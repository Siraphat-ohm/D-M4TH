import { useEffect, useMemo, useRef, useState } from "react";
import { DraftManager, type BoardTile, type Placement, type Tile } from "@d-m4th/game";
import type { ServerMessage } from "@d-m4th/protocol";
import { createRequestId, type ProtocolClient } from "../protocol-client";
import { isCellBlocked, toggleSelection, type TurnMode } from "./turn-controls";

const PREVIEW_DEBOUNCE_MS = 150;

export function useTurnController(params: {
  client: ProtocolClient;
  isMyTurn: boolean;
  actionsFrozen?: boolean;
  rack: Tile[];
  rackSize: number;
  board: BoardTile[];
}) {
  const { client, isMyTurn, actionsFrozen = false, rack, rackSize, board } = params;

  const occupiedCells = useMemo(() => {
    const set = new Set<string>();
    for (const tile of board) {
      set.add(`${tile.x},${tile.y}`);
    }
    return set as ReadonlySet<string>;
  }, [board]);

  const [draftManager, setDraftManager] = useState<DraftManager>(DraftManager.empty());
  const draftRef = useRef<DraftManager>(draftManager);
  
  const [customRackOrder, setCustomRackOrder] = useState<string[]>([]);

  useEffect(() => {
    setCustomRackOrder((prev) => {
      const existingIds = new Set(prev);
      const newIds = rack.map((t) => t.id).filter((id) => !existingIds.has(id));
      if (newIds.length === 0) return prev;
      return [...prev, ...newIds];
    });
  }, [rack]);

  const orderedRack = useMemo(() => {
    const rackCopy = [...rack];
    rackCopy.sort((a, b) => {
      const indexA = customRackOrder.indexOf(a.id);
      const indexB = customRackOrder.indexOf(b.id);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    });
    return rackCopy;
  }, [rack, customRackOrder]);

  const [selectedTileId, setSelectedTileId] = useState<string>();
  const autoPreviewRequestIdRef = useRef<string | undefined>(undefined);
  const [turnMode, setTurnMode] = useState<TurnMode>("play");
  const [swapSelectedTileIds, setSwapSelectedTileIds] = useState<string[]>([]);
  const [previewScore, setPreviewScore] = useState<number>();

  const draft = draftManager.placements;
  const draftTileIds = new Set(draft.map((p) => p.tileId));
  const visibleRack = turnMode === "swap" ? orderedRack : orderedRack.filter((tile) => !draftTileIds.has(tile.id));
  const rackSlots = createRackSlots(visibleRack, rackSize);
  const selectedRackTileIds = turnMode === "swap"
    ? new Set(swapSelectedTileIds)
    : new Set(selectedTileId ? [selectedTileId] : []);

  useEffect(() => {
    if (!isMyTurn || actionsFrozen || draft.length === 0) {
      autoPreviewRequestIdRef.current = undefined;
      setPreviewScore(undefined);
      return;
    }

    const requestId = `auto-preview:${createRequestId()}`;
    autoPreviewRequestIdRef.current = requestId;
    const timerId = window.setTimeout(() => {
      client.send({ type: "play:preview", requestId, placements: draft.map((p) => ({ ...p })) });
    }, PREVIEW_DEBOUNCE_MS);

    return () => window.clearTimeout(timerId);
  }, [actionsFrozen, client, draft, isMyTurn]);

  useEffect(() => {
    if (isMyTurn) return;
    if (draftRef.current.placements.length === 0 && !selectedTileId) return;
    updateDraftManager(draftRef.current.clear());
    setSelectedTileId(undefined);
    setPreviewScore(undefined);
  }, [isMyTurn, selectedTileId]);

  useEffect(() => {
    if (draftRef.current.placements.length === 0) return;
    const rackIds = new Set(rack.map((tile) => tile.id));
    const hasOutdatedDraft = draftRef.current.placements.some((placement) => !rackIds.has(placement.tileId));
    if (!hasOutdatedDraft) return;
    updateDraftManager(draftRef.current.clear());
    setSelectedTileId(undefined);
    setPreviewScore(undefined);
  }, [rack]);

  function updateDraftManager(nextManager: DraftManager): void {
    draftRef.current = nextManager;
    setDraftManager(nextManager);
  }

  function updateAndBroadcastDraft(nextManager: DraftManager): void {
    if (actionsFrozen) return;
    updateDraftManager(nextManager);
    setPreviewScore(undefined);
    client.send({
      type: "placement:draft",
      requestId: createRequestId(),
      placements: nextManager.placements.map((p) => ({ ...p }))
    });
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
    client.send({ type: "play:commit", requestId: createRequestId(), placements: draftRef.current.placements.map((p) => ({ ...p })) });
    updateDraftManager(draftRef.current.clear());
    setPreviewScore(undefined);
  }

  function handleSwapAction(): void {
    if (actionsFrozen) return;
    if (turnMode !== "swap") {
      setTurnMode("swap");
      setSelectedTileId(undefined);
      updateDraftManager(draftRef.current.cancelFace());
      setSwapSelectedTileIds([]);

      if (draftRef.current.placements.length > 0) {
        updateDraftManager(draftRef.current.clear());
        client.send({ type: "rack:recall", requestId: createRequestId() });
      }
      return;
    }

    if (swapSelectedTileIds.length === 0) return;

    client.send({ type: "turn:swap", requestId: createRequestId(), tileIds: swapSelectedTileIds });
    setSwapSelectedTileIds([]);
    setTurnMode("play");
  }

  function passTurn(): void {
    if (actionsFrozen) return;
    client.send({ type: "turn:pass", requestId: createRequestId() });
  }

  function recallRack(): void {
    if (actionsFrozen) return;
    if (turnMode === "swap") {
      setTurnMode("play");
      setSwapSelectedTileIds([]);
      return;
    }

    updateDraftManager(draftRef.current.clear());
    setSelectedTileId(undefined);
    setPreviewScore(undefined);
    client.send({ type: "rack:recall", requestId: createRequestId() });
  }

  function handleRackSwap(idA: string, idB: string): void {
    if (idA === idB) return;

    setCustomRackOrder((prev) => {
      const indexA = prev.indexOf(idA);
      const indexB = prev.indexOf(idB);

      if (indexA === -1 || indexB === -1) return prev;

      const next = [...prev];
      next[indexA] = idB;
      next[indexB] = idA;

      return next;
    });
  }

  function handleRackSelect(tile: Tile): void {
    if (turnMode === "swap") {
      if (actionsFrozen) return;
      setSwapSelectedTileIds((ids) => toggleSelection(ids, tile.id));
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
    setPreviewScore(undefined);
  }

  function handleMessage(message: ServerMessage): boolean {
    if (message.type === "play:previewed") {
      if (message.requestId !== autoPreviewRequestIdRef.current) return false;
      setPreviewScore(message.score.totalScore);
      return true;
    }

    if (message.type === "action:rejected") {
      if (message.requestId === autoPreviewRequestIdRef.current) {
        setPreviewScore(undefined);
        return true;
      }
    }

    return false;
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
    handleMessage,
    actionsFrozen
  };
}

function createRackSlots(rack: readonly Tile[], rackSize: number): Array<Tile | undefined> {
  return [...rack, ...Array.from({ length: Math.max(0, rackSize - rack.length) }, () => undefined)];
}
