import { type CSSProperties } from "react";
import type { PublicSnapshot } from "@d-m4th/game";
import { formatTime } from "./format";

export function PlayerInfoList(props: { snapshot: PublicSnapshot; previewScore?: number; now?: number }) {
  const now = props.now ?? Date.now();

  return (
    <div className="player-list">
      {props.snapshot.players.map((player) => {
        const isActive = props.snapshot.currentPlayerId === player.id;
        const showPreview = isActive && props.previewScore !== undefined;
        const elapsed = isActive ? Math.max(0, now - props.snapshot.turnStartedAt) : 0;
        const fullRemaining = props.snapshot.status === "playing" ? Math.max(0, player.remainingMs - elapsed) : player.remainingMs;
        const scoreDelta = showPreview
          ? `+${props.previewScore}`
          : player.lastPenaltyPoints !== undefined
            ? `-${player.lastPenaltyPoints}`
            : "";

        return (
          <article
            className={isActive ? "player-info-row current" : "player-info-row"}
            key={player.id}
            style={{ "--player-accent": player.color } as CSSProperties}
          >
            <div className="player-info-line player-info-line--top">
              <span className="swatch" style={{ background: player.color }} />
              <span className="player-name">{player.name}</span>
              <strong className="player-score">{player.score} pts</strong>
            </div>
            <div className="player-info-line player-info-line--bottom">
              <span className="player-clock">Full {props.snapshot.status === "lobby" ? "--" : formatTime(fullRemaining)}</span>
              <span
                className={showPreview ? "player-delta player-delta--preview" : player.lastPenaltyPoints !== undefined ? "player-delta player-delta--penalty" : "player-delta"}
                aria-hidden={!scoreDelta}
              >
                {scoreDelta || " "}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
