import { useEffect, useRef, useState } from "react";
import type { Placement } from "@d-m4th/game";
import type { ServerMessage } from "@d-m4th/protocol";
import { createRequestId, type ProtocolClient } from "../client/protocol-client";

const PREVIEW_DEBOUNCE_MS = 150;

export function useScorePreview(params: {
  client: ProtocolClient;
  isMyTurn: boolean;
  actionsFrozen: boolean;
  draft: readonly Placement[];
}) {
  const { actionsFrozen, client, draft, isMyTurn } = params;
  const autoPreviewRequestIdRef = useRef<string | undefined>(undefined);
  const [previewScore, setPreviewScore] = useState<number>();

  useEffect(() => {
    if (!isMyTurn || actionsFrozen || draft.length === 0) {
      autoPreviewRequestIdRef.current = undefined;
      setPreviewScore(undefined);
      return;
    }

    const requestId = `auto-preview:${createRequestId()}`;
    autoPreviewRequestIdRef.current = requestId;
    const timerId = window.setTimeout(() => {
      client.send({ type: "play:preview", requestId, placements: draft.map((placement) => ({ ...placement })) });
    }, PREVIEW_DEBOUNCE_MS);

    return () => window.clearTimeout(timerId);
  }, [actionsFrozen, client, draft, isMyTurn]);

  function clearPreviewScore(): void {
    setPreviewScore(undefined);
  }

  function handlePreviewMessage(message: ServerMessage): boolean {
    if (message.type === "play:previewed") {
      if (message.requestId !== autoPreviewRequestIdRef.current) return false;
      setPreviewScore(message.score.totalScore);
      return true;
    }

    if (message.type === "action:rejected" && message.requestId === autoPreviewRequestIdRef.current) {
      setPreviewScore(undefined);
      return true;
    }

    return false;
  }

  return { previewScore, clearPreviewScore, handlePreviewMessage };
}
