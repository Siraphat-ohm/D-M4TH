import type { BoardTile, Coordinate, Placement, PublicPlayer, Tile } from "@d-m4th/game";

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
  textColor: string;
  alpha: number;
}

export interface TileRenderMetrics {
  tileSize: number;
  shortLabelFontSize: number;
  longLabelFontSize: number;
}

const TILE_SIZE_RATIO = 0.72;
const SHORT_LABEL_FONT_RATIO = 0.34;
const LONG_LABEL_FONT_RATIO = 0.22;
const MIN_SHORT_LABEL_FONT_SIZE = 11;
const MIN_LONG_LABEL_FONT_SIZE = 8;
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
    longLabelFontSize: Math.max(MIN_LONG_LABEL_FONT_SIZE, cellSize * LONG_LABEL_FONT_RATIO)
  };
}

export function createDragPreviewSize(cellSize: number): number {
  return Math.max(MIN_DRAG_PREVIEW_SIZE, Math.floor(cellSize * TILE_SIZE_RATIO));
}

export function createRenderTiles(params: {
  boardTiles: readonly BoardTile[];
  ghostTiles: readonly BoardTile[];
  draft: readonly Placement[];
  rack: readonly Tile[];
  players: readonly PublicPlayer[];
  draftOwnerId?: string;
}): RenderTile[] {
  const playerColors = new Map(params.players.map((player) => [player.id, player.color]));
  const rackTiles = new Map(params.rack.map((tile) => [tile.id, tile]));

  return [
    ...params.ghostTiles.map((tile) => createRenderTile(tile, playerColors, 0.55)),
    ...params.draft.flatMap((placement) => {
      const tile = rackTiles.get(placement.tileId);

      if (!tile || !params.draftOwnerId) {
        return [];
      }

      return createRenderTile(
        {
          ...tile,
          ...placement,
          label: placement.face ?? tile.label,
          ownerId: params.draftOwnerId
        },
        playerColors,
        0.88
      );
    }),
    ...params.boardTiles.map((tile) => createRenderTile(tile, playerColors, 1))
  ];
}

export function textColorForPlayerColor(color: string): string {
  const normalizedColor = normalizeHexColor(color);
  const red = Number.parseInt(normalizedColor.slice(1, 3), 16);
  const green = Number.parseInt(normalizedColor.slice(3, 5), 16);
  const blue = Number.parseInt(normalizedColor.slice(5, 7), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

  return luminance > 150 ? "#111827" : "#f8fafc";
}

export function colorNumber(color: string): number {
  return Number.parseInt(normalizeHexColor(color).slice(1), 16);
}

export function normalizeHexColor(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }

  return "#f7f0d5";
}

function createRenderTile(tile: BoardTile, playerColors: ReadonlyMap<string, string>, alpha: number): RenderTile {
  const fillColor = normalizeHexColor(playerColors.get(tile.ownerId) ?? "#f7f0d5");

  return {
    ...tile,
    fillColor,
    textColor: textColorForPlayerColor(fillColor),
    alpha
  };
}
