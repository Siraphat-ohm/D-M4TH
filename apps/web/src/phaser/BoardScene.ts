import type { BoardTile, Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import type { PremiumMapId } from "@d-m4th/config";
import type { BoardRenderCache } from "../board/board-renderer";
import { renderBoard, createInitialCache } from "../board/board-renderer";

export interface RenderParams {
  boardPixelSize: number;
  boardSize: number;
  premiumMapId: PremiumMapId;
  boardTiles: BoardTile[];
  draft: readonly Placement[];
  ghostTiles: BoardTile[];
  players: PublicSnapshot["players"];
  rack: Tile[];
  draftOwnerId?: string;
  selectedTileId?: string;
}

const BOARD_SCENE_KEY = "board" as const;

// Lazy-resolved base class. Stored after first dynamic import.
let PhaserSceneClass: (new (...args: any[]) => any) | undefined;

export async function createBoardSceneClass(): Promise<new () => any> {
  if (!PhaserSceneClass) {
    const phaser = await import("phaser");
    PhaserSceneClass = phaser.Scene;
  }

  const Base = PhaserSceneClass;

  return class BoardSceneInstance extends Base {
    private __renderCache: BoardRenderCache = createInitialCache();

    constructor() {
      super({ key: BOARD_SCENE_KEY });
    }

    updateBoard(params: RenderParams): void {
      if (!this.sys?.isActive()) return;
      renderBoard(this as any, this.__renderCache, params);
    }

    resize(width: number, height: number): void {
      this.scale.resize(width, height);
    }

    clear(): void {
      this.__renderCache = createInitialCache();
      this.children?.removeAll();
    }
  };
}

export type BoardScene = InstanceType<Awaited<ReturnType<typeof createBoardSceneClass>>>;
