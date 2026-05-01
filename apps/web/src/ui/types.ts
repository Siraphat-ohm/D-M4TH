export type NoticeTone = "info" | "success" | "danger";

export interface LogEntry {
  id: number;
  text: string;
  tone: NoticeTone;
  at: number;
}
