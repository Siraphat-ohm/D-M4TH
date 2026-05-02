import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";

export const RECONNECT_SESSION_TTL_MS = 30 * 60 * 1000;

export interface ReconnectSessionRecord {
  tokenHash: string;
  roomCode: string;
  playerId: string;
  expiresAtMs: number;
  createdAtMs: number;
  updatedAtMs: number;
}

interface IssueReconnectSessionInput {
  roomCode: string;
  playerId: string;
  nowMs: number;
  ttlMs?: number;
}

interface RotateReconnectSessionInput {
  currentToken: string;
  nowMs: number;
  ttlMs?: number;
}

export class ReconnectSessionStore {
  private readonly selectByTokenHashQuery;
  private readonly deleteByTokenHashQuery;
  private readonly deleteByBindingQuery;
  private readonly insertSessionQuery;
  private readonly updateSessionTokenQuery;
  private readonly deleteExpiredQuery;

  constructor(
    private readonly db = new Database(
      process.env.RECONNECT_DB_PATH ?? "d-m4th.db",
    ),
  ) {
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS reconnect_sessions (
        token_hash TEXT PRIMARY KEY,
        room_code TEXT NOT NULL,
        player_id TEXT NOT NULL,
        expires_at_ms INTEGER NOT NULL,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );`,
    );
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_reconnect_sessions_room_player ON reconnect_sessions(room_code, player_id);",
    );
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_reconnect_sessions_expires_at ON reconnect_sessions(expires_at_ms);",
    );

    this.selectByTokenHashQuery = this.db.query(
      "SELECT token_hash, room_code, player_id, expires_at_ms, created_at_ms, updated_at_ms FROM reconnect_sessions WHERE token_hash = ?",
    );
    this.deleteByTokenHashQuery = this.db.query(
      "DELETE FROM reconnect_sessions WHERE token_hash = ?",
    );
    this.deleteByBindingQuery = this.db.query(
      "DELETE FROM reconnect_sessions WHERE room_code = ? AND player_id = ?",
    );
    this.insertSessionQuery = this.db.query(
      "INSERT INTO reconnect_sessions (token_hash, room_code, player_id, expires_at_ms, created_at_ms, updated_at_ms) VALUES (?, ?, ?, ?, ?, ?)",
    );
    this.updateSessionTokenQuery = this.db.query(
      "UPDATE reconnect_sessions SET token_hash = ?, expires_at_ms = ?, updated_at_ms = ? WHERE token_hash = ?",
    );
    this.deleteExpiredQuery = this.db.query(
      "DELETE FROM reconnect_sessions WHERE expires_at_ms <= ?",
    );
  }

  issue(input: IssueReconnectSessionInput): {
    token: string;
    record: ReconnectSessionRecord;
    revokedCount: number;
  } {
    const ttlMs = input.ttlMs ?? RECONNECT_SESSION_TTL_MS;
    const expiresAtMs = input.nowMs + ttlMs;
    const token = randomToken();
    const tokenHash = hashToken(token);

    this.cleanupExpired(input.nowMs);
    const revokedCount = Number(
      this.deleteByBindingQuery.run(
        input.roomCode.toUpperCase(),
        input.playerId,
      ).changes,
    );
    this.insertSessionQuery.run(
      tokenHash,
      input.roomCode.toUpperCase(),
      input.playerId,
      expiresAtMs,
      input.nowMs,
      input.nowMs,
    );

    return {
      token,
      revokedCount,
      record: {
        tokenHash,
        roomCode: input.roomCode.toUpperCase(),
        playerId: input.playerId,
        expiresAtMs,
        createdAtMs: input.nowMs,
        updatedAtMs: input.nowMs,
      },
    };
  }

  rotate(
    input: RotateReconnectSessionInput,
  ):
    | {
        ok: true;
        previous: ReconnectSessionRecord;
        nextToken: string;
        next: ReconnectSessionRecord;
      }
    | { ok: false; reason: "not_found" | "expired" } {
    const ttlMs = input.ttlMs ?? RECONNECT_SESSION_TTL_MS;
    const nowMs = input.nowMs;
    this.cleanupExpired(nowMs);

    const previous = this.getByToken(input.currentToken);
    if (!previous) {
      return { ok: false, reason: "not_found" };
    }

    if (previous.expiresAtMs <= nowMs) {
      this.deleteByTokenHashQuery.run(previous.tokenHash);
      return { ok: false, reason: "expired" };
    }

    const nextToken = randomToken();
    const nextTokenHash = hashToken(nextToken);
    const expiresAtMs = nowMs + ttlMs;

    this.updateSessionTokenQuery.run(
      nextTokenHash,
      expiresAtMs,
      nowMs,
      previous.tokenHash,
    );

    return {
      ok: true,
      previous,
      nextToken,
      next: {
        ...previous,
        tokenHash: nextTokenHash,
        expiresAtMs,
        updatedAtMs: nowMs,
      },
    };
  }

  getByToken(token: string): ReconnectSessionRecord | undefined {
    const row = this.selectByTokenHashQuery.get(hashToken(token));
    return rowToRecord(row);
  }

  revokeToken(token: string): boolean {
    const result = this.deleteByTokenHashQuery.run(hashToken(token));
    return Number(result.changes) > 0;
  }

  revokeByBinding(roomCode: string, playerId: string): number {
    return Number(
      this.deleteByBindingQuery.run(roomCode.toUpperCase(), playerId).changes,
    );
  }

  cleanupExpired(nowMs: number): number {
    return Number(this.deleteExpiredQuery.run(nowMs).changes);
  }

  close(): void {
    this.db.close();
  }
}

function rowToRecord(row: unknown): ReconnectSessionRecord | undefined {
  if (!row || typeof row !== "object") {
    return undefined;
  }

  const data = row as Record<string, unknown>;
  return {
    tokenHash: String(data.token_hash),
    roomCode: String(data.room_code),
    playerId: String(data.player_id),
    expiresAtMs: Number(data.expires_at_ms),
    createdAtMs: Number(data.created_at_ms),
    updatedAtMs: Number(data.updated_at_ms),
  };
}

function randomToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
