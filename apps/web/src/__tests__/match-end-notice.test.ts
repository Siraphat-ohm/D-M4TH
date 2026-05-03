import { describe, expect, test } from "bun:test";
import type { PublicSnapshot } from "@d-m4th/game";
import { buildMatchEndedNotice } from "../client/match-end-notice";

describe("match end notice", () => {
  test("shows a winner notice for a single winner", () => {
    const notice = buildMatchEndedNotice(createEndedSnapshot({
      endedReason: "player-left",
      winnerIds: ["p1"]
    }));

    expect(notice.text).toBe("Ada wins! Game ended: only one player remains.");
    expect(notice.tone).toBe("success");
    expect(notice.sticky).toBe(true);
  });

  test("shows a tie notice when multiple winners share first place", () => {
    const notice = buildMatchEndedNotice(createEndedSnapshot({
      endedReason: "exhausted-pass-cycle",
      winnerIds: ["p1", "p2"]
    }));

    expect(notice.text).toBe("Tie game! Game ended: all players passed.");
    expect(notice.tone).toBe("info");
    expect(notice.sticky).toBe(true);
  });
});

function createEndedSnapshot(overrides: Partial<PublicSnapshot>): PublicSnapshot {
  return {
    id: "match_1",
    code: "ABC123",
    status: "ended",
    config: {
      mode: "classical",
      boardSize: 15,
      premiumMapId: "scaled-classic",
      minPlayers: 2,
      maxPlayers: 2,
      rackSize: 8,
      totalTimeMs: 1_320_000,
      turnTimeMs: 180_000,
      incrementMs: 0,
      skillNodesEnabled: false
    },
    board: [],
    lastPlacements: [],
    players: [
      {
        id: "p1",
        name: "Ada",
        color: "#f97316",
        score: 100,
        rackCount: 0,
        remainingMs: 0,
        connected: true
      },
      {
        id: "p2",
        name: "Grace",
        color: "#2563eb",
        score: 100,
        rackCount: 0,
        remainingMs: 0,
        connected: true
      }
    ],
    playerOrder: ["p1", "p2"],
    currentPlayerId: "p1",
    tileBagCount: 0,
    consecutivePasses: 0,
    turnStartedAt: 0,
    endedReason: "player-left",
    winnerIds: ["p1"],
    ...overrides
  };
}
