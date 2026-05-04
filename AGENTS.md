# D-M4TH Agent Instructions

D-M4TH is a multiplayer math equation board game, Scrabble-like.

Use this file as the project routing guide. Keep work focused. Read detailed docs only when the task needs them.

## Project Map

- `apps/web`: React 19 + Vite client.
- `apps/server`: Bun WebSocket server.
- `packages/game`: pure TypeScript game engine.
- `packages/protocol`: shared client/server protocol types.
- `packages/config`: match config presets.
- `packages/db`: reconnect/session persistence where applicable.
- `deploy`: Docker, nginx, deployment config.
- `docs`: design, product, deployment, security, reliability references.

Important docs:

- UI/gameplay phase index: `docs/PLANS.md`
- Current execution plans: `docs/exec-plans/active/`
- Game rules: `docs/design-docs/game-rules.md`
- Gameplay loop: `docs/design-docs/gameplay-loop.md`
- Scoring: `docs/design-docs/scoring-model.md`
- Match screen spec: `docs/product-specs/match-screen.md`
- Deployment: `docs/product-specs/deployment.md`
- Security: `docs/SECURITY.md`
- Reliability: `docs/RELIABILITY.md`

## Token Discipline

Before reading files:

1. Use `rg`, `fd`, `ast-grep`, `git diff`, or graph queries first.
2. Identify the smallest relevant file set.
3. Do not read full files unless necessary.
4. Do not inspect unrelated folders.
5. Do not perform broad refactors unless explicitly requested.
6. Prefer targeted edits and focused tests.
7. Report only changed files, reason for each change, and validation result.

Useful commands:

```bash
rg "<text>"
fd "<name>"
ast-grep --pattern '<pattern>' --lang ts apps packages
git diff --stat
git diff
```

For long Codex sessions, use `/compact` before switching tasks.

## Hard Architecture Rules

### Game Engine

`packages/game` must stay pure TypeScript.

Do not add these dependencies to `packages/game`:

- DOM
- React
- PixiJS
- WebSocket
- database
- server runtime
- file/network I/O

The game engine is authoritative for:

- scoring
- turn order
- rack and draft legality
- penalty rules
- leave/forfeit state
- match end state
- winner/result state

Client UI must never compute authoritative game state.

Use existing repo utilities before adding new helpers. Deterministic randomization must go through the repo shuffle/random utility.

### Server and Protocol

The server is a thin adapter:

- validate protocol messages
- call game engine
- manage connections/sessions
- broadcast snapshots/events

`RoomRegistry` is transport/session glue. It must not own game rules.

Reconnect token parsing, validation, rotation, and revoke behavior must remain centralized server-side. Do not duplicate reconnect logic in UI or unrelated modules.

Normal disconnect is not intentional leave.

- Normal disconnect preserves reconnect.
- Intentional leave uses explicit protocol, currently `room:leave`.
- Intentional leave may end the match if fewer than two active non-left players remain.

### Client and UI

React owns:

- lobby UI
- match HUD
- player info
- rack
- action controls
- dialogs
- toasts
- logs
- match shell layout

PixiJS owns board canvas rendering only.

Do not put non-board UI in PixiJS.

Setup/lobby board preview is display-only and must not create game state.

Draft placements are client-side draft state, but all authoritative legality/scoring must come from the engine/server.

## UI Direction

Current gameplay UI direction: Monochrome + Player Accent.

Rules:

- No neon glow.
- No casino styling.
- No CRT effects.
- No decorative shadows.
- No rounded card styling.
- No tile shadows.
- Dark monochrome surfaces are the default.
- Player colors are the only strong accents.
- Active state must not rely on color only; include text such as `PLAYING` or active turn labels.

Fonts:

- `Silkscreen`: board identity, tiles, premium cells, headers, primary buttons.
- `IBM Plex Mono`: base UI, logs, inputs, standard buttons.

Do not reintroduce older visual directions unless explicitly requested.

## Layout Rules

Gameplay uses a fixed-height `100dvh` shell.

Required visible regions:

1. top HUD
2. board area
3. rack/action controls

Rules:

- Board must size from its real container slot.
- Board must not push rack/actions out of view.
- Do not hide rack/action controls to solve overflow.
- Do not hide top HUD.
- Do not use whole-page `transform: scale()`.
- Do not use negative margins to fake layout.
- Do not absolutely position the board just to fake fit.
- Avoid vertical scrolling during normal tablet/desktop gameplay.
- Phone landscape may use compact two-column layout, but controls must stay accessible.

## Code Organization

Do not dump new UI into:

- `apps/web/src/ui/App.tsx`
- global `styles.css`

Prefer focused components.

Expected boundaries:

- `App`: orchestration only.
- `MatchLayout`: match shell/layout composition.
- `MatchTopBar`: player strip, turn card, bag/leave HUD controls.
- `PlayerInfoList`: player cards and score/penalty deltas.
- `NoticeToast`: non-blocking toast UI.
- `Dialogs`: modal interactions.
- `useTurnController`: turn orchestration over `DraftManager`.

