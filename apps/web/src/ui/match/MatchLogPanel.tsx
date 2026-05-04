import { useState } from "react";
import { List, ScrollText } from "lucide-react";
import { formatClock } from "../shared/format";
import { LogEntryList } from "./LogEntryList";
import type { LogEntry } from "@/shared/types";

const LOG_PREVIEW_LIMIT = 6;

export function MatchLogPanel(props: { entries: LogEntry[]; onViewAll: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const previewEntries = props.entries.slice(0, LOG_PREVIEW_LIMIT);

  return (
    <aside className={collapsed ? "match-log-panel match-log-panel--collapsed" : "match-log-panel"}>
      <div className="match-log-header">
        <div className="match-log-title">
          <ScrollText size={16} aria-hidden="true" />
          <p>Log</p>
        </div>
        <div className="match-log-actions">
          <button type="button" className="match-log-collapse" onClick={() => setCollapsed((current) => !current)}>
            {collapsed ? "Show" : "Hide"}
          </button>
          <button type="button" className="match-log-view-all" onClick={props.onViewAll}>
            <List size={14} aria-hidden="true" />
            View All
          </button>
        </div>
      </div>
      {!collapsed && (
        <LogEntryList
          entries={previewEntries}
          emptyText="No log yet"
          listClassName="match-log-list"
          rowClassName="match-log-row"
          emptyClassName="match-log-empty"
          titleFormatter={(entry) => `${formatClock(entry.at)} ${entry.text}`}
        />
      )}
    </aside>
  );
}
