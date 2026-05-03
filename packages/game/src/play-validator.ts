import { buildContiguousLine, createBoardLayout, detectDirection } from "./board-layout";
import { createScoreBreakdown, scoreLine } from "./scoring";
import { faceOptionsForTileLabel, tileRequiresFace } from "./tile-catalog";
import type { BoardTile, Direction, MatchState, Placement, Player, ScoreBreakdown } from "./types";
import { cellKey } from "./utils";

export function validatePlay(match: MatchState, player: Player, placements: readonly Placement[]): ScoreBreakdown {
  if (placements.length === 0) {
    throw new Error("Play must include at least one tile");
  }

  const boardTiles = createBoardTiles(player, placements);
  ensureCellsAvailable(match, boardTiles);

  if (match.board.length === 0 && !coversStart(boardTiles, match.config.boardSize)) {
    throw new Error("First play must cover the start star");
  }

  const direction = detectDirection(boardTiles);
  const placedTileIds = new Set(boardTiles.map((tile) => tile.id));
  const layout = createBoardLayout(match.config.boardSize, match.config.premiumMapId);
  const primaryLine = buildContiguousLine({ board: match.board, placements: boardTiles, direction });
  const lineScores = [
    scoreLine({
      layout,
      line: primaryLine,
      placedTileIds
    })
  ];

  for (const crossLine of collectCrossLines(match.board, boardTiles, direction)) {
    try {
      lineScores.push(
        scoreLine({
          layout,
          line: crossLine,
          placedTileIds
        })
      );
    } catch (error) {
      throw new Error(`Cross equation is invalid: ${errorMessage(error)}`);
    }
  }

  return createScoreBreakdown({
    primaryLineScore: lineScores[0]!,
    lineScores,
    placedTileCount: placedTileIds.size,
    rackSize: match.config.rackSize
  });
}

function collectCrossLines(board: readonly BoardTile[], placements: readonly BoardTile[], primaryDirection: Direction): BoardTile[][] {
  const crossDirection = primaryDirection === "horizontal" ? "vertical" : "horizontal";
  const seenKeys = new Set<string>();
  const crossLines: BoardTile[][] = [];

  for (const placement of placements) {
    const line = buildContiguousLine({
      board,
      placements: [placement],
      direction: crossDirection
    });

    if (line.length <= 1) {
      continue;
    }

    const key = createLineKey(crossDirection, line);

    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    crossLines.push(line);
  }

  return crossLines;
}

function createLineKey(direction: Direction, line: readonly BoardTile[]): string {
  const firstTile = line[0]!;
  const lastTile = line[line.length - 1]!;
  return `${direction}:${firstTile.x},${firstTile.y}:${lastTile.x},${lastTile.y}`;
}

function createBoardTiles(player: Player, placements: readonly Placement[]): BoardTile[] {
  const rackById = new Map(player.rack.map((tile) => [tile.id, tile]));
  const usedCoordinates = new Set<string>();
  const usedTileIds = new Set<string>();

  return placements.map((placement) => {
    const tile = rackById.get(placement.tileId);

    if (!tile) {
      throw new Error("Placement contains a tile not in the player rack");
    }

    validatePlacementFace(tile.label, placement.face);

    if (usedTileIds.has(placement.tileId)) {
      throw new Error("Cannot place the same tile more than once");
    }

    const key = cellKey(placement);

    if (usedCoordinates.has(key)) {
      throw new Error("Cannot place multiple tiles on the same cell");
    }

    usedTileIds.add(placement.tileId);
    usedCoordinates.add(key);

    return {
      ...tile,
      label: placement.face ?? tile.label,
      x: placement.x,
      y: placement.y,
      ownerId: player.id
    };
  });
}

function ensureCellsAvailable(match: MatchState, placements: readonly BoardTile[]): void {
  const occupiedKeys = new Set(match.board.map(cellKey));

  for (const placement of placements) {
    if (occupiedKeys.has(cellKey(placement))) {
      throw new Error("Cell already occupied");
    }

    if (placement.x < 0 || placement.y < 0 || placement.x >= match.config.boardSize || placement.y >= match.config.boardSize) {
      throw new Error("Placement is out of bounds");
    }
  }
}

function coversStart(placements: readonly BoardTile[], boardSize: number): boolean {
  const startOffset = Math.floor(boardSize / 2);
  return placements.some((placement) => placement.x === startOffset && placement.y === startOffset);
}

function validatePlacementFace(tileLabel: string, face: string | undefined): void {
  if (!tileRequiresFace(tileLabel) && face) {
    throw new Error("Only assignable tiles can choose a face");
  }

  if (tileRequiresFace(tileLabel) && !face) {
    throw new Error("Assignable tile must choose a face");
  }

  if (face && !faceOptionsForTileLabel(tileLabel).includes(face)) {
    throw new Error("Tile face is not supported");
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
