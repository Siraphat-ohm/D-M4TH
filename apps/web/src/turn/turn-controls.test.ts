import { describe, expect, test } from "bun:test";
import { findDraftPlacementAt, moveOrSwapDraftPlacement, toggleSelection, upsertDraftPlacement } from "./turn-controls";

describe("turn controls", () => {
  test("moves a draft tile to an empty grid cell", () => {
    const draft = moveOrSwapDraftPlacement({
      draft: [{ tileId: "a", x: 1, y: 1 }],
      tileId: "a",
      target: { x: 2, y: 3 }
    });

    expect(draft).toEqual([{ tileId: "a", x: 2, y: 3 }]);
  });

  test("swaps draft positions when target grid has another draft tile", () => {
    const draft = moveOrSwapDraftPlacement({
      draft: [
        { tileId: "a", x: 1, y: 1 },
        { tileId: "b", x: 2, y: 2 }
      ],
      tileId: "a",
      target: { x: 2, y: 2 }
    });

    expect(draft).toEqual([
      { tileId: "a", x: 2, y: 2 },
      { tileId: "b", x: 1, y: 1 }
    ]);
  });

  test("finds draft tile at grid cell", () => {
    expect(findDraftPlacementAt([{ tileId: "a", x: 1, y: 1 }], { x: 1, y: 1 })?.tileId).toBe("a");
  });

  test("upserts draft placement by tile id", () => {
    const draft = upsertDraftPlacement([{ tileId: "a", x: 1, y: 1 }], { tileId: "a", x: 3, y: 4 });

    expect(draft).toEqual([{ tileId: "a", x: 3, y: 4 }]);
  });

  test("toggles rack swap selection", () => {
    expect(toggleSelection(["a"], "a")).toEqual([]);
    expect(toggleSelection(["a"], "b")).toEqual(["a", "b"]);
  });
});
