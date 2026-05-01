import { tileRequiresFace } from "./tile-catalog";
import type { Coordinate, Placement, Tile } from "./types";

export interface PendingFace extends Coordinate {
  tile: Tile;
}

export class DraftManager {
  public readonly placements: readonly Placement[];
  public readonly pendingFace?: PendingFace;

  private constructor(placements: readonly Placement[], pendingFace?: PendingFace) {
    this.placements = placements;
    this.pendingFace = pendingFace;
  }

  public static empty(): DraftManager {
    return new DraftManager([]);
  }

  public place(tile: Tile, x: number, y: number): DraftManager {
    if (tileRequiresFace(tile.label)) {
      return new DraftManager(this.placements, { tile, x, y });
    }

    return this.upsert({ tileId: tile.id, x, y });
  }

  public resolveFace(face: string): DraftManager {
    if (!this.pendingFace) {
      return this;
    }

    const { tile, x, y } = this.pendingFace;
    return this.upsert({ tileId: tile.id, x, y, face }).cancelFace();
  }

  public cancelFace(): DraftManager {
    return new DraftManager(this.placements, undefined);
  }

  public move(tileId: string, x: number, y: number): DraftManager {
    const source = this.placements.find((p) => p.tileId === tileId);
    if (!source) {
      return this;
    }

    const target = this.at(x, y);

    const nextPlacements = this.placements.map((placement) => {
      if (placement.tileId === tileId) {
        return { ...placement, x, y };
      }

      if (target && placement.tileId === target.tileId) {
        return { ...placement, x: source.x, y: source.y };
      }

      return placement;
    });

    return new DraftManager(nextPlacements, this.pendingFace);
  }

  public recall(tileId: string): DraftManager {
    return new DraftManager(
      this.placements.filter((p) => p.tileId !== tileId),
      this.pendingFace
    );
  }

  public clear(): DraftManager {
    return DraftManager.empty();
  }

  public at(x: number, y: number): Placement | undefined {
    return this.placements.find((p) => p.x === x && p.y === y);
  }

  public has(tileId: string): boolean {
    return this.placements.some((p) => p.tileId === tileId);
  }

  private upsert(placement: Placement): DraftManager {
    const filtered = this.placements.filter((p) => p.tileId !== placement.tileId);
    return new DraftManager([...filtered, placement], this.pendingFace);
  }
}
