import { useEffect, useRef, useState } from "react";
import { LogOut, Package } from "lucide-react";
import type { PublicSnapshot } from "@d-m4th/game";
import { formatTime } from "./format";
import { PlayerInfoList } from "./PlayerInfoList";

const PENALTY_DELTA_VISIBLE_MS = 5000;
const TIMEOUT_PENALTY_POINTS = 10;

interface PenaltyDelta {
  points: number;
  expiresAt: number;
}

export function MatchTopBar(props: { snapshot?: PublicSnapshot; previewScore?: number; onLeaveMatch: () => void }) {
  const [clockNow, setClockNow] = useState(() => Date.now());
  const previousScoresRef = useRef<Map<string, number>>(new Map());
  const shownPenaltyKeysRef = useRef<Set<string>>(new Set());
  const [penaltyDeltas, setPenaltyDeltas] = useState<Record<string, PenaltyDelta>>({});

  useEffect(() => {
    if (props.snapshot?.status !== "playing") return;

    setClockNow(Date.now());
    const id = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [props.snapshot?.status, props.snapshot?.turnStartedAt, props.snapshot?.currentPlayerId]);

  useEffect(() => {
    const snapshot = props.snapshot;
    if (!snapshot) return;

    const now = Date.now();
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
  }, [props.snapshot]);

  if (!props.snapshot) {
    return null;
  }

  const now = clockNow;
  const activePlayer = props.snapshot.players.find((player) => player.id === props.snapshot?.currentPlayerId);
  const elapsed = props.snapshot.status === "playing" && activePlayer
    ? Math.max(0, now - props.snapshot.turnStartedAt)
    : 0;
  const turnRemaining = props.snapshot.status === "playing"
    ? Math.max(0, props.snapshot.config.turnTimeMs - elapsed)
    : 0;
  const visiblePenaltyDeltas = toVisiblePenaltyPoints(penaltyDeltas, now);

  return (
    <div className="topbar-content">
      <PlayerInfoList snapshot={props.snapshot} previewScore={props.previewScore} penaltyDeltas={visiblePenaltyDeltas} now={now} />
      <div className="hud-metrics">
        <div className="metric metric--turn">
          <div className="turn-indicator">
            <strong className="turn-name" style={{ color: activePlayer?.color }}>
              {activePlayer ? `${activePlayer.name.toUpperCase()}'S TURN` : "TURN"}
            </strong>
            <span className="turn-time" style={{ color: activePlayer?.color }}>
              {formatTime(turnRemaining)}
            </span>
          </div>
        </div>
        <div className="metric">
          <Package size={14} aria-hidden="true" />
          <span className="hud-label">Bag</span>
          <strong className="hud-value">{props.snapshot.tileBagCount}</strong>
        </div>
        <button type="button" className="leave-match-button" onClick={props.onLeaveMatch}>
          <LogOut size={14} aria-hidden="true" />
          Leave
        </button>
      </div>
    </div>
  );
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
