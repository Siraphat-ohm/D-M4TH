export const CLASSICAL_BOARD_SIZE = 15;
export const MIN_BOARD_SIZE = 15;
export const MAX_BOARD_SIZE = 25;
export const CLASSICAL_RACK_SIZE = 8;
export const CLASSICAL_TOTAL_TIME_MS = 22 * 60 * 1000;
export const CLASSICAL_TURN_TIME_MS = 3 * 60 * 1000;
export const TURN_OVERTIME_PENALTY = 10;
export const BINGO_BONUS = 40;
export const MIN_SWAP_BAG_TILES = 5;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export type MatchMode = "classical" | "party";
export const PREMIUM_MAP_OPTIONS = [
  { id: "scaled-classic", label: "Scaled Classic" },
  { id: "center-classic", label: "Center Classic" },
  { id: "cross", label: "Cross" },
  { id: "starlight", label: "Starlight (Balanced)" },
  { id: "power-rings", label: "Power Rings (Balanced)" },
  { id: "the-core", label: "The Core (Balanced)" },
  { id: "diamond", label: "Diamond Ring" },
  { id: "crossfire", label: "Crossfire" },
  { id: "starburst", label: "Starburst" },
  { id: "fortress", label: "The Fortress" },
  { id: "spider-web", label: "Spider Web" },
  { id: "four-islands", label: "Four Islands" }
] as const;
export type PremiumMapId = (typeof PREMIUM_MAP_OPTIONS)[number]["id"];
export const DEFAULT_PREMIUM_MAP_ID: PremiumMapId = "scaled-classic";

export interface MatchConfig {
  mode: MatchMode;
  boardSize: number;
  premiumMapId: PremiumMapId;
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
    premiumMapId: DEFAULT_PREMIUM_MAP_ID,
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
  premiumMapId?: PremiumMapId;
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
    premiumMapId: normalizePremiumMapId(input.premiumMapId),
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
  const clamped = Math.max(MIN_BOARD_SIZE, Math.min(MAX_BOARD_SIZE, Math.floor(size)));
  return clamped % 2 === 1 ? clamped : clamped + 1;
}

function normalizePremiumMapId(id: PremiumMapId | undefined): PremiumMapId {
  if (!id) {
    return DEFAULT_PREMIUM_MAP_ID;
  }

  return PREMIUM_MAP_OPTIONS.some((option) => option.id === id) ? id : DEFAULT_PREMIUM_MAP_ID;
}

function clampPlayerCount(playerCount: number): number {
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.floor(playerCount)));
}
