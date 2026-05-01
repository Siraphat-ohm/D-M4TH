import type { BoardCell, BoardTile, Coordinate, Direction } from "./types";

export const START_COORDINATE: Coordinate = { x: 7, y: 7 };
const CLASSICAL_LAYOUT_SIZE = 15;

const DOUBLE_MULTIPLIER = 2;
const TRIPLE_MULTIPLIER = 3;

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

export function createClassicalBoardLayout(boardSize = CLASSICAL_LAYOUT_SIZE): BoardCell[] {
  const offset = centeredClassicalOffset(boardSize);
  const cells = new Map<string, BoardCell>();
  addEquationMultipliers(cells, shiftCoordinates(TRIPLE_EQUATION_CELLS, offset), TRIPLE_MULTIPLIER);
  addEquationMultipliers(cells, shiftCoordinates(DOUBLE_EQUATION_CELLS, offset), DOUBLE_MULTIPLIER);
  addPieceMultipliers(cells, shiftCoordinates(TRIPLE_PIECE_CELLS, offset), TRIPLE_MULTIPLIER);
  addPieceMultipliers(cells, shiftCoordinates(DOUBLE_PIECE_CELLS, offset), DOUBLE_MULTIPLIER);

  const startCell = ensureCell(cells, getStartCoordinate(boardSize));
  startCell.start = true;
  startCell.pieceMultiplier = TRIPLE_MULTIPLIER;

  return [...cells.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

export function cellKey({ x, y }: Coordinate): string {
  return `${x}:${y}`;
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

  if (sameRow) {
    return "horizontal";
  }

  if (sameColumn) {
    return "vertical";
  }

  throw new Error("Placed tiles must align horizontally or vertically");
}

export function buildContiguousLine(params: {
  board: readonly BoardTile[];
  placements: readonly BoardTile[];
  direction: Direction;
}): BoardTile[] {
  const { board, direction, placements } = params;
  const allTiles = [...board, ...placements];
  const fixedAxis = direction === "horizontal" ? placements[0]?.y : placements[0]?.x;
  const sameAxisTiles = allTiles.filter((tile) => {
    return direction === "horizontal" ? tile.y === fixedAxis : tile.x === fixedAxis;
  });
  const tilesByPosition = new Map<number, BoardTile>();

  for (const tile of sameAxisTiles) {
    tilesByPosition.set(direction === "horizontal" ? tile.x : tile.y, tile);
  }

  const placementPositions = placements.map((tile) => (direction === "horizontal" ? tile.x : tile.y));
  let start = Math.min(...placementPositions);
  let end = Math.max(...placementPositions);

  while (tilesByPosition.has(start - 1)) {
    start -= 1;
  }

  while (tilesByPosition.has(end + 1)) {
    end += 1;
  }

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

function centeredClassicalOffset(boardSize: number): Coordinate {
  if (boardSize < CLASSICAL_LAYOUT_SIZE || boardSize % 2 === 0) {
    throw new Error("Board size must be an odd number at least 15");
  }

  const offset = (boardSize - CLASSICAL_LAYOUT_SIZE) / 2;
  return { x: offset, y: offset };
}

function shiftCoordinates(coordinates: readonly Coordinate[], offset: Coordinate): Coordinate[] {
  return coordinates.map((coordinate) => ({
    x: coordinate.x + offset.x,
    y: coordinate.y + offset.y
  }));
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

function ensureCell(cells: Map<string, BoardCell>, coordinate: Coordinate): BoardCell {
  const key = cellKey(coordinate);
  const existingCell = cells.get(key);

  if (existingCell) {
    return existingCell;
  }

  const cell = { ...coordinate };
  cells.set(key, cell);
  return cell;
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
