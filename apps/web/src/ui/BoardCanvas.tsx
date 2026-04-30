import { useEffect, useRef, useState } from "react";
import { createClassicalBoardLayout } from "@d-m4th/game";
import type { BoardTile, Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import {
  colorNumber,
  createRenderTiles,
  createTileRenderMetrics,
  snapClientPointToBoardCell,
  type RenderTile
} from "../board/board-interaction";

interface BoardCanvasProps {
  snapshot?: PublicSnapshot;
  draft: Placement[];
  rack: Tile[];
  currentPlayerId?: string;
  selectedTileId?: string;
  placementDisabled: boolean;
  onCellClick: (x: number, y: number) => void;
  onTileDrop: (tileId: string, x: number, y: number) => void;
}

interface PhaserRuntime {
  AUTO: number;
  Game: new (config: Record<string, unknown>) => { destroy(removeCanvas: boolean): void; scene: { getScene(key: string): BoardScene } };
  Scene: new (config: { key: string }) => BoardScene;
}

interface PhaserRectangle {
  setStrokeStyle(width: number, color: number, alpha?: number): PhaserRectangle;
}

interface PhaserText {
  setOrigin(x: number, y?: number): PhaserText;
}

interface BoardScene {
  add: {
    rectangle(x: number, y: number, width: number, height: number, color: number, alpha?: number): PhaserRectangle;
    text(x: number, y: number, text: string, style: Record<string, string | number>): PhaserText;
  };
  scale: {
    resize(width: number, height: number): void;
  };
  children: {
    removeAll(): void;
  };
}

const BOARD_SCENE_KEY = "board";
const NORMAL_CELL_COLOR = 0x171d2b;
const CELL_BORDER_COLOR = 0x2e374f;
const START_TEXT_COLOR = "#f7e6a6";
const PREMIUM_COLORS = {
  piece2: 0xc97846,
  piece3: 0x2d8b8f,
  equation2: 0xd6a84a,
  equation3: 0xa33f4e
};

export function BoardCanvas(props: BoardCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ destroy(removeCanvas: boolean): void; scene: { getScene(key: string): BoardScene } } | undefined>(
    undefined
  );
  const [renderSignal, setRenderSignal] = useState(0);

  useEffect(() => {
    let disposed = false;

    async function mountPhaser(): Promise<void> {
      const host = hostRef.current;

      if (!host) {
        return;
      }

      const runtime = await loadPhaser();

      if (disposed) {
        return;
      }

      const scene = createScene(runtime);
      gameRef.current = new runtime.Game({
        type: runtime.AUTO,
        parent: host,
        width: host.clientWidth,
        height: host.clientWidth,
        backgroundColor: "#141414",
        scene
      });
      setRenderSignal((current) => current + 1);
    }

    mountPhaser();

    return () => {
      disposed = true;
      gameRef.current?.destroy(true);
      gameRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const observer = new ResizeObserver(() => setRenderSignal((current) => current + 1));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const scene = gameRef.current?.scene.getScene(BOARD_SCENE_KEY);
    const host = hostRef.current;

    if (!scene || !host) {
      return;
    }

    scene.scale.resize(host.clientWidth, host.clientWidth);
    renderBoard(scene, {
      boardSize: props.snapshot?.config.boardSize ?? 15,
      boardTiles: props.snapshot?.board ?? [],
      draft: props.draft,
      ghostTiles:
        props.snapshot?.ghostPlacements
          .filter((placement) => placement.playerId !== props.currentPlayerId)
          .flatMap((placement) => placement.placements) ?? [],
      players: props.snapshot?.players ?? [],
      rack: props.rack,
      draftOwnerId: props.currentPlayerId,
      selectedTileId: props.selectedTileId
    });
  }, [props.snapshot, props.draft, props.rack, props.currentPlayerId, props.selectedTileId, renderSignal]);

  return (
    <div
      className="board-host"
      data-board-size={props.snapshot?.config.boardSize ?? 15}
      ref={hostRef}
      onPointerDown={(event) => {
        if (props.placementDisabled || event.button !== 0) {
          return;
        }

        const coordinate = readBoardCoordinate(hostRef.current, event, props.snapshot?.config.boardSize ?? 15);

        if (coordinate) {
          props.onCellClick(coordinate.x, coordinate.y);
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        if (props.placementDisabled) {
          return;
        }

        const tileId = event.dataTransfer.getData("text/plain");
        const coordinate = readBoardCoordinate(hostRef.current, event, props.snapshot?.config.boardSize ?? 15);

        if (tileId && coordinate) {
          props.onTileDrop(tileId, coordinate.x, coordinate.y);
        }
      }}
    />
  );
}

async function loadPhaser(): Promise<PhaserRuntime> {
  const module = (await import("phaser")) as unknown as Partial<PhaserRuntime> & { default?: PhaserRuntime };
  const runtime = module.default ?? module;

  if (!runtime.Game || !runtime.Scene) {
    throw new Error("Phaser runtime did not load");
  }

  return runtime as PhaserRuntime;
}

function createScene(runtime: PhaserRuntime): BoardScene {
  class Scene extends runtime.Scene {
    constructor() {
      super({ key: BOARD_SCENE_KEY });
    }
  }

  return new Scene();
}

function renderBoard(
  scene: BoardScene,
  params: {
    boardSize: number;
    boardTiles: BoardTile[];
    draft: Placement[];
    ghostTiles: BoardTile[];
    players: PublicSnapshot["players"];
    rack: Tile[];
    draftOwnerId?: string;
    selectedTileId?: string;
  }
): void {
  const { boardSize, boardTiles, draft, draftOwnerId, ghostTiles, players, rack } = params;
  const premiumLayout = createClassicalBoardLayout(boardSize);
  const size = thisCanvasWidth();
  const cellSize = size / boardSize;
  scene.children.removeAll();

  for (let y = 0; y < boardSize; y += 1) {
    for (let x = 0; x < boardSize; x += 1) {
      const premium = premiumLayout.find((cell) => cell.x === x && cell.y === y);
      drawCell(scene, { x, y, cellSize, premium });
    }
  }

  for (const tile of createRenderTiles({ boardTiles, ghostTiles, draft, rack, players, draftOwnerId })) {
    if (tile.id === params.selectedTileId) {
      drawSelection(scene, tile, cellSize);
    }

    drawTile(scene, tile, cellSize);
  }
}

function drawCell(
  scene: BoardScene,
  params: {
    x: number;
    y: number;
    cellSize: number;
    premium?: ReturnType<typeof createClassicalBoardLayout>[number];
  }
): void {
  const { cellSize, premium, x, y } = params;
  const centerX = x * cellSize + cellSize / 2;
  const centerY = y * cellSize + cellSize / 2;
  const outerSize = Math.max(1, cellSize - 1);
  const innerSize = Math.max(1, cellSize - Math.max(4, cellSize * 0.14));

  scene.add.rectangle(centerX, centerY, outerSize, outerSize, CELL_BORDER_COLOR, 0.9);
  scene.add.rectangle(centerX, centerY, innerSize, innerSize, cellColor(premium), premium ? 0.96 : 0.82);

  const label = premiumLabel(premium);

  if (premium?.start) {
    scene.add.text(centerX, centerY - cellSize * 0.14, "★", {
      fontFamily: '"Silkscreen", monospace',
      fontSize: Math.max(8, cellSize * 0.28),
      color: START_TEXT_COLOR
    }).setOrigin(0.5);
  }

  if (label) {
    scene.add.text(centerX, centerY + (premium?.start ? cellSize * 0.2 : 0), label, {
      fontFamily: '"Silkscreen", monospace',
      fontSize: Math.max(7, cellSize * 0.18),
      color: "#101827"
    }).setOrigin(0.5);
  }
}

function cellColor(premium?: ReturnType<typeof createClassicalBoardLayout>[number]): number {
  if (premium?.pieceMultiplier === 3) {
    return PREMIUM_COLORS.piece3;
  }

  if (premium?.pieceMultiplier === 2) {
    return PREMIUM_COLORS.piece2;
  }

  if (premium?.equationMultiplier === 3) {
    return PREMIUM_COLORS.equation3;
  }

  if (premium?.equationMultiplier === 2) {
    return PREMIUM_COLORS.equation2;
  }

  return NORMAL_CELL_COLOR;
}

function premiumLabel(premium?: ReturnType<typeof createClassicalBoardLayout>[number]): string {
  if (premium?.pieceMultiplier) {
    return `${premium.pieceMultiplier}P`;
  }

  if (premium?.equationMultiplier) {
    return `${premium.equationMultiplier}E`;
  }

  return "";
}

function drawSelection(scene: BoardScene, tile: RenderTile, cellSize: number): void {
  scene.add.rectangle(
    tile.x * cellSize + cellSize / 2,
    tile.y * cellSize + cellSize / 2,
    cellSize * 0.88,
    cellSize * 0.88,
    0xffd166,
    0.95
  ).setStrokeStyle(Math.max(2, cellSize * 0.06), 0xfff0a8, 1);
}

function drawTile(scene: BoardScene, tile: RenderTile, cellSize: number): void {
  const metrics = createTileRenderMetrics(cellSize);
  const centerX = tile.x * cellSize + cellSize / 2;
  const centerY = tile.y * cellSize + cellSize / 2;
  const strokeWidth = Math.max(1, cellSize * 0.04);

  scene.add.rectangle(centerX, centerY, metrics.tileSize, metrics.tileSize, colorNumber(tile.fillColor), tile.alpha).setStrokeStyle(
    strokeWidth,
    0xf7e6a6,
    tile.alpha
  );
  scene.add.rectangle(centerX, centerY, metrics.tileSize * 0.82, metrics.tileSize * 0.82, colorNumber(tile.fillColor), tile.alpha * 0.82);
  scene.add.text(centerX, tile.y * cellSize + cellSize * 0.48, tile.label, {
    fontFamily: '"Silkscreen", monospace',
    fontSize: tile.label.length > 3 ? metrics.longLabelFontSize : metrics.shortLabelFontSize,
    color: tile.textColor
  }).setOrigin(0.5);
}

function thisCanvasWidth(): number {
  return document.querySelector(".board-host")?.clientWidth ?? 600;
}

function readBoardCoordinate(
  host: HTMLDivElement | null,
  point: { clientX: number; clientY: number },
  boardSize: number
) {
  if (!host) {
    return undefined;
  }

  return snapClientPointToBoardCell({
    point,
    bounds: readBoardContentBounds(host),
    boardSize
  });
}

function readBoardContentBounds(host: HTMLDivElement) {
  const bounds = host.getBoundingClientRect();

  return {
    left: bounds.left + host.clientLeft,
    top: bounds.top + host.clientTop,
    width: host.clientWidth,
    height: host.clientHeight
  };
}
