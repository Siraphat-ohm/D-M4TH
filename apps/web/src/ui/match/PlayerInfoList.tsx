import { type CSSProperties } from "react";
import type { PublicSnapshot } from "@d-m4th/game";
import { formatSignedTime } from "../shared/format";

export function PlayerInfoList(props: {
  snapshot: PublicSnapshot;
  previewScore?: number;
  penaltyDeltas?: Record<string, number>;
  now?: number;
}) {
  const now = props.now ?? Date.now();

  return (
    <div className="player-list">
      {props.snapshot.players.map((player) => {
        const isActive = props.snapshot.currentPlayerId === player.id;
        const showPreview = isActive && props.previewScore !== undefined;
        const penaltyPoints = props.penaltyDeltas?.[player.id] ?? player.lastPenaltyPoints;
        const elapsed = isActive ? now - props.snapshot.turnStartedAt : 0;
        const fullRemaining = props.snapshot.status === "playing" ? player.remainingMs - elapsed : player.remainingMs;
        const scoreDelta = showPreview
          ? `+${props.previewScore}`
          : penaltyPoints !== undefined
            ? `-${penaltyPoints}`
            : "";
        const deltaClassName = showPreview ? "player-delta preview" : penaltyPoints !== undefined ? "player-delta penalty" : "player-delta";

        return (
          <div
            key={player.id}
            className={`player-card${isActive ? " active" : ""}${!isActive ? " inactive" : ""}`}
            style={{ "--player-accent": player.color } as CSSProperties}
            data-testid="player-card"
            data-player-id={player.id}
            data-active={isActive}
            data-score={player.score}
          >
            <div className="player-swatch" style={{ background: player.color }} />
            <div className="player-details">
              <span className="player-name" data-testid="player-name">
                {player.name}
                {isActive && props.snapshot.status === "playing" && (
                  <span className="player-status">Playing</span>
                )}
              </span>
              <span className={`player-time${fullRemaining < 0 ? " overtime" : ""}`} data-testid="player-time">
                {props.snapshot.status === "lobby" ? "--" : formatSignedTime(fullRemaining)}
              </span>
            </div>
            <div className="player-score-block">
              <p className={showPreview ? "player-score preview" : "player-score"} data-testid="player-score">{player.score} pts</p>
              <span
                className={deltaClassName}
                data-testid="player-delta"
                data-penalty-points={penaltyPoints}
              >
                {scoreDelta || " "}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
