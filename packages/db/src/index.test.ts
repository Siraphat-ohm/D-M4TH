import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { ReconnectSessionStore, hashToken } from "./index";

describe("ReconnectSessionStore", () => {
  test("stores only hashed token and rotates on resume", () => {
    const db = new Database(":memory:");
    const store = new ReconnectSessionStore(db);
    const nowMs = 1_000_000;

    const issued = store.issue({ roomCode: "abcd", playerId: "p1", nowMs });

    const rawRows = db
      .query("SELECT token_hash, room_code, player_id, expires_at_ms FROM reconnect_sessions")
      .all() as Array<{ token_hash: string; room_code: string; player_id: string; expires_at_ms: number }>;

    expect(rawRows).toHaveLength(1);
    expect(rawRows[0]?.token_hash).toBe(hashToken(issued.token));
    expect(rawRows[0]?.token_hash).not.toBe(issued.token);
    expect(rawRows[0]?.room_code).toBe("ABCD");

    const rotated = store.rotate({ currentToken: issued.token, nowMs: nowMs + 1000 });
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) {
      return;
    }

    expect(rotated.nextToken).not.toBe(issued.token);
    expect(store.getByToken(issued.token)).toBeUndefined();
    expect(store.getByToken(rotated.nextToken)?.playerId).toBe("p1");

    store.close();
  });
});
