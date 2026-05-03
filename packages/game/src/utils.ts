import seedrandom from "seedrandom";
import type { Coordinate, MatchState, Player, PublicPlayer, Tile } from "./types";

/**
 * Spatial / ID Utilities
 */

export function cellKey({ x, y }: Coordinate): string {
  return `${x}:${y}`;
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createRoomCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
}

/**
 * Player Utilities
 */

export function getPlayer(match: MatchState, playerId: string): Player {
  const player = match.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    throw new Error("Unknown player");
  }

  return player;
}

export function nextTurnPlayer(match: MatchState): string {
  const currentIndex = match.playerOrder.indexOf(match.currentPlayerId ?? "");
  for (let offset = 1; offset <= match.playerOrder.length; offset += 1) {
    const nextIndex = (currentIndex + offset) % match.playerOrder.length;
    const playerId = match.playerOrder[nextIndex];
    const player = match.players.find((candidate) => candidate.id === playerId);
    if (player && !player.left) {
      return playerId;
    }
  }

  throw new Error("No active players remain");
}

export function toPublicPlayer(player: Player): PublicPlayer {
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    score: player.score,
    lastPenaltyPoints: player.lastPenaltyPoints,
    rackCount: player.rack.length,
    remainingMs: player.remainingMs,
    connected: player.connected,
    left: player.left
  };
}

export function sumRackValue(tiles: readonly Tile[]): number {
  return tiles.reduce((total, tile) => total + tile.value, 0);
}

/**
 * Array / Tile Utilities
 */

export function shuffle<T>(items: readonly T[], seed: string): T[] {
  const shuffled = [...items];
  const rng = seedrandom(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

/**
 * Legacy alias for tile bag
 */
export function shuffleTiles(tiles: readonly Tile[], seed: string): Tile[] {
  return shuffle(tiles, seed);
}

/**
 * Error / Error handling
 */

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
