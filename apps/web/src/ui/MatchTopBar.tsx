import { useEffect, useState } from "react";
import { LogOut, Package } from "lucide-react";
import type { PublicSnapshot } from "@d-m4th/game";
import { formatTime } from "./format";
import { PlayerInfoList } from "./PlayerInfoList";
import { usePenaltyDelta } from "./usePenaltyDelta";

export function MatchTopBar(props: { snapshot?: PublicSnapshot; previewScore?: number; onLeaveMatch: () => void }) {
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    if (props.snapshot?.status !== "playing") return;

    setClockNow(Date.now());
    const id = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [props.snapshot?.status, props.snapshot?.turnStartedAt, props.snapshot?.currentPlayerId]);

  const now = clockNow;
  const visiblePenaltyDeltas = usePenaltyDelta(props.snapshot, now);

  if (!props.snapshot) {
    return null;
  }

  const activePlayer = props.snapshot.players.find((player) => player.id === props.snapshot?.currentPlayerId);
  const elapsed = props.snapshot.status === "playing" && activePlayer
    ? Math.max(0, now - props.snapshot.turnStartedAt)
    : 0;
  const turnRemaining = props.snapshot.status === "playing"
    ? Math.max(0, props.snapshot.config.turnTimeMs - elapsed)
    : 0;

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
