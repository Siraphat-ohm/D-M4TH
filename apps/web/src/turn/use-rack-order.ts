import { useEffect, useMemo, useState } from "react";
import type { Tile } from "@d-m4th/game";

export function useRackOrder(rack: readonly Tile[]) {
  const [customRackOrder, setCustomRackOrder] = useState<string[]>([]);

  useEffect(() => {
    setCustomRackOrder((prev) => {
      const existingIds = new Set(prev);
      const newIds = rack.map((tile) => tile.id).filter((id) => !existingIds.has(id));
      return newIds.length === 0 ? prev : [...prev, ...newIds];
    });
  }, [rack]);

  const orderedRack = useMemo(() => {
    const rackCopy = [...rack];
    rackCopy.sort((a, b) => {
      const indexA = customRackOrder.indexOf(a.id);
      const indexB = customRackOrder.indexOf(b.id);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    });
    return rackCopy;
  }, [rack, customRackOrder]);

  function handleRackSwap(idA: string, idB: string): void {
    if (idA === idB) return;

    setCustomRackOrder((prev) => {
      const indexA = prev.indexOf(idA);
      const indexB = prev.indexOf(idB);
      if (indexA === -1 || indexB === -1) return prev;

      const next = [...prev];
      next[indexA] = idB;
      next[indexB] = idA;
      return next;
    });
  }

  return { orderedRack, handleRackSwap };
}

export function createRackSlots(rack: readonly Tile[], rackSize: number): Array<Tile | undefined> {
  return [...rack, ...Array.from({ length: Math.max(0, rackSize - rack.length) }, () => undefined)];
}
