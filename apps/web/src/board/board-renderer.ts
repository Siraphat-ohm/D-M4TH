import type { BoardTile, Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import { createClassicalBoardLayout } from "@d-m4th/game";
import {
  colorNumber,
  createRenderTiles,
  createTileRenderMetrics,
  type RenderTile
} from "./board-interaction";
import { displayTileLabel } from "../ui/tile-display";

export interface PhaserGameObject {
  destroy(): void;
}

export interface PhaserRectangle extends PhaserGameObject {
  setStrokeStyle(width: number, color: number, alpha?: number): PhaserRectangle;
}

export interface PhaserText extends PhaserGameObject {
  setOrigin(x: number, y?: number): PhaserText;
}

export interface BoardScene {
  add: {
    rectangle(x: number, y: number, width: number, height: number, color: number, alpha?: number): PhaserRectangle;
    text(x: number, y: number, text: string, style: Record<string, string | number>): PhaserText;
  };
  scale: {
    resize(width: number, height: number): void;
  };
  children: {
    removeAll(): void;
  };
}

export interface TileRenderState {
  tileKey: string;
  objects: PhaserGameObject[];
}

export interface BoardRenderCache {
  boardSignature?: string;
  tiles: TileRenderState[];
}

export const NORMAL_CELL_COLOR = 0x171b26;
export const CELL_BORDER_COLOR = 0x2a3142;
export const START_TEXT_COLOR = "#8C93A3";
export const PREMIUM_COLORS = {
  piece2: 0x8a5a38,
  piece3: 0x3e7774,
  equation2: 0x8a7a3a,
  equation3: 0x80394d
};

export function renderBoard(
  scene: BoardScene,
  cache: BoardRenderCache,
  params: {
    boardPixelSize: number;
    boardSize: number;
    boardTiles: BoardTile[];
    lastPlacements: BoardTile[];
    draft: readonly Placement[];
    ghostTiles: BoardTile[];
    players: PublicSnapshot["players"];
    rack: Tile[];
    draftOwnerId?: string;
    selectedTileId?: string;
  }
): void {
  const { boardPixelSize, boardSize, boardTiles, lastPlacements, draft, draftOwnerId, ghostTiles, players, rack } = params;
  const premiumLayout = createClassicalBoardLayout(boardSize);
  const premiumCellsByCoordinate = new Map(premiumLayout.map((cell) => [premiumCoordinateKey(cell.x, cell.y), cell]));
  const cellSize = boardPixelSize / boardSize;
  const boardSignature = `${boardSize}:${boardPixelSize}`;
  const activePlayerColor = players.find((player) => player.id === draftOwnerId)?.color;

  if (cache.boardSignature !== boardSignature) {
    clearBoardCache(scene, cache);

    for (let y = 0; y < boardSize; y += 1) {
      for (let x = 0; x < boardSize; x += 1) {
        const premium = premiumCellsByCoordinate.get(premiumCoordinateKey(x, y));
        drawCell(scene, { x, y, cellSize, premium });
      }
    }

    cache.boardSignature = boardSignature;
  }

  const renderTiles = createRenderTiles({ boardTiles, lastPlacements, ghostTiles, draft, rack, players, draftOwnerId, activePlayerColor });
  const newTileKeys = new Map<string, RenderTile>();

  for (const tile of renderTiles) {
    const key = tileKey(tile, params.selectedTileId);
    newTileKeys.set(key, tile);
  }

  const newTileEntries: TileRenderState[] = [];
  const existingKeys = new Map<string, TileRenderState>();

  for (const entry of cache.tiles) {
    existingKeys.set(entry.tileKey, entry);
  }

  // Destroy tiles no longer in view
  for (const entry of cache.tiles) {
    if (!newTileKeys.has(entry.tileKey)) {
      destroyObjects(entry.objects);
    }
  }

  // Create or reuse tiles
  for (const [key, tile] of newTileKeys) {
    const existing = existingKeys.get(key);

    if (existing) {
      newTileEntries.push(existing);
    } else {
      const objects: PhaserGameObject[] = [];

      if (tile.id === params.selectedTileId) {
        objects.push(...drawSelection(scene, tile, cellSize));
      }

      objects.push(...drawTile(scene, tile, cellSize));
      newTileEntries.push({ tileKey: key, objects });
    }
  }

  cache.tiles = newTileEntries;
}

function clearBoardCache(scene: BoardScene, cache: BoardRenderCache): void {
  for (const entry of cache.tiles) {
    destroyObjects(entry.objects);
  }
  cache.tiles = [];
  scene.children.removeAll();
}

function destroyObjects(objects: PhaserGameObject[]): void {
  for (const obj of objects) {
    obj.destroy();
  }
}

function tileKey(tile: RenderTile, selectedTileId?: string): string {
  const selected = tile.id === selectedTileId ? ":sel" : "";
  return `${tile.x},${tile.y}:${tile.label}:${tile.fillColor}:${tile.borderColor}:${tile.alpha}${selected}`;
}

function premiumCoordinateKey(x: number, y: number): string {
  return `${x},${y}`;
}

function drawCell(
  scene: BoardScene,
  params: {
    x: number;
    y: number;
    cellSize: number;
    premium?: ReturnType<typeof createClassicalBoardLayout>[number];
  }
): void {
  const { cellSize, premium, x, y } = params;
  const centerX = x * cellSize + cellSize / 2;
  const centerY = y * cellSize + cellSize / 2;
  const outerSize = Math.max(1, cellSize - 1);
  const innerSize = Math.max(1, cellSize - Math.max(4, cellSize * 0.14));

  scene.add.rectangle(centerX, centerY, outerSize, outerSize, CELL_BORDER_COLOR, 0.9);
  scene.add.rectangle(centerX, centerY, innerSize, innerSize, cellColor(premium), premium ? 0.96 : 0.82);

  const label = premiumLabel(premium);

  if (premium?.start) {
    scene.add.text(centerX, centerY - cellSize * 0.14, "★", {
      fontFamily: '"Silkscreen", monospace',
      fontSize: Math.max(11, cellSize * 0.36),
      color: START_TEXT_COLOR
    }).setOrigin(0.5);
  }

  if (label) {
    scene.add.text(centerX, centerY + (premium?.start ? cellSize * 0.22 : 0), label, {
      fontFamily: '"Silkscreen", monospace',
      fontSize: Math.max(10, cellSize * 0.27),
      color: "#EDEDED"
    }).setOrigin(0.5);
  }
}

function cellColor(premium?: ReturnType<typeof createClassicalBoardLayout>[number]): number {
  if (premium?.pieceMultiplier === 3) return PREMIUM_COLORS.piece3;
  if (premium?.pieceMultiplier === 2) return PREMIUM_COLORS.piece2;
  if (premium?.equationMultiplier === 3) return PREMIUM_COLORS.equation3;
  if (premium?.equationMultiplier === 2) return PREMIUM_COLORS.equation2;
  return NORMAL_CELL_COLOR;
}

function premiumLabel(premium?: ReturnType<typeof createClassicalBoardLayout>[number]): string {
  if (premium?.pieceMultiplier) return `${premium.pieceMultiplier}P`;
  if (premium?.equationMultiplier) return `${premium.equationMultiplier}E`;
  return "";
}

function drawSelection(scene: BoardScene, tile: RenderTile, cellSize: number): PhaserGameObject[] {
  const rect = scene.add.rectangle(
    tile.x * cellSize + cellSize / 2,
    tile.y * cellSize + cellSize / 2,
    cellSize * 0.88,
    cellSize * 0.88,
    0x000000,
    0
  ).setStrokeStyle(Math.max(2, cellSize * 0.06), colorNumber(tile.borderColor), 1);
  return [rect];
}

function drawTile(scene: BoardScene, tile: RenderTile, cellSize: number): PhaserGameObject[] {
  const metrics = createTileRenderMetrics(cellSize);
  const centerX = tile.x * cellSize + cellSize / 2;
  const strokeWidth = Math.max(1, cellSize * 0.04);
  const label = displayTileLabel(tile);

  const outer = scene.add.rectangle(centerX, tile.y * cellSize + cellSize / 2, metrics.tileSize, metrics.tileSize, colorNumber(tile.fillColor), tile.alpha).setStrokeStyle(
    strokeWidth,
    colorNumber(tile.borderColor),
    tile.alpha
  );

  if (!label) {
    return [outer];
  }

  const text = scene.add.text(centerX, tile.y * cellSize + cellSize * 0.48, label, {
    fontFamily: '"Silkscreen", monospace',
    fontSize: label.length > 3 ? metrics.longLabelFontSize : metrics.shortLabelFontSize,
    color: tile.textColor
  }).setOrigin(0.5);
  return [outer, text];
}
