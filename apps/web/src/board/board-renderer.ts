import type { BoardTile, Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import type { PremiumMapId } from "@d-m4th/config";
import { BitmapText, Container, Graphics } from "pixi.js";
import { createBoardLayout } from "@d-m4th/game";
import {
  colorNumber,
  createRenderTiles,
  type TileRenderMetrics,
  type RenderTile
} from "./board-interaction";
import { displayTileLabel } from "../shared/tile-display";

export interface TileObjectGroup {
  outer: Graphics;
  labelText?: BitmapText;
  valueText?: BitmapText;
  selection?: Graphics;
}

export interface BoardRenderCache {
  /** Topology signature — excludes pixel size so resizes don't trigger a grid rebuild. */
  boardSignature?: string;
  cellObjects: (Graphics | BitmapText)[];
  tileObjects: Map<string, TileObjectGroup>;
  pool: {
    graphics: Graphics[];
    texts: BitmapText[];
  };
}

export const NORMAL_CELL_COLOR = 0x171b26;
export const CELL_BORDER_COLOR = 0x2a3142;
export const CELL_INNER_STROKE_COLOR = 0x3a4358;
export const CELL_PREMIUM_STROKE_COLOR = 0xf2ecdd;
export const START_TEXT_COLOR = "#8C93A3";

/** Ratio of cell width used for the inner (coloured) cell square. */
const CELL_INNER_PADDING_RATIO = 0.14;
/** Fraction of a cell unit for the outer border rect. */
const CELL_OUTER_UNIT = 0.98;
/** Fraction of a cell unit for the inner colour fill. */
const CELL_INNER_UNIT = 1 - CELL_INNER_PADDING_RATIO;
const CELL_STROKE_UNIT = 0.028;
const CELL_HIGHLIGHT_HEIGHT = 0.08;

const POOL_MAX_SIZE = 64;

export const PREMIUM_COLORS = {
  piece2: 0x8a5a38,
  piece3: 0x3e7774,
  equation2: 0x8a7a3a,
  equation3: 0x80394d
};

// Font sizes as fractions of one cell unit. The root container is scaled by
// cellSize, so a fraction of 0.27 → 0.27 × cellSize screen pixels.
const CELL_LABEL_FONT_UNIT = 0.27;
const CELL_STAR_FONT_UNIT = 0.36;

const UNIT_TILE_METRICS: TileRenderMetrics = {
  tileSize: 0.88,
  shortLabelFontSize: 0.44,
  longLabelFontSize: 0.32,
  valueFontSize: 0.18
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

  // Topology signature deliberately excludes boardPixelSize.
  // Grid cells are drawn in unit space (1 unit = 1 cell) and the root
  // container is scaled to pixel size, so resizes never require a rebuild.
  const boardSignature = `${boardSize}:${premiumMapId}`;
  const activePlayerColor = players.find((player) => player.id === draftOwnerId)?.color;

  // 1. Grid / Background — rebuild only when board topology changes.
  if (cache.boardSignature !== boardSignature) {
    clearBoardObjects(cache);
    const premiumLayout = createBoardLayout(boardSize, premiumMapId);
    const premiumMap = new Map(premiumLayout.map(p => [`${p.x},${p.y}`, p]));

    for (let y = 0; y < boardSize; y += 1) {
      for (let x = 0; x < boardSize; x += 1) {
        const premium = premiumMap.get(`${x},${y}`);
        drawCell(root, cache, { x, y, premium });
      }
    }

    cache.boardSignature = boardSignature;
  }

  // Scale the entire scene to pixel size. All unit-space positions become pixels.
  root.scale.set(cellSize);

  // 2. Tiles — reuse from cache keyed by their visual state.
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
      nextTileObjects.set(key, drawTile(root, cache, tile, isSelected));
    }
  }

  // Recycle remaining old tiles back to the pool.
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

