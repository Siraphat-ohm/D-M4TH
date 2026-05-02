import {
  RECONNECT_SESSION_TTL_MS,
  ReconnectSessionStore,
  hashToken,
  type ReconnectSessionRecord
} from "@d-m4th/db";

export type ReconnectLogEvent = "issue" | "resume" | "rotate" | "revoke" | "takeover";

export interface ReconnectLogger {
  log(event: ReconnectLogEvent, details: Record<string, unknown>): void;
}

export interface ResumeAttempt {
  roomCode: string;
  playerId?: string;
  reconnectToken: string;
  nowMs?: number;
}

const ROTATED_TOKEN_GRACE_MS = 5_000;

interface RecentRotation {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
  reconnectTokenHash: string;
  expiresAtMs: number;
  graceUntilMs: number;
}

export type ResumeResult =
  | {
      ok: true;
      roomCode: string;
      playerId: string;
      reconnectToken: string;
      expiresAtMs: number;
      previousTokenHash: string;
      nextTokenHash: string;
    }
  | {
      ok: false;
      status: 401 | 409;
      reason: string;
      roomCode?: string;
    };

export class ReconnectService {
  private readonly recentlyRotatedByTokenHash = new Map<string, RecentRotation>();

  constructor(
    private readonly store = new ReconnectSessionStore(),
    private readonly logger: ReconnectLogger = new JsonConsoleReconnectLogger()
  ) {}

  issue(input: { roomCode: string; playerId: string; nowMs?: number }): {
    roomCode: string;
    playerId: string;
    reconnectToken: string;
    expiresAtMs: number;
  } {
    const nowMs = input.nowMs ?? Date.now();
    const issued = this.store.issue({
      roomCode: input.roomCode,
      playerId: input.playerId,
      nowMs,
      ttlMs: RECONNECT_SESSION_TTL_MS
    });

    if (issued.revokedCount > 0) {
      this.logger.log("revoke", {
        reason: "replaced_on_issue",
        roomCode: issued.record.roomCode,
        playerId: issued.record.playerId,
        count: issued.revokedCount
      });
    }

    this.logger.log("issue", {
      roomCode: issued.record.roomCode,
      playerId: issued.record.playerId,
      expiresAtMs: issued.record.expiresAtMs
    });

    return {
      roomCode: issued.record.roomCode,
      playerId: issued.record.playerId,
      reconnectToken: issued.token,
      expiresAtMs: issued.record.expiresAtMs
    };
  }

  resume(attempt: ResumeAttempt): ResumeResult {
    const nowMs = attempt.nowMs ?? Date.now();
    this.sweepRecentRotations(nowMs);
    const existing = this.store.getByToken(attempt.reconnectToken);

    if (!existing) {
      const reused = this.resumeFromRecentRotation(attempt, nowMs);
      if (!reused) {
        return { ok: false, status: 401, reason: "Invalid reconnect token" };
      }
      return reused;
    }

    if (existing.expiresAtMs <= nowMs) {
      const revoked = this.store.revokeToken(attempt.reconnectToken);
      if (revoked) {
        this.logger.log("revoke", {
          reason: "expired",
          roomCode: existing.roomCode,
          playerId: existing.playerId,
          expiresAtMs: existing.expiresAtMs
        });
      }
      return { ok: false, status: 401, reason: "Reconnect token expired", roomCode: existing.roomCode };
    }

    if (existing.roomCode !== attempt.roomCode || (attempt.playerId !== undefined && existing.playerId !== attempt.playerId)) {
      this.logger.log("takeover", {
        boundRoomCode: existing.roomCode,
        boundPlayerId: existing.playerId,
        requestedRoomCode: attempt.roomCode,
        requestedPlayerId: attempt.playerId
      });
      return { ok: false, status: 409, reason: "Reconnect token does not match room/player binding", roomCode: existing.roomCode };
    }

    const rotated = this.store.rotate({
      currentToken: attempt.reconnectToken,
      nowMs,
      ttlMs: RECONNECT_SESSION_TTL_MS
    });

    if (!rotated.ok) {
      if (rotated.reason === "expired") {
        this.logger.log("revoke", {
          reason: "expired_during_rotate",
          roomCode: existing.roomCode,
          playerId: existing.playerId
        });
      }
      return { ok: false, status: 401, reason: "Reconnect token invalid", roomCode: existing.roomCode };
    }

    this.logger.log("rotate", {
      roomCode: rotated.next.roomCode,
      playerId: rotated.next.playerId,
      expiresAtMs: rotated.next.expiresAtMs
    });
    this.rememberRecentRotation(attempt.reconnectToken, rotated.nextToken, rotated.next.roomCode, rotated.next.playerId, rotated.next.expiresAtMs, nowMs);
    this.logger.log("resume", {
      roomCode: rotated.next.roomCode,
      playerId: rotated.next.playerId,
      expiresAtMs: rotated.next.expiresAtMs
    });

    return {
      ok: true,
      roomCode: rotated.next.roomCode,
      playerId: rotated.next.playerId,
      reconnectToken: rotated.nextToken,
      expiresAtMs: rotated.next.expiresAtMs,
      previousTokenHash: rotated.previous.tokenHash,
      nextTokenHash: rotated.next.tokenHash
    };
  }

