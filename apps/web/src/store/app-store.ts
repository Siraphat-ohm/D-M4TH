import { create } from "zustand";
import { createClassicalConfig, type MatchConfig } from "@d-m4th/config";
import type { BoardTile, PublicSnapshot, Tile } from "@d-m4th/game";
import { normalizeRoomCode } from "../ui/format";
import type { LogEntry, NoticeTone, ViewMode } from "../ui/types";

const DEFAULT_PLAYER_COLOR = "#EF476F";
const LOG_HISTORY_LIMIT = 30;

export type AppRoute = "/" | "/lobby" | "/match";

export interface PrivateState {
  playerId: string;
  rack: Tile[];
}

export interface NoticeState {
  text: string;
  tone: NoticeTone;
  sticky?: boolean;
}

interface AppState {
  viewMode: ViewMode;
  name: string;
  color: string;
  roomCode: string;
  config: MatchConfig;
  logOpen: boolean;
  notice?: NoticeState;
  route: AppRoute;
  snapshot?: PublicSnapshot;
  privateState?: PrivateState;
  logEntries: LogEntry[];
  ghostPlacements: Array<{ playerId: string; placements: BoardTile[] }>;
  nextLogId: number;
  setViewMode: (mode: ViewMode) => void;
  setName: (name: string) => void;
  setColor: (color: string) => void;
  setRoomCode: (code: string) => void;
  setConfig: (config: MatchConfig) => void;
  setLogOpen: (open: boolean) => void;
  setNotice: (notice?: NoticeState) => void;
  setRoute: (route: AppRoute) => void;
  setSnapshot: (snapshot?: PublicSnapshot) => void;
  setPrivateState: (privateState?: PrivateState) => void;
  setGhostPlacements: (ghostPlacements: Array<{ playerId: string; placements: BoardTile[] }>) => void;
  addLog: (text: string, tone: NoticeTone) => void;
}

export const useAppStore = create<AppState>((set) => {
  const initialRoomCode = readInitialRoomCode();

  return {
    viewMode: initialRoomCode ? "join" : "create",
    name: "",
    color: DEFAULT_PLAYER_COLOR,
    roomCode: normalizeRoomCode(initialRoomCode),
    config: createClassicalConfig(),
    logOpen: false,
    notice: undefined,
    route: toRoute(window.location.pathname),
    snapshot: undefined,
    privateState: undefined,
    logEntries: [],
    ghostPlacements: [],
    nextLogId: 1,
    setViewMode: (viewMode) => set({ viewMode }),
    setName: (name) => set({ name }),
    setColor: (color) => set({ color }),
    setRoomCode: (roomCode) => set({ roomCode }),
    setConfig: (config) => set({ config }),
    setLogOpen: (logOpen) => set({ logOpen }),
    setNotice: (notice) => set({ notice }),
    setRoute: (route) => set({ route }),
    setSnapshot: (snapshot) => set({ snapshot }),
    setPrivateState: (privateState) => set({ privateState }),
    setGhostPlacements: (ghostPlacements) => set({ ghostPlacements }),
    addLog: (text, tone) =>
      set((state) => ({
        logEntries: [{ id: state.nextLogId, text, tone, at: Date.now() }, ...state.logEntries].slice(0, LOG_HISTORY_LIMIT),
        nextLogId: state.nextLogId + 1
      }))
  };
});

function toRoute(pathname: string): AppRoute {
  if (pathname === "/match") return "/match";
  if (pathname === "/lobby") return "/lobby";
  return "/";
}

function readInitialRoomCode(): string {
  return normalizeRoomCode(new URLSearchParams(window.location.search).get("room") ?? "");
}
