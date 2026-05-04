import { ChevronRight, ShoppingBag } from "lucide-react";
import { tileBagScaleForPlayerCount } from "@d-m4th/config";
import { createTileSet, type BoardTile, type PublicSnapshot, type Tile } from "@d-m4th/game";

export function BagSummary(props: {
  snapshot: PublicSnapshot;
  rack: readonly Tile[];
}) {
  const unseenTileBreakdown = createUnseenTileBreakdown({
    boardTiles: props.snapshot.board,
    rack: props.rack,
    playerCount: props.snapshot.players.length
  });

  return (
    <div
      className="match-sidebar__section match-sidebar__bag-card"
      aria-label={`${props.snapshot.tileBagCount} tiles left in bag`}
      tabIndex={0}
    >
        <div className="match-sidebar__bag-summary">
          <div className="match-sidebar__bag-icon">
            <ShoppingBag size={16} aria-hidden="true" />
          </div>
          <div className="match-sidebar__bag-copy">
            <p className="match-sidebar__label">Bag</p>
            <p className="match-sidebar__bag-count">{formatTileCount(props.snapshot.tileBagCount)}</p>
            <p className="match-sidebar__bag-hint">
              Hover for details
              <ChevronRight size={12} aria-hidden="true" />
            </p>
          </div>
        </div>
      <div className="match-sidebar__bag-popover" role="tooltip" aria-hidden="true">
        <div className="match-sidebar__bag-popover-header">
          <p className="match-sidebar__label">Tile Counts</p>
        </div>
        <div className="match-sidebar__bag-grid">
          {unseenTileBreakdown.map((entry) => (
            <span className="match-sidebar__bag-item" key={entry.label}>
              <span className="match-sidebar__bag-tile">{entry.displayLabel}</span>
              <span className="match-sidebar__bag-value">{entry.count}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatTileCount(count: number): string {
  return `${count} ${count === 1 ? "tile" : "tiles"}`;
}

function createUnseenTileBreakdown(params: {
  boardTiles: readonly BoardTile[];
  rack: readonly Tile[];
  playerCount: number;
}): Array<{ label: string; displayLabel: string; count: number }> {
  const allTiles = createTileSet(tileBagScaleForPlayerCount(params.playerCount));
  const remainingByLabel = new Map<string, number>();

  for (const tile of allTiles) {
    remainingByLabel.set(tile.label, (remainingByLabel.get(tile.label) ?? 0) + 1);
  }

  for (const tile of params.boardTiles) {
    remainingByLabel.set(tile.label, Math.max(0, (remainingByLabel.get(tile.label) ?? 0) - 1));
  }

  for (const tile of params.rack) {
    remainingByLabel.set(tile.label, Math.max(0, (remainingByLabel.get(tile.label) ?? 0) - 1));
  }

  return [...remainingByLabel.entries()]
    .filter(([, count]) => count > 0)
    .map(([label, count]) => ({
      label,
      displayLabel: label === "BLANK" ? "BL" : label,
      count
    }));
}
