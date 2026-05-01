import { useState } from "react";
import { List, ScrollText } from "lucide-react";
import { formatClock } from "./format";
import type { LogEntry } from "./types";

const LOG_PREVIEW_LIMIT = 6;

export function MatchLogPanel(props: { entries: LogEntry[]; onViewAll: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const previewEntries = props.entries.slice(0, LOG_PREVIEW_LIMIT);

  return (
    <aside className={collapsed ? "match-log-panel match-log-panel--collapsed" : "match-log-panel"}>
      <div className="match-log-header">
        <div className="match-log-title">
          <ScrollText size={16} aria-hidden="true" />
          <strong>Log</strong>
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
        <div className="match-log-list">
          {previewEntries.length === 0 ? (
            <span className="match-log-empty">No log yet</span>
          ) : (
            previewEntries.map((entry) => (
              <div className={`match-log-row ${entry.tone}`} key={entry.id} title={`${formatClock(entry.at)} ${entry.text}`}>
                <time>{formatClock(entry.at)}</time>
                <span>{entry.text}</span>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
}
