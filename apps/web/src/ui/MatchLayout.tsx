import { type CSSProperties } from "react";
import { Check, RefreshCcw, ScrollText, SkipForward, Undo2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { BoardCanvas } from "./BoardCanvas";
import { FaceSelectionDialog } from "./Dialogs";
import { MatchTopBar } from "./MatchTopBar";
import { Rack } from "./Rack";
import { useAppStore } from "../store/app-store";
import { useTurn } from "../turn/TurnContext";

export function MatchLayout() {
  const {
    snapshot,
    ghostPlacements,
    privateState,
    logEntries,
    color: ownColor,
    setLogOpen
  } = useAppStore(
    useShallow((state) => ({
      snapshot: state.snapshot,
      ghostPlacements: state.ghostPlacements,
      privateState: state.privateState,
      logEntries: state.logEntries,
      color: state.color,
      setLogOpen: state.setLogOpen
    }))
  );

  const turn = useTurn();

  if (!snapshot) return null;

  const rack = privateState?.rack ?? [];
  const activePlayer = snapshot.players.find((p) => p.id === snapshot.currentPlayerId);
  const activeColor = activePlayer?.color ?? ownColor;
  const activePlayerName = activePlayer?.name;
  const isMyTurn = snapshot.currentPlayerId === privateState?.playerId;
  const actionsFrozen = turn.actionsFrozen;

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
                placementDisabled={turn.placementDisabled || actionsFrozen}
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
                canDrag={turn.turnMode === "play" && !actionsFrozen}
                onSelect={turn.handleRackSelect}
              />
            </section>

            <section className="action-panel">
              {!isMyTurn && snapshot.status === "playing" && (
                <div className="waiting-message">
                  WAITING FOR {activePlayerName?.toUpperCase() ?? "OPPONENT"}...
                </div>
              )}
              <div className="action-bar">
                <button
                  className="primary"
                  style={{ "--button-accent": activeColor } as CSSProperties}
                  onClick={turn.commitPlay}
                  disabled={actionsFrozen || !isMyTurn || turn.draft.length === 0}
                >
                  <Check size={15} aria-hidden="true" />
                  Play
                </button>
                <button
                  onClick={turn.handleSwapAction}
                  disabled={actionsFrozen || !isMyTurn || (turn.turnMode === "swap" && turn.swapSelectedTileIds.length === 0)}
                >
                  <RefreshCcw size={15} aria-hidden="true" />
                  {turn.turnMode === "swap" ? `Swap ${turn.swapSelectedTileIds.length}` : "Swap"}
                </button>
                <button onClick={turn.passTurn} disabled={actionsFrozen || !isMyTurn || turn.turnMode === "swap"}>
                  <SkipForward size={15} aria-hidden="true" />
                  Pass
                </button>
                <button onClick={turn.recallRack} disabled={actionsFrozen || (turn.turnMode === "play" && turn.draft.length === 0)}>
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
        onClick={() => setLogOpen(true)}
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
