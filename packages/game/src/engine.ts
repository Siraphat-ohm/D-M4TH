import {
  CLASSICAL_RACK_SIZE,
  MIN_SWAP_BAG_TILES,
  TURN_OVERTIME_PENALTY,
  createClassicalConfig,
  createPartyConfig,
  type MatchConfig
} from "@d-m4th/config";
import { validatePlay } from "./play-validator";
import { createTileBag, drawTiles } from "./tile-catalog";
import type { BoardTile, EngineResult, MatchState, Placement, Player, PrivatePlayerPayload, PublicSnapshot, ScoreBreakdown, Tile } from "./types";
import { createId, createRoomCode, errorMessage, getPlayer, nextTurnPlayer, shuffle, shuffleTiles, toPublicPlayer } from "./utils";

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
    const config = normalizeMatchConfig(input.config ?? createClassicalConfig());
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
      playerOrder: [],
      tileBag: [],
      drawsSinceLastEquals: {},
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
    return accepted(player);
  }

  configureMatch(match: MatchState, config: MatchConfig): EngineResult<MatchConfig> {
    if (match.status !== "lobby") {
      return rejected("Cannot configure a match after it starts");
    }

    match.config = normalizeMatchConfig(config);
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
      player.rack = this.drawFairInitialRack(match, player.id);
    }

    match.status = "playing";
    match.playerOrder = shuffle(match.players.map((p) => p.id), `${match.id}:start`);
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

      const countNeeded = match.config.rackSize - player.rack.length;
      player.rack.push(...this.drawFairTiles(match, playerId, countNeeded));

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
      player.rack.push(...this.drawFairTiles(match, playerId, selectedTiles.length));
      match.tileBag = shuffleTiles([...match.tileBag, ...selectedTiles], `${match.id}:${now}:swap`);

      match.consecutivePasses = 0;
      this.finishTurn(match, player, now);

      return accepted(tileIds.map(String));
    } catch (error) {
      return rejected(errorMessage(error));
    }
  }

  private drawFairInitialRack(match: MatchState, playerId: string): Tile[] {
    const rack: Tile[] = [];

    // 1. Guaranteed Equals
    const equalsIndex = match.tileBag.findIndex(t => t.label === "=");
    if (equalsIndex !== -1) {
      rack.push(...match.tileBag.splice(equalsIndex, 1));
    }

    // 2. Guaranteed 3 Digits
    for (let i = 0; i < 3; i++) {
      const digitIndex = match.tileBag.findIndex(t => /^[0-9]$/.test(t.label));
      if (digitIndex !== -1) {
        rack.push(...match.tileBag.splice(digitIndex, 1));
      }
    }

    // 3. Fill remaining
    const remainingCount = match.config.rackSize - rack.length;
    rack.push(...drawTiles(match.tileBag, remainingCount));

    // Reset pity timer
    match.drawsSinceLastEquals[playerId] = 0;

    return shuffle(rack, `${match.id}:${playerId}:initial-rack`);
  }

  private drawFairTiles(match: MatchState, playerId: string, count: number): Tile[] {
    const drawn: Tile[] = [];
    const EQUALS_PITY_THRESHOLD = 8;

    for (let i = 0; i < count; i++) {
      if (match.tileBag.length === 0) break;

      let currentDraw: Tile;
      const drawsSinceLast = match.drawsSinceLastEquals[playerId] ?? 0;

      if (drawsSinceLast >= EQUALS_PITY_THRESHOLD) {
        const equalsIndex = match.tileBag.findIndex(t => t.label === "=");
        if (equalsIndex !== -1) {
          currentDraw = match.tileBag.splice(equalsIndex, 1)[0];
        } else {
          currentDraw = match.tileBag.splice(0, 1)[0];
        }
      } else {
        currentDraw = match.tileBag.splice(0, 1)[0];
      }

      if (currentDraw.label === "=") {
        match.drawsSinceLastEquals[playerId] = 0;
      } else {
        match.drawsSinceLastEquals[playerId] = drawsSinceLast + 1;
      }

      drawn.push(currentDraw);
    }

    return drawn;
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

  leaveMatch(match: MatchState, playerId: string, now = Date.now()): EngineResult<MatchState> {
    try {
      const player = getPlayer(match, playerId);
      player.connected = false;
      player.left = true;

      if (match.status === "lobby") {
        match.players = match.players.filter((candidate) => candidate.id !== playerId);
        match.playerOrder = match.playerOrder.filter((id) => id !== playerId);
        return accepted(match);
      }

      if (match.status !== "playing") {
        return accepted(match);
      }

      const activePlayerIds = new Set(match.players.filter((candidate) => !candidate.left).map((candidate) => candidate.id));
      match.playerOrder = match.playerOrder.filter((id) => activePlayerIds.has(id));

      if (activePlayerIds.size < 2) {
        match.status = "ended";
        match.endedReason = "player-left";
        match.turnStartedAt = now;
        return accepted(match);
      }

      if (match.currentPlayerId === playerId) {
        match.currentPlayerId = nextTurnPlayer(match);
        match.turnStartedAt = now;
      }

      return accepted(match);
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

function normalizeMatchConfig(config: MatchConfig): MatchConfig {
  if (config.mode === "classical") {
    return {
      ...createClassicalConfig(),
      totalTimeMs: config.totalTimeMs,
      turnTimeMs: config.turnTimeMs,
      incrementMs: config.incrementMs,
      skillNodesEnabled: config.skillNodesEnabled
    };
  }

  return {
    ...createPartyConfig({
      boardSize: config.boardSize,
      premiumMapId: config.premiumMapId,
      maxPlayers: config.maxPlayers,
      totalTimeMs: config.totalTimeMs,
      turnTimeMs: config.turnTimeMs,
      incrementMs: config.incrementMs
    }),
    skillNodesEnabled: config.skillNodesEnabled
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

function accepted<T>(value: T): EngineResult<T> {
  return { ok: true, value };
}

function rejected<T>(error: string): EngineResult<T> {
  return { ok: false, error };
}
