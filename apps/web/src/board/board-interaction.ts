import type { BoardTile, Coordinate, Placement, PublicPlayer, Tile } from "@d-m4th/game";
import { textColorForBackground } from "../ui/shared/format";

export interface BoardBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ClientPoint {
  clientX: number;
  clientY: number;
}

export interface RenderTile extends BoardTile {
  fillColor: string;
  borderColor: string;
  textColor: string;
  alpha: number;
}

export interface TileRenderMetrics {
  tileSize: number;
  shortLabelFontSize: number;
  longLabelFontSize: number;
  valueFontSize: number;
}

const TILE_SIZE_RATIO = 0.88;
const SHORT_LABEL_FONT_RATIO = 0.44;
const LONG_LABEL_FONT_RATIO = 0.32;
const VALUE_FONT_RATIO = 0.18;
const MIN_SHORT_LABEL_FONT_SIZE = 12;
const MIN_LONG_LABEL_FONT_SIZE = 9;
const MIN_VALUE_FONT_SIZE = 8;
const MIN_DRAG_PREVIEW_SIZE = 24;

export function snapClientPointToBoardCell(params: {
  point: ClientPoint;
  bounds: BoardBounds;
  boardSize: number;
}): Coordinate | undefined {
  const { boardSize, bounds, point } = params;
  const playableSize = Math.min(bounds.width, bounds.height);
  const localX = point.clientX - bounds.left;
  const localY = point.clientY - bounds.top;

  if (localX < 0 || localY < 0 || localX >= playableSize || localY >= playableSize) {
    return undefined;
  }

  const cellSize = playableSize / boardSize;

  return {
    x: Math.floor(localX / cellSize),
    y: Math.floor(localY / cellSize)
  };
}

export function createTileRenderMetrics(cellSize: number): TileRenderMetrics {
  return {
    tileSize: cellSize * TILE_SIZE_RATIO,
    shortLabelFontSize: Math.max(MIN_SHORT_LABEL_FONT_SIZE, cellSize * SHORT_LABEL_FONT_RATIO),
    longLabelFontSize: Math.max(MIN_LONG_LABEL_FONT_SIZE, cellSize * LONG_LABEL_FONT_RATIO),
    valueFontSize: Math.max(MIN_VALUE_FONT_SIZE, cellSize * VALUE_FONT_RATIO)
  };
}

export function createDragPreviewSize(cellSize: number): number {
  return Math.max(MIN_DRAG_PREVIEW_SIZE, Math.floor(cellSize * TILE_SIZE_RATIO));
}

const TILE_FACE = "#F2ECDD";
const TILE_TEXT = "#111111";
const TILE_BORDER = "#2A3142";

export function createRenderTiles(params: {
  boardTiles: readonly BoardTile[];
  ghostTiles: readonly BoardTile[];
  draft: readonly Placement[];
  rack: readonly Tile[];
  players: readonly PublicPlayer[];
  draftOwnerId?: string;
  activePlayerColor?: string;
}): RenderTile[] {
  const rackTiles = new Map(params.rack.map((tile) => [tile.id, tile]));
  const playerColorMap = new Map(params.players.map((p) => [p.id, p.color]));

  return [
    ...params.ghostTiles.map((tile) => {
      const ownerColor = tile.ownerId ? playerColorMap.get(tile.ownerId) : undefined;
      return createStaticRenderTile(tile, normalizeHexColor(ownerColor ?? TILE_BORDER), 0.55);
    }),
    ...params.draft.flatMap((placement) => {
      const tile = rackTiles.get(placement.tileId);

      if (!tile || !params.draftOwnerId) {
        return [];
      }

      const ownerColor = playerColorMap.get(params.draftOwnerId);

      return createStaticRenderTile(
        {
          ...tile,
          ...placement,
          label: placement.face ?? tile.label,
          ownerId: params.draftOwnerId
        },
        normalizeHexColor(ownerColor ?? TILE_BORDER),
        0.92
      );
    }),
    ...params.boardTiles.map((tile) => {
      const ownerColor = tile.ownerId ? playerColorMap.get(tile.ownerId) : undefined;
      return createStaticRenderTile(tile, normalizeHexColor(ownerColor ?? TILE_BORDER), 1);
    })
  ];
}

export const textColorForPlayerColor = textColorForBackground;

export function colorNumber(color: string): number {
  return Number.parseInt(normalizeHexColor(color).slice(1), 16);
}

export function normalizeHexColor(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }

  if (import.meta.env.DEV) {
    console.warn(`normalizeHexColor: invalid color "${color}", falling back to TILE_FACE`);
  }

  return TILE_FACE;
}

function createStaticRenderTile(tile: BoardTile, borderColor: string, alpha: number): RenderTile {
  return {
    ...tile,
    fillColor: TILE_FACE,
    borderColor,
    textColor: TILE_TEXT,
    alpha
  };
}
