import type { ServerWebSocket } from "bun";
import {
  parseClientMessage,
  encodeServerMessage,
  parseReconnectIssueRequest,
  parseReconnectResumeRequest,
  type ReconnectResumeRequest
} from "@d-m4th/protocol";
import { ReconnectService } from "./reconnect-service";
import { RoomRegistry, type RoomConnection } from "./room-registry";

const PORT = Number(process.env.PORT ?? 2567);

interface SocketData {
  connection: RoomConnection;
  reconnectAttempt?: ReconnectResumeRequest;
}

export function startServer() {
  const reconnectService = new ReconnectService();
  const registry = new RoomRegistry(
    undefined,
    (roomCode, playerId) => {
      const issued = reconnectService.issue({ roomCode, playerId });
      return issued.reconnectToken;
    },
    (roomCode, playerId, reason) => {
      reconnectService.revokeByBinding({ roomCode, playerId, reason });
    }
  );
  const socketRegistry = new Map<string, ServerWebSocket<SocketData>>();

  const server = Bun.serve<SocketData>(
    createServerApp({
      registry,
      reconnectService,
      socketRegistry
    })
  );

  console.log(`D-M4TH server listening on http://localhost:${PORT}`);

  process.on("SIGINT", () => {
    reconnectService.close();
    server.stop();
    process.exit(0);
  });

  return server;
}

interface CreateServerAppOptions {
  registry: RoomRegistry;
  reconnectService: ReconnectService;
  socketRegistry: Map<string, ServerWebSocket<SocketData>>;
}

export function createServerApp({ registry, reconnectService, socketRegistry }: CreateServerAppOptions) {
  const app = {
    port: PORT,
    fetch: async (request, server) => {
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return Response.json({ ok: true });
      }

      if (url.pathname === "/api/reconnect/issue") {
        if (request.method !== "POST") {
          return new Response("Method Not Allowed", { status: 405 });
        }

        return handleReconnectIssueRequest(request, registry, reconnectService);
      }

      if (url.pathname === "/api/reconnect/resume") {
        if (request.method !== "POST") {
          return new Response("Method Not Allowed", { status: 405 });
        }

        return handleReconnectResumeRequest(request, registry, reconnectService);
      }

      if (url.pathname === "/ws") {
        const reconnectAttempt = parseReconnectAttempt(url);
        if (reconnectAttempt instanceof Error) {
          return Response.json({ error: reconnectAttempt.message }, { status: 400 });
        }

        const connection: RoomConnection = {
          id: crypto.randomUUID(),
          send(message) {
            socketSend(connection.id, message, socketRegistry);
          }
        };

        const upgraded = server.upgrade(request, {
          data: { connection, reconnectAttempt }
        });
        return upgraded ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
      }

      return new Response("D-M4TH server. Connect to /ws.", {
        headers: { "content-type": "text/plain" }
      });
    },
    websocket: {
      open(socket) {
        socketRegistry.set(socket.data.connection.id, socket);
        const reconnectAttempt = socket.data.reconnectAttempt;
        if (reconnectAttempt) {
          resumeConnectionFromSocket(socket, reconnectAttempt, registry, reconnectService);
        }
      },
      message(socket, message) {
        const resumeMessage = readResumeMessage(String(message));
        if (resumeMessage) {
          resumeConnectionFromSocket(
            socket,
            {
              roomCode: resumeMessage.code,
              reconnectToken: resumeMessage.reconnectToken,
              playerId: undefined
            },
            registry,
            reconnectService,
            resumeMessage.requestId
          );
          return;
        }

        registry.handleRawMessage(socket.data.connection, String(message));
      },
      close(socket) {
        socketRegistry.delete(socket.data.connection.id);
        registry.disconnect(socket.data.connection);
      }
    }
  } satisfies Parameters<typeof Bun.serve<SocketData>>[0];

  return app;
}

if (import.meta.main) {
  startServer();
}

