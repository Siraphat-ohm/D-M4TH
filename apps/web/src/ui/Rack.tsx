import type { DragEvent } from "react";
import type { Tile } from "@d-m4th/game";
import { createDragPreviewSize, textColorForPlayerColor } from "../board/board-interaction";
import { displayTileLabel } from "./tile-display";

interface RackProps {
  rackSlots: Array<Tile | undefined>;
  selectedTileIds: ReadonlySet<string>;
  playerColor: string;
  canDrag: boolean;
  onSelect: (tile: Tile) => void;
}

export function Rack(props: RackProps) {
  const textColor = textColorForPlayerColor(props.playerColor);

  return (
    <div className="rack">
      {props.rackSlots.map((tile, index) => {
        if (!tile) {
          return <div className="tile-placeholder" key={`empty-${index}`} aria-hidden="true" />;
        }

        return (
          <button
            className={props.selectedTileIds.has(tile.id) ? "tile selected" : "tile"}
            draggable={props.canDrag}
            key={tile.id}
            style={{ background: props.playerColor, color: textColor }}
            onClick={() => props.onSelect(tile)}
            onDragStart={(event) => {
              if (!props.canDrag) {
                event.preventDefault();
                return;
              }

              props.onSelect(tile);
              event.dataTransfer.setData("text/plain", tile.id);
              setTileDragImage({
                event,
                label: displayTileLabel(tile),
                playerColor: props.playerColor,
                textColor
              });
            }}
          >
            <span>{displayTileLabel(tile)}</span>
            <small>{tile.value}</small>
          </button>
        );
      })}
    </div>
  );
}

function setTileDragImage(params: {
  event: DragEvent<HTMLButtonElement>;
  label: string;
  playerColor: string;
  textColor: string;
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
  preview.style.border = "3px solid #f7e6a6";
  preview.style.borderRadius = "0";
  preview.style.background = params.playerColor;
  preview.style.color = params.textColor;
  preview.style.font = `400 ${Math.max(12, Math.floor(size * 0.34))}px "Silkscreen", monospace`;
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
