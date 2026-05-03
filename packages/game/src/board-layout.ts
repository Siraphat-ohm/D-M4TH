import type { PremiumMapId } from "@d-m4th/config";
import type { BoardCell, BoardTile, Coordinate, Direction } from "./types";
import { cellKey } from "./utils";

export const CLASSICAL_LAYOUT_SIZE = 15;
export const START_COORDINATE: Coordinate = { x: 7, y: 7 };

const TRIPLE_MULTIPLIER = 3;
const DOUBLE_MULTIPLIER = 2;
const MIN_BOARD_SIZE = CLASSICAL_LAYOUT_SIZE;
const CLASSICAL_CENTER_OFFSET = 7;

type PremiumType = "3E" | "2E" | "3P" | "2P" | null;
type PremiumTypeResolver = (dx: number, dy: number) => PremiumType;

const TRIPLE_EQUATION_CELLS: readonly Coordinate[] = [
  { x: 0, y: 0 },
  { x: 7, y: 0 },
  { x: 14, y: 0 },
  { x: 0, y: 7 },
  { x: 14, y: 7 },
  { x: 0, y: 14 },
  { x: 7, y: 14 },
  { x: 14, y: 14 }
];

const DOUBLE_EQUATION_CELLS: readonly Coordinate[] = [
  { x: 1, y: 1 },
  { x: 2, y: 2 },
  { x: 3, y: 3 },
  { x: 4, y: 4 },
  { x: 10, y: 10 },
  { x: 11, y: 11 },
  { x: 12, y: 12 },
  { x: 13, y: 13 },
  { x: 13, y: 1 },
  { x: 12, y: 2 },
  { x: 11, y: 3 },
  { x: 10, y: 4 },
  { x: 4, y: 10 },
  { x: 3, y: 11 },
  { x: 2, y: 12 },
  { x: 1, y: 13 }
];

const TRIPLE_PIECE_CELLS: readonly Coordinate[] = [
  { x: 5, y: 1 },
  { x: 9, y: 1 },
  { x: 1, y: 5 },
  { x: 5, y: 5 },
  { x: 9, y: 5 },
  { x: 13, y: 5 },
  { x: 7, y: 7 },
  { x: 1, y: 9 },
  { x: 5, y: 9 },
  { x: 9, y: 9 },
  { x: 13, y: 9 },
  { x: 5, y: 13 },
  { x: 9, y: 13 }
];

const DOUBLE_PIECE_CELLS: readonly Coordinate[] = [
  { x: 3, y: 0 },
  { x: 11, y: 0 },
  { x: 6, y: 2 },
  { x: 8, y: 2 },
  { x: 0, y: 3 },
  { x: 7, y: 3 },
  { x: 14, y: 3 },
  { x: 2, y: 6 },
  { x: 6, y: 6 },
  { x: 8, y: 6 },
  { x: 12, y: 6 },
  { x: 3, y: 7 },
  { x: 11, y: 7 },
  { x: 2, y: 8 },
  { x: 6, y: 8 },
  { x: 8, y: 8 },
  { x: 12, y: 8 },
  { x: 0, y: 11 },
  { x: 7, y: 11 },
  { x: 14, y: 11 },
  { x: 6, y: 12 },
  { x: 8, y: 12 },
  { x: 3, y: 14 },
  { x: 11, y: 14 }
];

export type ExtendedPremiumMapId =
  | PremiumMapId
  | "starlight"
  | "power-rings"
  | "the-core"
  | "diamond"
  | "crossfire"
  | "starburst"
  | "fortress"
  | "spider-web"
  | "four-islands";

const PREMIUM_TYPE_RESOLVERS: Record<ExtendedPremiumMapId, PremiumTypeResolver> = {
  "scaled-classic": resolveScaledClassicPremiumType,
  "center-classic": resolveScaledClassicPremiumType,
  cross: resolveCrossPremiumType,
  starlight: resolveStarlightPremiumType,
  "power-rings": resolvePowerRingsPremiumType,
  "the-core": resolveTheCorePremiumType,
  diamond: resolveDiamondPremiumType,
  crossfire: resolveCrossfirePremiumType,
  starburst: resolveStarburstPremiumType,
  fortress: resolveFortressPremiumType,
  "spider-web": resolveSpiderWebPremiumType,
  "four-islands": resolveFourIslandsPremiumType
};

