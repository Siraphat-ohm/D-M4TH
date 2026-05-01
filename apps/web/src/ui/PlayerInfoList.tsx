import { useEffect, useState } from "react";
import type { PublicSnapshot } from "@d-m4th/game";
import { formatTime } from "./format";

export function PlayerInfoList(props: { snapshot: PublicSnapshot; previewScore?: number }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (props.snapshot.status !== "playing") return;

    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [props.snapshot.status, props.snapshot.turnStartedAt, props.snapshot.currentPlayerId]);

  const now = Date.now();

  return (
    <div className="player-list">
      {props.snapshot.players.map((player) => {
        const isActive = props.snapshot.currentPlayerId === player.id;
        const showPreview = isActive && props.previewScore !== undefined;
        const elapsed = isActive ? Math.max(0, now - props.snapshot.turnStartedAt) : 0;
        const fullRemaining = props.snapshot.status === "playing" ? Math.max(0, player.remainingMs - elapsed) : player.remainingMs;
        const turnRemaining = isActive && props.snapshot.status === "playing"
          ? Math.max(0, props.snapshot.config.turnTimeMs - elapsed)
          : undefined;

        return (
          <div className={isActive ? "player-info-row current" : "player-info-row"} key={player.id} style={isActive ? { borderColor: player.color } : undefined}>
            <div className="player-info-line player-info-line--top">
              <span className="swatch" style={{ background: player.color }} />
              <span className="player-name">{player.name}</span>
              <strong className={showPreview ? "player-score preview" : "player-score"}>
                {player.score} pts
                {showPreview && <span>+{props.previewScore}</span>}
              </strong>
              {player.lastPenaltyPoints !== undefined && <span>Penalty -{player.lastPenaltyPoints}</span>}
            </div>
            <div className="player-info-line player-info-line--bottom">
              <span>Turn {turnRemaining === undefined ? "--" : formatTime(turnRemaining)}</span>
              <span>Full {props.snapshot.status === "lobby" ? "--" : formatTime(fullRemaining)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
