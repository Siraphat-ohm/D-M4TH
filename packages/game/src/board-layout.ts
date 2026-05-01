import type { BoardCell, BoardTile, Coordinate, Direction } from "./types";
import type { PremiumMapId } from "@d-m4th/config";
import { cellKey } from "./utils";

// --- Classical layout constants (15x15) ---

export const START_COORDINATE: Coordinate = { x: 7, y: 7 };
const CLASSICAL_LAYOUT_SIZE = 15;
const CLASSICAL_HALF_SIZE = 7;

const DOUBLE_MULTIPLIER = 2;
const TRIPLE_MULTIPLIER = 3;
const CLASSICAL_BOARD_AREA = CLASSICAL_LAYOUT_SIZE * CLASSICAL_LAYOUT_SIZE;
const CLASSICAL_TRIPLE_EQUATION_COUNT = 8;
const CLASSICAL_DOUBLE_EQUATION_COUNT = 16;
const CLASSICAL_TRIPLE_PIECE_COUNT = 13;
const CLASSICAL_DOUBLE_PIECE_COUNT = 24;

// Hardcoded classical positions for backward-compatible centering on larger boards.
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

// --- Scaled layout generators (centered coordinates) ---
//
// Each generator is a single point in centered coordinates (relative to board center).
// Four-fold rotation (dx,dy) -> (-dy,dx) -> (-dx,-dy) -> (dy,-dx) produces all
// symmetric counterparts. One generator per unique orbit.
//
// Classical 15x15 cell counts and ratios (out of 225 total cells):
//   3E:  8 cells (3.56%) — 2 generators x 4 rotations
//   2E: 16 cells (7.11%) — 4 generators x 4 rotations
//   3P: 13 cells (5.78%) — 1 center + 3 generators x 4 rotations
//   2P: 24 cells (10.67%) — 6 generators x 4 rotations
//   Total: 61 unique premium cells, 164 non-premium cells

interface ScaledGenerator {
  dx: number;
  dy: number;
}

const TRIPLE_EQUATION_GENERATORS: readonly ScaledGenerator[] = [
  { dx: 7, dy: 0 },
  { dx: 7, dy: 7 }
];

const DOUBLE_EQUATION_GENERATORS: readonly ScaledGenerator[] = [
  { dx: 3, dy: 3 },
  { dx: 4, dy: 4 },
  { dx: 5, dy: 5 },
  { dx: 6, dy: 6 }
];

const TRIPLE_PIECE_GENERATORS: readonly ScaledGenerator[] = [
  { dx: 2, dy: 2 },
  { dx: 2, dy: 6 },
  { dx: 6, dy: 2 }
];

const DOUBLE_PIECE_GENERATORS: readonly ScaledGenerator[] = [
  { dx: 0, dy: 4 },
  { dx: 1, dy: 1 },
  { dx: 1, dy: 5 },
  { dx: 5, dy: 1 },
  { dx: 4, dy: 7 },
  { dx: 7, dy: 4 }
];

const CROSS_TRIPLE_EQUATION_GENERATORS: readonly ScaledGenerator[] = [
  { dx: 0, dy: 7 },
  { dx: 7, dy: 7 }
];

const CROSS_DOUBLE_EQUATION_GENERATORS: readonly ScaledGenerator[] = [
  { dx: 0, dy: 4 },
  { dx: 4, dy: 0 },
  { dx: 5, dy: 5 }
];

const CROSS_TRIPLE_PIECE_GENERATORS: readonly ScaledGenerator[] = [
  { dx: 0, dy: 3 },
  { dx: 3, dy: 0 },
  { dx: 3, dy: 3 }
];

const CROSS_DOUBLE_PIECE_GENERATORS: readonly ScaledGenerator[] = [
  { dx: 1, dy: 5 },
  { dx: 5, dy: 1 },
  { dx: 3, dy: 5 },
  { dx: 5, dy: 3 },
  { dx: 0, dy: 6 },
  { dx: 6, dy: 0 }
];

// --- Public API ---

