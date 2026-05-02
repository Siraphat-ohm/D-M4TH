@/home/simon/.codex/RTK.md

--- project-doc ---

# D-M4TH Codex Instructions

## Project

D-M4TH is a multiplayer math equation board game, Scrabble-like, using:

- Bun monorepo
- `apps/server`: Bun WebSocket server
- `apps/web`: React 19 + Vite client
- PixiJS 8 for board canvas only, including setup preview board
- `packages/game`: pure TypeScript game engine
- `packages/protocol`: shared message types
- `packages/config`: match config presets
- `packages/db`: reconnect/session persistence where applicable

Use `PLAN.md` as the current UI/gameplay audit and phase reference.

## Hard Architecture Rules

### Game Engine

- `packages/game` must stay pure TypeScript.
- No I/O, DOM, React, PixiJS, database, WebSocket, or server dependency in `packages/game`.
- Game engine is the source of truth for:
  - scoring
  - turn order
  - rack/draft legality
  - penalty rules
  - leave/forfeit state
  - match end state
- Client must never compute authoritative game state.
- Use `seedrandom` through the repo shuffle utility in `utils.ts` for deterministic randomization.
- Player start order is randomized at match start using the match ID as seed.

### Server / Protocol

- Server is a thin adapter:
  - validate protocol
  - call game engine
  - manage sessions/connections
  - broadcast snapshots/events
- `RoomRegistry` is transport/session glue, not the owner of game rules.
- Delegate match rules to `GameEngine`.
- Normal disconnect must preserve reconnect.
- Intentional `room:leave` is different from disconnect.
- Intentional leave may end a match when fewer than two active non-left players remain.
- Reconnect token parsing, validation, rotation, and revoke behavior must stay centralized server-side in reconnect/session services.
- Do not duplicate reconnect token logic across modules.

### Client / UI

- React owns:
  - lobby UI
  - match HUD
  - player info
  - rack
  - action controls
  - dialogs
  - toasts
  - logs
  - match shell layout
- PixiJS owns board canvas rendering only.
- Do not put non-board UI in PixiJS.
- Setup/lobby board preview is display-only and must not create game state.
- Draft placements are client-side and managed by `useTurnController` wrapping `DraftManager`.
- Keep UI split into focused components.
- Do not dump new UI into `App.tsx`.
- Keep CSS split under `apps/web/src/styles/`.
- Do not dump new styles into `styles.css`.

## Commands

Use Bun through RTK.

Common commands:

```bash
rtk bun test
rtk bun run typecheck
rtk bun run build
rtk bun run dev
rtk bun run dev:web
```

For web-only changes:

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

## Testing Expectations

- Add or update Bun tests when changing `packages/game` behavior.
- Add or update focused web tests when changing UI helpers or turn controls.
- Run `rtk bun test` after engine/rules changes.
- Run `rtk bun run typecheck` after protocol/server/game shared changes.
- Run `cd apps/web && rtk bun run typecheck` after web TypeScript changes.
- Run `cd apps/web && rtk bun run build` after web UI/style changes.
- Avoid broad rewrites unless explicitly requested.

For browser/UI validation, check:

- desktop around `1920x1080`
- laptop around `1366x768`
- tablet landscape around `1366x1024`
- tablet portrait
- phone portrait around `390x844`
- phone landscape around `800x360`

Confirm:

- HUD visible
- board visible
- rack visible
- action buttons visible
- no vertical page scroll during normal tablet/desktop gameplay
- board renders after resize and does not stay on `Loading board`
- toast/log UI does not cover board/rack/actions

## Implementation Rules

- Prefer standard library and existing repo utilities first.
- Add third-party dependencies only when standard/current helpers cannot solve the problem cleanly.
- If behavior, compatibility, or security is uncertain, verify with official docs or trusted sources before implementing.
- When logic is reused across modules, extract and centralize it instead of duplicating code paths.
- Keep changes focused to the requested task.
- Do not refactor unrelated systems during feature work.
- Remove dead imports, dead CSS, and obsolete comments after replacing behavior.
- Keep comments short and useful.
- Do not add debug `console.log` unless temporary, and remove before final.
- Do not add UI features while typecheck is red unless directly fixing the failing files.

## Current Stabilization Priority

Before adding new gameplay UI features:

1. Fix remaining TypeScript errors in:
   - `apps/web/src/board/board-interaction.ts`
   - `apps/web/src/board/board-renderer.ts`
2. Make `cd apps/web && rtk bun run typecheck` pass cleanly.
3. Add regression tests for intentional leave vs normal disconnect.
4. Verify toast/log placement from browser screenshots.
5. Continue visual polish only after stabilization.

## Current UI Direction

Match gameplay UI uses the **Monochrome + Player Accent** direction.

### Visual Decisions

- No rounded UI.
- No glow.
- No decorative shadows.
- No tile shadows.
- No CRT/casino/neon styling.
- Dark monochrome surfaces are the default:
  - background
  - panels
  - empty board cells
  - log panel
  - rack container
  - dialogs
  - toasts
  - secondary buttons
- Player colors are the only strong accents.
- Player palette:
  - `#EF476F`
  - `#8B5CF6`
  - `#06D6A0`
  - `#FFD166`
  - `#118AB2`
  - `#F97316`
- Bonus cell colors:
  - `2P #8A5A38`
  - `3P #3E7774`
  - `2E #8A7A3A`
  - `3E #80394D`
- Rack tiles and placed board tiles use off-white faces with dark text.

### Typography Identity

