export const CLASSICAL_BOARD_SIZE = 15;
export const CLASSICAL_RACK_SIZE = 8;
export const CLASSICAL_TOTAL_TIME_MS = 22 * 60 * 1000;
export const CLASSICAL_TURN_TIME_MS = 3 * 60 * 1000;
export const TURN_OVERTIME_PENALTY = 10;
export const BINGO_BONUS = 40;
export const MIN_SWAP_BAG_TILES = 5;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export type MatchMode = "classical" | "party";

export interface MatchConfig {
  mode: MatchMode;
  boardSize: number;
  minPlayers: number;
  maxPlayers: number;
  rackSize: number;
  totalTimeMs: number;
  turnTimeMs: number;
  incrementMs: number;
  skillNodesEnabled: boolean;
}

export function createClassicalConfig(): MatchConfig {
  return {
    mode: "classical",
    boardSize: CLASSICAL_BOARD_SIZE,
    minPlayers: MIN_PLAYERS,
    maxPlayers: 2,
    rackSize: CLASSICAL_RACK_SIZE,
    totalTimeMs: CLASSICAL_TOTAL_TIME_MS,
    turnTimeMs: CLASSICAL_TURN_TIME_MS,
    incrementMs: 0,
    skillNodesEnabled: false
  };
}

export interface PartyConfigInput {
  boardSize?: number;
  maxPlayers?: number;
  totalTimeMs?: number;
  turnTimeMs?: number;
  incrementMs?: number;
}

export function createPartyConfig(input: PartyConfigInput = {}): MatchConfig {
  const boardSize = normalizeBoardSize(input.boardSize ?? CLASSICAL_BOARD_SIZE);
  const maxPlayers = clampPlayerCount(input.maxPlayers ?? 6);

  return {
    mode: "party",
    boardSize,
    minPlayers: MIN_PLAYERS,
    maxPlayers,
    rackSize: CLASSICAL_RACK_SIZE,
    totalTimeMs: input.totalTimeMs ?? CLASSICAL_TOTAL_TIME_MS,
    turnTimeMs: input.turnTimeMs ?? CLASSICAL_TURN_TIME_MS,
    incrementMs: input.incrementMs ?? 0,
    skillNodesEnabled: false
  };
}

const BAG_SCALE_SMALL_LIMIT = 2;
const BAG_SCALE_MEDIUM_LIMIT = 4;

export function tileBagScaleForPlayerCount(playerCount: number): number {
  if (playerCount <= BAG_SCALE_SMALL_LIMIT) {
    return 1;
  }

  if (playerCount <= BAG_SCALE_MEDIUM_LIMIT) {
    return 2;
  }

  return 3;
}

function normalizeBoardSize(size: number): number {
  const minimumSize = Math.max(CLASSICAL_BOARD_SIZE, Math.floor(size));
  return minimumSize % 2 === 1 ? minimumSize : minimumSize + 1;
}

function clampPlayerCount(playerCount: number): number {
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.floor(playerCount)));
}
