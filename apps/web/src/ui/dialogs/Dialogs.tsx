import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { faceOptionsForTileLabel, type Tile } from "@d-m4th/game";
import { textColorForPlayerColor } from "../../board/board-interaction";
import { formatClock } from "../shared/format";
import type { LogEntry } from "../shared/types";

export function LogDialog(props: { entries: LogEntry[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    props.onClose();
  }

  return (
    <div className="dialog-backdrop">
      <div ref={dialogRef} className="log-dialog" role="dialog" aria-modal="true" aria-label="Match log" onKeyDown={handleKeyDown}>
        <div className="dialog-header">
          <strong>Log</strong>
          <button onClick={props.onClose}>Close</button>
        </div>
        <div className="log-list">
          {props.entries.length === 0 ? (
            <span className="log-empty">No log</span>
          ) : (
            props.entries.map((entry) => (
              <div className={`log-row ${entry.tone}`} key={entry.id}>
                <time>{formatClock(entry.at)}</time>
                <span>{entry.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function FaceSelectionDialog(props: {
  tile: Tile;
  playerColor: string;
  onCancel: () => void;
  onSelect: (face: string) => void;
}) {
  const textColor = textColorForPlayerColor(props.playerColor);
  const faces = faceOptionsForTileLabel(props.tile.label);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      props.onCancel();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);

    if (buttons.length === 0) {
      return;
    }

    const firstButton = buttons[0];
    const lastButton = buttons[buttons.length - 1];

    if (event.shiftKey && document.activeElement === firstButton) {
      event.preventDefault();
      lastButton.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastButton) {
      event.preventDefault();
      firstButton.focus();
    }
  }

  return (
    <div className="dialog-backdrop">
      <div ref={dialogRef} className="face-dialog" role="dialog" aria-modal="true" aria-label={`${props.tile.label} face`} onKeyDown={handleDialogKeyDown}>
        <strong>{props.tile.label}</strong>
        <div className="face-options">
          {faces.map((face) => (
            <button key={face} style={{ background: props.playerColor, color: textColor }} onClick={() => props.onSelect(face)}>
              {face}
            </button>
          ))}
        </div>
        <button onClick={props.onCancel}>Cancel</button>
      </div>
    </div>
  );
}
