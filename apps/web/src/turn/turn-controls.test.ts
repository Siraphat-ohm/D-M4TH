import { describe, expect, test } from "bun:test";
import { isCellBlocked, toggleSelection } from "./turn-controls";

describe("turn controls", () => {
  test("toggles rack swap selection", () => {
    expect(toggleSelection(["a"], "a")).toEqual([]);
    expect(toggleSelection(["a"], "b")).toEqual(["a", "b"]);
  });

  test("blocks placement on committed board cells", () => {
    expect(isCellBlocked(new Set(["7,7"]), undefined, undefined, 7, 7)).toBe(true);
  });

  test("blocks placement on another draft tile but allows own tile move target", () => {
    expect(isCellBlocked(new Set(), "tile-b", "tile-a", 5, 5)).toBe(true);
    expect(isCellBlocked(new Set(), "tile-a", "tile-a", 5, 5)).toBe(false);
  });
});
