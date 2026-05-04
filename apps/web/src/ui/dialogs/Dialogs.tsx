import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { faceOptionsForTileLabel, type Tile } from "@d-m4th/game";
import { textColorForPlayerColor } from "../../shared/color";
import { focusFirstDialogButton, handleEscapeKey, trapButtonFocus } from "./dialog-utils";
import { LogEntryList } from "../match/LogEntryList";
import type { LogEntry } from "@/shared/types";

export function LogDialog(props: { entries: LogEntry[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    focusFirstDialogButton(dialogRef);
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    handleEscapeKey(event, props.onClose);
  }

  return (
    <div className="dialog-backdrop">
      <div ref={dialogRef} className="log-dialog" role="dialog" aria-modal="true" aria-label="Match log" onKeyDown={handleKeyDown}>
        <div className="dialog-header">
          <p>Log</p>
          <button onClick={props.onClose}>Close</button>
        </div>
        <LogEntryList
          entries={props.entries}
          emptyText="No log"
          listClassName="log-list"
          rowClassName="log-row"
          emptyClassName="log-empty"
        />
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
    focusFirstDialogButton(dialogRef);
  }, []);

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (handleEscapeKey(event, props.onCancel)) {
      return;
    }

    trapButtonFocus(event, dialogRef);
  }

  return (
    <div className="dialog-backdrop">
      <div ref={dialogRef} className="face-dialog" role="dialog" aria-modal="true" aria-label={`${props.tile.label} face`} onKeyDown={handleDialogKeyDown}>
        <p>{props.tile.label}</p>
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
