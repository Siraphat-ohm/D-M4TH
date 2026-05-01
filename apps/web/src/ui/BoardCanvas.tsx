import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createClassicalBoardLayout } from "@d-m4th/game";
import type { BoardTile, Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import {
  colorNumber,
  createRenderTiles,
  createTileRenderMetrics,
  snapClientPointToBoardCell,
  type RenderTile
} from "../board/board-interaction";
import { displayTileLabel } from "./tile-display";

interface BoardCanvasProps {
  snapshot?: PublicSnapshot;
  previewBoardSize?: number;
  draft: Placement[];
  rack: Tile[];
  currentPlayerId?: string;
  selectedTileId?: string;
  placementDisabled: boolean;
  onCellClick: (x: number, y: number) => void;
  onDraftTileDoubleClick: (x: number, y: number) => void;
  onTileDrop: (tileId: string, x: number, y: number) => void;
  variant?: "game" | "preview";
}

interface PhaserRuntime {
  AUTO: number;
  Game: new (config: Record<string, unknown>) => { destroy(removeCanvas: boolean): void; scene: { getScene(key: string): BoardScene } };
  Scene: new (config: { key: string }) => BoardScene;
  Scale: {
    RESIZE: number;
  };
}

interface PhaserGameObject {
  destroy(): void;
}

interface PhaserRectangle extends PhaserGameObject {
  setStrokeStyle(width: number, color: number, alpha?: number): PhaserRectangle;
}

interface PhaserText extends PhaserGameObject {
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
const DEFAULT_BOARD_SIZE = 15;
const DOUBLE_TAP_WINDOW_MS = 300;
const MIN_TOUCH_CELL_SIZE = 44;
const MIN_BOARD_PIXELS = 420;
const NORMAL_CELL_COLOR = 0x171d2b;
const CELL_BORDER_COLOR = 0x2e374f;
const SELECTED_TILE_BORDER_COLOR = 0x38d4ce;
const START_TEXT_COLOR = "#f7e6a6";
const PREMIUM_COLORS = {
  piece2: 0xc97846,
  piece3: 0x2d8b8f,
  equation2: 0xd6a84a,
  equation3: 0xa33f4e
};

interface TileRenderState {
  tileKey: string;
  objects: PhaserGameObject[];
}

interface BoardRenderCache {
  boardSignature?: string;
  tiles: TileRenderState[];
}

type RenderStatus = "loading" | "ready" | "error";

export function BoardCanvas(props: BoardCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ destroy(removeCanvas: boolean): void; scene: { getScene(key: string): BoardScene } } | undefined>(
    undefined
  );
  const renderCacheRef = useRef<BoardRenderCache>({ tiles: [] });
  const lastTapRef = useRef<{ at: number; x: number; y: number } | undefined>(undefined);
  const [renderSignal, setRenderSignal] = useState(0);
  const [renderStatus, setRenderStatus] = useState<RenderStatus>("loading");
  const boardSize = props.snapshot?.config.boardSize ?? props.previewBoardSize ?? DEFAULT_BOARD_SIZE;
  const minimumBoardPixels = props.variant === "preview" ? MIN_BOARD_PIXELS : calculateMinimumBoardPixels(boardSize);

  useEffect(() => {
    let disposed = false;

    async function mountPhaser(): Promise<void> {
      const host = hostRef.current;

      if (!host) {
        return;
      }

      setRenderStatus("loading");

      try {
        const runtime = await loadPhaser();

        if (disposed) {
          return;
        }

        const scene = createScene(runtime);
        const boardPixelSize = readBoardPixelSize(host);
        gameRef.current = new runtime.Game({
          type: runtime.AUTO,
          parent: host,
          width: boardPixelSize,
          height: boardPixelSize,
          backgroundColor: "#0a0f1c",
          scale: {
            mode: runtime.Scale.RESIZE,
            width: boardPixelSize,
            height: boardPixelSize
          },
          scene
        });
        setRenderStatus("ready");
        setRenderSignal((current) => current + 1);
      } catch (error) {
        console.error("Failed to mount Phaser board", error);

        if (!disposed) {
          setRenderStatus("error");
        }
      }
    }

    mountPhaser();

    return () => {
      disposed = true;
      gameRef.current?.destroy(true);
      gameRef.current = undefined;
      renderCacheRef.current = { tiles: [] };
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

    const boardPixelSize = readBoardPixelSize(host);

    if (boardPixelSize === 0) {
      return;
    }

    scene.scale.resize(boardPixelSize, boardPixelSize);
    renderBoard(scene, renderCacheRef.current, {
      boardPixelSize,
      boardSize,
      boardTiles: props.snapshot?.board ?? [],
      draft: props.draft,
      ghostTiles:
        props.snapshot?.ghostPlacements
          ?.filter((placement) => placement.playerId !== props.currentPlayerId)
          .flatMap((placement) => placement.placements) ?? [],
      players: props.snapshot?.players ?? [],
      rack: props.rack,
      draftOwnerId: props.currentPlayerId,
      selectedTileId: props.selectedTileId
    });
  }, [boardSize, props.snapshot, props.draft, props.rack, props.currentPlayerId, props.selectedTileId, renderSignal]);

  return (
    <div
      className={`board-host board-host--${props.variant ?? "game"} relative`}
      data-board-size={boardSize}
      ref={hostRef}
      style={{ "--board-min-size": `${minimumBoardPixels}px` } as CSSProperties}
      onPointerDown={(event) => {
        if (props.placementDisabled || event.button !== 0) {
          return;
        }

        const coordinate = readBoardCoordinate(hostRef.current, event, boardSize);

        if (coordinate) {
          props.onCellClick(coordinate.x, coordinate.y);

          if (isRepeatedTap(lastTapRef.current, coordinate, event.timeStamp)) {
            props.onDraftTileDoubleClick(coordinate.x, coordinate.y);
            lastTapRef.current = undefined;
            return;
          }

          lastTapRef.current = { at: event.timeStamp, x: coordinate.x, y: coordinate.y };
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        if (props.placementDisabled) {
          return;
        }

        const tileId = event.dataTransfer.getData("text/plain");
        const coordinate = readBoardCoordinate(hostRef.current, event, boardSize);

        if (tileId && coordinate) {
          props.onTileDrop(tileId, coordinate.x, coordinate.y);
        }
      }}
    >
      {renderStatus !== "ready" && (
        <div
          className="absolute inset-0 z-10 grid place-items-center bg-[rgb(10_15_28_/_0.92)] px-4 text-center text-sm uppercase tracking-[0.18em] text-[color:var(--muted)]"
          role="status"
        >
          {renderStatus === "error" ? "Board load failed" : "Loading board"}
        </div>
      )}
    </div>
  );
}

async function loadPhaser(): Promise<PhaserRuntime> {
  const module = (await import("phaser")) as unknown as Partial<PhaserRuntime> & { default?: PhaserRuntime };
  const runtime = module.default ?? module;

  if (!runtime.Game || !runtime.Scene || !runtime.Scale) {
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
  cache: BoardRenderCache,
  params: {
    boardPixelSize: number;
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
  const { boardPixelSize, boardSize, boardTiles, draft, draftOwnerId, ghostTiles, players, rack } = params;
  const premiumLayout = createClassicalBoardLayout(boardSize);
  const premiumCellsByCoordinate = new Map(premiumLayout.map((cell) => [premiumCoordinateKey(cell.x, cell.y), cell]));
  const cellSize = boardPixelSize / boardSize;
  const boardSignature = `${boardSize}:${boardPixelSize}`;

  if (cache.boardSignature !== boardSignature) {
    for (const entry of cache.tiles) {
      for (const obj of entry.objects) {
        obj.destroy();
      }
    }

    cache.tiles = [];
    scene.children.removeAll();

    for (let y = 0; y < boardSize; y += 1) {
      for (let x = 0; x < boardSize; x += 1) {
        const premium = premiumCellsByCoordinate.get(premiumCoordinateKey(x, y));
        drawCell(scene, { x, y, cellSize, premium });
      }
    }

    cache.boardSignature = boardSignature;
  }

  const renderTiles = createRenderTiles({ boardTiles, ghostTiles, draft, rack, players, draftOwnerId });
  const newTileKeys = new Map<string, RenderTile>();

  for (const tile of renderTiles) {
    const key = tileKey(tile, params.selectedTileId);
    newTileKeys.set(key, tile);
  }

  const newTileEntries: TileRenderState[] = [];
  const existingKeys = new Map<string, TileRenderState>();

  for (const entry of cache.tiles) {
    existingKeys.set(entry.tileKey, entry);
  }

  for (const entry of cache.tiles) {
    if (!newTileKeys.has(entry.tileKey)) {
      for (const obj of entry.objects) {
        obj.destroy();
      }
    }
  }

  // Create or reuse tiles
  for (const [key, tile] of newTileKeys) {
    const existing = existingKeys.get(key);

    if (existing) {
      newTileEntries.push(existing);
    } else {
      const objects: PhaserGameObject[] = [];

      if (tile.id === params.selectedTileId) {
        objects.push(...drawSelection(scene, tile, cellSize));
      }

      objects.push(...drawTile(scene, tile, cellSize));
      newTileEntries.push({ tileKey: key, objects });
    }
  }

  cache.tiles = newTileEntries;
}

function tileKey(tile: RenderTile, selectedTileId?: string): string {
  const selected = tile.id === selectedTileId ? ":sel" : "";
  return `${tile.x},${tile.y}:${tile.label}:${tile.fillColor}:${tile.alpha}${selected}`;
}

function isRepeatedTap(
  lastTap: { at: number; x: number; y: number } | undefined,
  coordinate: { x: number; y: number },
  now: number
): boolean {
  if (!lastTap) {
    return false;
  }

  return lastTap.x === coordinate.x && lastTap.y === coordinate.y && now - lastTap.at <= DOUBLE_TAP_WINDOW_MS;
}

function premiumCoordinateKey(x: number, y: number): string {
  return `${x},${y}`;
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
      fontSize: Math.max(10, cellSize * 0.32),
      color: START_TEXT_COLOR
    }).setOrigin(0.5);
  }

  if (label) {
    scene.add.text(centerX, centerY + (premium?.start ? cellSize * 0.22 : 0), label, {
      fontFamily: '"Silkscreen", monospace',
      fontSize: Math.max(9, cellSize * 0.22),
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

function drawSelection(scene: BoardScene, tile: RenderTile, cellSize: number): PhaserGameObject[] {
  const rect = scene.add.rectangle(
    tile.x * cellSize + cellSize / 2,
    tile.y * cellSize + cellSize / 2,
    cellSize * 0.88,
    cellSize * 0.88,
    0x000000,
    0
  ).setStrokeStyle(Math.max(2, cellSize * 0.06), SELECTED_TILE_BORDER_COLOR, 1);
  return [rect];
}

function drawTile(scene: BoardScene, tile: RenderTile, cellSize: number): PhaserGameObject[] {
  const metrics = createTileRenderMetrics(cellSize);
  const centerX = tile.x * cellSize + cellSize / 2;
  const centerY = tile.y * cellSize + cellSize / 2;
  const strokeWidth = Math.max(1, cellSize * 0.04);
  const label = displayTileLabel(tile);

  const outer = scene.add.rectangle(centerX, centerY, metrics.tileSize, metrics.tileSize, colorNumber(tile.fillColor), tile.alpha).setStrokeStyle(
    strokeWidth,
    colorNumber(tile.textColor),
    tile.alpha
  );
  const inner = scene.add.rectangle(centerX, centerY, metrics.tileSize * 0.82, metrics.tileSize * 0.82, colorNumber(tile.fillColor), tile.alpha * 0.82);

  if (!label) {
    return [outer, inner];
  }

  const text = scene.add.text(centerX, tile.y * cellSize + cellSize * 0.48, label, {
    fontFamily: '"Silkscreen", monospace',
    fontSize: label.length > 3 ? metrics.longLabelFontSize : metrics.shortLabelFontSize,
    color: tile.textColor
  }).setOrigin(0.5);
  return [outer, inner, text];
}

function calculateMinimumBoardPixels(boardSize: number): number {
  return Math.max(MIN_BOARD_PIXELS, boardSize * MIN_TOUCH_CELL_SIZE);
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

function readBoardPixelSize(host: HTMLDivElement): number {
  return Math.floor(Math.min(host.clientWidth, host.clientHeight));
}