export function createBoardLayout(
  boardSize: number,
  premiumMapId: ExtendedPremiumMapId = "scaled-classic"
): BoardCell[] {
  if (premiumMapId === "center-classic") {
    return createClassicalBoardLayout(boardSize);
  }

  assertSupportedBoardSize(boardSize);

  const center = Math.floor(boardSize / 2);
  const cells = new Map<string, BoardCell>();
  const resolvePremiumType = PREMIUM_TYPE_RESOLVERS[premiumMapId] ?? resolveScaledClassicPremiumType;

  for (let x = 0; x < boardSize; x += 1) {
    for (let y = 0; y < boardSize; y += 1) {
      const coordinate = { x, y };
      const dx = Math.abs(x - center);
      const dy = Math.abs(y - center);

      if (dx === 0 && dy === 0) {
        applyStartCell(cells, coordinate, premiumMapId);
        continue;
      }

      const mappedDx = scaleDistanceToClassicalAxis(dx, center);
      const mappedDy = scaleDistanceToClassicalAxis(dy, center);
      applyPremiumType(cells, coordinate, resolvePremiumType(mappedDx, mappedDy));
    }
  }

  return toSortedBoardCells(cells);
}

export function createClassicalBoardLayout(boardSize = CLASSICAL_LAYOUT_SIZE): BoardCell[] {
  assertSupportedBoardSize(boardSize);

  if (boardSize === CLASSICAL_LAYOUT_SIZE) {
    return createScaledBoardLayout(boardSize);
  }

  const offset = Math.floor((boardSize - CLASSICAL_LAYOUT_SIZE) / 2);
  const cells = new Map<string, BoardCell>();

  addEquationMultipliers(cells, shiftCoordinates(TRIPLE_EQUATION_CELLS, offset), TRIPLE_MULTIPLIER);
  addEquationMultipliers(cells, shiftCoordinates(DOUBLE_EQUATION_CELLS, offset), DOUBLE_MULTIPLIER);
  addPieceMultipliers(cells, shiftCoordinates(TRIPLE_PIECE_CELLS, offset), TRIPLE_MULTIPLIER);
  addPieceMultipliers(cells, shiftCoordinates(DOUBLE_PIECE_CELLS, offset), DOUBLE_MULTIPLIER);

  const startCell = ensureCell(cells, getStartCoordinate(boardSize));
  startCell.start = true;
  startCell.pieceMultiplier = TRIPLE_MULTIPLIER;

  return toSortedBoardCells(cells);
}

export function createScaledBoardLayout(boardSize: number): BoardCell[] {
  return createBoardLayout(boardSize, "scaled-classic");
}

export function createCrossBoardLayout(boardSize: number): BoardCell[] {
  return createBoardLayout(boardSize, "cross");
}

function resolveStarlightPremiumType(dx: number, dy: number): PremiumType {
  if (matchesAny(dx, dy, [[7, 7], [7, 0], [0, 7]])) return "3E";
  if (matchesAny(dx, dy, [[4, 4], [0, 4], [4, 0], [3, 7], [7, 3]])) return "2E";
  if (dx === dy && matchesAnyValue(dx, [2, 5])) return "3P";
  if (dx === dy && matchesAnyValue(dx, [1, 3, 6])) return "2P";
  if (matchesAny(dx, dy, [[2, 4], [4, 2]])) return "2P";
  return null;
}

function resolvePowerRingsPremiumType(dx: number, dy: number): PremiumType {
  if (dx === 7 && dy === 7) return "3E";
  if (Math.max(dx, dy) === 3) return dx === 3 && dy === 3 ? "3P" : "2P";
  if (matchesAny(dx, dy, [[0, 6], [6, 0], [5, 5]])) return "2E";
  if (matchesAny(dx, dy, [[7, 0], [0, 7]])) return "3P";
  return null;
}

function resolveTheCorePremiumType(dx: number, dy: number): PremiumType {
  if (matchesAny(dx, dy, [[7, 7], [7, 0], [0, 7]])) return "3E";
  if (dx + dy === 1) return "3P";
  if (dx + dy === 2) return "2P";
  if (dx === 2 && dy === 2) return "3P";
  if (matchesAny(dx, dy, [[0, 4], [4, 0], [5, 5]])) return "2E";
  if (matchesAny(dx, dy, [[3, 6], [6, 3]])) return "2P";
  return null;
}

function resolveDiamondPremiumType(dx: number, dy: number): PremiumType {
  if (matchesAny(dx, dy, [[7, 7], [7, 0], [0, 7]])) return "3E";
  if (dx + dy === 7 && dx !== 7 && dy !== 7) return "3P";
  if (dx + dy === 4) return "2E";
  if (dx === dy && matchesAnyValue(dx, [2, 6])) return "2P";
  return null;
}

