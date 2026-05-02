import { type CSSProperties, useEffect, useRef, useState } from "react";
import { DEFAULT_PREMIUM_MAP_ID, type PremiumMapId } from "@d-m4th/config";
import type { BoardTile, Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import { snapClientPointToBoardCell } from "../../board/board-interaction";
import { PixiBoardGame } from "../../pixi/PixiBoardGame";

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
const MAX_INIT_RETRIES = 2;
const BOARD_SIZE_SAFETY_MARGIN = 4;

type RenderStatus = "loading" | "ready" | "error";
type RenderErrorKind = "webgl-disabled" | "unknown";

export function BoardCanvas(props: BoardCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pixiRef = useRef<HTMLDivElement>(null);
  const boardGameRef = useRef<PixiBoardGame | null>(null);
  const lastTapRef = useRef<{ at: number; x: number; y: number } | undefined>(undefined);
  const [renderStatus, setRenderStatus] = useState<RenderStatus>("loading");
  const [boardTargetPixels, setBoardTargetPixels] = useState(() => estimateInitialBoardPixels(props.variant ?? "game"));
  const [initAttempt, setInitAttempt] = useState(0);
  const [renderErrorKind, setRenderErrorKind] = useState<RenderErrorKind>("unknown");

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
      setRenderErrorKind("unknown");
      const measured = Math.round(host?.getBoundingClientRect().width ?? 0);
      const fallback = estimateInitialBoardPixels(props.variant ?? "game");
      const initialSize = Math.max(1, measured > 1 ? measured : fallback);
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
        if (!disposed) {
          setRenderStatus("error");
          const errorKind = classifyRenderError(e);
          setRenderErrorKind(errorKind);
          if (errorKind !== "webgl-disabled" && initAttempt < MAX_INIT_RETRIES) {
            window.setTimeout(() => {
              setInitAttempt((value) => value + 1);
            }, 180);
          }
        }
      }
    }

    mount();

    return () => {
      disposed = true;
      boardGameRef.current?.destroy();
      boardGameRef.current = null;
    };
  }, [initAttempt, props.variant]);

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
    getBoardSizingElements(host).forEach((element) => observer.observe(element));

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
      <div ref={pixiRef} className="pixi-canvas-layer" />
      {renderStatus !== "ready" && (
        <div
          className="board-render-overlay"
          role="status"
        >
          {renderStatus === "error"
            ? renderErrorKind === "webgl-disabled"
              ? "WebGL disabled in this browser mode"
              : "Board load failed"
            : "Loading board"}
        </div>
      )}
    </div>
  );
}

function classifyRenderError(error: unknown): RenderErrorKind {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes("webgl") && (normalized.includes("disabled") || normalized.includes("context"))) {
    return "webgl-disabled";
  }
  return "unknown";
}

function estimateInitialBoardPixels(variant: "game" | "preview"): number {
  const fallback = variant === "preview" ? 750 : 840;
  if (typeof window === "undefined") return fallback;
  const viewportCap = Math.max(320, Math.floor(window.innerWidth - 32));
  return Math.min(fallback, viewportCap);
}

function measureBoardTargetPixels(host: HTMLDivElement, variant: "game" | "preview"): number {
  const slot = readBoardSlotSize(host);
  const viewportSafeCap = getViewportSafeBoardCap(variant);
  const viewportWidth = Math.max(1, window.innerWidth - 16);
  const viewportHeight = Math.max(1, window.innerHeight - 16);
  const widthBudget = Math.max(1, Math.floor(Math.min(slot.width || viewportWidth, viewportWidth)));
  const heightBudget = Math.max(1, Math.floor(Math.min(slot.height || viewportHeight, viewportHeight)));

  if (variant === "preview") {
    const cap = 980;
    return Math.max(1, Math.floor(Math.min(widthBudget, heightBudget, viewportSafeCap, cap)));
  }

  const next = Math.floor(Math.min(widthBudget, heightBudget, viewportSafeCap) - BOARD_SIZE_SAFETY_MARGIN);
  return Math.max(1, next);
}

function getBoardSizingElements(host: HTMLDivElement): HTMLElement[] {
  return uniqueElements([
    host,
    host.parentElement,
    host.closest<HTMLElement>(".board-stage"),
    host.closest<HTMLElement>(".match-main"),
    host.closest<HTMLElement>(".play-surface")
  ]);
}

function readBoardSlotSize(host: HTMLDivElement): { width: number; height: number } {
  const elements = uniqueElements([
    host.parentElement,
    host.closest<HTMLElement>(".board-stage"),
    host.closest<HTMLElement>(".match-main")
  ]);
  const widths = elements.map((element) => element.getBoundingClientRect().width).filter(isUsefulDimension);
  const heights = elements.map((element) => element.getBoundingClientRect().height).filter(isUsefulDimension);
  return {
    width: widths.length > 0 ? Math.min(...widths) : 0,
    height: heights.length > 0 ? Math.min(...heights) : 0
  };
}

function getViewportSafeBoardCap(variant: "game" | "preview"): number {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (variant === "preview") {
    return Math.floor(Math.min(width, height) * 0.72);
  }
  if (height <= 480 && width >= 640) {
    return Math.floor(height - 8);
  }
  if (width >= 900 && width <= 1400 && height >= 768 && height <= 1050) {
    return Math.floor(height * 0.84);
  }
  return 980;
}

function uniqueElements(elements: Array<HTMLElement | null | undefined>): HTMLElement[] {
  return [...new Set(elements.filter((element): element is HTMLElement => element !== null && element !== undefined))];
}

function isUsefulDimension(value: number): boolean {
  return Number.isFinite(value) && value > 1;
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
