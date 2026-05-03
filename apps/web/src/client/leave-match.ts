import type { MutableRefObject } from "react";
import type { BoardTile, PublicSnapshot } from "@d-m4th/game";
import type { ServerMessage } from "@d-m4th/protocol";
import { createRequestId, type ProtocolClient } from "./protocol-client";
import type { NoticeState, PrivateState, ViewMode } from "@/shared/types";
import type { ReconnectSession } from "./reconnect-session";

export type ReconnectState = "idle" | "waiting" | "resuming" | "failed" | "expired";

export interface LeaveMatchParams {
  client: ProtocolClient;
  snapshotCode?: string;
  reconnectSession?: ReconnectSession;
  clearReconnectRoom(roomCode: string): void;
  setSocketConnected(connected: boolean): void;
  setReconnectState(state: ReconnectState): void;
  resumeRequestIdRef: MutableRefObject<string | undefined>;
  resumeRoomCodeRef: MutableRefObject<string | undefined>;
  resumeAttemptKeyRef: MutableRefObject<string | undefined>;
  inActiveMatchContextRef: MutableRefObject<boolean>;
  turnHandleRef: MutableRefObject<(message: ServerMessage) => boolean>;
  setSnapshot(snapshot?: PublicSnapshot): void;
  setPrivateState(privateState?: PrivateState): void;
  setGhostPlacements(ghostPlacements: Array<{ playerId: string; placements: BoardTile[] }>): void;
  setLogOpen(open: boolean): void;
  setNotice(notice?: NoticeState): void;
  setRoomCode(code: string): void;
  setViewMode(mode: ViewMode): void;
  setLocation(path: string, options?: { replace?: boolean }): void;
}

export function leaveMatch(params: LeaveMatchParams): void {
  const activeRoomCode = params.snapshotCode ?? params.reconnectSession?.roomCode;
  if (params.client.isConnected()) {
    params.client.send({ type: "room:leave", requestId: createRequestId() });
  }

  if (activeRoomCode) {
    params.clearReconnectRoom(activeRoomCode);
  }

  params.client.close();
  params.setSocketConnected(false);
  params.setReconnectState("idle");
  params.resumeRequestIdRef.current = undefined;
  params.resumeRoomCodeRef.current = undefined;
  params.resumeAttemptKeyRef.current = undefined;
  params.inActiveMatchContextRef.current = false;
  params.turnHandleRef.current = () => false;
  params.setSnapshot(undefined);
  params.setPrivateState(undefined);
  params.setGhostPlacements([]);
  params.setLogOpen(false);
  params.setNotice({ text: "Left match", tone: "info" });
  params.setRoomCode("");
  params.setViewMode("join");
  params.setLocation("/", { replace: true });
}
