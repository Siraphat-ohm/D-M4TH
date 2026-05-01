import {
  CLASSICAL_RACK_SIZE,
  MIN_SWAP_BAG_TILES,
  TURN_OVERTIME_PENALTY,
  createClassicalConfig,
  type MatchConfig
} from "@d-m4th/config";
import { validatePlay } from "./play-validator";
import { createTileBag, drawTiles, shuffleTiles } from "./tile-catalog";
import type { BoardTile, EngineResult, MatchState, Placement, Player, PrivatePlayerPayload, PublicSnapshot, ScoreBreakdown } from "./types";

export interface CreateMatchInput {
  hostName: string;
  hostColor: string;
  config?: MatchConfig;
  now?: number;
}

export interface JoinMatchInput {
  name: string;
  color: string;
}

export class GameEngine {
  createMatch(input: CreateMatchInput): MatchState {
    const now = input.now ?? Date.now();
    const config = input.config ?? createClassicalConfig();
    const host = createPlayer({
      id: createId("player"),
      name: input.hostName,
      color: input.hostColor,
      totalTimeMs: config.totalTimeMs
    });

    return {
      id: createId("match"),
      code: createRoomCode(),
      status: "lobby",
      config,
      board: [],
      lastPlacements: [],
      players: [host],
      playerOrder: [host.id],
      tileBag: [],
      consecutivePasses: 0,
      turnStartedAt: now,
      createdAt: now
    };
  }

  joinMatch(match: MatchState, input: JoinMatchInput): EngineResult<Player> {
    if (match.status !== "lobby") {
      return rejected("Cannot join after the match starts");
    }

    if (match.players.length >= match.config.maxPlayers) {
      return rejected("Room is full");
    }

    const player = createPlayer({
      id: createId("player"),
      name: input.name,
      color: input.color,
      totalTimeMs: match.config.totalTimeMs
    });

    match.players.push(player);
    match.playerOrder.push(player.id);
    return accepted(player);
  }

  configureMatch(match: MatchState, config: MatchConfig): EngineResult<MatchConfig> {
    if (match.status !== "lobby") {
      return rejected("Cannot configure a match after it starts");
    }

    match.config = config;
    for (const player of match.players) {
      player.remainingMs = config.totalTimeMs;
    }

    return accepted(config);
  }

  startMatch(match: MatchState, now = Date.now()): EngineResult<MatchState> {
    if (match.status !== "lobby") {
      return rejected("Match already started");
    }

    if (match.players.length < match.config.minPlayers) {
      return rejected("Not enough players to start");
    }

    match.tileBag = createTileBag(match.players.length, match.id);
    for (const player of match.players) {
      player.rack = drawTiles(match.tileBag, match.config.rackSize);
    }

    match.status = "playing";
    match.currentPlayerId = match.playerOrder[0];
    match.turnStartedAt = now;
    return accepted(match);
  }

  previewPlay(match: MatchState, playerId: string, placements: readonly Placement[]): EngineResult<ScoreBreakdown> {
    try {
      ensurePlaying(match);
      ensureCurrentTurn(match, playerId);
      const player = getPlayer(match, playerId);
      return accepted(validatePlay(match, player, placements));
    } catch (error) {
      return rejected(errorMessage(error));
    }
  }

  commitPlay(match: MatchState, playerId: string, placements: readonly Placement[], now = Date.now()): EngineResult<ScoreBreakdown> {
    try {
      ensurePlaying(match);
      ensureCurrentTurn(match, playerId);
      const player = getPlayer(match, playerId);
      const score = validatePlay(match, player, placements);
      
      const rackById = new Map(player.rack.map((tile) => [tile.id, tile]));
      const boardTiles: BoardTile[] = placements.map(p => ({
        ...rackById.get(p.tileId)!,
        label: p.face ?? rackById.get(p.tileId)!.label,
        x: p.x,
        y: p.y,
        ownerId: player.id
      }));

      const placedTileIds = new Set(placements.map((placement) => placement.tileId));

      match.board.push(...boardTiles);
      match.lastPlacements = boardTiles;
      player.rack = player.rack.filter((tile) => !placedTileIds.has(tile.id));
      player.score += score.totalScore;
      player.rack.push(...drawTiles(match.tileBag, match.config.rackSize - player.rack.length));
      match.consecutivePasses = 0;
      this.finishTurn(match, player, now);
      this.resolveEndgame(match);

      return accepted(score);
    } catch (error) {
      return rejected(errorMessage(error));
    }
  }

