# D-M4TH UI Plan

## Current State

D-M4TH match UI follows the **Monochrome + Player Accent** direction.

Core visual rules:

- Dark monochrome base for app background, panels, board cells, rack container, log panel, dialogs, toasts, and secondary actions.
- Player colors are the only strong accents.
- Active player color drives:
  - active player card border
  - active player card tint
  - turn timer value/accent
  - enabled primary action button
  - selected rack tile
  - pending board tile border
- Rack tiles and placed board tiles use off-white faces with dark text.
- Bonus cells use muted colors:
  - `2P #8A5A38`
  - `3P #3E7774`
  - `2E #8A7A3A`
  - `3E #80394D`
- React owns HUD, rack, action controls, dialogs, toast/log UI, lobby UI, and match shell.
- PixiJS 8 owns board canvas rendering only, including setup preview board.
- Game engine is the source of truth for scoring, turn order, penalty, player leave/forfeit state, and match end state.
- RoomRegistry is a transport/session adapter and should delegate game rules to GameEngine.
- Normal disconnect must preserve reconnect.
- Intentional `room:leave` is different from disconnect and may end a match if fewer than two active non-left players remain.
- Gameplay layout must fit HUD + board + rack + actions in one viewport on tablet/desktop.
- Avoid vertical scrolling during normal gameplay.

## Completed Work

### Match UI Direction

- Refactored match screen away from sidebar/floating-log layout into:
  - compact top HUD/player bar
  - flexible board area
  - bottom rack/action strip
- Added compact match HUD with player cards, turn timer, bag count, and leave button.
- Removed gameplay brand card from match HUD.
- Removed redundant waiting text from the action area.
- Removed `▶` active-player marker.
- Active player is now shown through:
  - active border
  - subtle tinted card
  - `PLAYING` badge
  - turn timer text
- Turn timer includes active player context, for example `OHM'S TURN`.
- Preview score highlights on active player score, not in the action bar.
- Penalty delta can be shown near player score.

### Board / PixiJS

- React owns the square board host.
- PixiJS 8 receives exact board pixels and renders only the board.
- Added responsive board sizing with CSS/ResizeObserver budgeting.
- Board sizing is constrained by the real board slot height so rack/actions remain visible.
- Fixed PixiJS board lifecycle so resize changes do not leave the board stuck on `Loading board`.
- Optimized PixiJS rendering with pooling for tiles/text.
- Setup/lobby preview board is display-only and must not create game state.
- Rack tile size is capped so rack tiles stay readable without overpowering the board.

### Responsive Layout

- Gameplay uses a fixed-height `100dvh` shell.
- `play-surface` uses rows:
  - top HUD
  - flexible board slot
  - final control strip
- `.match-main` is the board area only.
- `.control-strip` stays visible as the final row.
- Tablet landscape reduces HUD/rack/gap sizing before the board can push controls out of view.
- Short phone landscape uses compact two-column layout:
  - board on the left
  - compressed HUD/rack/actions on the right
- Verified no normal gameplay scroll at:
  - `1366x1024`
  - `1366x768`
  - `384x824`
  - `800x360`

### Leave / Reconnect / Match End

- Added explicit intentional leave protocol via `room:leave`.
- Client leave flow:
  - sends `room:leave` when possible
  - closes ProtocolClient intentionally
  - clears only the current room reconnect token
  - clears local match state
  - returns to lobby
  - avoids immediate reconnect
- Server handles intentional leave separately from normal disconnect.
- Game engine owns leave/forfeit behavior through `leaveMatch()`.
- Left players are skipped for turn advancement.
- Match ends with `endedReason = "player-left"` when fewer than two active non-left players remain.
- Normal accidental disconnect still preserves reconnect behavior.
- Intentional leave revokes reconnect binding where available.
- Refresh after Leave does not re-enter the same room.
- Refresh/network disconnect without pressing Leave still resumes normally.

### Notifications / Logs / Dialogs

- Added compact non-blocking gameplay toasts.
- Toast stack uses `pointer-events: none`; toast cards can use `pointer-events: auto` only where needed.
- Toasts avoid board, rack, and action controls.
- Gameplay accepted-action notices do not render as in-play banners.
- Accepted actions go to the match log instead.
- Face selection remains modal because it requires a player decision.
- Match log remains user-opened.
- Log panel and toast behavior are separate concepts.

### Stabilization / Refactor Pass

