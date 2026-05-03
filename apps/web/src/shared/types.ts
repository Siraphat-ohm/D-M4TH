import type { Tile } from "@d-m4th/game";

export type NoticeTone = "info" | "success" | "danger";

export interface NoticeState {
  text: string;
  tone: NoticeTone;
  sticky?: boolean;
}

export interface PrivateState {
  playerId: string;
  rack: Tile[];
}

export type ViewMode = "create" | "join";

export interface LogEntry {
  id: number;
  text: string;
  tone: NoticeTone;
  at: number;
}