  revokeByBinding(input: { roomCode: string; playerId: string; reason: string }): number {
    const revokedCount = this.store.revokeByBinding(input.roomCode, input.playerId);

    if (revokedCount > 0) {
      this.logger.log("revoke", {
        reason: input.reason,
        roomCode: input.roomCode.toUpperCase(),
        playerId: input.playerId,
        count: revokedCount
      });
    }

    return revokedCount;
  }

  close(): void {
    this.recentlyRotatedByTokenHash.clear();
    this.store.close();
  }

  private resumeFromRecentRotation(attempt: ResumeAttempt, nowMs: number): ResumeResult | undefined {
    const previousTokenHash = hashToken(attempt.reconnectToken);
    const recent = this.recentlyRotatedByTokenHash.get(previousTokenHash);
    if (!recent) {
      return undefined;
    }

    if (recent.graceUntilMs <= nowMs || recent.expiresAtMs <= nowMs) {
      this.recentlyRotatedByTokenHash.delete(previousTokenHash);
      return undefined;
    }

    if (
      recent.roomCode !== attempt.roomCode ||
      (attempt.playerId !== undefined && recent.playerId !== attempt.playerId)
    ) {
      this.logger.log("takeover", {
        boundRoomCode: recent.roomCode,
        boundPlayerId: recent.playerId,
        requestedRoomCode: attempt.roomCode,
        requestedPlayerId: attempt.playerId
      });
      return {
        ok: false,
        status: 409,
        reason: "Reconnect token does not match room/player binding",
        roomCode: recent.roomCode
      };
    }

    this.logger.log("resume", {
      roomCode: recent.roomCode,
      playerId: recent.playerId,
      expiresAtMs: recent.expiresAtMs,
      replayedToken: true
    });

    return {
      ok: true,
      roomCode: recent.roomCode,
      playerId: recent.playerId,
      reconnectToken: recent.reconnectToken,
      expiresAtMs: recent.expiresAtMs,
      previousTokenHash,
      nextTokenHash: recent.reconnectTokenHash
    };
  }

  private rememberRecentRotation(
    previousToken: string,
    reconnectToken: string,
    roomCode: string,
    playerId: string,
    expiresAtMs: number,
    nowMs: number
  ): void {
    const previousTokenHash = hashToken(previousToken);
    const reconnectTokenHash = hashToken(reconnectToken);

    this.recentlyRotatedByTokenHash.set(previousTokenHash, {
      roomCode,
      playerId,
      reconnectToken,
      reconnectTokenHash,
      expiresAtMs,
      graceUntilMs: nowMs + ROTATED_TOKEN_GRACE_MS
    });

    for (const recent of this.recentlyRotatedByTokenHash.values()) {
      if (recent.reconnectTokenHash !== previousTokenHash) {
        continue;
      }

      recent.reconnectToken = reconnectToken;
      recent.reconnectTokenHash = reconnectTokenHash;
      recent.expiresAtMs = expiresAtMs;
      recent.graceUntilMs = nowMs + ROTATED_TOKEN_GRACE_MS;
    }
  }

  private sweepRecentRotations(nowMs: number): void {
    for (const [tokenHash, recent] of this.recentlyRotatedByTokenHash) {
      if (recent.graceUntilMs <= nowMs || recent.expiresAtMs <= nowMs) {
        this.recentlyRotatedByTokenHash.delete(tokenHash);
      }
    }
  }
}

class JsonConsoleReconnectLogger implements ReconnectLogger {
  log(event: ReconnectLogEvent, details: Record<string, unknown>): void {
    console.info(
      JSON.stringify({
        scope: "reconnect",
        event,
        ...details,
        timestamp: new Date().toISOString()
      })
    );
  }
}

export function reconnectSessionFromRecord(record: ReconnectSessionRecord): {
  roomCode: string;
  playerId: string;
  expiresAtMs: number;
} {
  return {
    roomCode: record.roomCode,
    playerId: record.playerId,
    expiresAtMs: record.expiresAtMs
  };
}
