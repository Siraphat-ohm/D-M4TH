# Gameplay Loop

Players take turns building valid mathematical equations on a shared board.

## Turn Options

During a turn, a player chooses one action:

- Play: submit a valid equation placement.
- Swap: exchange 1 to 8 rack tiles with the bag, then skip the turn. Swap is unavailable when the bag has 5 or fewer tiles.
- Pass: skip the turn.

Party mode can add `Use Skill` as a fourth action.

## Draft To Submit

Draft placements are local until submitted.

1. Player selects rack tiles.
2. Player places draft tiles on board cells.
3. Client shows non-authoritative preview where possible.
4. Player submits `PLAY`.
5. Server validates protocol and calls the game engine.
6. Engine accepts or rejects the action.
7. Server broadcasts the authoritative snapshot/event.

## Feedback

Accepted gameplay actions go to the match log. Transient toasts are compact and non-blocking. Face selection remains modal because the player must choose a tile face before continuing.

## End Of Match

The engine ends the match when an endgame condition is met. The match screen remains visible for final state, winner/result notices, and log review.
