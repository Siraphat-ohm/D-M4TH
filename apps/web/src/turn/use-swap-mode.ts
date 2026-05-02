import { useState } from "react";
import { toggleSelection, type TurnMode } from "./turn-controls";

export function useSwapMode() {
  const [turnMode, setTurnMode] = useState<TurnMode>("play");
  const [swapSelectedTileIds, setSwapSelectedTileIds] = useState<string[]>([]);

  function enterSwapMode(): void {
    setTurnMode("swap");
    setSwapSelectedTileIds([]);
  }

  function exitSwapMode(): void {
    setTurnMode("play");
    setSwapSelectedTileIds([]);
  }

  function toggleSwapTile(tileId: string): void {
    setSwapSelectedTileIds((ids) => toggleSelection(ids, tileId));
  }

  return {
    turnMode,
    setTurnMode,
    swapSelectedTileIds,
    setSwapSelectedTileIds,
    enterSwapMode,
    exitSwapMode,
    toggleSwapTile
  };
}
