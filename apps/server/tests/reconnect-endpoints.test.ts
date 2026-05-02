import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import type { ServerMessage } from "@d-m4th/protocol";
import { ReconnectSessionStore } from "@d-m4th/db";
import { handleReconnectIssueRequest, handleReconnectResumeRequest } from "../src/index";
import { ReconnectService, type ReconnectLogger } from "../src/reconnect-service";
import { RoomRegistry, type RoomConnection } from "../src/room-registry";

describe("reconnect HTTP endpoints", () => {
  test("issues and resumes reconnect token", async () => {
    const logger: ReconnectLogger = { log() {} };
    const reconnectService = new ReconnectService(new ReconnectSessionStore(new Database(":memory:")), logger);
    const registry = new RoomRegistry(undefined, (roomCode, playerId) => reconnectService.issue({ roomCode, playerId }).reconnectToken);

    const host = createConnection("host");
    registry.handleRawMessage(host, JSON.stringify({ type: "room:create", requestId: "1", name: "Ada", color: "#f97316" }));

    const snapshot = lastSnapshot(host);
    const playerId = snapshot.private?.playerId;
    expect(playerId).toBeString();

    const issueResponse = await handleReconnectIssueRequest(
      new Request("http://localhost/api/reconnect/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomCode: snapshot.snapshot.code, playerId })
      }),
      registry,
      reconnectService
    );
    expect(issueResponse.status).toBe(200);

    const issueJson = (await issueResponse.json()) as { reconnectToken: string; expiresAtMs: number };
    expect(issueJson.reconnectToken).toBeString();

    const takeoverResponse = await handleReconnectResumeRequest(
      new Request("http://localhost/api/reconnect/resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomCode: snapshot.snapshot.code, playerId: "other-player", reconnectToken: issueJson.reconnectToken })
      }),
      registry,
      reconnectService
    );
    expect(takeoverResponse.status).toBe(409);

    const resumeResponse = await handleReconnectResumeRequest(
      new Request("http://localhost/api/reconnect/resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomCode: snapshot.snapshot.code, playerId, reconnectToken: issueJson.reconnectToken })
      }),
      registry,
      reconnectService
    );
    expect(resumeResponse.status).toBe(200);

    const resumeJson = (await resumeResponse.json()) as { reconnectToken: string };
    expect(resumeJson.reconnectToken).toBeString();
    expect(resumeJson.reconnectToken).not.toBe(issueJson.reconnectToken);

    const issueResponseWithoutPlayer = await handleReconnectIssueRequest(
      new Request("http://localhost/api/reconnect/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomCode: snapshot.snapshot.code, playerId })
      }),
      registry,
      reconnectService
    );
    const issueWithoutPlayerJson = (await issueResponseWithoutPlayer.json()) as { reconnectToken: string };

    const resumeWithoutPlayerResponse = await handleReconnectResumeRequest(
      new Request("http://localhost/api/reconnect/resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomCode: snapshot.snapshot.code, reconnectToken: issueWithoutPlayerJson.reconnectToken })
      }),
      registry,
      reconnectService
    );
    expect(resumeWithoutPlayerResponse.status).toBe(200);
  });

  test("returns 410 when room is missing on resume", async () => {
    const logger: ReconnectLogger = { log() {} };
    const reconnectService = new ReconnectService(new ReconnectSessionStore(new Database(":memory:")), logger);
    const registry = new RoomRegistry();

    const issued = reconnectService.issue({ roomCode: "lost", playerId: "player-1" });

    const response = await handleReconnectResumeRequest(
      new Request("http://localhost/api/reconnect/resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomCode: "LOST", playerId: "player-1", reconnectToken: issued.reconnectToken })
      }),
      registry,
      reconnectService
    );

    expect(response.status).toBe(410);
  });

  test("accepts repeated resume requests with same prior token during refresh storm", async () => {
    const logger: ReconnectLogger = { log() {} };
    const reconnectService = new ReconnectService(new ReconnectSessionStore(new Database(":memory:")), logger);
    const registry = new RoomRegistry(undefined, (roomCode, playerId) => reconnectService.issue({ roomCode, playerId }).reconnectToken);

    const host = createConnection("host");
    registry.handleRawMessage(host, JSON.stringify({ type: "room:create", requestId: "1", name: "Ada", color: "#f97316" }));
    const snapshot = lastSnapshot(host);
    const playerId = snapshot.private?.playerId;
    expect(playerId).toBeString();

    const issued = reconnectService.issue({ roomCode: snapshot.snapshot.code, playerId: playerId! });
    const resumeBody = JSON.stringify({
      roomCode: snapshot.snapshot.code,
      playerId,
      reconnectToken: issued.reconnectToken
    });

    const first = await handleReconnectResumeRequest(
      new Request("http://localhost/api/reconnect/resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: resumeBody
      }),
      registry,
      reconnectService
    );
    expect(first.status).toBe(200);
    const firstJson = (await first.json()) as { reconnectToken: string };
    expect(firstJson.reconnectToken).toBeString();

    const second = await handleReconnectResumeRequest(
      new Request("http://localhost/api/reconnect/resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: resumeBody
      }),
      registry,
      reconnectService
    );
    expect(second.status).toBe(200);
    const secondJson = (await second.json()) as { reconnectToken: string };
    expect(secondJson.reconnectToken).toBe(firstJson.reconnectToken);
  });
});

function createConnection(id: string): RoomConnection & { messages: ServerMessage[] } {
  return {
    id,
    messages: [],
    send(message) {
      this.messages.push(JSON.parse(message) as ServerMessage);
    }
  };
}

function lastSnapshot(connection: { messages: ServerMessage[] }): Extract<ServerMessage, { type: "room:snapshot" }> {
  const snapshot = [...connection.messages].reverse().find((message: ServerMessage) => message.type === "room:snapshot");

  if (!snapshot || snapshot.type !== "room:snapshot") {
    throw new Error("snapshot missing");
  }

  return snapshot;
}
