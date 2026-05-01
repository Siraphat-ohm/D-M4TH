import type { BoardTile, Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import type { PremiumMapId } from "@d-m4th/config";
import { createBoardLayout } from "@d-m4th/game";
import {
  colorNumber,
  createRenderTiles,
  createTileRenderMetrics,
  type RenderTile
} from "./board-interaction";
import { displayTileLabel } from "../ui/tile-display";

export interface PhaserGameObject {
  destroy(): void;
  setVisible(value: boolean): this;
  setActive(value: boolean): this;
  setX(x: number): this;
  setY(y: number): this;
  alpha: number;
}

export interface PhaserRectangle extends PhaserGameObject {
  width: number;
  height: number;
  fillColor: number;
  setFillStyle(color: number, alpha?: number): this;
  setStrokeStyle(width: number, color: number, alpha?: number): this;
  setSize(width: number, height: number): this;
}

export interface PhaserText extends PhaserGameObject {
  text: string;
  setOrigin(x: number, y?: number): this;
  setFontSize(size: string | number): this;
  setColor(color: string): this;
  setText(value: string | string[]): this;
}

export interface BoardScene {
  add: {
    rectangle(x: number, y: number, width: number, height: number, color: number, alpha?: number): PhaserRectangle;
    text(x: number, y: number, text: string, style: Record<string, string | number>): PhaserText;
  };
  children: {
    removeAll(): void;
  };
}

export interface TileObjectGroup {
  outer: PhaserRectangle;
  labelText?: PhaserText;
  valueText?: PhaserText;
  selection?: PhaserRectangle;
}

export interface BoardRenderCache {
  boardSignature?: string;
  cellObjects: PhaserGameObject[];
  tileObjects: Map<string, TileObjectGroup>;
  pool: {
    rectangles: PhaserRectangle[];
    texts: PhaserText[];
  };
}

export const NORMAL_CELL_COLOR = 0x171b26;
export const CELL_BORDER_COLOR = 0x2a3142;
export const START_TEXT_COLOR = "#8C93A3";
const CELL_INNER_PADDING_RATIO = 0.14;
const PREVIEW_DEBOUNCE_MS = 150;
const POOL_MAX_SIZE = 64;
export const PREMIUM_COLORS = {
  piece2: 0x8a5a38,
  piece3: 0x3e7774,
  equation2: 0x8a7a3a,
  equation3: 0x80394d
};

export function createInitialCache(): BoardRenderCache {
  return {
    cellObjects: [],
    tileObjects: new Map(),
    pool: {
      rectangles: [],
      texts: []
    }
  };
}

export function renderBoard(
  scene: BoardScene,
  cache: BoardRenderCache,
  params: {
    boardPixelSize: number;
    boardSize: number;
    premiumMapId: PremiumMapId;
    boardTiles: BoardTile[];
    draft: readonly Placement[];
    ghostTiles: BoardTile[];
    players: PublicSnapshot["players"];
    rack: Tile[];
    draftOwnerId?: string;
    selectedTileId?: string;
  }
): void {
  const { boardPixelSize, boardSize, boardTiles, draft, draftOwnerId, ghostTiles, players, premiumMapId, rack } = params;
  if (import.meta.env.DEV && boardPixelSize % boardSize !== 0) {
    console.warn("Board size is not aligned to grid", { boardPixelSize, boardSize });
  }

  const cellSize = boardPixelSize / boardSize;
  const boardSignature = `${boardSize}:${boardPixelSize}:${premiumMapId}`;
  const activePlayerColor = players.find((player) => player.id === draftOwnerId)?.color;

  // 1. Grid / Background
  if (cache.boardSignature !== boardSignature) {
    clearBoardObjects(cache);
    const premiumLayout = createBoardLayout(boardSize, premiumMapId);
    const premiumMap = new Map(premiumLayout.map(p => [`${p.x},${p.y}`, p]));

    for (let y = 0; y < boardSize; y += 1) {
      for (let x = 0; x < boardSize; x += 1) {
        const premium = premiumMap.get(`${x},${y}`);
        cache.cellObjects.push(...drawCell(scene, { x, y, cellSize, premium }));
      }
    }
    cache.boardSignature = boardSignature;
  }

  // 2. Tiles
  const renderTiles = createRenderTiles({ boardTiles, ghostTiles, draft, rack, players, draftOwnerId, activePlayerColor });
  const nextTileObjects = new Map<string, TileObjectGroup>();

  for (const tile of renderTiles) {
    const isSelected = tile.id === params.selectedTileId;
    const key = getTileKey(tile, isSelected);
    const existing = cache.tileObjects.get(key);

    if (existing) {
      nextTileObjects.set(key, existing);
      cache.tileObjects.delete(key);
    } else {
      nextTileObjects.set(key, drawTile(scene, cache, tile, cellSize, isSelected));
    }
  }

  // Recycle remaining old tiles
  for (const group of cache.tileObjects.values()) {
    recycleTileGroup(cache, group);
  }

  cache.tileObjects = nextTileObjects;
}

function clearBoardObjects(cache: BoardRenderCache): void {
  for (const obj of cache.cellObjects) {
    obj.destroy();
  }
  cache.cellObjects = [];

  for (const group of cache.tileObjects.values()) {
    group.outer.destroy();
    group.labelText?.destroy();
    group.valueText?.destroy();
    group.selection?.destroy();
  }
  cache.tileObjects.clear();
}

function getTileKey(tile: RenderTile, isSelected: boolean): string {
  return `${tile.x},${tile.y}:${tile.label}:${tile.value}:${tile.fillColor}:${tile.borderColor}:${tile.alpha}:${isSelected}`;
}

function drawCell(
  scene: BoardScene,
  params: {
    x: number;
    y: number;
    cellSize: number;
    premium?: ReturnType<typeof createBoardLayout>[number];
  }
): PhaserGameObject[] {
  const { cellSize, premium, x, y } = params;
  const centerX = x * cellSize + cellSize / 2;
  const centerY = y * cellSize + cellSize / 2;
  const outerSize = Math.max(1, cellSize - 1);
  const innerSize = Math.max(1, cellSize - Math.max(4, cellSize * CELL_INNER_PADDING_RATIO));

  const objects: PhaserGameObject[] = [];
  objects.push(scene.add.rectangle(centerX, centerY, outerSize, outerSize, CELL_BORDER_COLOR, 0.9));
  objects.push(scene.add.rectangle(centerX, centerY, innerSize, innerSize, cellColor(premium), premium ? 0.96 : 0.82));

  const label = premiumLabel(premium);

  if (premium?.start) {
    objects.push(scene.add.text(centerX, centerY - cellSize * 0.14, "★", {
      fontFamily: '"Silkscreen", monospace',
      fontSize: Math.max(11, cellSize * 0.36),
      color: START_TEXT_COLOR
    }).setOrigin(0.5));
  }

  if (label) {
    objects.push(scene.add.text(centerX, centerY + (premium?.start ? cellSize * 0.22 : 0), label, {
      fontFamily: '"Silkscreen", monospace',
      fontSize: Math.max(10, cellSize * 0.27),
      color: "#EDEDED"
    }).setOrigin(0.5));
  }

  return objects;
}

function cellColor(premium?: ReturnType<typeof createBoardLayout>[number]): number {
  if (premium?.pieceMultiplier === 3) return PREMIUM_COLORS.piece3;
  if (premium?.pieceMultiplier === 2) return PREMIUM_COLORS.piece2;
  if (premium?.equationMultiplier === 3) return PREMIUM_COLORS.equation3;
  if (premium?.equationMultiplier === 2) return PREMIUM_COLORS.equation2;
  return NORMAL_CELL_COLOR;
}

function premiumLabel(premium?: ReturnType<typeof createBoardLayout>[number]): string {
  if (premium?.pieceMultiplier) return `${premium.pieceMultiplier}P`;
  if (premium?.equationMultiplier) return `${premium.equationMultiplier}E`;
  return "";
}

function drawTile(scene: BoardScene, cache: BoardRenderCache, tile: RenderTile, cellSize: number, isSelected: boolean): TileObjectGroup {
  const metrics = createTileRenderMetrics(cellSize);
  const centerX = tile.x * cellSize + cellSize / 2;
  const centerY = tile.y * cellSize + cellSize / 2;
  const strokeWidth = Math.max(1, cellSize * 0.04);
  const label = displayTileLabel(tile);

  const outer = getRectangle(scene, cache)
    .setX(centerX)
    .setY(centerY)
    .setSize(metrics.tileSize, metrics.tileSize)
    .setFillStyle(colorNumber(tile.fillColor), tile.alpha)
    .setStrokeStyle(strokeWidth, colorNumber(tile.borderColor), tile.alpha)
    .setVisible(true)
    .setActive(true);

  let selection: PhaserRectangle | undefined;
  if (isSelected) {
    selection = getRectangle(scene, cache)
      .setX(centerX)
      .setY(centerY)
      .setSize(cellSize * 0.88, cellSize * 0.88)
      .setFillStyle(0x000000, 0)
      .setStrokeStyle(Math.max(2, cellSize * 0.06), colorNumber(tile.borderColor), 1)
      .setVisible(true)
      .setActive(true);
  }

  let labelText: PhaserText | undefined;
  if (label) {
    labelText = getText(scene, cache)
      .setX(centerX)
      .setY(centerY)
      .setOrigin(0.5)
      .setText(label)
      .setFontSize(label.length > 3 ? metrics.longLabelFontSize : metrics.shortLabelFontSize)
      .setColor(tile.textColor)
      .setVisible(true)
      .setActive(true);
  }

  const tileHalfSize = metrics.tileSize / 2;
  const valueText = getText(scene, cache)
    .setX(centerX + tileHalfSize - Math.max(3, cellSize * 0.08))
    .setY(centerY + tileHalfSize - Math.max(2, cellSize * 0.06))
    .setOrigin(1, 1)
    .setText(String(tile.value))
    .setFontSize(metrics.valueFontSize)
    .setColor(tile.textColor)
    .setVisible(true)
    .setActive(true);

  return { outer, labelText, valueText, selection };
}

function getRectangle(scene: BoardScene, cache: BoardRenderCache): PhaserRectangle {
  const pooled = cache.pool.rectangles.pop();
  if (pooled) return pooled;
  return scene.add.rectangle(0, 0, 1, 1, 0xFFFFFF);
}

function getText(scene: BoardScene, cache: BoardRenderCache): PhaserText {
  const pooled = cache.pool.texts.pop();
  if (pooled) return pooled;
  return scene.add.text(0, 0, "", { fontFamily: '"Silkscreen", monospace', resolution: 2 }).setOrigin(0.5);
}

function recycleTileGroup(cache: BoardRenderCache, group: TileObjectGroup): void {
  recycleRectangle(cache, group.outer);

  if (group.labelText) {
    recycleText(cache, group.labelText);
  }

  if (group.valueText) {
    recycleText(cache, group.valueText);
  }

  if (group.selection) {
    recycleRectangle(cache, group.selection);
  }
}

function recycleRectangle(cache: BoardRenderCache, rect: PhaserRectangle): void {
  rect.setVisible(false).setActive(false);
  if (cache.pool.rectangles.length < POOL_MAX_SIZE) {
    cache.pool.rectangles.push(rect);
  } else {
    rect.destroy();
  }
}

function recycleText(cache: BoardRenderCache, text: PhaserText): void {
  text.setVisible(false).setActive(false);
  if (cache.pool.texts.length < POOL_MAX_SIZE) {
    cache.pool.texts.push(text);
  } else {
    text.destroy();
  }
}