- Added Playwright E2E coverage in `apps/web/src/__tests__/*.e2e.ts`, strictly targeted via `testMatch` to avoid Bun test collision.
- Covered board rendering (preview/match/resize), waiting-player rack planning, gameplay interaction, and timeout penalties.
- Fixed web board typecheck by restoring `board-interaction.ts` game type imports.
- Added leave/disconnect regression coverage for:
  - two-player intentional leave ending the match
  - normal disconnect preserving reconnect and not marking left
  - three-player leave continuing with two active non-left players
  - left-player turn skipping
  - active-player leave advancing to the next original turn player
  - stalemate counting only active non-left players
- Fixed ended matches so `currentPlayerId` does not point at a left player.
- Reset Pixi board render cache after app recreation so destroyed objects are not reused after resize/DPR changes.
- Split turn-controller support code into focused rack-order, swap-mode, score-preview, turn-action, and type modules.
- Extracted leave-match flow and penalty-delta display logic out of large UI components.
- Moved player connection state mutation behind `GameEngine.setPlayerConnected()`.
- Moved cross-layer web state types and room-code normalization into neutral `apps/web/src/shared/*` ownership so app/client no longer depend on `ui/shared` or `app-store` for those type/helper seams.
- Made `MatchLayout` store-free by lifting its log/store reads to `App`, and tightened `use-protocol-orchestrator` away from avoidable `any` in its private-state and ghost-placement inputs.
- Verified `apps/web` typecheck, web build, root typecheck, root tests, and browser smoke at desktop/laptop/tablet/phone sizes.
- Organized web CSS into feature folders (components, lobby, match, board) and split large monolithic CSS files.
- Fully split the old `layout.css` into `styles/layout/app-shell.css`, `lobby-layout.css`, `match-layout.css`, and `match-responsive.css`, then moved the leftover shared alignment rules into the owning feature styles so the compatibility `layout.css` could be removed.
- Implemented owner-approved endgame rules: `rack-empty`, exhausted-bag pass-cycle by active non-left players, `winnerIds` in authoritative snapshots, and per-started-minute overtime penalties applied by the game engine while keeping the match screen visible for final-state winner notices.

## Current Stabilization Priority

Before adding new gameplay UI features:

1. Keep `apps/web` and root typecheck green.
2. Keep leave/reconnect regression tests green.
3. Continue visual polish only after stabilization checks pass.
4. Use browser screenshots for any future toast/log placement changes.

Do not add new UI features while typecheck is red unless the task directly fixes the failing files.

## Remaining UI / Gameplay Work

### P0: Stabilization

- Keep `cd apps/web && rtk bun run typecheck` passing after web changes.
- Keep `cd apps/web && rtk bun run build` passing after UI/style changes.
- Keep `rtk bun test` passing after engine/rules/server changes.
- If leave/reconnect changes continue, add server coverage for three-player `room:leave` continuing with two active non-left players.

### P1: Match End / Penalty Feedback

- Add or polish match-ended UI copy for `endedReason = "player-left"`.
- Display clear ended text such as:
  - `Match ended`
  - `Player left`
  - remaining player result if winner support is added later
- Consider adding `winnerId` or result metadata only if the game model needs it.
- Do not fake winner logic only in React.
- Add server/protocol event or snapshot field for timeout penalties instead of relying only on UI score-diff guessing.
- Preferred future penalty event:
  - `player:penalized`
  - `playerId`
  - `points`
  - `reason: "timeout"`
- Keep penalty delta near player score, not as a modal.
- Avoid double-applying penalty in UI.

### P1: Toast / Log Polish

- Tune toast placement from screenshots on:
  - desktop
  - laptop
  - tablet portrait
  - tablet landscape
  - phone portrait
  - phone landscape
- Toasts must not cover:
  - board
  - rack
  - `PLAY`
  - `SWAP`
  - `PASS`
  - `RECALL`
- Phone landscape toasts should stay inside the side/HUD area.
- Mobile portrait toasts should avoid covering rack/actions.
- Tune log collapsed placement on narrow screens after live mobile review.
- Known issue: user-opened match log can overlay gameplay at `800x360` phone landscape; keep it user-opened and non-forced, but tune placement if future screenshots show it blocking critical controls.
- Keep log user-opened and non-disruptive.
- Keep face selection modal.

### P2: UI Polish

- Decide final phone rack behavior:
  - keep 8-wide with horizontal scroll
  - or wrap to 4x2
