# Match Screen

## Purpose

The match screen keeps board, player state, rack, and actions visible during normal play.

## Layout

Gameplay uses a fixed-height `100dvh` shell with these rows:

1. top HUD
2. flexible board slot
3. final rack/action control strip

Tablet and desktop gameplay should avoid vertical page scroll. Phone landscape may use a compact two-column layout with board on the left and compressed HUD/rack/actions on the right.

## HUD

- Compact top match bar shows player cards, score, mini timer, bag count, and leave control.
- Active player is shown through active border, subtle tint, `PLAYING` badge, and turn text such as `OHM'S TURN`.
- Turn timer value uses active player accent.
- Tiles-left display remains neutral.

## Board

PixiJS renders board canvas only. Board size comes from the actual board host slot.

Board must render after resize and must not remain on `Loading board`.

## Notices And Logs

- Accepted gameplay actions go to match log.
- Toasts are compact, transient, and non-blocking.
- Toasts must not cover board, rack, or action controls.
- Match log is user-opened history.
- Face selection is modal because it requires a decision.
