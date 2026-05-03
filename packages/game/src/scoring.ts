import { BINGO_BONUS } from "@d-m4th/config";
import { getBoardCell } from "./board-layout";
import { validateEquation } from "./equation-parser";
import type { BoardCell, BoardTile, LineScoreBreakdown, ScoreBreakdown } from "./types";

export function scoreLine(params: {
  layout: readonly BoardCell[];
  line: readonly BoardTile[];
  placedTileIds: ReadonlySet<string>;
}): LineScoreBreakdown {
  const { layout, line, placedTileIds } = params;
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

  return {
    baseScore,
    equationMultiplier,
    totalScore: baseScore * equationMultiplier,
    expression: equation.expression
  };
}

export function createScoreBreakdown(params: {
  primaryLineScore: LineScoreBreakdown;
  lineScores: readonly LineScoreBreakdown[];
  placedTileCount: number;
  rackSize: number;
}): ScoreBreakdown {
  const { primaryLineScore, lineScores, placedTileCount, rackSize } = params;
  const bingoBonus = placedTileCount === rackSize ? BINGO_BONUS : 0;
  const lineTotal = lineScores.reduce((sum, lineScore) => sum + lineScore.totalScore, 0);

  return {
    baseScore: primaryLineScore.baseScore,
    equationMultiplier: primaryLineScore.equationMultiplier,
    bingoBonus,
    totalScore: lineTotal + bingoBonus,
    expression: primaryLineScore.expression,
    lines: [...lineScores]
  };
}
