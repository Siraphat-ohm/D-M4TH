export type NoticeTone = "info" | "success" | "danger";

export type ViewMode = "create" | "join";

export interface LogEntry {
  id: number;
  text: string;
  tone: NoticeTone;
  at: number;
}
