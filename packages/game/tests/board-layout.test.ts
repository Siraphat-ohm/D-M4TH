import { describe, expect, test } from "bun:test";
import {
  createBoardLayout,
  createClassicalBoardLayout,
  createCrossBoardLayout,
  createScaledBoardLayout,
  getBoardCell,
  getStartCoordinate
} from "../src/board-layout";

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

describe("scaled board layout", () => {
  test("produces identical output to classical layout at size 15", () => {
    const classical = createClassicalBoardLayout();
    const scaled = createScaledBoardLayout(15);

    expect(scaled.length).toEqual(classical.length);

    for (const classicalCell of classical) {
      const scaledCell = getBoardCell(scaled, classicalCell);
      expect(scaledCell.equationMultiplier).toEqual(classicalCell.equationMultiplier);
      expect(scaledCell.pieceMultiplier).toEqual(classicalCell.pieceMultiplier);
      expect(scaledCell.start).toEqual(classicalCell.start);
    }
  });

  test("places start at center with 3P multiplier", () => {
    for (const size of [15, 17, 19, 21]) {
      const layout = createScaledBoardLayout(size);
      const startCoord = getStartCoordinate(size);
      const startCell = getBoardCell(layout, startCoord);

      expect(startCell.start).toBe(true);
      expect(startCell.pieceMultiplier).toBe(3);
    }
  });

  test("has 4-fold rotational symmetry for all premium cells", () => {
    for (const size of [15, 17, 19, 21]) {
      const layout = createScaledBoardLayout(size);
      const center = Math.floor(size / 2);

      for (const cell of layout) {
        const dx = cell.x - center;
        const dy = cell.y - center;
        const rotations: Array<[number, number]> = [
          [-dy, dx],
          [-dx, -dy],
          [dy, -dx]
        ];

        for (const [rdx, rdy] of rotations) {
          const rotatedCell = getBoardCell(layout, { x: center + rdx, y: center + rdy });
          expect(rotatedCell.equationMultiplier).toEqual(cell.equationMultiplier);
          expect(rotatedCell.pieceMultiplier).toEqual(cell.pieceMultiplier);
        }
      }
    }
  });

  test("keeps all cells within board bounds", () => {
    for (const size of [15, 17, 19, 21, 23]) {
      const layout = createScaledBoardLayout(size);

      for (const cell of layout) {
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.x).toBeLessThan(size);
        expect(cell.y).toBeGreaterThanOrEqual(0);
        expect(cell.y).toBeLessThan(size);
      }
    }
  });

  test("places 3E at corners and edge midpoints for any board size", () => {
    for (const size of [15, 17, 19, 21]) {
      const layout = createScaledBoardLayout(size);
      const maxIndex = size - 1;
      const center = Math.floor(size / 2);

      const corners = [
        { x: 0, y: 0 },
        { x: maxIndex, y: 0 },
        { x: 0, y: maxIndex },
        { x: maxIndex, y: maxIndex }
      ];

      const edgeMidpoints = [
        { x: center, y: 0 },
        { x: maxIndex, y: center },
        { x: center, y: maxIndex },
        { x: 0, y: center }
      ];

      for (const corner of corners) {
        expect(getBoardCell(layout, corner).equationMultiplier).toBe(3);
      }

      for (const midpoint of edgeMidpoints) {
        expect(getBoardCell(layout, midpoint).equationMultiplier).toBe(3);
      }
    }
  });

  test("keeps many 2E cells on diagonal routes", () => {
    for (const size of [15, 17, 19, 21]) {
      const layout = createScaledBoardLayout(size);
      const center = Math.floor(size / 2);

      const equationMultiplier2Cells = layout.filter((c) => c.equationMultiplier === 2);
      const diagonalCells = equationMultiplier2Cells.filter((cell) => {
        const dx = Math.abs(cell.x - center);
        const dy = Math.abs(cell.y - center);
        return dx === dy;
      });

      expect(equationMultiplier2Cells.length).toBeGreaterThan(0);
      expect(diagonalCells.length).toBeGreaterThanOrEqual(16);
    }
  });

  test("increases premium count as odd board size grows", () => {
    let previousCount = 0;

    for (const size of [15, 17, 19, 21, 23, 25]) {
      const layout = createScaledBoardLayout(size);

      expect(layout.length).toBeGreaterThan(previousCount);
      previousCount = layout.length;
    }
  });

  test("returns sorted cells by position", () => {
    for (const size of [15, 17]) {
      const layout = createScaledBoardLayout(size);

      for (let index = 1; index < layout.length; index++) {
        const previous = layout[index - 1];
        const current = layout[index];
        const inOrder =
          previous.y < current.y || (previous.y === current.y && previous.x < current.x);
        expect(inOrder).toBe(true);
      }
    }
  });

  test("rejects even board sizes", () => {
    expect(() => createScaledBoardLayout(16)).toThrow("odd number");
    expect(() => createScaledBoardLayout(14)).toThrow("odd number");
  });

  test("rejects board sizes below 15", () => {
    expect(() => createScaledBoardLayout(13)).toThrow("at least 15");
    expect(() => createScaledBoardLayout(9)).toThrow("at least 15");
  });

  test("classical cell counts: 3E=8, 2E=16, 3P=13, 2P=24", () => {
    const layout = createScaledBoardLayout(15);

    const equationMultiplier3 = layout.filter((c) => c.equationMultiplier === 3).length;
    const equationMultiplier2 = layout.filter((c) => c.equationMultiplier === 2).length;
    const pieceMultiplier3 = layout.filter((c) => c.pieceMultiplier === 3).length;
    const pieceMultiplier2 = layout.filter((c) => c.pieceMultiplier === 2).length;
    const startCells = layout.filter((c) => c.start).length;

    expect(equationMultiplier3).toBe(8);
    expect(equationMultiplier2).toBe(16);
    expect(pieceMultiplier3).toBe(13);
    expect(pieceMultiplier2).toBe(24);
    expect(startCells).toBe(1);
    expect(layout.length).toBe(61);
  });
});

