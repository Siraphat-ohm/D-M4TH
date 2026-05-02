import { type CSSProperties } from "react";
import { Check, RefreshCcw, ScrollText, SkipForward, Undo2 } from "lucide-react";
import type { BoardTile, PublicSnapshot, Tile } from "@d-m4th/game";
import { BoardCanvas } from "./BoardCanvas";
import { FaceSelectionDialog } from "./Dialogs";
import { MatchTopBar } from "./MatchTopBar";
import { Rack } from "./Rack";
import type { LogEntry, NoticeTone } from "./types";
import type { useTurnController } from "../turn/use-turn-controller";

interface MatchLayoutProps {
  snapshot: PublicSnapshot;
  ghostPlacements: Array<{ playerId: string; placements: BoardTile[] }>;
  privateState: { playerId: string; rack: Tile[] } | undefined;
  logEntries: LogEntry[];
  activeColor: string;
  ownColor: string;
  turn: ReturnType<typeof useTurnController>;
  isMyTurn: boolean;
  onOpenLog: () => void;
  onCommitPlay: () => void;
  onSwapAction: () => void;
  onPassTurn: () => void;
  onRecallRack: () => void;
}

export function MatchLayout(props: MatchLayoutProps) {
  const {
    snapshot,
    ghostPlacements,
    privateState,
    logEntries,
    activeColor,
    ownColor,
    turn,
    isMyTurn,
    onOpenLog,
    onCommitPlay,
    onSwapAction,
    onPassTurn,
    onRecallRack
  } = props;

  const rack = privateState?.rack ?? [];

  return (
    <section className="play-surface">
      <section className="match-topbar">
        <MatchTopBar snapshot={snapshot} previewScore={turn.previewScore} />
      </section>

      <section className="match-main">
        <div className="board-stack">
          <section className="board-stage">
            <div className="board-scroll-container">
              <BoardCanvas
                snapshot={snapshot}
                ghostPlacements={ghostPlacements}
                draft={turn.draft}
                rack={rack}
                currentPlayerId={privateState?.playerId}
                selectedTileId={turn.selectedTileId}
                placementDisabled={turn.placementDisabled}
                onCellClick={turn.handleBoardCellClick}
                onDraftTileDoubleClick={turn.handleBoardCellDoubleClick}
                onTileDrop={turn.placeRackTile}
              />
            </div>
          </section>

          <section className="control-strip">
            <section className="rack-panel">
              <Rack
                rackSlots={turn.rackSlots}
                selectedTileIds={turn.selectedRackTileIds}
                playerColor={ownColor}
                canDrag={turn.turnMode === "play"}
                onSelect={turn.handleRackSelect}
              />
            </section>

            <section className="action-panel">
              <div className="action-bar">
                <button
                  className="primary"
                  style={{ "--button-accent": activeColor } as CSSProperties}
                  onClick={onCommitPlay}
                  disabled={!isMyTurn || turn.draft.length === 0}
                >
                  <Check size={15} aria-hidden="true" />
                  Play
                </button>
                <button
                  onClick={onSwapAction}
                  disabled={!isMyTurn || (turn.turnMode === "swap" && turn.swapSelectedTileIds.length === 0)}
                >
                  <RefreshCcw size={15} aria-hidden="true" />
                  {turn.turnMode === "swap" ? `Swap ${turn.swapSelectedTileIds.length}` : "Swap"}
                </button>
                <button onClick={onPassTurn} disabled={!isMyTurn || turn.turnMode === "swap"}>
                  <SkipForward size={15} aria-hidden="true" />
                  Pass
                </button>
                <button onClick={onRecallRack} disabled={turn.turnMode === "play" && turn.draft.length === 0}>
                  <Undo2 size={15} aria-hidden="true" />
                  {turn.turnMode === "swap" ? "Cancel" : "Recall"}
                </button>
              </div>
            </section>
          </section>
        </div>
      </section>

      <button
        type="button"
        className="floating-log-button"
        aria-label="Open match log"
        onClick={onOpenLog}
      >
        <ScrollText size={18} aria-hidden="true" />
        {logEntries.length > 0 && (
          <span className="floating-log-badge" aria-label="Log entries">
            {Math.min(logEntries.length, 99)}
          </span>
        )}
      </button>

      {turn.pendingFacePlacement && (
        <FaceSelectionDialog
          playerColor={ownColor}
          tile={turn.pendingFacePlacement.tile}
          onCancel={turn.cancelPendingFace}
          onSelect={(face) =>
            turn.placeResolvedRackTile(
              turn.pendingFacePlacement!.tile,
              turn.pendingFacePlacement!.x,
              turn.pendingFacePlacement!.y,
              face
            )
          }
        />
      )}
    </section>
  );
}
