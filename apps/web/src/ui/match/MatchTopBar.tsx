import { useEffect, useState, type CSSProperties } from "react";
import { LogOut } from "lucide-react";
import type { PublicSnapshot } from "@d-m4th/game";
import { formatSignedTime } from "@/ui/shared/format";
import { PlayerInfoList } from "@/ui/match/PlayerInfoList";
import { usePenaltyDelta } from "@/ui/match/usePenaltyDelta";

export function MatchTopBar(props: {
  snapshot?: PublicSnapshot;
  previewScore?: number;
  onLeaveMatch: () => void;
}) {
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    if (props.snapshot?.status !== "playing") return;

    setClockNow(Date.now());
    const id = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [props.snapshot?.status, props.snapshot?.turnStartedAt, props.snapshot?.currentPlayerId]);

  if (!props.snapshot) {
    return null;
  }

  const now = clockNow;
  const snapshot = props.snapshot;
  const activePlayer = snapshot.players.find((player) => player.id === snapshot.currentPlayerId);
  const activePlayerName = activePlayer?.name.trim() || "Player";
  const activePlayerColor = activePlayer?.color ?? "var(--panel-border)";

  const elapsed =
    snapshot.status === "playing" && activePlayer
      ? now - snapshot.turnStartedAt
      : 0;

  const turnRemaining =
    snapshot.status === "playing"
      ? snapshot.config.turnTimeMs - elapsed
      : 0;

  const visiblePenaltyDeltas = usePenaltyDelta(snapshot, now);
  const turnLabel = snapshot.status === "playing" ? "TURN TIMER" : snapshot.status.toLowerCase();

  return (
    <div
      className="topbar-content match-hud"
      style={{ "--active-player-color": activePlayerColor } as CSSProperties}
    >
      <PlayerInfoList
        snapshot={snapshot}
        previewScore={props.previewScore}
        penaltyDeltas={visiblePenaltyDeltas}
        now={now}
      />

      <div className="hud-metrics match-hud-status" aria-label="Match status">
        <div className="metric metric--turn" aria-label={`${activePlayerName}'s turn`}>
          <div className="turn-indicator">
            <p className="turn-name">{turnLabel}</p>
            <span
              className={`turn-time${turnRemaining < 0 ? " overtime" : ""}`}
              data-testid="turn-timer"
            >
              {formatSignedTime(turnRemaining)}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="leave-match-button"
          onClick={props.onLeaveMatch}
          aria-label="Leave match"
          title="Leave match"
        >
          <LogOut size={14} aria-hidden="true" />
          Leave
        </button>
      </div>
    </div>
  );
}
