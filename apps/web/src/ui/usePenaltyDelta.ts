import { useEffect, useRef, useState } from "react";
import type { PublicSnapshot } from "@d-m4th/game";

const PENALTY_DELTA_VISIBLE_MS = 5000;
const TIMEOUT_PENALTY_POINTS = 10;

interface PenaltyDelta {
  points: number;
  expiresAt: number;
}

export function usePenaltyDelta(snapshot: PublicSnapshot | undefined, now: number): Record<string, number> {
  const previousScoresRef = useRef<Map<string, number>>(new Map());
  const shownPenaltyKeysRef = useRef<Set<string>>(new Set());
  const [penaltyDeltas, setPenaltyDeltas] = useState<Record<string, PenaltyDelta>>({});

  useEffect(() => {
    if (!snapshot) return;

    setPenaltyDeltas((current) => {
      const next = keepVisiblePenaltyDeltas(current, now);
      for (const player of snapshot.players) {
        const previousScore = previousScoresRef.current.get(player.id);
        const detectedPenalty = previousScore !== undefined && previousScore - player.score === TIMEOUT_PENALTY_POINTS
          ? TIMEOUT_PENALTY_POINTS
          : undefined;
        const points = player.lastPenaltyPoints ?? detectedPenalty;
        const penaltyKey = points !== undefined ? `${player.id}:${player.score}:${points}` : undefined;

        if (points !== undefined && points > 0 && penaltyKey && !shownPenaltyKeysRef.current.has(penaltyKey)) {
          shownPenaltyKeysRef.current.add(penaltyKey);
          next[player.id] = { points, expiresAt: now + PENALTY_DELTA_VISIBLE_MS };
        }
      }
      return next;
    });

    previousScoresRef.current = new Map(snapshot.players.map((player) => [player.id, player.score]));
  }, [now, snapshot]);

  return toVisiblePenaltyPoints(penaltyDeltas, now);
}

function keepVisiblePenaltyDeltas(deltas: Record<string, PenaltyDelta>, now: number): Record<string, PenaltyDelta> {
  return Object.fromEntries(Object.entries(deltas).filter(([, delta]) => delta.expiresAt > now));
}

function toVisiblePenaltyPoints(deltas: Record<string, PenaltyDelta>, now: number): Record<string, number> {
  return Object.fromEntries(
    Object.entries(deltas)
      .filter(([, delta]) => delta.expiresAt > now)
      .map(([playerId, delta]) => [playerId, delta.points])
  );
}
