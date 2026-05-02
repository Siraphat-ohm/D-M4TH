import { useEffect, useState } from "react";
import { Clock3, Package } from "lucide-react";
import type { PublicSnapshot } from "@d-m4th/game";
import { formatTime } from "./format";
import { PlayerInfoList } from "./PlayerInfoList";

export function MatchTopBar(props: { snapshot?: PublicSnapshot; previewScore?: number }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (props.snapshot?.status !== "playing") return;

    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [props.snapshot?.status, props.snapshot?.turnStartedAt, props.snapshot?.currentPlayerId]);

  if (!props.snapshot) {
    return null;
  }

  const now = Date.now();
  const activePlayer = props.snapshot.players.find((player) => player.id === props.snapshot?.currentPlayerId);
  const elapsed = props.snapshot.status === "playing" && activePlayer
    ? Math.max(0, now - props.snapshot.turnStartedAt)
    : 0;
  const turnRemaining = props.snapshot.status === "playing"
    ? Math.max(0, props.snapshot.config.turnTimeMs - elapsed)
    : 0;

  return (
    <div className="topbar-content">
      <PlayerInfoList snapshot={props.snapshot} previewScore={props.previewScore} now={now} />
      <div className="hud-metrics">
        <div className="metric">
          <Clock3 size={14} aria-hidden="true" />
          <span className="hud-label">Turn</span>
          <strong className="hud-value" style={{ color: activePlayer?.color }}>
            {formatTime(turnRemaining)}
          </strong>
        </div>
        <div className="metric">
          <Package size={14} aria-hidden="true" />
          <span className="hud-label">Bag</span>
          <strong className="hud-value">{props.snapshot.tileBagCount}</strong>
        </div>
      </div>
    </div>
  );
}
