# Current UI Stabilization

This content was preserved from the former root UI plan.

## Current State

D-M4TH match UI follows the Monochrome + Player Accent direction.

- Dark monochrome base for app background, panels, board cells, rack container, log panel, dialogs, toasts, and secondary actions.
- Player colors are the only strong accents.
- React owns HUD, rack, action controls, dialogs, toast/log UI, lobby UI, and match shell.
- PixiJS 8 owns board canvas rendering only, including setup preview board.
- Game engine is the source of truth for scoring, turn order, penalties, player leave/forfeit state, and match end state.
- RoomRegistry is a transport/session adapter and should delegate game rules to GameEngine.
- Normal disconnect must preserve reconnect.
- Intentional `room:leave` is different from disconnect and may end a match if fewer than two active non-left players remain.
- Gameplay layout must fit HUD + board + rack + actions in one viewport on tablet/desktop.

## Current Stabilization Priority

1. Keep `apps/web` and root typecheck green.
2. Keep leave/reconnect regression tests green.
3. Continue visual polish only after stabilization checks pass.
4. Use browser screenshots for future toast/log placement changes.

Do not add new UI features while typecheck is red unless the task directly fixes the failing files.

## P0 Stabilization

- Keep `cd apps/web && rtk bun run typecheck` passing after web changes.
- Keep `cd apps/web && rtk bun run build` passing after UI/style changes.
- Keep `rtk bun test` passing after engine/rules/server changes.
- If leave/reconnect changes continue, add server coverage for three-player `room:leave` continuing with two active non-left players.

## P1 Match End And Penalty Feedback

- Polish match-ended UI copy for `endedReason = "player-left"`.
- Display clear ended text such as `Match ended` and `Player left`.
- Do not fake winner logic in React.
- Prefer server/protocol event or snapshot field for timeout penalties instead of UI score-diff guessing.
- Keep penalty delta near player score, not as a modal.

## P1 Toast And Log Polish

- Tune toast placement from screenshots on desktop, laptop, tablet portrait, tablet landscape, phone portrait, and phone landscape.
- Toasts must not cover board, rack, `PLAY`, `SWAP`, `PASS`, or `RECALL`.
- Phone landscape toasts should stay inside the side/HUD area.
- Mobile portrait toasts should avoid covering rack/actions.
- Keep log user-opened and non-disruptive.
- Keep face selection modal.

## P2 UI Polish

- Decide final phone rack behavior: 8-wide horizontal scroll or 4x2 wrap.
- Improve active-player and turn-change affordance without glow or noisy animation.
- Keep premium cell labels readable while muted.
- Keep HUD compact and aligned.
- Keep board dominant without hiding rack/actions.

## P2 Code Health

- Keep `useTurnController` as orchestration over focused helpers.
- Future split candidate if it grows again: `useDraftPlacement`.
- Avoid dumping layout/state logic into `App.tsx`.
- Keep HUD components focused: `MatchTopBar`, `PlayerInfoList`, `NoticeToast`, `MatchLayout`.
- Keep CSS in focused files under `apps/web/src/styles/`.

## Validation Expectations

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

Browser validation should cover desktop `1920x1080`, laptop `1366x768`, tablet landscape `1366x1024`, tablet portrait, phone portrait `390x844`, and phone landscape `800x360`.
