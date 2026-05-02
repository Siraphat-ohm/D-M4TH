import type { PublicPlayer } from "@d-m4th/game";

export function findPlayerColor(players: readonly PublicPlayer[], playerId?: string): string | undefined {
  if (!playerId) return undefined;
  return players.find((p) => p.id === playerId)?.color;
}

export function resolvePlayerAccent(
  players: readonly PublicPlayer[],
  playerId?: string,
  fallback = "var(--panel-border)"
): string {
  return findPlayerColor(players, playerId) ?? fallback;
}

export function createPlayerColorMap(players: readonly PublicPlayer[]): Map<string, string> {
  return new Map(players.map((p) => [p.id, p.color]));
}
