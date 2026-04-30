import { describe, expect, test } from "bun:test";
import { createClassicalBoardLayout, getBoardCell, getStartCoordinate } from "../src/board-layout";

describe("classical board layout", () => {
  test("uses the center as both start star and 3P", () => {
    const layout = createClassicalBoardLayout();
    const center = getBoardCell(layout, { x: 7, y: 7 });

    expect(center.start).toBe(true);
    expect(center.pieceMultiplier).toBe(3);
  });

  test("keeps fixed classical premium coordinates", () => {
    const layout = createClassicalBoardLayout();

    expect(getBoardCell(layout, { x: 0, y: 0 }).equationMultiplier).toBe(3);
    expect(getBoardCell(layout, { x: 1, y: 1 }).equationMultiplier).toBe(2);
    expect(getBoardCell(layout, { x: 5, y: 1 }).pieceMultiplier).toBe(3);
    expect(getBoardCell(layout, { x: 3, y: 0 }).pieceMultiplier).toBe(2);
  });

  test("centers the classical premium layout on larger odd boards", () => {
    const layout = createClassicalBoardLayout(19);
    const center = getBoardCell(layout, { x: 9, y: 9 });

    expect(getStartCoordinate(19)).toEqual({ x: 9, y: 9 });
    expect(center.start).toBe(true);
    expect(center.pieceMultiplier).toBe(3);
    expect(getBoardCell(layout, { x: 2, y: 2 }).equationMultiplier).toBe(3);
    expect(getBoardCell(layout, { x: 16, y: 16 }).equationMultiplier).toBe(3);
  });
});
