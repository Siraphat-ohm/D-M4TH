import { describe, expect, test } from "bun:test";
import { toggleSelection } from "./turn-controls";

describe("turn controls", () => {
  test("toggles rack swap selection", () => {
    expect(toggleSelection(["a"], "a")).toEqual([]);
    expect(toggleSelection(["a"], "b")).toEqual(["a", "b"]);
  });
});