  swapTiles(match: MatchState, playerId: string, tileIds: readonly string[], now = Date.now()): EngineResult<string[]> {
    try {
      ensureCurrentTurn(match, playerId);

      if (match.tileBag.length <= MIN_SWAP_BAG_TILES) {
        throw new Error("Cannot swap when the tile bag has 5 or fewer tiles");
      }

      if (tileIds.length < 1 || tileIds.length > CLASSICAL_RACK_SIZE) {
        throw new Error("Swap must include 1 to 8 tiles");
      }

      const player = getPlayer(match, playerId);
      const selectedIds = new Set(tileIds);
      const selectedTiles = player.rack.filter((tile) => selectedIds.has(tile.id));

      if (selectedTiles.length !== selectedIds.size) {
        throw new Error("Swap contains tiles not in the player rack");
      }

      player.rack = player.rack.filter((tile) => !selectedIds.has(tile.id));
      player.rack.push(...drawTiles(match.tileBag, selectedTiles.length));
      match.tileBag = shuffleTiles([...match.tileBag, ...selectedTiles], `${match.id}:${now}:swap`);
      match.consecutivePasses = 0;
      this.finishTurn(match, player, now);

      return accepted(tileIds.map(String));
    } catch (error) {
      return rejected(errorMessage(error));
    }
  }

  passTurn(match: MatchState, playerId: string, now = Date.now()): EngineResult<string> {
    try {
      ensureCurrentTurn(match, playerId);
      const player = getPlayer(match, playerId);
      match.consecutivePasses += 1;
      this.finishTurn(match, player, now);
      this.resolveEndgame(match);
      return accepted(playerId);
    } catch (error) {
      return rejected(errorMessage(error));
    }
  }

  createSnapshot(match: MatchState): PublicSnapshot {
    return {
      id: match.id,
      code: match.code,
      status: match.status,
      config: match.config,
      board: match.board,
      lastPlacements: match.lastPlacements,
      players: match.players.map(toPublicPlayer),
      playerOrder: match.playerOrder,
      currentPlayerId: match.currentPlayerId,
      tileBagCount: match.tileBag.length,
      consecutivePasses: match.consecutivePasses,
      turnStartedAt: match.turnStartedAt,
      endedReason: match.endedReason
    };
  }

  createPrivatePayload(match: MatchState, playerId: string): PrivatePlayerPayload {
    const player = getPlayer(match, playerId);
    return {
      playerId,
      rack: player.rack
    };
  }

  private finishTurn(match: MatchState, player: Player, now: number): void {
    const elapsedMs = Math.max(0, now - match.turnStartedAt);
    player.remainingMs = Math.max(0, player.remainingMs - elapsedMs + match.config.incrementMs);

    if (elapsedMs > match.config.turnTimeMs) {
      player.score -= TURN_OVERTIME_PENALTY;
      player.lastPenaltyPoints = TURN_OVERTIME_PENALTY;
    }

    if (player.remainingMs === 0) {
      match.status = "ended";
      match.endedReason = "time-out";
      return;
    }

    const nextPlayerId = nextTurnPlayer(match);
    const nextPlayer = getPlayer(match, nextPlayerId);
    nextPlayer.lastPenaltyPoints = undefined;
    match.currentPlayerId = nextPlayerId;
    match.turnStartedAt = now;
  }

  private resolveEndgame(match: MatchState): void {
    if (match.status !== "playing") {
      return;
    }

    const emptyRackPlayer = match.players.find((player) => player.rack.length === 0);

    if (match.tileBag.length === 0 && emptyRackPlayer) {
      match.status = "ended";
      match.endedReason = "depletion";
      return;
    }

    if (match.tileBag.length === 0 && match.consecutivePasses >= match.players.length) {
      match.status = "ended";
      match.endedReason = "stalemate";
    }
  }
}

function createPlayer(input: { id: string; name: string; color: string; totalTimeMs: number }): Player {
  return {
    id: input.id,
    name: input.name.trim() || "Guest",
    color: input.color,
    score: 0,
    rack: [],
    remainingMs: input.totalTimeMs,
    connected: true
  };
}

function ensurePlaying(match: MatchState): void {
  if (match.status !== "playing") {
    throw new Error("Match is not playing");
  }
}

function ensureCurrentTurn(match: MatchState, playerId: string): void {
  ensurePlaying(match);

  if (match.currentPlayerId !== playerId) {
    throw new Error("It is not this player's turn");
  }
}

function getPlayer(match: MatchState, playerId: string): Player {
  const player = match.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    throw new Error("Unknown player");
  }

  return player;
}

function nextTurnPlayer(match: MatchState): string {
  const currentIndex = match.playerOrder.findIndex((playerId) => playerId === match.currentPlayerId);
  const nextIndex = (currentIndex + 1) % match.playerOrder.length;
  return match.playerOrder[nextIndex];
}

function toPublicPlayer(player: Player) {
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

function accepted<T>(value: T): EngineResult<T> {
  return { ok: true, value };
}

function rejected<T>(error: string): EngineResult<T> {
  return { ok: false, error };
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function createRoomCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown engine error";
}