- `Silkscreen`:
  - board identity
  - tiles
  - premium cells
  - stars
  - headers
  - primary buttons
- `IBM Plex Mono`:
  - base UI
  - logs
  - inputs
  - standard buttons

### Active Player Accent

Active player color should drive:

- active player card border
- active player card tint
- turn timer accent/value
- enabled primary action button when current player can act
- selected rack tile
- pending board tile border
- relevant score preview/penalty delta accent

Disabled actions must not use bright saturated active-player styling.

Active state must not rely on color only. Use text such as `PLAYING` and turn text such as `OHM'S TURN`.

## Layout Rules

Gameplay uses a fixed-height `100dvh` shell.

The play surface should preserve these rows:

1. top HUD
2. flexible board slot
3. final rack/action control strip

Rules:

- Board must size from the actual `.match-main` / `.board-stage` slot.
- Board must not push rack/action controls out of view.
- Tablet landscape should reduce HUD/rack/gap sizing before the board can hide controls.
- Short phone landscape uses compact two-column layout:
  - board on the left
  - compressed HUD/rack/actions on the right
- Avoid vertical scrolling during normal gameplay.
- Do not solve overflow by hiding gameplay controls.
- Do not use whole-page `transform: scale()`.
- Do not use negative margins to fake layout.
- Do not absolutely position the board just to fake fit.

## Board / PixiJS Rules

- PixiJS 8 renders board canvas only.
- React owns board host sizing.
- Pixi receives exact board pixel size.
- Board rendering should not own HUD, rack, buttons, dialogs, logs, or toasts.
- Resize must not leave board stuck on `Loading board`.
- Preview board is display-only.
- Keep premium cell labels readable but muted.
- Keep rack tiles readable without overpowering board.
- Avoid Pixi lifecycle changes unless the task is specifically about rendering/sizing.

## Rack / Turn Rules

- Rack stays 8 slots with empty placeholders.
- Draft board tiles return to rack on double click / double tap.
- Preview score highlights on active player score, not in action bar.
- Timeout penalty feedback should display near the player score.
- Do not double-apply penalty in UI.
- Prefer server/protocol penalty events or snapshot metadata over UI score-diff guessing when available.
- Game engine remains source of truth for penalty scoring.

## Leave / Reconnect Rules

- Intentional leave must use explicit protocol message, currently `room:leave`.
- Closing WebSocket alone is ambiguous and should not be treated as leave.
- Normal disconnect:
  - mark player disconnected
  - preserve reconnect
  - do not end match immediately
- Intentional leave:
  - mark player left/forfeited through game engine
  - revoke reconnect binding where available
  - clear only the current room reconnect token on client
  - close ProtocolClient intentionally
  - reset local match state
  - return to lobby
- If intentional leave leaves fewer than two active non-left players, the match should end.
- Do not break refresh/reconnect behavior for accidental disconnects.
- Do not duplicate reconnect token parsing/rotation logic in UI or RoomRegistry.

## Notification / Dialog Rules

Separate these concepts:

- Face selection dialog:
  - modal
  - blocking is okay
  - requires a decision
- Match log:
  - user-opened
  - history panel/dialog
  - should not appear as a forced gameplay notice
- Toast/notice:
  - transient
  - compact
  - non-blocking
  - must avoid board/rack/action controls

Toast rules:

- Toast stack container may use `pointer-events: none`.
- Toast cards may use `pointer-events: auto` only when they contain close/action controls.
- Do not cover `PLAY`, `SWAP`, `PASS`, `RECALL`, rack tiles, or the board.
- Desktop/tablet toasts should sit in a HUD-safe/top-right or similar non-critical area.
- Phone landscape toasts should stay in the side/HUD area.
- Mobile portrait toasts should avoid rack/actions.
- Use `aria-live` appropriately.
- Do not use browser `alert()` or `confirm()`.

## Component Boundaries

Preferred focused components:

- `App`
  - orchestration only
  - no large UI dumping ground
- `MatchLayout`
  - match shell and layout composition
- `MatchTopBar`
  - player strip, turn card, bag/leave HUD controls
- `PlayerInfoList`
  - player cards and score/penalty deltas
- `NoticeToast`
  - non-blocking toast UI
- `Dialogs`
  - modal interactions such as face selection
- `useTurnController`
  - turn orchestration over DraftManager

If `useTurnController` grows too large, future split candidates are:

- `useDraftPlacement`
- `useRackOrder`
- `useSwapMode`
- `useScorePreview`

Do not perform that refactor during unrelated UI/layout tasks.

## Guardrails

### Architecture Guardrails

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

### Visual Guardrails

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

### Layout Guardrails

- Gameplay must fit HUD + board + rack + actions together.
- Do not solve overflow by hiding gameplay controls.
- Do not hide rack/action controls.
- Do not hide top HUD.
- Do not use `transform: scale()` on the whole app.
- Do not use negative margins to fake fitting.
- Do not position the board absolutely just to fake layout.
- Avoid vertical scrolling during normal gameplay on tablet/desktop.
- Phone landscape may use a compact layout, but controls must remain accessible.

### Code Organization Guardrails

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

## Skill Maintenance Notes

If Codex reports skipped project skills, fix those before relying on the skill.

Known issue pattern:

- `SKILL.md` description exceeds max length.

Fix by shortening the YAML/frontmatter `description` field to under the tool limit.
Keep long guidance in the body, not in the description.

Example:

```md
---
name: pixijs-application
description: Use for PixiJS app lifecycle, canvas sizing, renderer resize, stage/container rendering, texture cleanup, and React integration bugs in D-M4TH.
---
```
