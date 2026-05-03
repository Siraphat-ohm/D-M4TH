export function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function formatSignedTime(ms: number): string {
  const isNegative = ms < 0;
  const absMs = Math.abs(ms);
  const totalSeconds = Math.ceil(absMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${isNegative ? "-" : ""}${minutes}:${seconds}`;
}

const clockFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});

export function formatClock(timestamp: number): string {
  return clockFormatter.format(timestamp);
}
