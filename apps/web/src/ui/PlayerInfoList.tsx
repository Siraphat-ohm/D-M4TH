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
          <div key={player.id} className={isActive ? "player-card active" : "player-card"}>
            <div className="player-swatch" style={{ background: player.color }} />
            <div className="player-details">
              <span className="player-name">
                {player.name}
                {isActive && props.snapshot.status === "playing" && (
                  <span className="player-status">PLAYING</span>
                )}
              </span>
              <span className="player-time">Full {props.snapshot.status === "lobby" ? "--" : formatTime(fullRemaining)}</span>
            </div>
            <div className="player-score-block">
              <strong className={showPreview ? "player-score preview" : "player-score"}>{player.score} pts</strong>
              <span className={showPreview ? "player-delta preview" : player.lastPenaltyPoints !== undefined ? "player-delta penalty" : "player-delta"}>
                {scoreDelta || " "}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
