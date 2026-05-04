# Endgame And Results

## Ended Match Behavior

When the engine ends a match, the match screen should remain visible with clear final-state messaging.

Useful copy includes:

- `Match ended`
- `Player left`
- result/winner copy when winner metadata is present

## Engine Authority

Winner, ended reason, player-left state, timeout, and final score must come from authoritative engine/server state.

React must not invent winner logic.

## Player Leave

Intentional leave returns the leaving player to lobby and clears only the current room reconnect token. Remaining players receive final state if the match ends.

Normal disconnect must preserve reconnect and must not be displayed as an intentional leave.

## Penalties

Timeout penalty feedback should display near the player score. Prefer server/protocol penalty events or snapshot metadata over UI score-diff guessing.
