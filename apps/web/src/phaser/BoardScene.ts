import type { BoardTile, Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import type { BoardRenderCache } from "../board/board-renderer";
import { renderBoard, createInitialCache } from "../board/board-renderer";

export interface RenderParams {
  boardPixelSize: number;
  boardSize: number;
  boardTiles: BoardTile[];
  lastPlacements: BoardTile[];
  draft: readonly Placement[];
  ghostTiles: BoardTile[];
  players: PublicSnapshot["players"];
  rack: Tile[];
  draftOwnerId?: string;
  selectedTileId?: string;
}

export class BoardScene extends (await import("phaser")).Scene {
  private renderCache: BoardRenderCache = createInitialCache();

  constructor() {
    super({ key: "board" });
  }

  updateBoard(params: RenderParams): void {
    if (!this.sys.isActive()) return;

    renderBoard(this as any, this.renderCache, params);
  }

  resize(width: number, height: number): void {
    this.scale.resize(width, height);
  }

  clear(): void {
    this.renderCache = createInitialCache();
    this.children.removeAll();
  }
}