/** Draw one background cell in unit space (1 unit = 1 cell wide). */
function drawCell(
    root: Container,
    cache: BoardRenderCache,
    params: {
      x: number;
      y: number;
      premium?: ReturnType<typeof createBoardLayout>[number];
    }
  ): void {
    const { premium, x, y } = params;
    const centerX = x + 0.5;
    const centerY = y + 0.5;

    const outerHalf = CELL_OUTER_UNIT / 2;
    const innerHalf = CELL_INNER_UNIT / 2;

    const outer = new Graphics()
      .rect(-outerHalf, -outerHalf, CELL_OUTER_UNIT, CELL_OUTER_UNIT)
      .fill({ color: CELL_BORDER_COLOR, alpha: premium ? 0.98 : 0.94 });

    outer.position.set(centerX, centerY);
    root.addChild(outer);
    cache.cellObjects.push(outer);

    const fillColor = cellColor(premium);
    const fillAlpha = premium ? 0.96 : 0.82;

    const inner = new Graphics()
      .rect(-innerHalf, -innerHalf, CELL_INNER_UNIT, CELL_INNER_UNIT)
      .fill({ color: fillColor, alpha: fillAlpha })
      .stroke({
        width: CELL_STROKE_UNIT,
        color: premium ? CELL_PREMIUM_STROKE_COLOR : CELL_INNER_STROKE_COLOR,
        alpha: premium ? 0.3 : 0.42
      });

    inner.position.set(centerX, centerY);
    root.addChild(inner);
    cache.cellObjects.push(inner);

    const highlight = new Graphics()
      .rect(
        -innerHalf + CELL_STROKE_UNIT,
        -innerHalf + CELL_STROKE_UNIT,
        CELL_INNER_UNIT - (CELL_STROKE_UNIT * 2),
        CELL_HIGHLIGHT_HEIGHT
      )
      .fill({
        color: premium ? CELL_PREMIUM_STROKE_COLOR : 0xffffff,
        alpha: premium ? 0.06 : 0.035
      });

    highlight.position.set(centerX, centerY);
    root.addChild(highlight);
    cache.cellObjects.push(highlight);

    if (premium?.start) {
      const star = getBitmapText(cache);
      star.text = "★";
      star.style.fontFamily = "Silkscreen";
      star.style.fontSize = CELL_STAR_FONT_UNIT;
      star.tint = 0x8c93a3;
      star.anchor.set(0.5);
      star.position.set(centerX, centerY - 0.14);
      star.visible = true;
      root.addChild(star);
      cache.cellObjects.push(star);
    }

    const label = premiumLabel(premium);
    if (label) {
      const text = getBitmapText(cache);
      text.text = label;
      text.style.fontFamily = "Silkscreen";
      text.style.fontSize = CELL_LABEL_FONT_UNIT;
      text.tint = 0xededed;
      text.anchor.set(0.5);
      text.position.set(centerX, centerY + (premium?.start ? 0.22 : 0));
      text.visible = true;
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

/**
 * Draw a tile in unit space. Font sizes and geometry are unit fractions;
 * the root container's scale converts them to pixels.
 */
function drawTile(root: Container, cache: BoardRenderCache, tile: RenderTile, isSelected: boolean): TileObjectGroup {
  // Metrics are unit fractions; root.scale converts them to screen pixels.
  const metrics = UNIT_TILE_METRICS;
  const centerX = tile.x + 0.5;
  const centerY = tile.y + 0.5;
  const strokeWidth = 0.04;
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
      .rect(-0.44, -0.44, 0.88, 0.88)
      .stroke({ width: 0.06, color: colorNumber(tile.borderColor), alpha: 1 });
    selection.position.set(centerX, centerY);
    selection.visible = true;
    root.addChild(selection);
  }

  let labelText: BitmapText | undefined;
  if (label) {
    labelText = getBitmapText(cache);
    labelText.text = label;
    labelText.style.fontFamily = "VT323";
    labelText.style.fontSize = label.length > 3 ? metrics.longLabelFontSize : metrics.shortLabelFontSize;
    labelText.tint = colorNumber(tile.textColor);
    labelText.anchor.set(0.5);
    labelText.position.set(centerX, centerY);
    labelText.visible = true;
    root.addChild(labelText);
  }

  const tileHalfSize = metrics.tileSize / 2;
  const valueText = getBitmapText(cache);
  valueText.text = String(tile.value);
  valueText.style.fontFamily = "VT323";
  valueText.style.fontSize = metrics.valueFontSize;
  valueText.tint = colorNumber(tile.textColor);
  valueText.anchor.set(1, 1);
  valueText.position.set(
    centerX + tileHalfSize - 0.08,
    centerY + tileHalfSize - 0.06
  );
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

function getBitmapText(cache: BoardRenderCache): BitmapText {
  const pooled = cache.pool.texts.pop();
  if (pooled) {
    pooled.text = "";
    return pooled;
  }
  return new BitmapText({ style: { fontFamily: "VT323", fontSize: 0.3 } });
}

function recycleTileGroup(cache: BoardRenderCache, group: TileObjectGroup): void {
  recycleGraphics(cache, group.outer);

  if (group.labelText) {
    recycleBitmapText(cache, group.labelText);
  }

  if (group.valueText) {
    recycleBitmapText(cache, group.valueText);
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
    graphics.destroy();
  }
}

function recycleBitmapText(cache: BoardRenderCache, text: BitmapText): void {
  text.visible = false;
  text.removeFromParent();
  if (cache.pool.texts.length < POOL_MAX_SIZE) {
    cache.pool.texts.push(text);
  } else {
    text.destroy();
  }
}