- Improve active-player and turn-change affordance without adding glow or animation noise.
- Keep premium cell labels readable while staying muted behind player colors.
- Keep HUD compact and aligned.
- Avoid stacking player cards or timer cards in a way that increases topbar height.
- Keep board dominant but never at the cost of hiding rack/actions.
- Tune board/rack/action/log proportions using Chrome screenshots, not only CSS inspection.

### P2: Code Health

- Keep `useTurnController` as the orchestration hook over focused helpers.
- Future split candidate if it grows again:
  - `useDraftPlacement`
- Do not refactor turn code during unrelated UI tasks.
- Avoid dumping layout/state logic into `App.tsx`.
- Keep HUD components focused:
  - `MatchTopBar`
  - `PlayerInfoList`
  - `NoticeToast`
  - `MatchLayout`
- Keep CSS in focused files under `apps/web/src/styles/`.

## Testing Expectations

For web UI/style changes:

```bash
cd apps/web && rtk bun run typecheck
cd apps/web && rtk bun run build
rtk bun test apps/web/src/ui/tile-display.test.ts apps/web/src/board/board-interaction.test.ts apps/web/src/turn/turn-controls.test.ts
```

For engine/rules/protocol/server changes:

```bash
rtk bun run typecheck
rtk bun test
```

For leave/reconnect changes, test at minimum:

- Two-player match:
  - Player A intentionally leaves
  - Player A returns to lobby
  - Player A does not reconnect on refresh
  - Player B receives ended/final state
- Normal disconnect:
  - Player A refreshes or loses network without pressing Leave
  - match does not end
  - reconnect still resumes
- Three-player match:
  - one player leaves
  - match continues if two active non-left players remain
  - match ends when only one active non-left player remains

For browser validation:

- Wide desktop around `1920x1080`
- Laptop around `1366x768`
- Tablet landscape around `1366x1024`
- Tablet portrait
- Phone portrait around `390x844`
- Phone landscape around `800x360`

Confirm:

- Board renders after resizing and does not remain on `Loading board`.
- HUD is visible.
- Board is fully visible.
- Rack is visible.
- Action buttons are visible.
- No vertical page scroll during normal tablet/desktop gameplay.
- Rack tiles do not visually dominate the board.
- Accepted gameplay actions appear in log, not in-play notice banners.
- Toasts do not cover board/rack/actions.
- Face selection remains modal and keyboard usable.

## Guardrails

### Architecture

- Do not put non-board UI into PixiJS 8.
- Do not make the client authoritative.
- Do not compute scoring, winner, leave/forfeit rules, or turn order in React.
- Do not put server/session logic into `packages/game`.
- Do not add DOM, React, PixiJS, server, database, or WebSocket dependencies to `packages/game`.
- Keep `packages/game` pure TypeScript.
- Keep `RoomRegistry` as adapter/session glue.
- Delegate game rules to `GameEngine`.
- Normal disconnect must not equal intentional leave.
- Intentional leave must not break accidental reconnect.

### Visual Style

- Do not reintroduce:
  - neon glow
  - heavy gradients
  - decorative shadows
  - rounded card styling
  - tile shadows
  - CRT effects
  - casino styling
- Player colors are strong accents.
- Everything else stays dark monochrome or muted.
- Primary button accent should match active player only when the current player can act.
- Disabled actions must look muted and non-clickable.
- Active state must not rely on color only.

### Layout

- Gameplay must fit HUD + board + rack + actions together.
- Do not solve overflow by hiding gameplay controls.
- Do not hide rack/action controls.
- Do not hide top HUD.
- Do not use `transform: scale()` on the whole app.
- Do not use negative margins to fake fitting.
- Do not position the board absolutely just to fake layout.
- Avoid vertical scrolling during normal gameplay on tablet/desktop.
- Phone landscape may use a compact layout, but controls must remain accessible.

### Code Organization

- Do not dump layout or style work into `App.tsx` or `styles.css`.
- Keep focused React components.
- Keep CSS split under `apps/web/src/styles/`.
- Avoid broad rewrites unless explicitly requested.
- Prefer replacing bad code over wrapping it in more layers.
- Remove dead CSS/comments when replacing behavior.
- Do not add new dependencies unless current tools cannot solve the problem cleanly.

## Recommended Next Task

Fix the remaining TypeScript errors in:

- `apps/web/src/board/board-interaction.ts`
- `apps/web/src/board/board-renderer.ts`

Task scope:

- Do not change gameplay behavior.
- Do not touch leave/reconnect/toast/HUD code.
- Run `cd apps/web && rtk bun run typecheck`.
- Report exact errors, files changed, why each fix is safe, and final result.
