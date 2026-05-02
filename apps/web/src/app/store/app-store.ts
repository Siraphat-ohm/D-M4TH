import { create } from "zustand";
import type { Tile } from "@d-m4th/game";
import type { NoticeTone } from "../../ui/shared/types";
import { createUISlice, type UISlice } from "./slices/uiSlice";
import { createMatchSlice, type MatchSlice } from "./slices/matchSlice";
import { createPlayerSlice, type PlayerSlice } from "./slices/playerSlice";

export interface PrivateState {
  playerId: string;
  rack: Tile[];
}

export interface NoticeState {
  text: string;
  tone: NoticeTone;
  sticky?: boolean;
}

type AppState = UISlice & MatchSlice & PlayerSlice;

export const useAppStore = create<AppState>()((...a) => ({
  ...createUISlice(...a),
  ...createMatchSlice(...a),
  ...createPlayerSlice(...a),
}));
