import type { PublicSnapshot } from "@d-m4th/game";
import type { NoticeState } from "@/shared/types";

export function buildMatchEndedNotice(snapshot: PublicSnapshot): NoticeState {
  const winners = snapshot.players.filter((player) => snapshot.winnerIds.includes(player.id));
  const headline =
    winners.length === 1
      ? `${winners[0]?.name.trim() || "Player"} wins!`
      : "Tie game!";

  const reason = describeEndedReason(snapshot.endedReason);
  return {
    text: reason ? `${headline} ${reason}` : headline,
    tone: winners.length === 1 ? "success" : "info",
    sticky: true
  };
}

function describeEndedReason(endedReason: PublicSnapshot["endedReason"]): string {
  switch (endedReason) {
    case "exhausted-pass-cycle":
      return "Game ended: all players passed.";
    case "rack-empty":
      return "Game ended: rack emptied.";
    case "player-left":
      return "Game ended: only one player remains.";
    case "playable-players-exhausted":
      return "Game ended: fewer than two playable players remain.";
    case "time-out":
      return "Game ended: time expired.";
    default:
      return "";
  }
}