export function createBoardLayout(boardSize: number, premiumMapId: PremiumMapId = "scaled-classic"): BoardCell[] {
  switch (premiumMapId) {
    case "center-classic":
      return createClassicalBoardLayout(boardSize);
    case "cross":
      return createCrossBoardLayout(boardSize);
    case "scaled-classic":
      return createScaledBoardLayout(boardSize);
  }
}

/**
 * Creates the classical 15x15 board layout, optionally centered on a larger odd-sized board.
 * For party mode with proportional layout, use `createScaledBoardLayout` instead.
 */
export function createClassicalBoardLayout(boardSize = CLASSICAL_LAYOUT_SIZE): BoardCell[] {
  if (boardSize === CLASSICAL_LAYOUT_SIZE) {
    return createScaledBoardLayout(boardSize);
  }

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

/**
 * Creates a proportional board layout for any odd board size.
 * Premium cell positions are scaled from the classical 15x15 generator positions,
 * maintaining the same density ratios and quadrantal (4-fold rotational) symmetry.
 */
export function createScaledBoardLayout(boardSize: number): BoardCell[] {
  ensureScalableBoardSize(boardSize);

  return createScaledLayoutFromGenerators({
    boardSize,
    tripleEquationGenerators: TRIPLE_EQUATION_GENERATORS,
    doubleEquationGenerators: DOUBLE_EQUATION_GENERATORS,
    triplePieceGenerators: TRIPLE_PIECE_GENERATORS,
    doublePieceGenerators: DOUBLE_PIECE_GENERATORS
  });
}

/**
 * Creates a cross-heavy party layout for any odd board size at least 15.
 * Premium cells preserve rotational symmetry while emphasizing center lanes.
 */
export function createCrossBoardLayout(boardSize: number): BoardCell[] {
  ensureScalableBoardSize(boardSize);

  return createScaledLayoutFromGenerators({
    boardSize,
    tripleEquationGenerators: CROSS_TRIPLE_EQUATION_GENERATORS,
    doubleEquationGenerators: CROSS_DOUBLE_EQUATION_GENERATORS,
    triplePieceGenerators: CROSS_TRIPLE_PIECE_GENERATORS,
    doublePieceGenerators: CROSS_DOUBLE_PIECE_GENERATORS
  });
}

function createScaledLayoutFromGenerators(params: {
  boardSize: number;
  tripleEquationGenerators: readonly ScaledGenerator[];
  doubleEquationGenerators: readonly ScaledGenerator[];
  triplePieceGenerators: readonly ScaledGenerator[];
  doublePieceGenerators: readonly ScaledGenerator[];
}): BoardCell[] {
  const {
    boardSize,
    doubleEquationGenerators,
    doublePieceGenerators,
    tripleEquationGenerators,
    triplePieceGenerators
  } = params;

  if (boardSize < CLASSICAL_LAYOUT_SIZE || boardSize % 2 === 0) {
    throw new Error("Board size must be an odd number at least 15");
  }

  const center = Math.floor(boardSize / 2);
  const scale = center / CLASSICAL_HALF_SIZE;
  const cells = new Map<string, BoardCell>();

  applyScaledGenerators(
    cells,
    tripleEquationGenerators,
    scale,
    center,
    (cell, mult) => { cell.equationMultiplier = mult; },
    TRIPLE_MULTIPLIER
  );

  applyScaledGenerators(
    cells,
    doubleEquationGenerators,
    scale,
    center,
    (cell, mult) => { cell.equationMultiplier = mult; },
    DOUBLE_MULTIPLIER
  );

  applyScaledGenerators(
    cells,
    triplePieceGenerators,
    scale,
    center,
    (cell, mult) => { cell.pieceMultiplier = mult; },
    TRIPLE_MULTIPLIER
  );

  applyScaledGenerators(
    cells,
    doublePieceGenerators,
    scale,
    center,
    (cell, mult) => { cell.pieceMultiplier = mult; },
    DOUBLE_MULTIPLIER
  );

  const startCoord = { x: center, y: center };
  const startCell = ensureCell(cells, startCoord);
  startCell.start = true;
  startCell.pieceMultiplier = TRIPLE_MULTIPLIER;
  growPremiumDensity(cells, boardSize);

  return [...cells.values()].sort((a, b) => a.y - b.y || a.x - b.x);
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

// --- Internal helpers ---

/**
 * Scales generators, applies 4-fold rotation, and sets the appropriate multiplier
 * on each generated cell. Deduplicates via ensureCell.
 */
function applyScaledGenerators(
  cells: Map<string, BoardCell>,
  generators: readonly ScaledGenerator[],
  scale: number,
  center: number,
  applyMultiplier: (cell: BoardCell, multiplier: number) => void,
  multiplier: number
): void {
  for (const { dx, dy } of generators) {
    const scaledDx = Math.round(dx * scale);
    const scaledDy = Math.round(dy * scale);

    for (const [rdx, rdy] of fourFoldRotations(scaledDx, scaledDy)) {
      const boardX = center + rdx;
      const boardY = center + rdy;
      const cell = ensureCell(cells, { x: boardX, y: boardY });
      applyMultiplier(cell, multiplier);
    }
  }
}

/** Yields the 4 rotation points of (dx, dy) under 90-degree rotation about origin. */
function fourFoldRotations(dx: number, dy: number): readonly [number, number][] {
  return [
    [dx, dy],
    [-dy, dx],
    [-dx, -dy],
    [dy, -dx]
  ];
}

function growPremiumDensity(cells: Map<string, BoardCell>, boardSize: number): void {
  fillSymmetricPremiumCells({
    cells,
    boardSize,
    targetCount: targetSymmetricCount(CLASSICAL_TRIPLE_EQUATION_COUNT, boardSize, false),
    kind: "equation",
    multiplier: TRIPLE_MULTIPLIER,
    score: scoreTripleEquationOrbit
  });

  fillSymmetricPremiumCells({
    cells,
    boardSize,
    targetCount: targetSymmetricCount(CLASSICAL_DOUBLE_EQUATION_COUNT, boardSize, false),
    kind: "equation",
    multiplier: DOUBLE_MULTIPLIER,
    score: scoreDoubleEquationOrbit
  });

  fillSymmetricPremiumCells({
    cells,
    boardSize,
    targetCount: targetSymmetricCount(CLASSICAL_TRIPLE_PIECE_COUNT, boardSize, true),
    kind: "piece",
    multiplier: TRIPLE_MULTIPLIER,
    score: scoreTriplePieceOrbit
  });

  fillSymmetricPremiumCells({
    cells,
    boardSize,
    targetCount: targetSymmetricCount(CLASSICAL_DOUBLE_PIECE_COUNT, boardSize, false),
    kind: "piece",
    multiplier: DOUBLE_MULTIPLIER,
    score: scoreDoublePieceOrbit
  });
}

function targetSymmetricCount(classicalCount: number, boardSize: number, includesCenter: boolean): number {
  const scaledCount = Math.round(classicalCount * (boardSize * boardSize) / CLASSICAL_BOARD_AREA);

  if (includesCenter) {
    return 1 + Math.round((scaledCount - 1) / 4) * 4;
  }

  return Math.round(scaledCount / 4) * 4;
}

function fillSymmetricPremiumCells(params: {
  cells: Map<string, BoardCell>;
  boardSize: number;
  targetCount: number;
  kind: "equation" | "piece";
  multiplier: number;
  score: (orbit: readonly Coordinate[], center: number) => number;
}): void {
  const { boardSize, cells, kind, multiplier, score, targetCount } = params;
  const center = Math.floor(boardSize / 2);
  const candidates = createSymmetricOrbits(boardSize)
    .filter((orbit) => orbit.every((coordinate) => canApplyPremium(cells, coordinate, kind)))
    .sort((a, b) => score(a, center) - score(b, center) || orbitKey(a).localeCompare(orbitKey(b)));

  for (const orbit of candidates) {
    if (countPremiumCells(cells, kind, multiplier) >= targetCount) {
      return;
    }

    applyPremiumOrbit(cells, orbit, kind, multiplier);
  }
}

function createSymmetricOrbits(boardSize: number): Coordinate[][] {
  const center = Math.floor(boardSize / 2);
  const orbitByKey = new Map<string, Coordinate[]>();

  for (let dx = 0; dx <= center; dx += 1) {
    for (let dy = 0; dy <= center; dy += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      const orbit = uniqueCoordinates(
        fourFoldRotations(dx, dy).map(([rdx, rdy]) => ({
          x: center + rdx,
          y: center + rdy
        }))
      );
      orbitByKey.set(orbitKey(orbit), orbit);
    }
  }

  return [...orbitByKey.values()];
}

function uniqueCoordinates(coordinates: readonly Coordinate[]): Coordinate[] {
  const byKey = new Map<string, Coordinate>();

  for (const coordinate of coordinates) {
    byKey.set(cellKey(coordinate), coordinate);
  }

  return [...byKey.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

function canApplyPremium(cells: Map<string, BoardCell>, coordinate: Coordinate, kind: "equation" | "piece"): boolean {
  const cell = cells.get(cellKey(coordinate));

  if (!cell) {
    return true;
  }

  return kind === "equation"
    ? cell.equationMultiplier === undefined && cell.pieceMultiplier === undefined
    : cell.pieceMultiplier === undefined && cell.equationMultiplier === undefined && !cell.start;
}

function applyPremiumOrbit(
  cells: Map<string, BoardCell>,
  orbit: readonly Coordinate[],
  kind: "equation" | "piece",
  multiplier: number
): void {
  for (const coordinate of orbit) {
    const cell = ensureCell(cells, coordinate);

    if (kind === "equation") {
      cell.equationMultiplier = multiplier;
    } else {
      cell.pieceMultiplier = multiplier;
    }
  }
}

function countPremiumCells(cells: Map<string, BoardCell>, kind: "equation" | "piece", multiplier: number): number {
  return [...cells.values()].filter((cell) => (
    kind === "equation" ? cell.equationMultiplier === multiplier : cell.pieceMultiplier === multiplier
  )).length;
}

function scoreTripleEquationOrbit(orbit: readonly Coordinate[], center: number): number {
  return orbitScore(orbit, center, (dx, dy) => (center - Math.max(dx, dy)) * 100 + Math.min(dx, dy));
}

function scoreDoubleEquationOrbit(orbit: readonly Coordinate[], center: number): number {
  return orbitScore(orbit, center, (dx, dy) => Math.abs(dx - dy) * 100 + (center - Math.max(dx, dy)));
}

function scoreTriplePieceOrbit(orbit: readonly Coordinate[], center: number): number {
  const targetRing = Math.round(center * 0.42);
  return orbitScore(orbit, center, (dx, dy) => Math.abs(Math.max(dx, dy) - targetRing) * 20 + Math.abs(dx - dy));
}

function scoreDoublePieceOrbit(orbit: readonly Coordinate[], center: number): number {
  const targetRing = Math.round(center * 0.68);
  return orbitScore(orbit, center, (dx, dy) => Math.abs(Math.max(dx, dy) - targetRing) * 20 + Math.min(dx, dy));
}

function orbitScore(
  orbit: readonly Coordinate[],
  center: number,
  scoreCoordinate: (dx: number, dy: number) => number
): number {
  return Math.min(
    ...orbit.map((coordinate) => scoreCoordinate(Math.abs(coordinate.x - center), Math.abs(coordinate.y - center)))
  );
}

function orbitKey(orbit: readonly Coordinate[]): string {
  return orbit.map(cellKey).join("|");
}

function centeredClassicalOffset(boardSize: number): Coordinate {
  if (boardSize < CLASSICAL_LAYOUT_SIZE || boardSize % 2 === 0) {
    throw new Error("Board size must be an odd number at least 15");
  }

  const offset = (boardSize - CLASSICAL_LAYOUT_SIZE) / 2;
  return { x: offset, y: offset };
}

function ensureScalableBoardSize(boardSize: number): void {
  if (boardSize < CLASSICAL_LAYOUT_SIZE || boardSize % 2 === 0) {
    throw new Error("Board size must be an odd number at least 15");
  }
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
