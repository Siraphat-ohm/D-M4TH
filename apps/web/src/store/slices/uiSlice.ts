import type { StateCreator } from "zustand";
import type { LogEntry, NoticeTone, ViewMode } from "../../ui/types";
import type { NoticeState } from "../app-store"; // I will move interfaces around later

const LOG_HISTORY_LIMIT = 30;

export interface UISlice {
  viewMode: ViewMode;
  logOpen: boolean;
  notice?: NoticeState;
  logEntries: LogEntry[];
  nextLogId: number;
  setViewMode: (mode: ViewMode) => void;
  setLogOpen: (open: boolean) => void;
  setNotice: (notice?: NoticeState) => void;
  addLog: (text: string, tone: NoticeTone) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  viewMode: "join",
  logOpen: false,
  notice: undefined,
  logEntries: [],
  nextLogId: 1,
  setViewMode: (viewMode) => set({ viewMode }),
  setLogOpen: (logOpen) => set({ logOpen }),
  setNotice: (notice) => set({ notice }),
  addLog: (text, tone) =>
    set((state) => ({
      logEntries: [{ id: state.nextLogId, text, tone, at: Date.now() }, ...state.logEntries].slice(0, LOG_HISTORY_LIMIT),
      nextLogId: state.nextLogId + 1,
    })),
});
