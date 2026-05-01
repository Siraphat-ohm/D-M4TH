export type TurnMode = "play" | "swap";

export function toggleSelection(selectedIds: readonly string[], tileId: string): string[] {
  if (selectedIds.includes(tileId)) {
    return selectedIds.filter((selectedId) => selectedId !== tileId);
  }

  return [...selectedIds, tileId];
}
