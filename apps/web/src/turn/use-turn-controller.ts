import { useEffect, useMemo, useRef, useState } from "react";
import { DraftManager, type Tile } from "@d-m4th/game";
import { isCellBlocked } from "./turn-controls";
import type { TurnControllerState, UseTurnControllerParams } from "./turn-controller-types";
import { createRackSlots, useRackOrder } from "./use-rack-order";
import { useScorePreview } from "./use-score-preview";
import { useSwapMode } from "./use-swap-mode";
import { useTurnActions } from "./use-turn-actions";

export function useTurnController(params: UseTurnControllerParams): TurnControllerState {
  const { client, isMyTurn, actionsFrozen = false, rack, rackSize, board } = params;
  const turnActions = useTurnActions(client, actionsFrozen);
  const { orderedRack, handleRackSwap } = useRackOrder(rack);
  const {
    enterSwapMode,
    exitSwapMode,
    swapSelectedTileIds,
    toggleSwapTile,
    turnMode
  } = useSwapMode();

  const occupiedCells = useMemo(() => {
    const set = new Set<string>();
    for (const tile of board) {
      set.add(`${tile.x},${tile.y}`);
    }
    return set as ReadonlySet<string>;
  }, [board]);

  const [draftManager, setDraftManager] = useState<DraftManager>(DraftManager.empty());
  const draftRef = useRef<DraftManager>(draftManager);
  const [selectedTileId, setSelectedTileId] = useState<string>();
  const draft = draftManager.placements;
  const draftTileIds = new Set(draft.map((p) => p.tileId));
  const visibleRack = turnMode === "swap" ? orderedRack : orderedRack.filter((tile) => !draftTileIds.has(tile.id));
  const rackSlots = createRackSlots(visibleRack, rackSize);
  const selectedRackTileIds = turnMode === "swap"
    ? new Set(swapSelectedTileIds)
    : new Set(selectedTileId ? [selectedTileId] : []);
  const { clearPreviewScore, handlePreviewMessage, previewScore } = useScorePreview({ client, isMyTurn, actionsFrozen, draft });

  useEffect(() => {
    if (isMyTurn) return;
    if (draftRef.current.placements.length === 0 && !selectedTileId) return;
    updateDraftManager(draftRef.current.clear());
    setSelectedTileId(undefined);
    clearPreviewScore();
  }, [clearPreviewScore, isMyTurn, selectedTileId]);

  useEffect(() => {
    if (draftRef.current.placements.length === 0) return;
    const rackIds = new Set(rack.map((tile) => tile.id));
    const hasOutdatedDraft = draftRef.current.placements.some((placement) => !rackIds.has(placement.tileId));
    if (!hasOutdatedDraft) return;
    updateDraftManager(draftRef.current.clear());
    setSelectedTileId(undefined);
    clearPreviewScore();
  }, [clearPreviewScore, rack]);

  function updateDraftManager(nextManager: DraftManager): void {
    draftRef.current = nextManager;
    setDraftManager(nextManager);
  }

  function updateAndBroadcastDraft(nextManager: DraftManager): void {
    if (actionsFrozen) return;
    updateDraftManager(nextManager);
    clearPreviewScore();
    turnActions.sendDraft(nextManager.placements);
  }

  function handleBoardCellClick(x: number, y: number): void {
    if (actionsFrozen) return;
    if (turnMode !== "play" || !isMyTurn) return;

    const targetDraft = draftRef.current.at(x, y);

    if (!selectedTileId) {
      setSelectedTileId(targetDraft?.tileId);
      return;
    }

    if (targetDraft && targetDraft.tileId !== selectedTileId) {
      setSelectedTileId(targetDraft.tileId);
      return;
    }

    if (draftRef.current.has(selectedTileId)) {
      if (isCellBlocked(occupiedCells, targetDraft?.tileId, selectedTileId, x, y)) {
        return;
      }
      updateAndBroadcastDraft(draftRef.current.move(selectedTileId, x, y, occupiedCells));
      setSelectedTileId(undefined);
      return;
    }

    placeRackTile(selectedTileId, x, y);
  }

  function placeRackTile(tileId: string, x: number, y: number): void {
    if (actionsFrozen) return;
    const tile = rack.find((candidate) => candidate.id === tileId);
    if (turnMode !== "play" || !isMyTurn || !tile) return;
    if (isCellBlocked(occupiedCells, draftRef.current.at(x, y)?.tileId, undefined, x, y)) return;

    const nextManager = draftRef.current.place(tile, x, y, occupiedCells);
    updateAndBroadcastDraft(nextManager);

    if (!nextManager.pendingFace) {
      setSelectedTileId(undefined);
    }
  }

  function placeResolvedRackTile(tile: Tile, x: number, y: number, face?: string): void {
    if (actionsFrozen) return;
    if (face) {
      updateAndBroadcastDraft(draftRef.current.resolveFace(face));
    }
    setSelectedTileId(undefined);
  }

  function handleBoardCellDoubleClick(x: number, y: number): void {
    if (actionsFrozen) return;
    if (turnMode !== "play" || !isMyTurn) return;

    const draftPlacement = draftRef.current.at(x, y);
    if (!draftPlacement) return;

    updateAndBroadcastDraft(draftRef.current.recall(draftPlacement.tileId));

    if (selectedTileId === draftPlacement.tileId) {
      setSelectedTileId(undefined);
    }
  }

  function commitPlay(): void {
    if (actionsFrozen) return;
    turnActions.sendCommitPlay(draftRef.current.placements);
    updateDraftManager(draftRef.current.clear());
    clearPreviewScore();
  }

  function handleSwapAction(): void {
    if (actionsFrozen) return;
    if (turnMode !== "swap") {
      enterSwapMode();
      setSelectedTileId(undefined);
      updateDraftManager(draftRef.current.cancelFace());

      if (draftRef.current.placements.length > 0) {
        updateDraftManager(draftRef.current.clear());
        turnActions.sendRecallRack();
      }
      return;
    }

    if (swapSelectedTileIds.length === 0) return;

    turnActions.sendSwap(swapSelectedTileIds);
    exitSwapMode();
  }

  function passTurn(): void {
    if (actionsFrozen) return;
    turnActions.sendPass();
  }

  function recallRack(): void {
    if (actionsFrozen) return;
    if (turnMode === "swap") {
      exitSwapMode();
      return;
    }

    updateDraftManager(draftRef.current.clear());
    setSelectedTileId(undefined);
    clearPreviewScore();
    turnActions.sendRecallRack();
  }

  function handleRackSelect(tile: Tile): void {
    if (turnMode === "swap") {
      if (actionsFrozen) return;
      toggleSwapTile(tile.id);
      return;
    }

    if (selectedTileId && selectedTileId !== tile.id) {
      if (draftTileIds.has(selectedTileId)) {
        setSelectedTileId(tile.id);
        return;
      }
      handleRackSwap(selectedTileId, tile.id);
      setSelectedTileId(undefined);
      return;
    }

    if (selectedTileId === tile.id) {
      setSelectedTileId(undefined);
      return;
    }

    setSelectedTileId(tile.id);
    clearPreviewScore();
  }

  return {
    draft,
    selectedTileId,
    pendingFacePlacement: draftManager.pendingFace,
    turnMode,
    previewScore,
    visibleRack,
    rackSlots,
    selectedRackTileIds,
    swapSelectedTileIds,
    placementDisabled: turnMode === "swap",
    handleBoardCellClick,
    handleBoardCellDoubleClick,
    placeRackTile,
    placeResolvedRackTile,
    commitPlay,
    handleSwapAction,
    passTurn,
    recallRack,
    handleRackSelect,
    cancelPendingFace: () => updateDraftManager(draftRef.current.cancelFace()),
    handleMessage: handlePreviewMessage,
    actionsFrozen
  };
}
