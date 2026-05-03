import type { StateCreator } from "zustand";
import { createClassicalConfig, type MatchConfig } from "@d-m4th/config";
import { normalizeRoomCode } from "@/shared/room-code";

const DEFAULT_PLAYER_COLOR = "#EF476F";

export interface PlayerSlice {
  name: string;
  color: string;
  roomCode: string;
  config: MatchConfig;
  setName: (name: string) => void;
  setColor: (color: string) => void;
  setRoomCode: (code: string) => void;
  setConfig: (config: MatchConfig) => void;
}

function readInitialRoomCode(): string {
  return normalizeRoomCode(new URLSearchParams(window.location.search).get("room") ?? "");
}

export const createPlayerSlice: StateCreator<PlayerSlice, [], [], PlayerSlice> = (set) => {
  const initialRoomCode = readInitialRoomCode();

  return {
    name: "",
    color: DEFAULT_PLAYER_COLOR,
    roomCode: normalizeRoomCode(initialRoomCode),
    config: createClassicalConfig(),
    setName: (name) => set({ name }),
    setColor: (color) => set({ color }),
    setRoomCode: (roomCode) => set({ roomCode }),
    setConfig: (config) => set({ config }),
  };
};
