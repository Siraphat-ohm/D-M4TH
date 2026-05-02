export type TurnMode = "play" | "swap";

export function toggleSelection(selectedIds: readonly string[], tileId: string): string[] {
  if (selectedIds.includes(tileId)) {
    return selectedIds.filter((selectedId) => selectedId !== tileId);
  }

  return [...selectedIds, tileId];
}

export function isCellBlocked(
  occupiedCells: ReadonlySet<string>,
  targetDraftTileId: string | undefined,
  movingTileId: string | undefined,
  x: number,
  y: number
): boolean {
  const key = `${x},${y}`;
  if (occupiedCells.has(key)) {
    return true;
  }
  return targetDraftTileId !== undefined && targetDraftTileId !== movingTileId;
}