function resolveCrossfirePremiumType(dx: number, dy: number): PremiumType {
  if (matchesAny(dx, dy, [[7, 0], [0, 7]])) return "3E";
  if ((dx === 0 && dy >= 2 && dy <= 6) || (dy === 0 && dx >= 2 && dx <= 6)) return "2E";
  if (dx === 7 && dy === 7) return "3P";
  if (dx === dy && dx >= 2 && dx <= 5) return "2P";
  if (matchesAny(dx, dy, [[6, 2], [2, 6]])) return "3P";
  return null;
}

function resolveStarburstPremiumType(dx: number, dy: number): PremiumType {
  if (dx === 7 && dy === 7) return "3E";
  if (matchesAny(dx, dy, [[7, 0], [0, 7]])) return "3P";
  if (dx === dy && dx >= 3 && dx <= 5) return "2E";
  if (dx + dy === 5 && dx !== 0 && dy !== 0) return "2P";
  if (dx + dy === 9 && dx !== 0 && dy !== 0 && dx !== 7 && dy !== 7) return "2P";
  return null;
}

function resolveFortressPremiumType(dx: number, dy: number): PremiumType {
  if (matchesAny(dx, dy, [[7, 7], [7, 0], [0, 7]])) return "3E";
  if (Math.max(dx, dy) === 2) return "2E";
  if (Math.max(dx, dy) === 5) return dx === 5 && dy === 5 ? "3P" : "2P";
  return null;
}

function resolveSpiderWebPremiumType(dx: number, dy: number): PremiumType {
  if (matchesAny(dx, dy, [[7, 7], [7, 0], [0, 7]])) return "3E";
  if ((dx === 0 && dy >= 2 && dy <= 6) || (dy === 0 && dx >= 2 && dx <= 6)) return "2E";
  if (dx === dy && dx >= 2 && dx <= 6) return "2P";
  if (dx + dy === 7 && dx !== 0 && dy !== 0 && dx !== 7 && dy !== 7) return "3P";
  return null;
}

function resolveFourIslandsPremiumType(dx: number, dy: number): PremiumType {
  if (matchesAny(dx, dy, [[7, 7], [7, 0], [0, 7]])) return "3P";
  if (dx === 4 && dy === 4) return "3E";
  if (Math.abs(dx - 4) + Math.abs(dy - 4) === 1) return "2E";
  if (Math.abs(dx - 4) + Math.abs(dy - 4) === 2) return "2P";
  return null;
}

function resolveCrossPremiumType(dx: number, dy: number): PremiumType {
  if (matchesAny(dx, dy, [[0, 7], [7, 7], [7, 0]])) return "3E";
  if (matchesAny(dx, dy, [[0, 4], [4, 0], [5, 5]])) return "2E";
  if (matchesAny(dx, dy, [[0, 3], [3, 0], [3, 3]])) return "3P";
  if (matchesAny(dx, dy, [[1, 5], [5, 1], [3, 5], [5, 3], [0, 6], [6, 0]])) return "2P";
  return null;
}

function resolveScaledClassicPremiumType(dx: number, dy: number): PremiumType {
  if (matchesAny(dx, dy, [[7, 7], [7, 0], [0, 7]])) return "3E";
  if (dx === dy && dx >= 3 && dx <= 6) return "2E";
  if (matchesAny(dx, dy, [[2, 2], [2, 6], [6, 2]])) return "3P";
  if (matchesAny(dx, dy, [[0, 4], [4, 0], [1, 1], [1, 5], [5, 1], [4, 7], [7, 4]])) return "2P";
  return null;
}

function assertSupportedBoardSize(boardSize: number): void {
  if (boardSize < MIN_BOARD_SIZE || boardSize % 2 === 0) {
    throw new Error("Board size must be an odd number at least 15");
  }
}

function applyStartCell(
  cells: Map<string, BoardCell>,
  coordinate: Coordinate,
  premiumMapId: ExtendedPremiumMapId
): void {
  const startCell = ensureCell(cells, coordinate);
  startCell.start = true;

  if (premiumMapId !== "four-islands") {
    startCell.pieceMultiplier = TRIPLE_MULTIPLIER;
  }
}

function scaleDistanceToClassicalAxis(distanceFromCenter: number, center: number): number {
  return Math.round((distanceFromCenter / center) * CLASSICAL_CENTER_OFFSET);
}

function applyPremiumType(cells: Map<string, BoardCell>, coordinate: Coordinate, premiumType: PremiumType): void {
  if (!premiumType) {
    return;
  }

  const cell = ensureCell(cells, coordinate);

  switch (premiumType) {
    case "3E":
      cell.equationMultiplier = TRIPLE_MULTIPLIER;
      return;
    case "2E":
      cell.equationMultiplier = DOUBLE_MULTIPLIER;
      return;
    case "3P":
      cell.pieceMultiplier = TRIPLE_MULTIPLIER;
      return;
    case "2P":
      cell.pieceMultiplier = DOUBLE_MULTIPLIER;
      return;
  }
}

