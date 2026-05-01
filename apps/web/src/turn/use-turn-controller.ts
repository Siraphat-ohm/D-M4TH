import { useEffect, useRef, useState } from "react";
import { DraftManager, type Placement, type Tile } from "@d-m4th/game";
import type { ServerMessage } from "@d-m4th/protocol";
import { createRequestId, type ProtocolClient } from "../protocol-client";
import { toggleSelection, type TurnMode } from "./turn-controls";

export function useTurnController(params: {
  client: ProtocolClient;
  isMyTurn: boolean;
  rack: Tile[];
  rackSize: number;
}) {
  const { client, isMyTurn, rack, rackSize } = params;

  const [draftManager, setDraftManager] = useState<DraftManager>(DraftManager.empty());
  const draftRef = useRef<DraftManager>(draftManager);
  
  const [selectedTileId, setSelectedTileId] = useState<string>();
  const autoPreviewRequestIdRef = useRef<string | undefined>(undefined);
  const [turnMode, setTurnMode] = useState<TurnMode>("play");
  const [swapSelectedTileIds, setSwapSelectedTileIds] = useState<string[]>([]);
  const [previewScore, setPreviewScore] = useState<number>();

  const draft = draftManager.placements;
  const draftTileIds = new Set(draft.map((p) => p.tileId));
  const visibleRack = turnMode === "swap" ? rack : rack.filter((tile) => !draftTileIds.has(tile.id));
  const rackSlots = createRackSlots(visibleRack, rackSize);
  const selectedRackTileIds = turnMode === "swap"
    ? new Set(swapSelectedTileIds)
    : new Set(selectedTileId ? [selectedTileId] : []);

  useEffect(() => {
    if (!isMyTurn || draft.length === 0) {
      autoPreviewRequestIdRef.current = undefined;
      setPreviewScore(undefined);
      return;
    }

    const requestId = `auto-preview:${createRequestId()}`;
    autoPreviewRequestIdRef.current = requestId;
    const timerId = window.setTimeout(() => {
      client.send({ type: "play:preview", requestId, placements: draft.map((p) => ({ ...p })) });
    }, 150);

    return () => window.clearTimeout(timerId);
  }, [client, draft, isMyTurn]);

  function updateDraftManager(nextManager: DraftManager): void {
    draftRef.current = nextManager;
    setDraftManager(nextManager);
  }

  function updateAndBroadcastDraft(nextManager: DraftManager): void {
    updateDraftManager(nextManager);
    setPreviewScore(undefined);
    client.send({
      type: "placement:draft",
      requestId: createRequestId(),
      placements: nextManager.placements.map((p) => ({ ...p }))
    });
  }

  function handleBoardCellClick(x: number, y: number): void {
    if (turnMode !== "play" || !isMyTurn) return;

    const targetDraft = draftRef.current.at(x, y);

    if (!selectedTileId) {
      setSelectedTileId(targetDraft?.tileId);
      return;
    }

    if (draftRef.current.has(selectedTileId)) {
      updateAndBroadcastDraft(draftRef.current.move(selectedTileId, x, y));
      setSelectedTileId(undefined);
      return;
    }

    if (targetDraft) {
      setSelectedTileId(targetDraft.tileId);
      return;
    }

    placeRackTile(selectedTileId, x, y);
  }

  function placeRackTile(tileId: string, x: number, y: number): void {
    const tile = rack.find((candidate) => candidate.id === tileId);
    if (turnMode !== "play" || !isMyTurn || !tile) return;

    const nextManager = draftRef.current.place(tile, x, y);
    updateAndBroadcastDraft(nextManager);

    if (!nextManager.pendingFace) {
      setSelectedTileId(undefined);
    }
  }

  function placeResolvedRackTile(tile: Tile, x: number, y: number, face?: string): void {
    if (face) {
      updateAndBroadcastDraft(draftRef.current.resolveFace(face));
    }
    setSelectedTileId(undefined);
  }

  function handleBoardCellDoubleClick(x: number, y: number): void {
    if (turnMode !== "play" || !isMyTurn) return;

    const draftPlacement = draftRef.current.at(x, y);
    if (!draftPlacement) return;

    updateAndBroadcastDraft(draftRef.current.recall(draftPlacement.tileId));

    if (selectedTileId === draftPlacement.tileId) {
      setSelectedTileId(undefined);
    }
  }

  function commitPlay(): void {
    client.send({ type: "play:commit", requestId: createRequestId(), placements: draftRef.current.placements.map((p) => ({ ...p })) });
    updateDraftManager(draftRef.current.clear());
    setPreviewScore(undefined);
  }

  function handleSwapAction(): void {
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
    client.send({ type: "turn:pass", requestId: createRequestId() });
  }

  function recallRack(): void {
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

  function handleRackSelect(tile: Tile): void {
    if (turnMode === "swap") {
      setSwapSelectedTileIds((ids) => toggleSelection(ids, tile.id));
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
    handleMessage
  };
}

function createRackSlots(rack: readonly Tile[], rackSize: number): Array<Tile | undefined> {
  return [...rack, ...Array.from({ length: Math.max(0, rackSize - rack.length) }, () => undefined)];
}
