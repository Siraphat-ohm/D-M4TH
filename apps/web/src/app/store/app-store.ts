import { create } from "zustand";
import type { NoticeState, PrivateState } from "@/shared/types";
import { createUISlice, type UISlice } from "./slices/uiSlice";
import { createMatchSlice, type MatchSlice } from "./slices/matchSlice";
import { createPlayerSlice, type PlayerSlice } from "./slices/playerSlice";

type AppState = UISlice & MatchSlice & PlayerSlice;

export const useAppStore = create<AppState>()((...a) => ({
  ...createUISlice(...a),
  ...createMatchSlice(...a),
  ...createPlayerSlice(...a),
}));
