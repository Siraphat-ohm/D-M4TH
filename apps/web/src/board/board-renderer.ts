import type { BoardTile, Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import type { PremiumMapId } from "@d-m4th/config";
import { Container, Graphics, Text } from "pixi.js";
import { createBoardLayout } from "@d-m4th/game";
import {
  colorNumber,
  createRenderTiles,
  createTileRenderMetrics,
  type RenderTile
} from "./board-interaction";
import { displayTileLabel } from "../ui/tile-display";

export interface TileObjectGroup {
  outer: Graphics;
  labelText?: Text;
  valueText?: Text;
  selection?: Graphics;
}

export interface BoardRenderCache {
  boardSignature?: string;
  cellObjects: (Graphics | Text)[];
  tileObjects: Map<string, TileObjectGroup>;
  pool: {
    graphics: Graphics[];
    texts: Text[];
  };
}

export const NORMAL_CELL_COLOR = 0x171b26;
export const CELL_BORDER_COLOR = 0x2a3142;
export const START_TEXT_COLOR = "#8C93A3";
const CELL_INNER_PADDING_RATIO = 0.14;
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
      graphics: [],
      texts: []
    }
  };
}

export function renderBoard(
  root: Container,
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
        drawCell(root, cache, { x, y, cellSize, premium });
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
      nextTileObjects.set(key, drawTile(root, cache, tile, cellSize, isSelected));
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
    obj.destroy({ children: true });
  }
  cache.cellObjects = [];

  for (const group of cache.tileObjects.values()) {
    group.outer.destroy({ children: true });
    group.labelText?.destroy({ children: true });
    group.valueText?.destroy({ children: true });
    group.selection?.destroy({ children: true });
  }
  cache.tileObjects.clear();
}

function getTileKey(tile: RenderTile, isSelected: boolean): string {
  return `${tile.x},${tile.y}:${tile.label}:${tile.value}:${tile.fillColor}:${tile.borderColor}:${tile.alpha}:${isSelected}`;
}

