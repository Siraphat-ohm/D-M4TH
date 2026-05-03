import { describe, expect, test } from "bun:test";
import { displayTileLabel } from "../shared/tile-display";

describe("tile display", () => {
  test("renders blank tiles with no face", () => {
    expect(displayTileLabel({ label: "BLANK" })).toBe("");
  });

  test("keeps normal tile labels visible", () => {
    expect(displayTileLabel({ label: "10" })).toBe("10");
  });
});
