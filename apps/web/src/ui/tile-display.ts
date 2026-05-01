import type { Tile } from "@d-m4th/game";

export const BLANK_TILE_LABEL = "BLANK";

export function displayTileLabel(tile: Pick<Tile, "label">): string {
  return tile.label === BLANK_TILE_LABEL ? "" : tile.label;
}
