import type { Placement } from "@d-m4th/game";
import { createRequestId, type ProtocolClient } from "../protocol-client";

export function useTurnActions(client: ProtocolClient, actionsFrozen: boolean) {
  function sendDraft(placements: readonly Placement[]): void {
    if (actionsFrozen) return;
    client.send({
      type: "placement:draft",
      requestId: createRequestId(),
      placements: placements.map((placement) => ({ ...placement }))
    });
  }

  function sendRecallRack(): void {
    if (actionsFrozen) return;
    client.send({ type: "rack:recall", requestId: createRequestId() });
  }

  function sendCommitPlay(placements: readonly Placement[]): void {
    if (actionsFrozen) return;
    client.send({
      type: "play:commit",
      requestId: createRequestId(),
      placements: placements.map((placement) => ({ ...placement }))
    });
  }

  function sendSwap(tileIds: readonly string[]): void {
    if (actionsFrozen) return;
    client.send({ type: "turn:swap", requestId: createRequestId(), tileIds: [...tileIds] });
  }

  function sendPass(): void {
    if (actionsFrozen) return;
    client.send({ type: "turn:pass", requestId: createRequestId() });
  }

  return { sendCommitPlay, sendDraft, sendPass, sendRecallRack, sendSwap };
}
