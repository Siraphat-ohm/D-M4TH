import { type CSSProperties } from "react";
import { Check, RefreshCcw, ScrollText, SkipForward, Undo2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { BoardCanvas } from "@/ui/shared/BoardCanvas";
import { FaceSelectionDialog } from "@/ui/dialogs/Dialogs";
import { MatchTopBar } from "@/ui/match/MatchTopBar";
import { Rack } from "@/ui/rack/Rack";
import { resolvePlayerAccent } from "@/ui/shared/player-colors";
import { useAppStore } from "@/app/store/app-store";
import { useTurn } from "@/turn/TurnContext";

export function MatchLayout(props: { onLeaveMatch: () => void }) {
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
  const localPlayerColor = resolvePlayerAccent(snapshot.players, privateState?.playerId, ownColor);
  const activeTurnColor = resolvePlayerAccent(snapshot.players, snapshot.currentPlayerId, "var(--panel-border)");
  const isMyTurn = snapshot.currentPlayerId === privateState?.playerId;
  const actionsFrozen = turn.actionsFrozen;

  return (
    <section className="play-surface">
      <section className="match-topbar">
        <MatchTopBar snapshot={snapshot} previewScore={turn.previewScore} onLeaveMatch={props.onLeaveMatch} />
      </section>

      <section className="match-main">
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
      </section>

      <section className="control-strip">
        <section className="rack-panel">
          <Rack
            rackSlots={turn.rackSlots}
            selectedTileIds={turn.selectedRackTileIds}
            playerColor={localPlayerColor}
            canDragToBoard={isMyTurn && turn.turnMode === "play" && !actionsFrozen}
            canInteractWithRack={!actionsFrozen}
            tileBagCount={snapshot.tileBagCount}
            onSelect={turn.handleRackSelect}
          />
        </section>

        <section className={`action-panel${!isMyTurn ? " action-panel--waiting" : ""}`}>
          <div className="action-bar">
            <button
              className="primary"
              style={{ "--button-accent": isMyTurn ? activeTurnColor : "var(--panel-border)" } as CSSProperties}
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
