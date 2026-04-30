import type { Coordinate, Placement } from "@d-m4th/game";

export type TurnMode = "play" | "swap";

export function findDraftPlacementAt(draft: readonly Placement[], coordinate: Coordinate): Placement | undefined {
  return draft.find((placement) => placement.x === coordinate.x && placement.y === coordinate.y);
}

export function moveOrSwapDraftPlacement(params: {
  draft: readonly Placement[];
  tileId: string;
  target: Coordinate;
}): Placement[] {
  const { draft, target, tileId } = params;
  const source = draft.find((placement) => placement.tileId === tileId);

  if (!source) {
    return [...draft];
  }

  const targetPlacement = findDraftPlacementAt(draft, target);

  return draft.map((placement) => {
    if (placement.tileId === tileId) {
      return { ...placement, ...target };
    }

    if (targetPlacement && placement.tileId === targetPlacement.tileId) {
      return { ...placement, x: source.x, y: source.y };
    }

    return placement;
  });
}

export function upsertDraftPlacement(draft: readonly Placement[], placement: Placement): Placement[] {
  return [...draft.filter((draftPlacement) => draftPlacement.tileId !== placement.tileId), placement];
}

export function toggleSelection(selectedIds: readonly string[], tileId: string): string[] {
  if (selectedIds.includes(tileId)) {
    return selectedIds.filter((selectedId) => selectedId !== tileId);
  }

  return [...selectedIds, tileId];
}
