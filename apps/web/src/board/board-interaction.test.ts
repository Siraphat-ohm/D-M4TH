import { describe, expect, test } from "bun:test";
import {
  createDragPreviewSize,
  createRenderTiles,
  createTileRenderMetrics,
  snapClientPointToBoardCell,
  textColorForPlayerColor
} from "./board-interaction";

describe("board interaction", () => {
  test("snaps client coordinates using the visible board bounds", () => {
    const coordinate = snapClientPointToBoardCell({
      point: { clientX: 150, clientY: 250 },
      bounds: { left: 100, top: 200, width: 300, height: 300 },
      boardSize: 15
    });

    expect(coordinate).toEqual({ x: 2, y: 2 });
  });

  test("rejects drops outside the square board", () => {
    const coordinate = snapClientPointToBoardCell({
      point: { clientX: 401, clientY: 250 },
      bounds: { left: 100, top: 200, width: 300, height: 300 },
      boardSize: 15
    });

    expect(coordinate).toBeUndefined();
  });

  test("renders draft tiles with their real face and player color", () => {
    const tiles = createRenderTiles({
      boardTiles: [],
      ghostTiles: [],
      draft: [{ tileId: "t1", face: "=", x: 7, y: 7 }],
      rack: [{ id: "t1", label: "BLANK", value: 0 }],
      players: [
        { id: "p1", name: "Ada", color: "#f97316", score: 0, rackCount: 8, remainingMs: 1000, connected: true }
      ],
      draftOwnerId: "p1"
    });

    expect(tiles[0]).toMatchObject({ label: "=", value: 0, fillColor: "#f97316", ownerId: "p1" });
  });

  test("chooses readable text color from player color", () => {
    expect(textColorForPlayerColor("#111111")).toBe("#f8fafc");
    expect(textColorForPlayerColor("#fef08a")).toBe("#111827");
  });

  test("keeps rendered and dragged tiles smaller than a board cell", () => {
    const cellSize = 48;
    const metrics = createTileRenderMetrics(cellSize);

    expect(metrics.tileSize).toBeLessThan(cellSize);
    expect(createDragPreviewSize(cellSize)).toBeLessThan(cellSize);
  });
});
