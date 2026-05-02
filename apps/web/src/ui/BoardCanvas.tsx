import { type CSSProperties, useEffect, useRef, useState } from "react";
import { DEFAULT_PREMIUM_MAP_ID, type PremiumMapId } from "@d-m4th/config";
import type { BoardTile, Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import { snapClientPointToBoardCell } from "../board/board-interaction";
import { PixiBoardGame } from "../pixi/PixiBoardGame";

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

type RenderStatus = "loading" | "ready" | "error";

export function BoardCanvas(props: BoardCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pixiRef = useRef<HTMLDivElement>(null);
  const boardGameRef = useRef<PixiBoardGame | null>(null);
  const lastTapRef = useRef<{ at: number; x: number; y: number } | undefined>(undefined);
  const [renderStatus, setRenderStatus] = useState<RenderStatus>("loading");
  const [boardTargetPixels, setBoardTargetPixels] = useState(() => estimateInitialBoardPixels(props.variant ?? "game"));

  const boardSize = props.snapshot?.config.boardSize ?? props.previewBoardSize ?? DEFAULT_BOARD_SIZE;
  const premiumMapId = props.snapshot?.config.premiumMapId ?? props.previewPremiumMapId ?? DEFAULT_PREMIUM_MAP_ID;

  // Initialize Pixi once per mount. The real size is driven by ResizeObserver below.
  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    const pixiHost = pixiRef.current;
    if (!host || !pixiHost) return;

    async function mount(): Promise<void> {
      setRenderStatus("loading");
      const initialSize = Math.max(1, Math.round(host?.getBoundingClientRect().width ?? 600));
      const game = new PixiBoardGame(pixiHost!, initialSize);
      boardGameRef.current = game;

      try {
        await game.init();
        if (disposed) {
          game.destroy();
          return;
        }
        setRenderStatus("ready");
      } catch (e) {
        console.error("Pixi board init failed", e);
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
    const variant = props.variant ?? "game";

    let animationFrame = 0;
    const updateBoardTarget = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const next = measureBoardTargetPixels(host, variant);
        setBoardTargetPixels((current) => {
          return current === next ? current : next;
        });
      });
    };

    const observer = new ResizeObserver(updateBoardTarget);
    observer.observe(host);
    if (host.parentElement) {
      observer.observe(host.parentElement);
    }

    updateBoardTarget();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [props.variant]);

  // Update Pixi on data or dimension change.
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
      style={{ "--board-size": `${Math.max(1, boardTargetPixels)}px` } as CSSProperties}
      onPointerDown={handlePointerDown}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div ref={pixiRef} className="absolute inset-0 pointer-events-none" />
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

function estimateInitialBoardPixels(variant: "game" | "preview"): number {
  const fallback = variant === "preview" ? 750 : 840;
  if (typeof window === "undefined") return fallback;
  const viewportCap = Math.max(320, Math.floor(window.innerWidth - 32));
  return Math.min(fallback, viewportCap);
}

function measureBoardTargetPixels(host: HTMLDivElement, variant: "game" | "preview"): number {
  const parent = host.parentElement;
  const parentWidth = parent?.getBoundingClientRect().width ?? 0;
  const hostRect = host.getBoundingClientRect();
  const viewportWidth = Math.max(1, window.innerWidth - 32);
  const viewportHeight = Math.max(1, window.innerHeight - (variant === "preview" ? 140 : 180));

  const widthBudget = Math.max(1, Math.floor(Math.min(parentWidth || hostRect.width || viewportWidth, viewportWidth)));
  const cap = variant === "preview" ? 900 : 980;
  const min = variant === "preview" ? 220 : 240;
  const next = Math.floor(Math.min(widthBudget, viewportHeight, cap));
  const adaptiveMin = Math.min(min, Math.max(180, Math.floor(viewportWidth)));
  return Math.max(adaptiveMin, next);
}

function readBoardContentBounds(host: HTMLDivElement) {
  const bounds = host.getBoundingClientRect();
  return {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height
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
