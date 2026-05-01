import { BINGO_BONUS } from "@d-m4th/config";
import { getBoardCell } from "./board-layout";
import { validateEquation } from "./equation-parser";
import type { BoardCell, BoardTile, ScoreBreakdown } from "./types";

export function scoreLine(params: {
  layout: readonly BoardCell[];
  line: readonly BoardTile[];
  placedTileIds: ReadonlySet<string>;
  rackSize: number;
}): ScoreBreakdown {
  const { layout, line, placedTileIds, rackSize } = params;
  const equation = validateEquation(line);

  let baseScore = 0;
  let equationMultiplier = 1;

  for (const tile of line) {
    const isNewPlacement = placedTileIds.has(tile.id);
    const cell = getBoardCell(layout, tile);

    const pieceMultiplier = isNewPlacement ? (cell.pieceMultiplier ?? 1) : 1;
    baseScore += tile.value * pieceMultiplier;

    if (isNewPlacement) {
      equationMultiplier *= cell.equationMultiplier ?? 1;
    }
  }

  const bingoBonus = placedTileIds.size === rackSize ? BINGO_BONUS : 0;

  return {
    baseScore,
    equationMultiplier,
    bingoBonus,
    totalScore: baseScore * equationMultiplier + bingoBonus,
    expression: equation.expression
  };
}
