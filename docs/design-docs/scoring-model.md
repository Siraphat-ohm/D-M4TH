# Scoring Model

The game engine owns scoring. The client may preview score, but preview state is not authoritative.

## Equation Score

Base score comes from tile values. Piece multipliers apply to individual tiles first. Equation multipliers then apply to the total equation score.

Scoring uses one contiguous equation direction, horizontal or vertical, not cross scoring.

## Bingo Bonus

Playing all 8 rack tiles in one turn grants a 40 point bonus.

## Timeout Penalty

Exceeding the 3-minute turn limit applies a 10 point penalty.

Penalty feedback should be shown near the player score. UI must not double-apply penalty by guessing score differences.

## Premium Cells

Classical bonus cell colors:

- `2P`: `#8A5A38`
- `3P`: `#3E7774`
- `2E`: `#8A7A3A`
- `3E`: `#80394D`

Premium labels should remain readable but muted behind player and tile state.
