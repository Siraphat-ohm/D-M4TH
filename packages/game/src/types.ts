import type { MatchConfig } from "@d-m4th/config";

export type Direction = "horizontal" | "vertical";
export type PremiumTag = "2P" | "3P" | "2E" | "3E";
export type MatchStatus = "lobby" | "playing" | "ended";
export type EndedReason = "rack-empty" | "exhausted-pass-cycle" | "player-left" | "time-out" | "playable-players-exhausted";

export interface Coordinate {
  x: number;
  y: number;
}

export interface BoardCell extends Coordinate {
  start?: boolean;
  pieceMultiplier?: number;
  equationMultiplier?: number;
}

export interface TileDefinition {
  label: string;
  value: number;
  count: number;
}

export interface Tile {
  id: string;
  label: string;
  value: number;
}

export interface BoardTile extends Tile, Coordinate {
  ownerId: string;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  score: number;
  lastPenaltyPoints?: number;
  rack: Tile[];
  remainingMs: number;
  connected: boolean;
  left?: boolean;
  timedOut?: boolean;
}

export interface PublicPlayer {
  id: string;
  name: string;
  color: string;
  score: number;
  lastPenaltyPoints?: number;
  rackCount: number;
  remainingMs: number;
  connected: boolean;
  left?: boolean;
  timedOut?: boolean;
}

export interface Placement extends Coordinate {
  tileId: string;
  face?: string;
}

export interface PlacementDraft {
  playerId: string;
  placements: BoardTile[];
}

export interface LineScoreBreakdown {
  baseScore: number;
  equationMultiplier: number;
  totalScore: number;
  expression: string;
}

export interface ScoreBreakdown {
  baseScore: number;
  equationMultiplier: number;
  bingoBonus: number;
  totalScore: number;
  expression: string;
  lines: LineScoreBreakdown[];
}

export interface MatchState {
  id: string;
  code: string;
  status: MatchStatus;
  config: MatchConfig;
  board: BoardTile[];
  lastPlacements: BoardTile[];
  players: Player[];
  playerOrder: string[];
  currentPlayerId?: string;
  tileBag: Tile[];
  drawsSinceLastEquals: Record<string, number>;
  consecutivePasses: number;
  exhaustedBagPassers: string[];
  currentTurnPenaltyMinutesApplied: number;
  turnStartedAt: number;
  createdAt: number;
  endedReason?: EndedReason;
  winnerIds: string[];
}

export interface PublicSnapshot {
  id: string;
  code: string;
  status: MatchStatus;
  config: MatchConfig;
  board: BoardTile[];
  lastPlacements: BoardTile[];
  players: PublicPlayer[];
  playerOrder: string[];
  currentPlayerId?: string;
  tileBagCount: number;
  consecutivePasses: number;
  turnStartedAt: number;
  endedReason?: EndedReason;
  winnerIds: string[];
}

export interface PrivatePlayerPayload {
  playerId: string;
  rack: Tile[];
}

export interface EngineResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}
