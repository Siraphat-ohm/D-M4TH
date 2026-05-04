import { useEffect, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, LogOut, PanelLeft } from "lucide-react";
import type { PublicSnapshot, Tile } from "@d-m4th/game";
import { BagSummary } from "@/ui/match/BagSummary";
import { formatSignedTime } from "@/ui/shared/format";
import { PlayerInfoList } from "@/ui/match/PlayerInfoList";
import { usePenaltyDelta } from "@/ui/match/usePenaltyDelta";

export function MatchTopBar(props: {
  snapshot?: PublicSnapshot;
  rack: readonly Tile[];
  previewScore?: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
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

  return (
    <div
      className={`match-sidebar${props.collapsed ? " match-sidebar--collapsed" : ""}`}
      style={{ "--active-player-color": activePlayerColor } as CSSProperties}
    >
      <button
        type="button"
        className="match-sidebar__toggle"
        aria-label={props.collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!props.collapsed}
        onClick={props.onToggleCollapsed}
      >
        {props.collapsed ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronLeft size={16} aria-hidden="true" />}
        <PanelLeft size={14} aria-hidden="true" />
        <span className="match-sidebar__toggle-label">
          {props.collapsed ? "Panel" : "Hide Panel"}
        </span>
      </button>

      {!props.collapsed && (
        <>
          <div className="match-sidebar__section match-sidebar__turn-card" aria-label={`${activePlayerName}'s turn`}>
            <p className="match-sidebar__label">Turn Time</p>
            <div className="match-sidebar__turn-playerline">
              <span className="match-sidebar__turn-swatch" />
              <p className="match-sidebar__player">{activePlayerName}</p>
            </div>
            <span
              className={`turn-time${turnRemaining < 0 ? " overtime" : ""}`}
              data-testid="turn-timer"
            >
              {formatSignedTime(turnRemaining)}
            </span>
          </div>

          <BagSummary snapshot={snapshot} rack={props.rack} />

          <div className="match-sidebar__section match-sidebar__players">
            <p className="match-sidebar__label">Players Info</p>
            <PlayerInfoList
              snapshot={snapshot}
              previewScore={props.previewScore}
              penaltyDeltas={visiblePenaltyDeltas}
              now={now}
            />
          </div>

          <div className="match-sidebar__spacer" aria-hidden="true" />

          <button
            type="button"
            className="leave-match-button match-sidebar__leave"
            onClick={props.onLeaveMatch}
            aria-label="Leave match"
            title="Leave match"
          >
            <LogOut size={14} aria-hidden="true" />
            Leave
          </button>
        </>
      )}
    </div>
  );
}