Keep CSS split under `apps/web/src/styles/`.

Remove dead imports, dead CSS, obsolete comments, and temporary debug code after replacing behavior.

## Game Rule Work

Before changing rules, read:

- `docs/design-docs/game-rules.md`
- `docs/design-docs/scoring-model.md`
- `docs/design-docs/gameplay-loop.md`

Rules:

- Enforce game rules in `packages/game`, not React.
- Game engine is the executable source of truth.
- Add or update focused Bun tests for rule behavior.
- Cover both preview and commit paths when relevant.
- Invalid commit tests must assert no mutation of board, rack, score, tile bag, match status, or turn state.
- Do not mix game-rule fixes with CSS, deployment, Pixi, or UI redesign work.
- Timeout, total-time, turn-time, and penalty behavior must be implemented in `packages/game`.
- UI must display timeout/penalty state from server/protocol snapshots or events.
- Do not infer, duplicate, or double-apply timeout penalties in React.
- Endgame rules: `docs/product-specs/endgame-and-results.md`

## Leave and Reconnect Work

Rules:

- Intentional leave must use explicit protocol message.
- Closing WebSocket alone is ambiguous and must not count as leave.
- Normal disconnect marks disconnected, preserves reconnect, and does not end match immediately.
- Intentional leave marks player left/forfeited through game engine.
- Intentional leave should revoke reconnect binding where available.
- Client should clear only the current room reconnect token.
- Do not break refresh/reconnect behavior for accidental disconnects.
- Add regression tests for intentional leave vs normal disconnect.

## Toast, Dialog, and Notice Work

Keep these separate:

- Face selection dialog: modal, blocking, requires decision.
- Match log: user-opened history panel/dialog.
- Toast/notice: transient, compact, non-blocking.

Toast rules:

- Do not cover board, rack, or action buttons.
- Do not cover `PLAY`, `SWAP`, `PASS`, `RECALL`.
- Desktop/tablet toasts should sit in HUD-safe or top-right safe area.
- Phone landscape toasts should stay in side/HUD area.
- Mobile portrait toasts should avoid rack/actions.
- Use `aria-live` appropriately.
- Do not use browser `alert()` or `confirm()`.

## Deployment and Security Work

Before deployment/security edits, inspect only relevant files first:

```bash
rg "ws://|wss://|proxy_set_header|add_header|workflow_dispatch|inputs.version" deploy docs .github
```

Rules:

- Production WebSocket docs should prefer `wss://`.
- Keep `ws://localhost` only for local development examples.
- Avoid interpolating untrusted GitHub context directly inside `run:` scripts.
- For nginx WebSocket proxying, restrict Upgrade/Connection behavior to WebSocket-only routes.
- Do not mix deployment/security fixes with gameplay/UI refactors.

## Commands

Use Bun through RTK when running project commands.

General:

```bash
rtk bun test
rtk bun run typecheck
rtk bun run build
rtk bun run dev
rtk bun run dev:web
```

Web-only changes:

```bash
cd apps/web && rtk bun run typecheck
cd apps/web && rtk bun run build
```

Engine/rules/protocol/server changes:

```bash
rtk bun run typecheck
rtk bun test
```

Search/security helpers:

```bash
ast-grep --pattern '<pattern>' --lang ts apps packages
semgrep --config auto .
```

Run only the smallest relevant validation first. Run broader validation when changing shared types, protocol, engine rules, or build config.

## Browser/UI Validation

For gameplay UI changes, check these sizes when practical:

- desktop: around `1920x1080`
- laptop: around `1366x768`
- tablet landscape: around `1366x1024`
- phone portrait: around `390x844`
- phone landscape: around `800x360`

Confirm:

- HUD visible
- board visible
- rack visible
- action buttons visible
- no normal tablet/desktop vertical gameplay scroll
- board renders after resize
- board does not stay on `Loading board`
- toast/log UI does not cover board/rack/actions

## Graphify

This project has graphify output in `graphify-out/`.

For architecture or cross-module questions:

1. Read `graphify-out/GRAPH_REPORT.md` first when present.
2. Prefer `graphify-out/wiki/index.md` when present.
3. For relationships, use graph queries before raw grep when practical.

Examples:

```bash
graphify query "<question>"
graphify path "<A>" "<B>"
graphify explain "<concept>"
```

After modifying code files in this session, run:

```bash
graphify update .
```

## Current Priority

Do not add new gameplay UI features before stabilization unless explicitly requested.

Current stabilization order:

1. Fix remaining TypeScript errors in:
   - `apps/web/src/board/board-interaction.ts`
   - `apps/web/src/board/board-renderer.ts`
2. Make this pass:
   - `cd apps/web && rtk bun run typecheck`
3. Add regression tests for intentional leave vs normal disconnect.
4. Verify toast/log placement from browser screenshots.
5. Continue visual polish only after stabilization.

## Final Response Format

When finishing a task, report:

- files changed
- commands run
- validation result
- unresolved risks or follow-up items

Keep final summaries concise.
