import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { ReconnectSessionStore } from "@d-m4th/db";
import { ReconnectService, type ReconnectLogEvent, type ReconnectLogger } from "../src/reconnect-service";

interface LogEntry {
  event: ReconnectLogEvent;
  details: Record<string, unknown>;
}

describe("ReconnectService", () => {
  test("issues and resumes token with rotation", () => {
    const logs: LogEntry[] = [];
    const service = createService(logs);

    const issued = service.issue({ roomCode: "abcd", playerId: "player-1", nowMs: 1_000_000 });
    const resumed = service.resume({
      roomCode: "ABCD",
      playerId: "player-1",
      reconnectToken: issued.reconnectToken,
      nowMs: 1_000_100
    });

    expect(resumed.ok).toBe(true);
    if (!resumed.ok) {
      return;
    }

    expect(resumed.reconnectToken).not.toBe(issued.reconnectToken);
    expect(logs.map((log) => log.event)).toEqual(["issue", "rotate", "resume"]);
  });

  test("resumes token without explicit playerId", () => {
    const logs: LogEntry[] = [];
    const service = createService(logs);

    const issued = service.issue({ roomCode: "abcd", playerId: "player-1", nowMs: 1_000_000 });
    const resumed = service.resume({
      roomCode: "ABCD",
      reconnectToken: issued.reconnectToken,
      nowMs: 1_000_100
    });

    expect(resumed.ok).toBe(true);
    if (!resumed.ok) {
      return;
    }

    expect(resumed.playerId).toBe("player-1");
  });

  test("rejects cross-player takeover attempt", () => {
    const logs: LogEntry[] = [];
    const service = createService(logs);
    const issued = service.issue({ roomCode: "abcd", playerId: "player-1", nowMs: 2_000_000 });

    const resumed = service.resume({
      roomCode: "ABCD",
      playerId: "player-2",
      reconnectToken: issued.reconnectToken,
      nowMs: 2_000_050
    });

    expect(resumed.ok).toBe(false);
    if (resumed.ok) {
      return;
    }

    expect(resumed.status).toBe(409);
    expect(logs[1]?.event).toBe("takeover");
  });

  test("revokes expired token", () => {
    const logs: LogEntry[] = [];
    const service = createService(logs);
    const issued = service.issue({ roomCode: "abcd", playerId: "player-1", nowMs: 3_000_000 });

    const resumed = service.resume({
      roomCode: "ABCD",
      playerId: "player-1",
      reconnectToken: issued.reconnectToken,
      nowMs: 3_000_000 + 30 * 60 * 1000 + 1
    });

    expect(resumed.ok).toBe(false);
    if (resumed.ok) {
      return;
    }

    expect(resumed.status).toBe(401);
    expect(logs.some((log) => log.event === "revoke")).toBe(true);
  });

  test("accepts rapid repeated resume attempts with same old token", () => {
    const logs: LogEntry[] = [];
    const service = createService(logs);
    const issued = service.issue({ roomCode: "abcd", playerId: "player-1", nowMs: 4_000_000 });

    const firstResume = service.resume({
      roomCode: "ABCD",
      playerId: "player-1",
      reconnectToken: issued.reconnectToken,
      nowMs: 4_000_010
    });
    expect(firstResume.ok).toBe(true);
    if (!firstResume.ok) {
      return;
    }

    const replayedResume = service.resume({
      roomCode: "ABCD",
      playerId: "player-1",
      reconnectToken: issued.reconnectToken,
      nowMs: 4_000_020
    });
    expect(replayedResume.ok).toBe(true);
    if (!replayedResume.ok) {
      return;
    }

    expect(replayedResume.reconnectToken).toBe(firstResume.reconnectToken);

    const secondRotation = service.resume({
      roomCode: "ABCD",
      playerId: "player-1",
      reconnectToken: firstResume.reconnectToken,
      nowMs: 4_000_030
    });
    expect(secondRotation.ok).toBe(true);
    if (!secondRotation.ok) {
      return;
    }

    const replayedOlderTokenAfterSecondRotation = service.resume({
      roomCode: "ABCD",
      playerId: "player-1",
      reconnectToken: issued.reconnectToken,
      nowMs: 4_000_040
    });
    expect(replayedOlderTokenAfterSecondRotation.ok).toBe(true);
    if (!replayedOlderTokenAfterSecondRotation.ok) {
      return;
    }

    expect(replayedOlderTokenAfterSecondRotation.reconnectToken).toBe(secondRotation.reconnectToken);

    const expiredReplay = service.resume({
      roomCode: "ABCD",
      playerId: "player-1",
      reconnectToken: issued.reconnectToken,
      nowMs: 4_006_000
    });
    expect(expiredReplay.ok).toBe(false);
    if (expiredReplay.ok) {
      return;
    }

    expect(expiredReplay.status).toBe(401);
  });

  test("rejects takeover on replayed rotated token", () => {
    const logs: LogEntry[] = [];
    const service = createService(logs);
    const issued = service.issue({ roomCode: "abcd", playerId: "player-1", nowMs: 5_000_000 });

    const firstResume = service.resume({
      roomCode: "ABCD",
      playerId: "player-1",
      reconnectToken: issued.reconnectToken,
      nowMs: 5_000_010
    });
    expect(firstResume.ok).toBe(true);

    const takeover = service.resume({
      roomCode: "ABCD",
      playerId: "player-2",
      reconnectToken: issued.reconnectToken,
      nowMs: 5_000_020
    });

    expect(takeover.ok).toBe(false);
    if (takeover.ok) {
      return;
    }

    expect(takeover.status).toBe(409);
    expect(logs.some((log) => log.event === "takeover")).toBe(true);
  });
});

function createService(logs: LogEntry[]): ReconnectService {
  const store = new ReconnectSessionStore(new Database(":memory:"));
  const logger: ReconnectLogger = {
    log(event, details) {
      logs.push({ event, details });
    }
  };

  return new ReconnectService(store, logger);
}