describe("selectable party board layouts", () => {
  test("creates selectable layouts for every supported odd party board size", () => {
    for (const size of [15, 17, 19, 21, 23, 25]) {
      for (const mapId of ["scaled-classic", "center-classic", "cross"] as const) {
        const layout = createBoardLayout(size, mapId);
        const startCell = getBoardCell(layout, getStartCoordinate(size));

        expect(startCell.start).toBe(true);
        expect(startCell.pieceMultiplier).toBe(3);
        expect(layout.length).toBeGreaterThan(0);

        for (const cell of layout) {
          expect(cell.x).toBeGreaterThanOrEqual(0);
          expect(cell.x).toBeLessThan(size);
          expect(cell.y).toBeGreaterThanOrEqual(0);
          expect(cell.y).toBeLessThan(size);
        }
      }
    }
  });

  test("cross layout differs from scaled classic while preserving rotational symmetry", () => {
    const size = 19;
    const scaledLayout = createScaledBoardLayout(size);
    const crossLayout = createCrossBoardLayout(size);
    const center = Math.floor(size / 2);

    expect(crossLayout).not.toEqual(scaledLayout);

    for (const cell of crossLayout) {
      const dx = cell.x - center;
      const dy = cell.y - center;
      const rotations: Array<[number, number]> = [
        [-dy, dx],
        [-dx, -dy],
        [dy, -dx]
      ];

      for (const [rdx, rdy] of rotations) {
        const rotatedCell = getBoardCell(crossLayout, { x: center + rdx, y: center + rdy });
        expect(rotatedCell.equationMultiplier).toEqual(cell.equationMultiplier);
        expect(rotatedCell.pieceMultiplier).toEqual(cell.pieceMultiplier);
      }
    }
  });
});
