import { useLayoutEffect, useRef, type DragEvent } from "react";
import type { Tile } from "@d-m4th/game";
import { createDragPreviewSize } from "../../board/board-interaction";
import { displayTileLabel } from "../../shared/tile-display";

interface RackProps {
  rackSlots: Array<Tile | undefined>;
  selectedTileIds: ReadonlySet<string>;
  playerColor: string;
  canDragToBoard: boolean;
  canInteractWithRack: boolean;
  onSelect: (tile: Tile) => void;
}

export function Rack(props: RackProps) {
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const previousRects = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const nextRects = new Map<string, DOMRect>();

    for (const [key, element] of itemRefs.current.entries()) {
      nextRects.set(key, element.getBoundingClientRect());
    }

    for (const [key, element] of itemRefs.current.entries()) {
      const previousRect = previousRects.current.get(key);
      const nextRect = nextRects.get(key);

      if (!previousRect || !nextRect) {
        continue;
      }

      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;

      if (deltaX === 0 && deltaY === 0) {
        continue;
      }

      element.style.transition = "none";
      element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      element.getBoundingClientRect();
      element.style.transition = "transform 180ms ease";
      element.style.transform = "";
    }

    previousRects.current = nextRects;
  }, [props.rackSlots]);

  return (
    <div className="rack-shell">
      <div className="rack">
      {props.rackSlots.map((tile, index) => {
        if (!tile) {
          const placeholderKey = `empty-${index}`;

          return (
            <div
              className="tile-placeholder"
              key={placeholderKey}
              aria-hidden="true"
              ref={(element) => updateRackItemRef(itemRefs.current, placeholderKey, element)}
            />
          );
        }

        const tileKey = `tile-${tile.id}`;

        return (
          <button
            className={props.selectedTileIds.has(tile.id) ? "tile selected" : "tile"}
            draggable={props.canDragToBoard}
            key={tile.id}
            data-testid={`rack-tile-${tile.id}`}
            style={{ "--tile-accent": props.playerColor } as React.CSSProperties}
            ref={(element) => updateRackItemRef(itemRefs.current, tileKey, element)}
            onClick={() => {
              if (!props.canInteractWithRack) return;
              props.onSelect(tile);
            }}
            onDragStart={(event) => {
              if (!props.canDragToBoard) {
                event.preventDefault();
                return;
              }

              props.onSelect(tile);
              event.dataTransfer.setData("text/plain", tile.id);
              setTileDragImage({
                event,
                label: displayTileLabel(tile),
                tileBorderColor: props.playerColor
              });
            }}
          >
            <span>{displayTileLabel(tile)}</span>
            <small>{tile.value}</small>
          </button>
        );
      })}
      </div>
    </div>
  );
}

function setTileDragImage(params: {
  event: DragEvent<HTMLButtonElement>;
  label: string;
  tileBorderColor: string;
}): void {
  const size = createDragPreviewSize(readBoardCellSize());
  const preview = document.createElement("div");
  preview.textContent = params.label;
  preview.style.position = "fixed";
  preview.style.left = "-1000px";
  preview.style.top = "-1000px";
  preview.style.width = `${size}px`;
  preview.style.height = `${size}px`;
  preview.style.display = "grid";
  preview.style.placeItems = "center";
  preview.style.border = `3px solid ${params.tileBorderColor}`;
  preview.style.borderRadius = "0";
  preview.style.background = "#F2ECDD";
  preview.style.color = "#111111";
  preview.style.font = `400 ${Math.max(12, Math.floor(size * 0.34))}px "VT323", monospace`;
  document.body.append(preview);
  params.event.dataTransfer.effectAllowed = "move";
  params.event.dataTransfer.setDragImage(preview, size / 2, size / 2);
  window.setTimeout(() => preview.remove(), 0);
}

function readBoardCellSize(): number {
  const board = document.querySelector<HTMLElement>(".board-host");

  if (!board) {
    return 48;
  }

  const boardSize = Number(board.dataset.boardSize ?? 15);
  return Math.min(board.clientWidth, board.clientHeight) / boardSize;
}

function updateRackItemRef(
  refs: Map<string, HTMLElement>,
  key: string,
  element: HTMLElement | null
): void {
  if (!element) {
    refs.delete(key);
    return;
  }

  refs.set(key, element);
}
