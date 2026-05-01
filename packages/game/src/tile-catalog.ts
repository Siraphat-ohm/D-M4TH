import { tileBagScaleForPlayerCount } from "@d-m4th/config";
import type { Tile, TileDefinition } from "./types";
import { shuffleTiles } from "./utils";

export const TILE_DEFINITIONS: readonly TileDefinition[] = [
  { label: "0", value: 1, count: 5 },
  { label: "1", value: 1, count: 5 },
  { label: "2", value: 1, count: 5 },
  { label: "3", value: 1, count: 5 },
  { label: "4", value: 2, count: 4 },
  { label: "5", value: 2, count: 4 },
  { label: "6", value: 2, count: 4 },
  { label: "7", value: 3, count: 3 },
  { label: "8", value: 3, count: 3 },
  { label: "9", value: 3, count: 3 },
  { label: "10", value: 2, count: 2 },
  { label: "11", value: 3, count: 2 },
  { label: "12", value: 3, count: 2 },
  { label: "13", value: 4, count: 2 },
  { label: "14", value: 4, count: 2 },
  { label: "15", value: 4, count: 2 },
  { label: "16", value: 5, count: 1 },
  { label: "17", value: 5, count: 1 },
  { label: "18", value: 5, count: 1 },
  { label: "19", value: 6, count: 1 },
  { label: "20", value: 6, count: 1 },
  { label: "+", value: 1, count: 6 },
  { label: "-", value: 1, count: 6 },
  { label: "×", value: 2, count: 5 },
  { label: "÷", value: 3, count: 4 },
  { label: "×/÷", value: 4, count: 2 },
  { label: "±", value: 2, count: 2 },
  { label: "=", value: 1, count: 13 },
  { label: "BLANK", value: 0, count: 4 }
];

export const BLANK_FACE_LABELS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "+",
  "-",
  "×",
  "÷",
  "="
] as const;

export const ASSIGNABLE_TILE_FACES = {
  BLANK: BLANK_FACE_LABELS,
  "×/÷": ["×", "÷"],
  "±": ["+", "-"]
} as const;

export type AssignableTileLabel = keyof typeof ASSIGNABLE_TILE_FACES;

export function faceOptionsForTileLabel(label: string): readonly string[] {
  return tileRequiresFace(label) ? ASSIGNABLE_TILE_FACES[label] : [];
}

export function tileRequiresFace(label: string): label is AssignableTileLabel {
  return label in ASSIGNABLE_TILE_FACES;
}

export function createTileBag(playerCount: number, seed = "d-m4th"): Tile[] {
  const scale = tileBagScaleForPlayerCount(playerCount);
  const tiles = createTileSet(scale);
  return shuffleTiles(tiles, seed);
}

export function createTileSet(scale: number): Tile[] {
  const tiles: Tile[] = [];

  for (const definition of TILE_DEFINITIONS) {
    for (let index = 0; index < definition.count * scale; index += 1) {
      tiles.push({
        id: `${definition.label}-${index}-${scale}`,
        label: definition.label,
        value: definition.value
      });
    }
  }

  return tiles;
}

export function drawTiles(tileBag: Tile[], count: number): Tile[] {
  return tileBag.splice(0, Math.max(0, count));
}
