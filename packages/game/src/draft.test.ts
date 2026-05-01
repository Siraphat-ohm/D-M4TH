import { describe, expect, test } from "bun:test";
import { DraftManager } from "./draft";
import type { Tile } from "./types";

function tile(id: string, label: string, value = 1): Tile {
  return { id, label, value };
}

function occupied(...coords: Array<[number, number]>): ReadonlySet<string> {
  return new Set(coords.map(([x, y]) => `${x},${y}`));
}

describe("DraftManager", () => {
  describe("place()", () => {
    test("places tile on empty cell", () => {
      const sut = DraftManager.empty();
      const next = sut.place(tile("t1", "1"), 3, 4, occupied());

      expect(next.placements).toHaveLength(1);
      expect(next.placements[0]).toEqual({ tileId: "t1", x: 3, y: 4 });
    });

    test("rejects placement on cell occupied by committed board tile", () => {
      const sut = DraftManager.empty();
      const cells = occupied([3, 4]);
      const next = sut.place(tile("t1", "1"), 3, 4, cells);

      expect(next.placements).toHaveLength(0);
    });

    test("rejects placement on cell already holding another draft tile", () => {
      const sut = DraftManager.empty().place(tile("t1", "1"), 3, 4, occupied());
      const next = sut.place(tile("t2", "2"), 3, 4, occupied());

      expect(next.placements).toHaveLength(2);
    });

    test("rejects face-required tile on occupied cell", () => {
      const sut = DraftManager.empty();
      const next = sut.place(tile("t1", "BLANK"), 5, 5, occupied([5, 5]));

      expect(next.pendingFace).toBeUndefined();
      expect(next.placements).toHaveLength(0);
    });

    test("enters pending face state on free cell", () => {
      const sut = DraftManager.empty();
      const next = sut.place(tile("t1", "BLANK"), 5, 5, occupied());

      expect(next.pendingFace).toBeDefined();
      expect(next.pendingFace!.tile.id).toBe("t1");
    });
  });

  describe("move()", () => {
    test("moves draft tile to empty cell", () => {
      const sut = DraftManager.empty().place(tile("t1", "1"), 2, 3, occupied());
      const next = sut.move("t1", 5, 6, occupied());

      expect(next.placements).toHaveLength(1);
      expect(next.placements[0]).toEqual({ tileId: "t1", x: 5, y: 6 });
    });

    test("swaps two draft tiles", () => {
      const sut = DraftManager.empty()
        .place(tile("t1", "1"), 2, 3, occupied())
        .place(tile("t2", "2"), 5, 6, occupied());
      const next = sut.move("t1", 5, 6, occupied());

      const t1 = next.placements.find((p) => p.tileId === "t1")!;
      const t2 = next.placements.find((p) => p.tileId === "t2")!;
      expect(t1).toEqual({ tileId: "t1", x: 5, y: 6 });
      expect(t2).toEqual({ tileId: "t2", x: 2, y: 3 });
    });

    test("rejects move to cell occupied by committed board tile", () => {
      const sut = DraftManager.empty().place(tile("t1", "1"), 2, 3, occupied());
      const next = sut.move("t1", 7, 8, occupied([7, 8]));

      expect(next.placements).toHaveLength(1);
      expect(next.placements[0]).toEqual({ tileId: "t1", x: 2, y: 3 });
    });

    test("allows move to cell occupied by committed tile if another draft tile is there (swap)", () => {
      const sut = DraftManager.empty()
        .place(tile("t1", "1"), 2, 3, occupied())
        .place(tile("t2", "2"), 5, 6, occupied());
      const next = sut.move("t1", 5, 6, occupied([5, 6]));

      const t1 = next.placements.find((p) => p.tileId === "t1")!;
      expect(t1.x).toBe(5);
      expect(t1.y).toBe(6);
    });

    test("returns unchanged when tile not found", () => {
      const sut = DraftManager.empty();
      const next = sut.move("nonexistent", 1, 1, occupied());

      expect(next).toBe(sut);
    });
  });

  describe("recall()", () => {
    test("removes draft tile", () => {
      const sut = DraftManager.empty().place(tile("t1", "1"), 3, 4, occupied());
      const next = sut.recall("t1");

      expect(next.placements).toHaveLength(0);
    });
  });

  describe("clear()", () => {
    test("removes all draft tiles and pending face", () => {
      const sut = DraftManager.empty()
        .place(tile("t1", "1"), 3, 4, occupied())
        .place(tile("t2", "BLANK"), 5, 6, occupied());
      const next = sut.clear();

      expect(next.placements).toHaveLength(0);
      expect(next.pendingFace).toBeUndefined();
    });
  });
});
