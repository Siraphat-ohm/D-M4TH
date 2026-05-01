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
- Use `seedrandom` via the `shuffle` utility in `utils.ts` for all deterministic randomization.
- Server is a thin adapter: validate protocol, call engine, broadcast PublicSnapshot.
- Client never computes authoritative game state.
- React owns lobby, player info, rack, actions, dialogs, logs, and UI.
- Phaser owns board canvas rendering only. Do not put non-board UI in Phaser.
- Draft placements are client-side and managed by useTurnController wrapping DraftManager.
- Player start order is randomized at match start using the match ID as a seed.
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

Match gameplay UI is using the **Monochrome + Player Accent** direction.
Use PLAN.md as the audit and phase reference.
Current decisions:

- No rounded UI, glow, decorative shadows, or tile shadows.
- Dark monochrome surfaces are the default: background, panels, empty board cells, log panel, rack container, and secondary buttons stay neutral.
- Player colors are the only strong accents.
- Active player color drives the active player card border, turn timer value, PLAY button, selected rack tile, and pending board tile border.
- Player palette: `#EF476F`, `#8B5CF6`, `#06D6A0`, `#FFD166`, `#118AB2`, `#F97316`.
- Bonus cells use muted colors: `2P #8A5A38`, `3P #3E7774`, `2E #8A7A3A`, `3E #80394D`.
- Rack tiles and placed board tiles use off-white faces with dark text.
- Rack stays 8 slots with empty placeholders.
- Draft board tiles return to rack on double click / double tap.
- Top player bar shows compact player cards with name, score, and mini full timer.
- Preview score highlights on active player score, not in action bar.
- Gameplay accepted-action notices do not render as in-play banners; actions go to log.
- Match log is a React side panel and can collapse. `View All` opens the full log dialog.
- `lucide-react` is the current web icon dependency.