function drawCell(
  root: Container,
  cache: BoardRenderCache,
  params: {
    x: number;
    y: number;
    cellSize: number;
    premium?: ReturnType<typeof createBoardLayout>[number];
  }
): void {
  const { cellSize, premium, x, y } = params;
  const centerX = x * cellSize + cellSize / 2;
  const centerY = y * cellSize + cellSize / 2;
  const outerSize = Math.max(1, cellSize - 1);
  const innerSize = Math.max(1, cellSize - Math.max(4, cellSize * CELL_INNER_PADDING_RATIO));

  const outer = getGraphics(cache)
    .rect(-outerSize / 2, -outerSize / 2, outerSize, outerSize)
    .fill({ color: CELL_BORDER_COLOR, alpha: 0.9 });
  outer.position.set(centerX, centerY);
  root.addChild(outer);
  cache.cellObjects.push(outer);

  const inner = getGraphics(cache)
    .rect(-innerSize / 2, -innerSize / 2, innerSize, innerSize)
    .fill({ color: cellColor(premium), alpha: premium ? 0.96 : 0.82 });
  inner.position.set(centerX, centerY);
  root.addChild(inner);
  cache.cellObjects.push(inner);

  const label = premiumLabel(premium);

  if (premium?.start) {
    const star = getText(cache);
    star.text = "★";
    star.style.fontFamily = "Silkscreen";
    star.style.fontSize = Math.max(11, cellSize * 0.36);
    star.style.fill = START_TEXT_COLOR;
    star.anchor.set(0.5);
    star.position.set(centerX, centerY - cellSize * 0.14);
    root.addChild(star);
    cache.cellObjects.push(star);
  }

  if (label) {
    const text = getText(cache);
    text.text = label;
    text.style.fontFamily = "Silkscreen";
    text.style.fontSize = Math.max(10, cellSize * 0.27);
    text.style.fill = "#EDEDED";
    text.anchor.set(0.5);
    text.position.set(centerX, centerY + (premium?.start ? cellSize * 0.22 : 0));
    root.addChild(text);
    cache.cellObjects.push(text);
  }
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

function drawTile(root: Container, cache: BoardRenderCache, tile: RenderTile, cellSize: number, isSelected: boolean): TileObjectGroup {
  const metrics = createTileRenderMetrics(cellSize);
  const centerX = tile.x * cellSize + cellSize / 2;
  const centerY = tile.y * cellSize + cellSize / 2;
  const strokeWidth = Math.max(1, cellSize * 0.04);
  const label = displayTileLabel(tile);

  const outer = getGraphics(cache)
    .rect(-metrics.tileSize / 2, -metrics.tileSize / 2, metrics.tileSize, metrics.tileSize)
    .fill({ color: colorNumber(tile.fillColor), alpha: tile.alpha })
    .stroke({ width: strokeWidth, color: colorNumber(tile.borderColor), alpha: tile.alpha });
  outer.position.set(centerX, centerY);
  outer.visible = true;
  root.addChild(outer);

  let selection: Graphics | undefined;
  if (isSelected) {
    selection = getGraphics(cache)
      .rect(-cellSize * 0.44, -cellSize * 0.44, cellSize * 0.88, cellSize * 0.88)
      .stroke({ width: Math.max(2, cellSize * 0.06), color: colorNumber(tile.borderColor), alpha: 1 });
    selection.position.set(centerX, centerY);
    selection.visible = true;
    root.addChild(selection);
  }

  let labelText: Text | undefined;
  if (label) {
    labelText = getText(cache);
    labelText.text = label;
    labelText.style.fontFamily = "Silkscreen";
    labelText.style.fontSize = label.length > 3 ? metrics.longLabelFontSize : metrics.shortLabelFontSize;
    labelText.style.fill = tile.textColor;
    labelText.anchor.set(0.5);
    labelText.position.set(centerX, centerY);
    labelText.visible = true;
    root.addChild(labelText);
  }

  const tileHalfSize = metrics.tileSize / 2;
  const valueText = getText(cache);
  valueText.text = String(tile.value);
  valueText.style.fontFamily = "Silkscreen";
  valueText.style.fontSize = metrics.valueFontSize;
  valueText.style.fill = tile.textColor;
  valueText.anchor.set(1, 1);
  valueText.position.set(centerX + tileHalfSize - Math.max(3, cellSize * 0.08), centerY + tileHalfSize - Math.max(2, cellSize * 0.06));
  valueText.visible = true;
  root.addChild(valueText);

  return { outer, labelText, valueText, selection };
}

function getGraphics(cache: BoardRenderCache): Graphics {
  const pooled = cache.pool.graphics.pop();
  if (pooled) {
    pooled.clear();
    return pooled;
  }
  return new Graphics();
}

function getText(cache: BoardRenderCache): Text {
  const pooled = cache.pool.texts.pop();
  if (pooled) return pooled;
  return new Text({ style: { fontFamily: "Silkscreen" } });
}

function recycleTileGroup(cache: BoardRenderCache, group: TileObjectGroup): void {
  recycleGraphics(cache, group.outer);

  if (group.labelText) {
    recycleText(cache, group.labelText);
  }

  if (group.valueText) {
    recycleText(cache, group.valueText);
  }

  if (group.selection) {
    recycleGraphics(cache, group.selection);
  }
}

function recycleGraphics(cache: BoardRenderCache, graphics: Graphics): void {
  graphics.visible = false;
  graphics.removeFromParent();
  if (cache.pool.graphics.length < POOL_MAX_SIZE) {
    cache.pool.graphics.push(graphics);
  } else {
    graphics.destroy({ children: true });
  }
}

function recycleText(cache: BoardRenderCache, text: Text): void {
  text.visible = false;
  text.removeFromParent();
  if (cache.pool.texts.length < POOL_MAX_SIZE) {
    cache.pool.texts.push(text);
  } else {
    text.destroy({ children: true });
  }
}
