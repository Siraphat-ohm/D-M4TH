import type { MatchConfig } from "@d-m4th/config";

export type Direction = "horizontal" | "vertical";
export type PremiumTag = "2P" | "3P" | "2E" | "3E";
export type MatchStatus = "lobby" | "playing" | "ended";

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
  rack: Tile[];
  remainingMs: number;
  connected: boolean;
}

export interface PublicPlayer {
  id: string;
  name: string;
  color: string;
  score: number;
  rackCount: number;
  remainingMs: number;
  connected: boolean;
}

export interface Placement extends Coordinate {
  tileId: string;
  face?: string;
}

export interface PlacementDraft {
  playerId: string;
  placements: BoardTile[];
}

export interface ScoreBreakdown {
  baseScore: number;
  equationMultiplier: number;
  bingoBonus: number;
  totalScore: number;
  expression: string;
}

export interface MatchState {
  id: string;
  code: string;
  status: MatchStatus;
  config: MatchConfig;
  board: BoardTile[];
  players: Player[];
  playerOrder: string[];
  currentPlayerId?: string;
  tileBag: Tile[];
  consecutivePasses: number;
  turnStartedAt: number;
  createdAt: number;
  endedReason?: string;
}

export interface PublicSnapshot {
  id: string;
  code: string;
  status: MatchStatus;
  config: MatchConfig;
  board: BoardTile[];
  players: PublicPlayer[];
  playerOrder: string[];
  currentPlayerId?: string;
  tileBagCount: number;
  consecutivePasses: number;
  turnStartedAt: number;
  endedReason?: string;
  ghostPlacements: PlacementDraft[];
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
