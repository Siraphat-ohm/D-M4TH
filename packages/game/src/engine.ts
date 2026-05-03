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
import type { BoardTile, EndedReason, EngineResult, MatchState, Placement, Player, PrivatePlayerPayload, PublicSnapshot, ScoreBreakdown, Tile } from "./types";
import { createId, createRoomCode, errorMessage, getPlayer, nextTurnPlayer, shuffle, shuffleTiles, sumRackValue, toPublicPlayer } from "./utils";

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
      exhaustedBagPassers: [],
      currentTurnPenaltyMinutesApplied: 0,
      turnStartedAt: now,
      createdAt: now,
      winnerIds: []
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
    match.consecutivePasses = 0;
    match.exhaustedBagPassers = [];
    match.currentTurnPenaltyMinutesApplied = 0;
    match.endedReason = undefined;
    match.winnerIds = [];
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

      resetExhaustedBagPassCycle(match);
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

      if (tileIds.length > match.tileBag.length) {
        throw new Error("You cannot swap more tiles than available in the bag");
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

      resetExhaustedBagPassCycle(match);
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
      trackExhaustedBagPass(match, playerId);
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
      const previousPlayerOrder = [...match.playerOrder];
      const previousTurnIndex = previousPlayerOrder.indexOf(playerId);
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

      const activePlayers = match.players.filter((candidate) => !candidate.left);
      const activePlayerIds = new Set(activePlayers.map((candidate) => candidate.id));
      match.playerOrder = match.playerOrder.filter((id) => activePlayerIds.has(id));
      match.exhaustedBagPassers = match.exhaustedBagPassers.filter((id) => activePlayerIds.has(id));
      match.consecutivePasses = match.exhaustedBagPassers.length;

      if (activePlayers.length < 2) {
        applyPlayerLeftFinalState(match, activePlayers, now);
        return accepted(match);
      }

      if (match.currentPlayerId === playerId) {
        match.currentPlayerId = nextActivePlayerAfter(previousPlayerOrder, previousTurnIndex, activePlayerIds);
        match.turnStartedAt = now;
      }

      this.resolveEndgame(match);

      return accepted(match);
    } catch (error) {
      return rejected(errorMessage(error));
    }
  }

  setPlayerConnected(match: MatchState, playerId: string, connected: boolean): EngineResult<Player> {
    try {
      const player = getPlayer(match, playerId);
      player.connected = connected;
      return accepted(player);
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
      endedReason: match.endedReason,
      winnerIds: match.winnerIds
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
    player.lastPenaltyPoints = undefined;

    const overtimeMinutes = startedOvertimeMinutes(elapsedMs, match.config.turnTimeMs);
    const unpenalizedMinutes = Math.max(0, overtimeMinutes - match.currentTurnPenaltyMinutesApplied);
    if (unpenalizedMinutes > 0) {
      const penaltyPoints = overtimePenaltyForStartedMinutes(unpenalizedMinutes, TURN_OVERTIME_PENALTY);
      player.score -= penaltyPoints;
      player.lastPenaltyPoints = penaltyPoints;
      match.currentTurnPenaltyMinutesApplied = overtimeMinutes;
    }

    const nextPlayerId = nextTurnPlayer(match);
    const nextPlayer = getPlayer(match, nextPlayerId);
    nextPlayer.lastPenaltyPoints = undefined;
    match.currentPlayerId = nextPlayerId;
    match.currentTurnPenaltyMinutesApplied = 0;
    match.turnStartedAt = now;
  }

  private resolveEndgame(match: MatchState): void {
    if (match.status !== "playing") {
      return;
    }

    const activePlayers = match.players.filter((player) => !player.left);

    if (activePlayers.length < 2) {
      applyPlayerLeftFinalState(match, activePlayers, match.turnStartedAt);
      return;
    }

    if (match.tileBag.length === 0) {
      const emptyRackPlayer = activePlayers.find((player) => player.rack.length === 0);
      if (emptyRackPlayer) {
        applyRackEmptyFinalScoring(match, emptyRackPlayer, activePlayers);
        return;
      }

      if (hasCompletedExhaustedPassCycle(match, activePlayers)) {
        applyPassCycleFinalScoring(match, activePlayers);
      }
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

function countActivePlayers(match: MatchState): number {
  return match.players.filter((player) => !player.left).length;
}

function resetExhaustedBagPassCycle(match: MatchState): void {
  match.exhaustedBagPassers = [];
  match.consecutivePasses = 0;
}

function trackExhaustedBagPass(match: MatchState, playerId: string): void {
  if (match.tileBag.length > 0) {
    resetExhaustedBagPassCycle(match);
    return;
  }

  if (!match.exhaustedBagPassers.includes(playerId)) {
    match.exhaustedBagPassers = [...match.exhaustedBagPassers, playerId];
  }

  match.consecutivePasses = match.exhaustedBagPassers.length;
}

function hasCompletedExhaustedPassCycle(match: MatchState, activePlayers: readonly Player[]): boolean {
  if (match.tileBag.length > 0) {
    return false;
  }

  const activePlayerIds = new Set(activePlayers.map((player) => player.id));
  return activePlayers.every((player) => activePlayerIds.has(player.id) && match.exhaustedBagPassers.includes(player.id));
}

function startedOvertimeMinutes(elapsedMs: number, turnTimeMs: number): number {
  if (elapsedMs <= turnTimeMs) {
    return 0;
  }

  return Math.ceil((elapsedMs - turnTimeMs) / 60_000);
}

function overtimePenaltyForStartedMinutes(minutes: number, penaltyPerMinute: number): number {
  return minutes * penaltyPerMinute;
}

function calculateWinnerIds(players: readonly Player[]): string[] {
  if (players.length === 0) {
    return [];
  }

  const highestScore = Math.max(...players.map((player) => player.score));
  return players.filter((player) => player.score === highestScore).map((player) => player.id);
}

function applyRackEmptyFinalScoring(match: MatchState, outPlayer: Player, activePlayers: readonly Player[]): void {
  const remainingRackValue = activePlayers
    .filter((player) => player.id !== outPlayer.id)
    .reduce((total, player) => total + sumRackValue(player.rack), 0);

  outPlayer.score += remainingRackValue * 2;
  finalizeMatch(match, "rack-empty", calculateWinnerIds(activePlayers));
}

function applyPassCycleFinalScoring(match: MatchState, activePlayers: readonly Player[]): void {
  for (const player of activePlayers) {
    player.score -= sumRackValue(player.rack);
  }

  finalizeMatch(match, "exhausted-pass-cycle", calculateWinnerIds(activePlayers));
}

function applyPlayerLeftFinalState(match: MatchState, activePlayers: readonly Player[], now: number): void {
  match.currentPlayerId = activePlayers[0]?.id;
  match.turnStartedAt = now;
  finalizeMatch(match, "player-left", activePlayers[0] ? [activePlayers[0].id] : []);
}

function finalizeMatch(match: MatchState, endedReason: EndedReason, winnerIds: string[]): void {
  match.status = "ended";
  match.endedReason = endedReason;
  match.winnerIds = winnerIds;
}

function nextActivePlayerAfter(previousOrder: readonly string[], previousTurnIndex: number, activePlayerIds: ReadonlySet<string>): string {
  if (previousOrder.length === 0) {
    throw new Error("No active players remain");
  }

  const startIndex = previousTurnIndex === -1 ? 0 : previousTurnIndex + 1;
  for (let offset = 0; offset < previousOrder.length; offset += 1) {
    const playerId = previousOrder[(startIndex + offset) % previousOrder.length];
    if (activePlayerIds.has(playerId)) {
      return playerId;
    }
  }

  throw new Error("No active players remain");
}
