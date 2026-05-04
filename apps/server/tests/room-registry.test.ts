import { describe, expect, test } from "bun:test";
import { RoomRegistry, type RoomConnection } from "../src/room-registry";
import type { ServerMessage } from "@d-m4th/protocol";
import { createPartyConfig } from "@d-m4th/config";

describe("room registry", () => {
  test("creates and joins rooms by code while isolating private racks", () => {
    const registry = new RoomRegistry();
    const host = createConnection("host");
    const guest = createConnection("guest");

    registry.handleRawMessage(host, JSON.stringify({ type: "room:create", requestId: "1", name: "Ada", color: "#f97316" }));
    const roomCode = lastSnapshot(host).snapshot.code;

    registry.handleRawMessage(guest, JSON.stringify({ type: "room:join", requestId: "2", code: roomCode, name: "Grace", color: "#2563eb" }));
    registry.handleRawMessage(host, JSON.stringify({ type: "match:start", requestId: "3" }));

    const hostSnapshot = lastSnapshot(host);
    const guestSnapshot = lastSnapshot(guest);

    expect(hostSnapshot.private?.rack).toHaveLength(8);
    expect(guestSnapshot.private?.rack).toHaveLength(8);
    expect(hostSnapshot.private?.playerId).not.toBe(guestSnapshot.private?.playerId);
    expect(hostSnapshot.snapshot.players.every((player) => player.rackCount === 8)).toBe(true);
  });

  test("ghost placement does not commit board state", () => {
    const registry = new RoomRegistry();
    const host = createConnection("host");
    const guest = createConnection("guest");

    registry.handleRawMessage(host, JSON.stringify({ type: "room:create", requestId: "1", name: "Ada", color: "#f97316" }));
    const roomCode = lastSnapshot(host).snapshot.code;
    registry.handleRawMessage(guest, JSON.stringify({ type: "room:join", requestId: "2", code: roomCode, name: "Grace", color: "#2563eb" }));
    registry.handleRawMessage(host, JSON.stringify({ type: "match:start", requestId: "3" }));

    const rack = lastSnapshot(host).private?.rack ?? [];
    registry.handleRawMessage(
      host,
      JSON.stringify({ type: "placement:draft", requestId: "4", placements: [{ tileId: rack[0].id, x: 7, y: 7 }] })
    );

    const presenceMessage = guest.messages.find((m) => m.type === "room:presence") as Extract<ServerMessage, { type: "room:presence" }>;

    expect(lastSnapshot(guest).snapshot.board).toHaveLength(0);
    expect(presenceMessage).toBeDefined();
    expect(presenceMessage.ghostPlacements[0].placements).toHaveLength(1);
  });

  test("resumeConnection reattaches existing player identity", () => {
    const registry = new RoomRegistry();
    const host = createConnection("host");
    const resumed = createConnection("host-resumed");

    registry.handleRawMessage(host, JSON.stringify({ type: "room:create", requestId: "1", name: "Ada", color: "#f97316" }));

    const snapshot = lastSnapshot(host);
    const roomCode = snapshot.snapshot.code;
    const playerId = snapshot.private?.playerId;
    expect(playerId).toBeString();

    const resumedOk = registry.resumeConnection(resumed, roomCode, playerId!);
    expect(resumedOk).toBe(true);

    const resumedSnapshot = lastSnapshot(resumed);
    expect(resumedSnapshot.private?.playerId).toBe(playerId);
    expect(resumedSnapshot.snapshot.players.find((player) => player.id === playerId)?.connected).toBe(true);
  });

  test("normal disconnect marks player disconnected without leaving or ending the match", () => {
    const registry = new RoomRegistry();
    const host = createConnection("host");
    const guest = createConnection("guest");

    registry.handleRawMessage(host, JSON.stringify({ type: "room:create", requestId: "1", name: "Ada", color: "#f97316" }));
    const roomCode = lastSnapshot(host).snapshot.code;
    registry.handleRawMessage(guest, JSON.stringify({ type: "room:join", requestId: "2", code: roomCode, name: "Grace", color: "#2563eb" }));
    registry.handleRawMessage(host, JSON.stringify({ type: "match:start", requestId: "3" }));

    const guestId = lastSnapshot(guest).private?.playerId;
    expect(guestId).toBeString();

    registry.disconnect(guest);

    const snapshot = lastSnapshot(host).snapshot;
    const disconnectedGuest = snapshot.players.find((player) => player.id === guestId);
    expect(snapshot.status).toBe("playing");
    expect(disconnectedGuest?.connected).toBe(false);
    expect(disconnectedGuest?.left).not.toBe(true);

    const resumed = createConnection("guest-resumed");
    const resumedOk = registry.resumeConnection(resumed, roomCode, guestId!);
    expect(resumedOk).toBe(true);
    expect(lastSnapshot(resumed).snapshot.players.find((player) => player.id === guestId)?.connected).toBe(true);
  });

  test("room leave marks player left and ends a two-player match", () => {
    const revoked: Array<{ roomCode: string; playerId: string; reason: string }> = [];
    const registry = new RoomRegistry(
      undefined,
      (roomCode, playerId) => `${roomCode}:${playerId}:token`,
      (roomCode, playerId, reason) => revoked.push({ roomCode, playerId, reason })
    );
    const host = createConnection("host");
    const guest = createConnection("guest");

    registry.handleRawMessage(host, JSON.stringify({ type: "room:create", requestId: "1", name: "Ada", color: "#f97316" }));
    const roomCode = lastSnapshot(host).snapshot.code;
    registry.handleRawMessage(guest, JSON.stringify({ type: "room:join", requestId: "2", code: roomCode, name: "Grace", color: "#2563eb" }));
    registry.handleRawMessage(host, JSON.stringify({ type: "match:start", requestId: "3" }));

    const guestId = lastSnapshot(guest).private?.playerId;
    expect(guestId).toBeString();

    registry.handleRawMessage(guest, JSON.stringify({ type: "room:leave", requestId: "4" }));

    const snapshot = lastSnapshot(host).snapshot;
    const leftGuest = snapshot.players.find((player) => player.id === guestId);
    expect(snapshot.status).toBe("ended");
    expect(snapshot.endedReason).toBe("player-left");
    expect(snapshot.winnerIds).toEqual([snapshot.currentPlayerId!]);
    expect(leftGuest?.connected).toBe(false);
    expect(leftGuest?.left).toBe(true);
    expect(registry.resumeConnection(createConnection("guest-resumed"), roomCode, guestId!)).toBe(false);
    expect(revoked).toContainEqual({ roomCode, playerId: guestId!, reason: "intentional_leave" });
  });

  test("only host can configure the room in lobby", () => {
    const registry = new RoomRegistry();
    const host = createConnection("host");
    const guest = createConnection("guest");

    registry.handleRawMessage(host, JSON.stringify({ type: "room:create", requestId: "1", name: "Ada", color: "#f97316" }));
    const roomCode = lastSnapshot(host).snapshot.code;
    registry.handleRawMessage(guest, JSON.stringify({ type: "room:join", requestId: "2", code: roomCode, name: "Grace", color: "#2563eb" }));

    registry.handleRawMessage(
      guest,
      JSON.stringify({ type: "match:configure", requestId: "3", config: createPartyConfig({ boardSize: 19, maxPlayers: 4 }) })
    );

    const rejection = lastRejected(guest);
    expect(rejection.reason).toBe("Only the host can configure the room");
    expect(lastSnapshot(host).snapshot.config.boardSize).toBe(15);
    expect(lastSnapshot(host).snapshot.config.maxPlayers).toBe(2);
  });

  test("only host can start the match", () => {
    const registry = new RoomRegistry();
    const host = createConnection("host");
    const guest = createConnection("guest");

    registry.handleRawMessage(host, JSON.stringify({ type: "room:create", requestId: "1", name: "Ada", color: "#f97316" }));
    const roomCode = lastSnapshot(host).snapshot.code;
    registry.handleRawMessage(guest, JSON.stringify({ type: "room:join", requestId: "2", code: roomCode, name: "Grace", color: "#2563eb" }));

    registry.handleRawMessage(guest, JSON.stringify({ type: "match:start", requestId: "3" }));

    const rejection = lastRejected(guest);
    expect(rejection.reason).toBe("Only the host can start the match");
    expect(lastSnapshot(host).snapshot.status).toBe("lobby");
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

function lastRejected(connection: { messages: ServerMessage[] }): Extract<ServerMessage, { type: "action:rejected" }> {
  const rejection = [...connection.messages].reverse().find((message: ServerMessage) => message.type === "action:rejected");

  if (!rejection || rejection.type !== "action:rejected") {
    throw new Error("rejection missing");
  }

  return rejection;
}
