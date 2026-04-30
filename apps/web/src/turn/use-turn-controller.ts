import { useEffect, useRef, useState } from "react";
import { tileRequiresFace, type Placement, type Tile } from "@d-m4th/game";
import type { ServerMessage } from "@d-m4th/protocol";
import { createRequestId, type ProtocolClient } from "../protocol-client";
import {
  findDraftPlacementAt,
  moveOrSwapDraftPlacement,
  toggleSelection,
  type TurnMode,
  upsertDraftPlacement
} from "./turn-controls";

interface PendingFacePlacement {
  tile: Tile;
  x: number;
  y: number;
}

export function useTurnController(params: {
  client: ProtocolClient;
  isMyTurn: boolean;
  rack: Tile[];
}) {
  const { client, isMyTurn, rack } = params;

  const [draft, setDraft] = useState<Placement[]>([]);
  const draftRef = useRef<Placement[]>([]);
  const [selectedTileId, setSelectedTileId] = useState<string>();
  const [pendingFacePlacement, setPendingFacePlacement] = useState<PendingFacePlacement>();
  const autoPreviewRequestIdRef = useRef<string | undefined>(undefined);
  const [turnMode, setTurnMode] = useState<TurnMode>("play");
  const [swapSelectedTileIds, setSwapSelectedTileIds] = useState<string[]>([]);
  const [previewScore, setPreviewScore] = useState<number>();

  const draftTileIds = new Set(draft.map((p) => p.tileId));
  const visibleRack = turnMode === "swap" ? rack : rack.filter((tile) => !draftTileIds.has(tile.id));
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
      client.send({ type: "play:preview", requestId, placements: draft });
    }, 150);

    return () => window.clearTimeout(timerId);
  }, [client, draft, isMyTurn]);

  function updateDraft(nextDraft: Placement[]): void {
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }

  function updateAndBroadcastDraft(nextDraft: Placement[]): void {
    updateDraft(nextDraft);
    setPreviewScore(undefined);
    client.send({ type: "placement:draft", requestId: createRequestId(), placements: nextDraft });
  }

  function handleBoardCellClick(x: number, y: number): void {
    if (turnMode !== "play" || !isMyTurn) return;

    const target = { x, y };
    const targetDraft = findDraftPlacementAt(draftRef.current, target);

    if (!selectedTileId) {
      setSelectedTileId(targetDraft?.tileId);
      return;
    }

    const selectedDraft = draftRef.current.find((p) => p.tileId === selectedTileId);

    if (selectedDraft) {
      updateAndBroadcastDraft(moveOrSwapDraftPlacement({ draft: draftRef.current, tileId: selectedTileId, target }));
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

    if (tileRequiresFace(tile.label)) {
      setPendingFacePlacement({ tile, x, y });
      return;
    }

    placeResolvedRackTile(tile, x, y);
  }

  function placeResolvedRackTile(tile: Tile, x: number, y: number, face?: string): void {
    const placement: Placement = face ? { tileId: tile.id, x, y, face } : { tileId: tile.id, x, y };
    updateAndBroadcastDraft(upsertDraftPlacement(draftRef.current, placement));
    setSelectedTileId(undefined);
    setPendingFacePlacement(undefined);
  }

  function commitPlay(): void {
    client.send({ type: "play:commit", requestId: createRequestId(), placements: draftRef.current });
    updateDraft([]);
    setPreviewScore(undefined);
  }

  function handleSwapAction(): void {
    if (turnMode !== "swap") {
      setTurnMode("swap");
      setSelectedTileId(undefined);
      setPendingFacePlacement(undefined);
      setSwapSelectedTileIds([]);

      if (draftRef.current.length > 0) {
        updateDraft([]);
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

    updateDraft([]);
    setSelectedTileId(undefined);
    setPendingFacePlacement(undefined);
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
    pendingFacePlacement,
    turnMode,
    previewScore,
    visibleRack,
    selectedRackTileIds,
    swapSelectedTileIds,
    placementDisabled: turnMode === "swap",
    handleBoardCellClick,
    placeRackTile,
    placeResolvedRackTile,
    commitPlay,
    handleSwapAction,
    passTurn,
    recallRack,
    handleRackSelect,
    cancelPendingFace: () => setPendingFacePlacement(undefined),
    handleMessage
  };
}

export type { PendingFacePlacement };
