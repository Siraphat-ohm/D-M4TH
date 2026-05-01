@/home/simon/.codex/RTK.md

--- project-doc ---

# D-M4TH Codex Instructions

## Project

D-M4TH is a multiplayer math equation board game, Scrabble-like, using:

- Bun monorepo
- apps/server: Bun WebSocket server
- apps/web: React 19 + Vite client
- Phaser 4 for board canvas only, including setup preview board
- packages/game: pure TypeScript game engine
- packages/protocol: shared message types
- packages/config: match config presets

## Hard Architecture Rules

- packages/game must stay pure TypeScript with no I/O, DOM, React, Phaser, or server dependency.
- Server is a thin adapter: validate protocol, call engine, broadcast PublicSnapshot.
- Client never computes authoritative game state.
- React owns lobby, player info, rack, actions, dialogs, logs, and UI.
- Phaser owns board canvas rendering only. Do not put non-board UI in Phaser.
- Draft placements are client-side and managed by useTurnController.
- Setup/lobby board preview is display-only. It must not create game state.
- Keep UI split into focused components. Do not dump new UI into App.tsx.
- Keep CSS split under apps/web/src/styles/. Do not dump new styles into styles.css.

## Commands

Use Bun through RTK:

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

## Testing Expectations

- Add or update Bun tests when changing packages/game behavior.
- Add or update focused web tests when changing UI helpers or turn controls.
- Run `rtk bun test` after engine/rules changes.
- Run `cd apps/web && rtk bun run typecheck` after web TypeScript changes.
- Run `cd apps/web && rtk bun run build` after web UI/style changes.
- Avoid broad rewrites unless explicitly requested.

## Current Direction

Flat gameplay UI redesign is in progress.
Use PLAN.md as the audit and phase reference.
Current decisions:

- No rounded UI, glow, decorative shadows, or tile shadows.
- Functional colors stay.
- Rack stays 8 slots with empty placeholders.
- Draft board tiles return to rack on double click / double tap.
- PlayerInfo shows name, score, turn timer, full timer, and penalty when present.
- Preview score highlights on active player score, not in action bar.
