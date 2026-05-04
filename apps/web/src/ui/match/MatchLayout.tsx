import { useState, type CSSProperties } from "react";
import { Check, RefreshCcw, ScrollText, SkipForward, Undo2 } from "lucide-react";
import type { PublicSnapshot } from "@d-m4th/game";
import { BoardCanvas } from "@/board/BoardCanvas";
import { FaceSelectionDialog } from "@/ui/dialogs/Dialogs";
import { MatchTopBar } from "@/ui/match/MatchTopBar";
import { TurnContextInline } from "@/ui/match/TurnContextInline";
import { Rack } from "@/ui/rack/Rack";
import { resolvePlayerAccent } from "@/ui/shared/player-colors";
import { useTurn } from "@/turn/TurnContext";
import type { PrivateState } from "@/shared/types";

export function MatchLayout(props: {
  snapshot: PublicSnapshot;
  ghostPlacements: Array<{ playerId: string; placements: PublicSnapshot["board"] }>;
  privateState?: PrivateState;
  ownColor: string;
  logEntryCount: number;
  onOpenLog: () => void;
  onLeaveMatch: () => void;
}) {
  const turn = useTurn();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 900px)").matches : false
  );

  const rack = props.privateState?.rack ?? [];
  const localPlayerColor = resolvePlayerAccent(props.snapshot.players, props.privateState?.playerId, props.ownColor);
  const activeTurnColor = resolvePlayerAccent(props.snapshot.players, props.snapshot.currentPlayerId, "var(--panel-border)");
  const isMyTurn = props.snapshot.currentPlayerId === props.privateState?.playerId;
  const actionsFrozen = turn.actionsFrozen;

  return (
    <section className={`play-surface${sidebarCollapsed ? " play-surface--sidebar-collapsed" : ""}`}>
      <section className="match-sidebar-shell">
        <MatchTopBar
          snapshot={props.snapshot}
          rack={rack}
          previewScore={turn.previewScore}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
          onLeaveMatch={props.onLeaveMatch}
        />
      </section>

      <section className="match-main">
        <section className="board-stage">
          <div className="board-scroll-container">
            <BoardCanvas
              snapshot={props.snapshot}
              ghostPlacements={props.ghostPlacements}
              draft={turn.draft}
              rack={rack}
              currentPlayerId={props.privateState?.playerId}
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
        <TurnContextInline snapshot={props.snapshot} />

        <section className="rack-panel">
          <Rack
            rackSlots={turn.rackSlots}
            selectedTileIds={turn.selectedRackTileIds}
            playerColor={localPlayerColor}
            canDragToBoard={isMyTurn && turn.turnMode === "play" && !actionsFrozen}
            canInteractWithRack={!actionsFrozen}
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
              disabled={
                actionsFrozen ||
                !isMyTurn ||
                props.snapshot.tileBagCount <= 5 ||
                (turn.turnMode === "swap" && (
                  turn.swapSelectedTileIds.length === 0 ||
                  turn.swapSelectedTileIds.length > props.snapshot.tileBagCount
                ))
              }
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
        onClick={props.onOpenLog}
      >
        <ScrollText size={18} aria-hidden="true" />
        {props.logEntryCount > 0 && (
          <span className="floating-log-badge" aria-label="Log entries">
            {Math.min(props.logEntryCount, 99)}
          </span>
        )}
      </button>

      {turn.pendingFacePlacement && (
        <FaceSelectionDialog
          playerColor={props.ownColor}
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
