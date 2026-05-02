import type { MatchConfig } from "@d-m4th/config";
import { createRequestId, ProtocolClient } from "./protocol-client";
import { normalizeRoomCode } from "../ui/shared/format";
import type { PublicSnapshot } from "@d-m4th/game";

export interface UseLobbyActionsParams {
  client: ProtocolClient;
  actionsFrozen: boolean;
  name: string;
  color: string;
  roomCode: string;
  config: MatchConfig;
  snapshot?: PublicSnapshot;
  setLocation: (path: string) => void;
  setRoomCode: (code: string) => void;
  setConfig: (config: MatchConfig) => void;
}

export function useLobbyActions(params: UseLobbyActionsParams) {
  const createRoom = () => {
    if (params.actionsFrozen) return;
    if (!params.name.trim()) return;
    params.client.send({ type: "room:create", requestId: createRequestId(), name: params.name.trim(), color: params.color, config: params.config });
    params.setLocation("/lobby");
  };

  const joinRoom = () => {
    if (params.actionsFrozen) return;
    const code = normalizeRoomCode(params.roomCode);
    if (!params.name.trim() || code.length !== 6) return;
    if (code !== params.roomCode) params.setRoomCode(code);
    params.client.send({ type: "room:join", requestId: createRequestId(), code, name: params.name.trim(), color: params.color });
    params.setLocation("/lobby");
  };

  const configure = (nextConfig: MatchConfig) => {
    if (params.actionsFrozen) return;
    params.setConfig(nextConfig);
    if (params.snapshot?.status === "lobby") {
      params.client.send({ type: "match:configure", requestId: createRequestId(), config: nextConfig });
    }
  };

  const startMatch = () => {
    if (params.actionsFrozen) return;
    params.client.send({ type: "match:start", requestId: createRequestId() });
  };

  return { createRoom, joinRoom, configure, startMatch };
}