function matchesAny(dx: number, dy: number, coordinates: ReadonlyArray<readonly [number, number]>): boolean {
  return coordinates.some(([targetDx, targetDy]) => dx === targetDx && dy === targetDy);
}

function matchesAnyValue(value: number, values: readonly number[]): boolean {
  return values.includes(value);
}

function ensureCell(cells: Map<string, BoardCell>, coordinate: Coordinate): BoardCell {
  const key = cellKey(coordinate);
  let cell = cells.get(key);

  if (!cell) {
    cell = { ...coordinate };
    cells.set(key, cell);
  }

  return cell;
}

function addEquationMultipliers(
  cells: Map<string, BoardCell>,
  coordinates: readonly Coordinate[],
  multiplier: number
): void {
  for (const coordinate of coordinates) {
    ensureCell(cells, coordinate).equationMultiplier = multiplier;
  }
}

function addPieceMultipliers(
  cells: Map<string, BoardCell>,
  coordinates: readonly Coordinate[],
  multiplier: number
): void {
  for (const coordinate of coordinates) {
    ensureCell(cells, coordinate).pieceMultiplier = multiplier;
  }
}

function shiftCoordinates(coordinates: readonly Coordinate[], offset: number): Coordinate[] {
  return coordinates.map((coordinate) => ({
    x: coordinate.x + offset,
    y: coordinate.y + offset
  }));
}

function toSortedBoardCells(cells: ReadonlyMap<string, BoardCell>): BoardCell[] {
  return [...cells.values()].sort((left, right) => left.y - right.y || left.x - right.x);
}

export function getBoardCell(layout: readonly BoardCell[], coordinate: Coordinate): BoardCell {
  return layout.find((cell) => cell.x === coordinate.x && cell.y === coordinate.y) ?? coordinate;
}

export function getStartCoordinate(boardSize = CLASSICAL_LAYOUT_SIZE): Coordinate {
  const center = Math.floor(boardSize / 2);
  return { x: center, y: center };
}

export function detectDirection(tiles: readonly Coordinate[]): Direction {
  const sameRow = tiles.every((tile) => tile.y === tiles[0]?.y);
  const sameColumn = tiles.every((tile) => tile.x === tiles[0]?.x);

  if (sameRow) return "horizontal";
  if (sameColumn) return "vertical";

  throw new Error("Placed tiles must align horizontally or vertically");
}

export function buildContiguousLine(params: {
  board: readonly BoardTile[];
  placements: readonly BoardTile[];
  direction: Direction;
}): BoardTile[] {
  const { board, direction, placements } = params;
  const tilesByPosition = new Map<number, BoardTile>();
  const fixedAxis = direction === "horizontal" ? placements[0]?.y : placements[0]?.x;

  for (const tile of [...board, ...placements]) {
    if (direction === "horizontal" ? tile.y === fixedAxis : tile.x === fixedAxis) {
      tilesByPosition.set(direction === "horizontal" ? tile.x : tile.y, tile);
    }
  }

  const placementPositions = placements.map((tile) => (direction === "horizontal" ? tile.x : tile.y));
  let start = Math.min(...placementPositions);
  let end = Math.max(...placementPositions);

  while (tilesByPosition.has(start - 1)) start -= 1;
  while (tilesByPosition.has(end + 1)) end += 1;

  const inPlayLine: BoardTile[] = [];

  for (let position = start; position <= end; position += 1) {
    const tile = tilesByPosition.get(position);

    if (!tile) {
      throw new Error("Equation line cannot contain empty gaps");
    }

    inPlayLine.push(tile);
  }

  ensureNoGaps(inPlayLine, direction);
  return inPlayLine;
}

export function coversStart(tiles: readonly Coordinate[], boardSize = CLASSICAL_LAYOUT_SIZE): boolean {
  const start = getStartCoordinate(boardSize);
  return tiles.some((tile) => tile.x === start.x && tile.y === start.y);
}

function ensureNoGaps(line: readonly BoardTile[], direction: Direction): void {
  for (let index = 1; index < line.length; index += 1) {
    const previous = line[index - 1];
    const current = line[index];
    const delta = direction === "horizontal" ? current.x - previous.x : current.y - previous.y;

    if (delta !== 1) {
      throw new Error("Equation line cannot contain empty gaps");
    }
  }
}
