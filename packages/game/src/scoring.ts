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
  const baseScore = line.reduce((score, tile) => {
    const cell = getBoardCell(layout, tile);
    const pieceMultiplier = placedTileIds.has(tile.id) ? (cell.pieceMultiplier ?? 1) : 1;
    return score + tile.value * pieceMultiplier;
  }, 0);
  const equationMultiplier = line.reduce((multiplier, tile) => {
    if (!placedTileIds.has(tile.id)) {
      return multiplier;
    }

    const cell = getBoardCell(layout, tile);
    return multiplier * (cell.equationMultiplier ?? 1);
  }, 1);
  const bingoBonus = placedTileIds.size === rackSize ? BINGO_BONUS : 0;

  return {
    baseScore,
    equationMultiplier,
    bingoBonus,
    totalScore: baseScore * equationMultiplier + bingoBonus,
    expression: equation.expression
  };
}
