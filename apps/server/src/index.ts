import type { ServerWebSocket } from "bun";
import { RoomRegistry, type RoomConnection } from "./room-registry";

const PORT = Number(process.env.PORT ?? 2567);
const registry = new RoomRegistry();

interface SocketData {
  connection: RoomConnection;
}

Bun.serve<SocketData>({
  port: PORT,
  fetch(request, server) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }

    if (url.pathname === "/ws") {
      const connection: RoomConnection = {
        id: crypto.randomUUID(),
        send(message) {
          socketSend(connection.id, message);
        }
      };

      const upgraded = server.upgrade(request, { data: { connection } });
      return upgraded ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
    }

    return new Response("D-M4TH server. Connect to /ws.", {
      headers: { "content-type": "text/plain" }
    });
  },
  websocket: {
    open(socket) {
      socketRegistry.set(socket.data.connection.id, socket);
    },
    message(socket, message) {
      registry.handleRawMessage(socket.data.connection, String(message));
    },
    close(socket) {
      socketRegistry.delete(socket.data.connection.id);
      registry.disconnect(socket.data.connection);
    }
  }
});

const socketRegistry = new Map<string, ServerWebSocket<SocketData>>();

console.log(`D-M4TH server listening on http://localhost:${PORT}`);

function socketSend(connectionId: string, message: string): void {
  const socket = socketRegistry.get(connectionId);
  socket?.send(message);
}