export async function handleReconnectIssueRequest(
  request: Request,
  registry: RoomRegistry,
  reconnectService: ReconnectService
): Promise<Response> {
  try {
    const parsed = parseReconnectIssueRequest(await request.json());

    const room = registry.getRoom(parsed.roomCode);
    if (!room || !registry.hasPlayer(parsed.roomCode, parsed.playerId)) {
      reconnectService.revokeByBinding({ roomCode: parsed.roomCode, playerId: parsed.playerId, reason: "room_missing" });
      return Response.json({ error: "Room no longer available" }, { status: 410 });
    }

    return Response.json(reconnectService.issue(parsed));
  } catch (error) {
    return badRequest(error);
  }
}

export async function handleReconnectResumeRequest(
  request: Request,
  registry: RoomRegistry,
  reconnectService: ReconnectService
): Promise<Response> {
  try {
    const parsed = parseReconnectResumeRequest(await request.json());
    const resumed = reconnectService.resume(parsed);

    if (!resumed.ok) {
      return Response.json({ error: resumed.reason, roomCode: resumed.roomCode }, { status: resumed.status });
    }

    const room = registry.getRoom(resumed.roomCode);
    if (!room || !registry.hasPlayer(resumed.roomCode, resumed.playerId)) {
      reconnectService.revokeByBinding({
        roomCode: resumed.roomCode,
        playerId: resumed.playerId,
        reason: "room_missing"
      });
      return Response.json({ error: "Room no longer available", roomCode: resumed.roomCode }, { status: 410 });
    }

    return Response.json({
      roomCode: resumed.roomCode,
      playerId: resumed.playerId,
      reconnectToken: resumed.reconnectToken,
      expiresAtMs: resumed.expiresAtMs
    });
  } catch (error) {
    return badRequest(error);
  }
}

function resumeConnectionFromSocket(
  socket: ServerWebSocket<SocketData>,
  reconnectAttempt: ReconnectResumeRequest,
  registry: RoomRegistry,
  reconnectService: ReconnectService,
  requestId?: string
): void {
  const resumed = reconnectService.resume(reconnectAttempt);

  if (!resumed.ok) {
    socket.send(
      encodeServerMessage({
        type: "action:rejected",
        requestId,
        reason: resumed.reason,
        statusCode: resumed.status,
        roomCode: resumed.roomCode
      })
    );
    socket.close();
    return;
  }

  const resumedInRoom = registry.resumeConnection(socket.data.connection, resumed.roomCode, resumed.playerId);
  if (!resumedInRoom) {
    reconnectService.revokeByBinding({ roomCode: resumed.roomCode, playerId: resumed.playerId, reason: "room_missing" });
    socket.send(
      encodeServerMessage({
        type: "action:rejected",
        requestId,
        reason: "Room no longer available",
        statusCode: 410,
        roomCode: resumed.roomCode
      })
    );
    socket.close();
    return;
  }

  socket.send(
    encodeServerMessage({
      type: "action:accepted",
      requestId: requestId ?? `resume:${crypto.randomUUID()}`,
      action: "room:resume",
      roomCode: resumed.roomCode,
      reconnectToken: resumed.reconnectToken
    })
  );
}

function parseReconnectAttempt(url: URL): ReconnectResumeRequest | Error | undefined {
  const roomCode = url.searchParams.get("roomCode");
  const playerId = url.searchParams.get("playerId");
  const reconnectToken = url.searchParams.get("reconnectToken");

  const hasAny = roomCode !== null || playerId !== null || reconnectToken !== null;
  if (!hasAny) {
    return undefined;
  }

  if (!roomCode || !reconnectToken) {
    return new Error("roomCode and reconnectToken are required for reconnect");
  }

  return { roomCode: roomCode.toUpperCase(), playerId: playerId ?? undefined, reconnectToken };
}

function badRequest(error: unknown): Response {
  return Response.json(
    {
      error: error instanceof Error ? error.message : "Invalid request"
    },
    { status: 400 }
  );
}

function readResumeMessage(rawMessage: string): Extract<ReturnType<typeof parseClientMessage>, { type: "room:resume" }> | undefined {
  try {
    const parsed = parseClientMessage(rawMessage);
    return parsed.type === "room:resume" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function socketSend(
  connectionId: string,
  message: string,
  socketRegistry: Map<string, ServerWebSocket<SocketData>>
): void {
  const socket = socketRegistry.get(connectionId);
  socket?.send(message);
}
