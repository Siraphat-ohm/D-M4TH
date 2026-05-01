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
  const nextIndex = (currentIndex + 1) % match.playerOrder.length;
  return match.playerOrder[nextIndex];
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
    connected: player.connected
  };
}

/**
 * Array / Tile Utilities
 */

export function shuffleTiles(tiles: readonly Tile[], seed: string): Tile[] {
  const shuffledTiles = [...tiles];
  let state = hashSeed(seed);

  for (let index = shuffledTiles.length - 1; index > 0; index -= 1) {
    state = nextRandomState(state);
    const swapIndex = state % (index + 1);
    [shuffledTiles[index], shuffledTiles[swapIndex]] = [shuffledTiles[swapIndex], shuffledTiles[index]];
  }

  return shuffledTiles;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function nextRandomState(state: number): number {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
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
