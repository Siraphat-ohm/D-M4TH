import { formatClock } from "../shared/format";
import type { LogEntry } from "@/shared/types";

export function LogEntryList(props: {
  entries: LogEntry[];
  emptyText: string;
  listClassName: string;
  rowClassName: string;
  emptyClassName: string;
  titleFormatter?: (entry: LogEntry) => string | undefined;
}) {
  if (props.entries.length === 0) {
    return <span className={props.emptyClassName}>{props.emptyText}</span>;
  }

  return (
    <div className={props.listClassName}>
      {props.entries.map((entry) => (
        <div
          className={`${props.rowClassName} ${entry.tone}`}
          key={entry.id}
          title={props.titleFormatter?.(entry)}
        >
          <time>{formatClock(entry.at)}</time>
          <span>{entry.text}</span>
        </div>
      ))}
    </div>
  );
}
