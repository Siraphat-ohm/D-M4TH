import type { BoardCell, BoardTile, Coordinate, Direction } from "./types";
import type { PremiumMapId } from "@d-m4th/config";
import { cellKey } from "./utils";

// --- Constants ---
export const CLASSICAL_LAYOUT_SIZE = 15;
export const START_COORDINATE: Coordinate = { x: 7, y: 7 };
const TRIPLE_MULTIPLIER = 3;
const DOUBLE_MULTIPLIER = 2;

type PremiumType = '3E' | '2E' | '3P' | '2P' | null;

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

// Extended Premium Map IDs to include new layouts
// (Note: You may want to also update PREMIUM_MAP_OPTIONS in your @d-m4th/config file to reflect these)
export type ExtendedPremiumMapId = PremiumMapId | "starlight" | "power-rings" | "the-core" | "diamond" | "crossfire" | "starburst" | "fortress" | "spider-web" | "four-islands";

// --- Public API: Board Generation ---

export function createBoardLayout(boardSize: number, premiumMapId: ExtendedPremiumMapId = "scaled-classic"): BoardCell[] {
  if (premiumMapId === "center-classic") {
    return createClassicalBoardLayout(boardSize);
  }

  if (boardSize < CLASSICAL_LAYOUT_SIZE || boardSize % 2 === 0) {
    throw new Error("Board size must be an odd number at least 15");
  }

  const center = Math.floor(boardSize / 2);
  const cells = new Map<string, BoardCell>();

  // วนลูปวาดกระดานทุกช่อง
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      const coordinate: Coordinate = { x, y };
      const dx = Math.abs(x - center);
      const dy = Math.abs(y - center);

      // วางจุด Start ที่กึ่งกลางเสมอ (ยกเว้นโหมด four-islands ที่จะมี Star แค่หน้าตา แต่ของจริงอยู่ตามเกาะ)
      if (dx === 0 && dy === 0) {
        const cell = ensureCell(cells, coordinate);
        cell.start = true;
        // ปรับแก้เล็กน้อยสำหรับโหมด The Core ที่ตรงกลางควรเป็น Multiplier อื่นถ้าไม่อยากให้ทับกัน
        if (premiumMapId !== "four-islands") {
             cell.pieceMultiplier = TRIPLE_MULTIPLIER;
        }
        continue;
      }

      // แปลงพิกัด (Map) กลับไปเทียบกับสัดส่วน 15x15 (มีพิกัดสูงสุดจากศูนย์กลางคือ 7)
      const mappedDx = Math.round((dx / center) * 7);
      const mappedDy = Math.round((dy / center) * 7);

      // ดึงประเภทช่องพรีเมียมตาม Layout ที่เลือก
      const type = getPremiumType(premiumMapId, mappedDx, mappedDy);

      if (!type) {
        continue;
      }

      const cell = ensureCell(cells, coordinate);

      if (type === '3E') cell.equationMultiplier = TRIPLE_MULTIPLIER;
      else if (type === '2E') cell.equationMultiplier = DOUBLE_MULTIPLIER;
      else if (type === '3P') cell.pieceMultiplier = TRIPLE_MULTIPLIER;
      else if (type === '2P') cell.pieceMultiplier = DOUBLE_MULTIPLIER;
    }
  }

  // คืนค่าเป็น Array เรียงตามแกน Y และ X
  return [...cells.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

export function createClassicalBoardLayout(boardSize = CLASSICAL_LAYOUT_SIZE): BoardCell[] {
  if (boardSize < CLASSICAL_LAYOUT_SIZE || boardSize % 2 === 0) {
    throw new Error("Board size must be an odd number at least 15");
  }

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

  return [...cells.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

export function createScaledBoardLayout(boardSize: number): BoardCell[] {
  return createBoardLayout(boardSize, "scaled-classic");
}

export function createCrossBoardLayout(boardSize: number): BoardCell[] {
  return createBoardLayout(boardSize, "cross");
}

// --- Layout Definitions (Coordinate Mapping Rules) ---

function getPremiumType(mapId: ExtendedPremiumMapId, dx: number, dy: number): PremiumType {
  switch (mapId) {
    // --- Balanced Layouts (เน้นความแฟร์) ---
    case "starlight":
      if ((dx === 7 && dy === 7) || (dx === 7 && dy === 0) || (dx === 0 && dy === 7)) return '3E';
      if ((dx === 4 && dy === 4) || (dx === 0 && dy === 4) || (dx === 4 && dy === 0)) return '2E';
      if ((dx === 3 && dy === 7) || (dx === 7 && dy === 3)) return '2E';
      if (dx === dy && (dx === 2 || dx === 5)) return '3P';
      if (dx === dy && (dx === 1 || dx === 3 || dx === 6)) return '2P';
      if ((dx === 2 && dy === 4) || (dx === 4 && dy === 2)) return '2P';
      return null;

    case "power-rings":
      if (dx === 7 && dy === 7) return '3E';
      if (Math.max(dx, dy) === 3) return (dx === 3 && dy === 3) ? '3P' : '2P';
      if ((dx === 0 && dy === 6) || (dy === 0 && dx === 6) || (dx === dy && dx === 5)) return '2E';
      if ((dx === 7 && dy === 0) || (dx === 0 && dy === 7)) return '3P';
      return null;

    case "the-core":
      if ((dx === 7 && dy === 7) || (dx === 7 && dy === 0) || (dx === 0 && dy === 7)) return '3E';
      if (dx + dy === 1) return '3P';
      if (dx + dy === 2) return '2P';
      if (dx === 2 && dy === 2) return '3P';
      if ((dx === 0 && dy === 4) || (dy === 0 && dx === 4) || (dx === dy && dx === 5)) return '2E';
      if ((dx === 3 && dy === 6) || (dx === 6 && dy === 3)) return '2P';
      return null;

    // --- Thematic Layouts (เน้นความแปลกใหม่) ---
    case "diamond":
      if ((dx === 7 && dy === 7) || (dx === 7 && dy === 0) || (dx === 0 && dy === 7)) return '3E';
      if (dx + dy === 7 && dx !== 7 && dy !== 7) return '3P';
      if (dx + dy === 4) return '2E';
      if (dx === dy && (dx === 2 || dx === 6)) return '2P';
      return null;

    case "crossfire":
      if ((dx === 7 && dy === 0) || (dx === 0 && dy === 7)) return '3E';
      if ((dx === 0 && dy >= 2 && dy <= 6) || (dy === 0 && dx >= 2 && dx <= 6)) return '2E';
      if (dx === 7 && dy === 7) return '3P';
      if (dx === dy && dx >= 2 && dx <= 5) return '2P';
      if ((dx === 6 && dy === 2) || (dx === 2 && dy === 6)) return '3P';
      return null;

    case "starburst":
      if (dx === 7 && dy === 7) return '3E';
      if ((dx === 7 && dy === 0) || (dx === 0 && dy === 7)) return '3P';
      if (dx === dy && dx >= 3 && dx <= 5) return '2E';
      if (dx + dy === 5 && dx !== 0 && dy !== 0) return '2P';
      if (dx + dy === 9 && dx !== 0 && dy !== 0 && dx !== 7 && dy !== 7) return '2P';
      return null;

    case "fortress":
      if ((dx === 7 && dy === 7) || (dx === 7 && dy === 0) || (dx === 0 && dy === 7)) return '3E';
      if (Math.max(dx, dy) === 2) return '2E';
      if (Math.max(dx, dy) === 5) return (dx === 5 && dy === 5) ? '3P' : '2P';
      return null;

    case "spider-web":
      if ((dx === 7 && dy === 7) || (dx === 7 && dy === 0) || (dx === 0 && dy === 7)) return '3E';
      if ((dx === 0 && dy >= 2 && dy <= 6) || (dy === 0 && dx >= 2 && dx <= 6)) return '2E';
      if (dx === dy && dx >= 2 && dx <= 6) return '2P';
      if (dx + dy === 7 && dx !== 0 && dy !== 0 && dx !== 7 && dy !== 7) return '3P';
      return null;

    case "four-islands":
      if ((dx === 7 && dy === 7) || (dx === 7 && dy === 0) || (dx === 0 && dy === 7)) return '3P';
      if (dx === 4 && dy === 4) return '3E';
      if (Math.abs(dx - 4) + Math.abs(dy - 4) === 1) return '2E';
      if (Math.abs(dx - 4) + Math.abs(dy - 4) === 2) return '2P';
      return null;

    case "cross":
      // Re-implemented Cross from original intent using mapped coordinates
      if ((dx === 0 && dy === 7) || (dx === 7 && dy === 7) || (dx === 7 && dy === 0)) return '3E';
      if ((dx === 0 && dy === 4) || (dx === 4 && dy === 0) || (dx === 5 && dy === 5)) return '2E';
      if ((dx === 0 && dy === 3) || (dx === 3 && dy === 0) || (dx === 3 && dy === 3)) return '3P';
      if ((dx === 1 && dy === 5) || (dx === 5 && dy === 1) || (dx === 3 && dy === 5) || (dx === 5 && dy === 3) || (dx === 0 && dy === 6) || (dx === 6 && dy === 0)) return '2P';
      return null;

    case "scaled-classic":
    case "center-classic": // Fallback for center-classic to act like scaled in this new system
    default:
      // Original 15x15 Rules
      if ((dx === 7 && dy === 7) || (dx === 7 && dy === 0) || (dx === 0 && dy === 7)) return '3E';
      if (dx === dy && dx >= 3 && dx <= 6) return '2E';
      if ((dx === 2 && dy === 2) || (dx === 2 && dy === 6) || (dx === 6 && dy === 2)) return '3P';
      if (
        (dx === 0 && dy === 4) || (dx === 4 && dy === 0) ||
        (dx === 1 && dy === 1) || (dx === 1 && dy === 5) || (dx === 5 && dy === 1) ||
        (dx === 4 && dy === 7) || (dx === 7 && dy === 4)
      ) return '2P';
      return null;
  }
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

function addEquationMultipliers(cells: Map<string, BoardCell>, coordinates: readonly Coordinate[], multiplier: number): void {
  for (const coordinate of coordinates) {
    ensureCell(cells, coordinate).equationMultiplier = multiplier;
  }
}

function addPieceMultipliers(cells: Map<string, BoardCell>, coordinates: readonly Coordinate[], multiplier: number): void {
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

// --- Public API: Board Mechanics ---

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

  // O(1) Lookup Map
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

  // Expand bounds
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
