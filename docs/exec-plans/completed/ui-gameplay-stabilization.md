# UI Gameplay Stabilization Summary

This summary was preserved from root `PLAN.md`.

## Match UI Direction

- Refactored match screen into compact top HUD/player bar, flexible board area, and bottom rack/action strip.
- Added compact match HUD with player cards, turn timer, bag count, and leave button.
- Active player is shown through active border, subtle tinted card, `PLAYING` badge, and turn timer text.
- Preview score highlights on active player score, not in the action bar.

## Board And Responsive Layout

- React owns square board host sizing.
- PixiJS 8 receives exact board pixels and renders only the board.
- Board sizing is constrained by real board slot height so rack/actions remain visible.
- Resize changes no longer leave the board stuck on `Loading board`.
- Short phone landscape uses compact two-column layout.

## Leave, Reconnect, And Match End

- Added explicit intentional leave protocol via `room:leave`.
- Client leave flow sends leave when possible, closes intentionally, clears current room reconnect token, clears local match state, returns to lobby, and avoids immediate reconnect.
- Server handles intentional leave separately from normal disconnect.
- Game engine owns leave/forfeit behavior through `leaveMatch()`.
- Normal accidental disconnect still preserves reconnect.

## Notifications And Logs

- Added compact non-blocking gameplay toasts.
- Accepted gameplay actions go to match log instead of forced in-play banners.
- Face selection remains modal.
- Match log remains user-opened.

## Stabilization Work

- Added focused Playwright E2E coverage for board rendering, waiting-player rack planning, gameplay interaction, and timeout penalties.
- Added leave/disconnect regression coverage for intentional leave, normal disconnect, three-player leave continuation, turn skipping, and stalemate active-player counting.
- Split turn-controller support code into focused helpers.
- Extracted leave-match flow and penalty-delta display logic from larger UI components.
- Organized web CSS into focused feature folders.
- Implemented owner-approved endgame rules for rack-empty, exhausted-bag pass cycle, winners in snapshots, and overtime penalties.
