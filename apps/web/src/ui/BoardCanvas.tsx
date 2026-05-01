import { useEffect, useRef, useState, useMemo } from "react";
import type { BoardTile, Placement, PublicSnapshot, Tile } from "@d-m4th/game";
import { snapClientPointToBoardCell } from "../board/board-interaction";
import { BoardGame } from "../phaser/BoardGame";

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

const DEFAULT_BOARD_SIZE = 15;
const DOUBLE_TAP_WINDOW_MS = 300;
const MIN_TOUCH_CELL_SIZE = 44;
const MIN_BOARD_PIXELS = 420;

type RenderStatus = "loading" | "ready" | "error";

export function BoardCanvas(props: BoardCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const boardGameRef = useRef<BoardGame | null>(null);
  const lastTapRef = useRef<{ at: number; x: number; y: number } | undefined>(undefined);
  const [renderStatus, setRenderStatus] = useState<RenderStatus>("loading");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const boardSize = props.snapshot?.config.boardSize ?? props.previewBoardSize ?? DEFAULT_BOARD_SIZE;
  const minimumBoardPixels = props.variant === "preview" ? MIN_BOARD_PIXELS : boardSize * MIN_TOUCH_CELL_SIZE;

  // Initialize Phaser via BoardGame class
  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    if (!host) return;

    async function mount(): Promise<void> {
      setRenderStatus("loading");
      const initialSize = Math.max(minimumBoardPixels, Math.min(host?.clientWidth ?? 0, host?.clientHeight ?? 0));
      const game = new BoardGame(host!, initialSize);
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
  }, [minimumBoardPixels]);

  // Reactive resizing using ResizeObserver
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });

    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  // Update Phaser on data or dimension change
  useEffect(() => {
    const game = boardGameRef.current;
    if (!game || renderStatus !== "ready") return;

    const boardPixelSize = Math.floor(Math.min(dimensions.width, dimensions.height));
    if (boardPixelSize <= 0) return;

    game.resize(boardPixelSize);
    game.update({
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
  }, [dimensions, props.snapshot, props.draft, props.rack, props.currentPlayerId, props.selectedTileId, props.ghostPlacements, renderStatus, boardSize]);

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
      className={`board-host board-host--${props.variant ?? "game"} relative w-full h-full flex-1 overflow-hidden`}
      ref={hostRef}
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

function readBoardContentBounds(host: HTMLDivElement) {
  const bounds = host.getBoundingClientRect();
  return {
    left: bounds.left + host.clientLeft,
    top: bounds.top + host.clientTop,
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
