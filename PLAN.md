# D-M4TH UI Plan

## Current State

The match UI is now built around the **Monochrome + Player Accent** direction:

- Dark monochrome base for app background, panels, board cells, rack container, log panel, dialogs, and secondary actions.
- Player colors are the only strong accents.
- Active player color drives active player card border, turn timer value, PLAY button, selected rack tile, and pending board tile border.
- Rack tiles and placed board tiles use off-white faces with dark text.
- Bonus cells use muted colors: `2P #8A5A38`, `3P #3E7774`, `2E #8A7A3A`, `3E #80394D`.
- React owns match HUD, rack, actions, log, dialogs, and lobby UI. PixiJS 8 owns board canvas rendering only.

## Completed Work

- Match screen refactored away from sidebar/floating-log layout into top player bar, board/log main area, and bottom rack/action strip.
- Added `MatchTopBar` for compact player cards, centered turn timer, and neutral tiles-left card.
- Added `MatchLogPanel` with `Hide/Show` collapse and `View All` full log dialog.
- Removed gameplay brand card from the match HUD.
- Removed accepted-action notice banners during gameplay; actions are recorded in the log instead.
- Added `lucide-react` icons for HUD, log, and action controls.
- Added responsive board sizing with CSS/ResizeObserver budgeting and PixiJS 8 resize handling.
- Optimized PixiJS 8 rendering with object pooling for tiles and text, significantly reducing GC pressure.
- Decoupled PixiJS 8 lifecycle from React by extracting `BoardGame` and `BoardScene` classes.
- Fixed PixiJS 8 board lifecycle so resize changes do not leave the board stuck on `Loading board`.
- Capped rack tile size so rack tiles stay readable without overpowering the board.

## Remaining UI Work

- Implement explicit intentional-leave flow: client sends `room:leave`, clears only that room's reconnect token, and closes intentionally.
- Keep server state authoritative for leave/forfeit: intentional leave can end a match when fewer than two active players remain; accidental disconnect must still allow reconnect.
- Refactor gameplay notices into compact non-blocking toasts that avoid the board, rack, and action controls.
- Run browser QA after every gameplay layout/theme change at desktop, laptop, tablet, and mobile sizes.
- Tune board/rack/action/log proportions using Chrome screenshots, not only CSS inspection.
- Decide final phone rack behavior: keep 8-wide with horizontal scroll or wrap to 4x2.
- Tune log collapsed placement on narrow screens after live mobile review.
- Improve active-player and turn-change affordance without adding glow or animation noise.
- Keep premium cell labels readable while staying muted behind player colors.

## Testing Expectations

For web UI/style changes:

```bash
cd apps/web && rtk bun run typecheck
cd apps/web && rtk bun run build
rtk bun test apps/web/src/ui/tile-display.test.ts apps/web/src/board/board-interaction.test.ts apps/web/src/turn/turn-controls.test.ts
```

For browser validation:

- Check wide desktop around `1920x1080`.
- Check laptop around `1366x768` or similar short-height view.
- Check tablet portrait/landscape.
- Check phone portrait around `390x844`.
- Confirm board renders after resizing and does not remain on `Loading board`.
- Confirm rack tiles do not visually dominate the board.
- Confirm accepted gameplay actions appear in log, not as in-play notice banners.

## Guardrails

- Do not put non-board UI into PixiJS 8.
- Do not make the client authoritative.
- Do not reintroduce neon glow, heavy gradients, decorative shadows, rounded card styling, or tile shadows.
- Do not dump layout or style work into `App.tsx` or `styles.css`; keep focused React components and split CSS files.
