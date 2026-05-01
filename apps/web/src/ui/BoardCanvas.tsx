import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { BoardTile, Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import {
  snapClientPointToBoardCell,
} from "../board/board-interaction";
import {
  renderBoard,
  type BoardRenderCache,
  type BoardScene
} from "../board/board-renderer";

interface BoardCanvasProps {
  snapshot?: PublicSnapshot;
  ghostPlacements?: Array<{ playerId: string; placements: BoardTile[] }>;
  previewBoardSize?: number;
  draft: readonly Placement[];
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

const BOARD_SCENE_KEY = "board";
const DEFAULT_BOARD_SIZE = 15;
const DOUBLE_TAP_WINDOW_MS = 300;
const MIN_TOUCH_CELL_SIZE = 44;
const MIN_BOARD_PIXELS = 420;

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
  const [boardTargetPixels, setBoardTargetPixels] = useState(minimumBoardPixels);

  // Initialize Phaser
  useEffect(() => {
    let disposed = false;

    async function mountPhaser(): Promise<void> {
      const host = hostRef.current;
      if (!host) return;

      setRenderStatus("loading");

      try {
        const runtime = await loadPhaser();
        if (disposed) return;

        const scene = createScene(runtime);
        const boardPixelSize = readBoardPixelSize(host, minimumBoardPixels);
        
        gameRef.current = new runtime.Game({
          type: runtime.AUTO,
          parent: host,
          width: boardPixelSize,
          height: boardPixelSize,
          backgroundColor: "#080A0F",
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
        if (!disposed) setRenderStatus("error");
      }
    }

    mountPhaser();

    return () => {
      disposed = true;
      gameRef.current?.destroy(true);
      gameRef.current = undefined;
      renderCacheRef.current = { tiles: [] };
    };
  }, [minimumBoardPixels]);

  // Handle resizing
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const updateBoardTarget = () => {
      const next = measureBoardTargetPixels(host, props.variant, minimumBoardPixels);
      setBoardTargetPixels((current) => (current === next ? current : next));
      setRenderSignal((current) => current + 1);
    };

    updateBoardTarget();
    
    const observer = new ResizeObserver(updateBoardTarget);
    observer.observe(host);
    if (host.parentElement) observer.observe(host.parentElement);

    // Observe relevant containers for layout shifts
    const containers = [
      ".board-scroll-container",
      ".board-stage",
      ".match-main",
      ".play-surface",
      ".match-topbar",
      ".control-strip",
      ".match-notice"
    ];

    containers.forEach(selector => {
      const el = document.querySelector(selector);
      if (el) observer.observe(el);
    });

    window.addEventListener("resize", updateBoardTarget);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateBoardTarget);
    };
  }, [minimumBoardPixels, props.variant]);

  // Render logic
  useEffect(() => {
    const scene = gameRef.current?.scene.getScene(BOARD_SCENE_KEY);
    const host = hostRef.current;
    if (!scene || !host) return;

    const boardPixelSize = readBoardPixelSize(host, boardTargetPixels);
    if (boardPixelSize === 0) return;

    scene.scale.resize(boardPixelSize, boardPixelSize);
    
    renderBoard(scene, renderCacheRef.current, {
      boardPixelSize,
      boardSize,
      boardTiles: props.snapshot?.board ?? [],
      lastPlacements: props.snapshot?.lastPlacements ?? [],
      draft: props.draft,
      ghostTiles:
        props.ghostPlacements
          ?.filter((placement) => placement.playerId !== props.currentPlayerId)
          .flatMap((placement) => placement.placements) ?? [],
      players: props.snapshot?.players ?? [],
      rack: props.rack,
      draftOwnerId: props.currentPlayerId,
      selectedTileId: props.selectedTileId
    });
  }, [boardSize, boardTargetPixels, props.snapshot, props.draft, props.rack, props.currentPlayerId, props.selectedTileId, renderSignal]);

  const handlePointerDown = (event: React.PointerEvent) => {
    if (props.placementDisabled || event.button !== 0) return;

    const coordinate = readBoardCoordinate(hostRef.current, event, boardSize);
    if (!coordinate) return;

    props.onCellClick(coordinate.x, coordinate.y);

    if (isRepeatedTap(lastTapRef.current, coordinate, event.timeStamp)) {
      props.onDraftTileDoubleClick(coordinate.x, coordinate.y);
      lastTapRef.current = undefined;
      return;
    }

    lastTapRef.current = { at: event.timeStamp, x: coordinate.x, y: coordinate.y };
  };

  const handleDrop = (event: React.DragEvent) => {
    if (props.placementDisabled) return;

    const tileId = event.dataTransfer.getData("text/plain");
    const coordinate = readBoardCoordinate(hostRef.current, event, boardSize);

    if (tileId && coordinate) {
      props.onTileDrop(tileId, coordinate.x, coordinate.y);
    }
  };

  return (
    <div
      className={`board-host board-host--${props.variant ?? "game"} relative`}
      data-board-size={boardSize}
      ref={hostRef}
      style={
        {
          "--board-min-size": `${minimumBoardPixels}px`,
          "--board-target-size": `${boardTargetPixels}px`
        } as CSSProperties
      }
      onPointerDown={handlePointerDown}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
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

function calculateMinimumBoardPixels(boardSize: number): number {
  return Math.max(MIN_BOARD_PIXELS, boardSize * MIN_TOUCH_CELL_SIZE);
}

function readBoardCoordinate(
  host: HTMLDivElement | null,
  point: { clientX: number; clientY: number },
  boardSize: number
) {
  if (!host) return undefined;

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

function readBoardPixelSize(host: HTMLDivElement, fallbackPixels: number): number {
  const next = Math.floor(Math.min(host.clientWidth, host.clientHeight));
  return next > 0 ? next : Math.max(1, Math.floor(fallbackPixels));
}

function isRepeatedTap(
  lastTap: { at: number; x: number; y: number } | undefined,
  coordinate: { x: number; y: number },
  now: number
): boolean {
  if (!lastTap) return false;
  return lastTap.x === coordinate.x && lastTap.y === coordinate.y && now - lastTap.at <= DOUBLE_TAP_WINDOW_MS;
}

/**
 * Budgeting logic for board size.
 * Minimizes coupling by grouping measurements.
 */
function measureBoardTargetPixels(host: HTMLDivElement, variant: "game" | "preview" | undefined, minimumBoardPixels: number): number {
  const boardContainer = host.closest(".board-scroll-container");
  const containerRect = boardContainer instanceof HTMLElement ? boardContainer.getBoundingClientRect() : undefined;
  const widthBudget = Math.floor(containerRect?.width || host.parentElement?.clientWidth || host.clientWidth || minimumBoardPixels);

  if (variant === "preview") {
    const previewCap = Math.min(widthBudget, Math.floor(window.innerHeight * 0.72), 760);
    return Math.max(Math.min(minimumBoardPixels, widthBudget), Math.max(320, previewCap));
  }

  const measuredHeightBudget = Math.floor(containerRect?.height || 0);
  if (measuredHeightBudget > 0 && widthBudget > 0) {
    return Math.max(1, Math.floor(Math.min(widthBudget, measuredHeightBudget, 1080)));
  }

  // Fallback budgeting
  const reservedHeight = calculateReservedHeight();
  const heightBudget = window.innerHeight - reservedHeight;
  const target = Math.floor(Math.min(widthBudget, heightBudget, 1080));

  return Math.max(1, target);
}

function calculateReservedHeight(): number {
  const topBar = document.querySelector<HTMLElement>(".match-topbar");
  const notice = document.querySelector<HTMLElement>(".match-notice");
  const controlStrip = document.querySelector<HTMLElement>(".control-strip");
  const shell = document.querySelector(".app-shell");

  const heights = [topBar, notice, controlStrip].map(el => el?.getBoundingClientRect().height ?? 0);
  const totalHeights = heights.reduce((sum, h) => sum + h, 0);

  let paddingAndGap = 0;
  if (shell) {
    const style = getComputedStyle(shell);
    paddingAndGap += parseFloat(style.paddingTop || "0") + parseFloat(style.paddingBottom || "0");
    paddingAndGap += parseFloat(style.rowGap || style.gap || "0") * 2; // Approximate gaps
  }

  return totalHeights + paddingAndGap + 2;
}
