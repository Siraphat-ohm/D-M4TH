import { type CSSProperties, useEffect, useRef, useState } from "react";
import { DEFAULT_PREMIUM_MAP_ID, type PremiumMapId } from "@d-m4th/config";
import type { BoardTile, Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import { snapClientPointToBoardCell } from "../board/board-interaction";
import { BoardGame } from "../phaser/BoardGame";

interface BoardCanvasProps {
  snapshot?: PublicSnapshot;
  ghostPlacements?: Array<{ playerId: string; placements: BoardTile[] }>;
  previewBoardSize?: number;
  previewPremiumMapId?: PremiumMapId;
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

const DEFAULT_BOARD_SIZE = 15;
const DOUBLE_TAP_WINDOW_MS = 300;
const MIN_BOARD_PIXELS = 420;
const LARGE_SCREEN_WIDTH = 2400;
const LARGE_PREVIEW_CAP = 990;
const DEFAULT_PREVIEW_CAP = 840;
const PREVIEW_VIEWPORT_HEIGHT_RATIO = 0.76;

type RenderStatus = "loading" | "ready" | "error";

export function BoardCanvas(props: BoardCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const boardGameRef = useRef<BoardGame | null>(null);
  const lastTapRef = useRef<{ at: number; x: number; y: number } | undefined>(undefined);
  const [renderStatus, setRenderStatus] = useState<RenderStatus>("loading");
  const [boardTargetPixels, setBoardTargetPixels] = useState(() => snapBoardPixelsToGrid(MIN_BOARD_PIXELS, DEFAULT_BOARD_SIZE));

  const boardSize = props.snapshot?.config.boardSize ?? props.previewBoardSize ?? DEFAULT_BOARD_SIZE;
  const premiumMapId = props.snapshot?.config.premiumMapId ?? props.previewPremiumMapId ?? DEFAULT_PREMIUM_MAP_ID;

  // Initialize Phaser once per mount
  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    if (!host) return;

    async function mount(): Promise<void> {
      setRenderStatus("loading");
      const el = hostRef.current!;
      const initialSize = measureBoardTargetPixels(el, props.variant ?? "game", boardSize);
      const game = new BoardGame(el, initialSize);
      boardGameRef.current = game;

      try {
        await game.init();
        if (disposed) {
          game.destroy();
          return;
        }
        setRenderStatus("ready");
      } catch (e) {
        console.error("Board init failed", e);
        if (!disposed) setRenderStatus("error");
      }
    }

    mount();

    return () => {
      disposed = true;
      boardGameRef.current?.destroy();
      boardGameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let animationFrame = 0;
    const updateBoardTarget = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        setBoardTargetPixels(measureBoardTargetPixels(host, props.variant ?? "game", boardSize));
      });
    };
    const observer = new ResizeObserver(updateBoardTarget);

    observer.observe(host);
    if (host.parentElement) {
      observer.observe(host.parentElement);
    }
    window.addEventListener("resize", updateBoardTarget);
    window.addEventListener("orientationchange", updateBoardTarget);
    updateBoardTarget();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("resize", updateBoardTarget);
      window.removeEventListener("orientationchange", updateBoardTarget);
    };
  }, [boardSize, props.variant]);

  // Update Phaser on data or dimension change
  useEffect(() => {
    const game = boardGameRef.current;
    if (!game || renderStatus !== "ready") return;

    const boardPixelSize = boardTargetPixels;
    if (boardPixelSize <= 0) return;

    game.resize(boardPixelSize);
    game.update({
      boardPixelSize,
      boardSize,
      premiumMapId,
      boardTiles: props.snapshot?.board ?? [],
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
  }, [boardTargetPixels, props.snapshot, props.draft, props.rack, props.currentPlayerId, props.selectedTileId, props.ghostPlacements, renderStatus, boardSize, premiumMapId]);

  const handlePointerDown = (event: React.PointerEvent) => {
    if (props.placementDisabled || event.button !== 0) return;

    const host = hostRef.current;
    if (!host) return;

    const coordinate = snapClientPointToBoardCell({
      point: { clientX: event.clientX, clientY: event.clientY },
      bounds: readBoardContentBounds(host),
      boardSize
    });

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
    const host = hostRef.current;
    if (!host) return;

    const coordinate = snapClientPointToBoardCell({
      point: { clientX: event.clientX, clientY: event.clientY },
      bounds: readBoardContentBounds(host),
      boardSize
    });

    if (tileId && coordinate) {
      props.onTileDrop(tileId, coordinate.x, coordinate.y);
    }
  };

  return (
    <div
      className={`board-host board-host--${props.variant ?? "game"}`}
      data-board-size={boardSize}
      ref={hostRef}
      style={{ "--board-target-size": `${boardTargetPixels}px` } as CSSProperties}
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

export function snapBoardPixelsToGrid(
  targetPixels: number,
  boardSize: number,
  options?: {
    minCellPixels?: number;
    maxPixels?: number;
  }
): number {
  const safeBoardSize = Math.max(1, Math.floor(boardSize));
  const maxPixels = Math.max(1, Math.floor(options?.maxPixels ?? targetPixels));
  const safeTarget = Math.max(1, Math.floor(Math.min(targetPixels, maxPixels)));
  const minCellPixels = Math.max(1, Math.floor(options?.minCellPixels ?? 1));

  const cellPixels = Math.max(minCellPixels, Math.floor(safeTarget / safeBoardSize));
  const snapped = cellPixels * safeBoardSize;

  if (snapped <= maxPixels) {
    return Math.max(safeBoardSize, snapped);
  }

  const fallbackCellPixels = Math.max(1, Math.floor(maxPixels / safeBoardSize));
  return Math.max(safeBoardSize, fallbackCellPixels * safeBoardSize);
}

function measureBoardTargetPixels(host: HTMLDivElement, variant: "game" | "preview", boardSize: number): number {
  const parent = host.parentElement;
  const widthBudget = readPositivePixels(parent?.clientWidth ?? 0, host.clientWidth, MIN_BOARD_PIXELS);
  const heightBudget = readHeightBudget(host, variant);
  const cap = variant === "preview" ? previewBoardCap() : Number.POSITIVE_INFINITY;
  const rawTarget = Math.min(widthBudget, heightBudget, cap);

  return snapBoardPixelsToGrid(rawTarget, boardSize, { maxPixels: rawTarget });
}

function readHeightBudget(host: HTMLDivElement, variant: "game" | "preview"): number {
  const parentHeight = host.parentElement?.clientHeight ?? 0;
  const hostHeight = host.clientHeight;

  if (variant === "preview") {
    return Math.floor(window.innerHeight * PREVIEW_VIEWPORT_HEIGHT_RATIO);
  }

  return readPositivePixels(parentHeight, hostHeight, MIN_BOARD_PIXELS);
}

function readPositivePixels(...values: number[]): number {
  return Math.max(1, Math.floor(values.find((value) => value > 0) ?? MIN_BOARD_PIXELS));
}

function previewBoardCap(): number {
  return window.innerWidth >= LARGE_SCREEN_WIDTH ? LARGE_PREVIEW_CAP : DEFAULT_PREVIEW_CAP;
}

function readBoardContentBounds(host: HTMLDivElement) {
  const bounds = host.getBoundingClientRect();
  return {
    left: bounds.left,
    top: bounds.top,
    width: host.clientWidth,
    height: host.clientHeight
  };
}

function isRepeatedTap(
  lastTap: { at: number; x: number; y: number } | undefined,
  coordinate: { x: number; y: number },
  now: number
): boolean {
  if (!lastTap) return false;
  return lastTap.x === coordinate.x && lastTap.y === coordinate.y && now - lastTap.at <= DOUBLE_TAP_WINDOW_MS;
}
