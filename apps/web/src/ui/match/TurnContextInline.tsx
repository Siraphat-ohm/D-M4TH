import { useEffect, useState, type CSSProperties } from "react";
import type { PublicSnapshot } from "@d-m4th/game";
import { formatSignedTime } from "@/ui/shared/format";

export function TurnContextInline(props: { snapshot: PublicSnapshot }) {
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    if (props.snapshot.status !== "playing") {
      return;
    }

    setClockNow(Date.now());
    const id = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [props.snapshot.status, props.snapshot.turnStartedAt, props.snapshot.currentPlayerId]);

  const activePlayer = props.snapshot.players.find((player) => player.id === props.snapshot.currentPlayerId);

  if (!activePlayer) {
    return null;
  }

  const elapsed = props.snapshot.status === "playing" ? clockNow - props.snapshot.turnStartedAt : 0;
  const turnRemaining = props.snapshot.status === "playing"
    ? props.snapshot.config.turnTimeMs - elapsed
    : 0;

  return (
    <div
      className="turn-context-inline"
      style={{ "--active-player-color": activePlayer.color } as CSSProperties}
      aria-label={`${activePlayer.name}'s turn`}
    >
      <span className="turn-context-inline__name">{activePlayer.name}'s turn</span>
      <span className={`turn-context-inline__time${turnRemaining < 0 ? " overtime" : ""}`}>
        {formatSignedTime(turnRemaining)}
      </span>
    </div>
  );
}
