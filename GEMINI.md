# D-M4TH - Engineering Standards

## Core Tech Stack

- **Runtime**: Bun (monorepo with workspaces)
- **Frontend**: React 19, Vite, PixiJS 8 (Board Rendering only)
- **Styling**: Vanilla CSS with Flexbox/Grid. No TailwindCSS.
- **Backend**: Bun WebSocket server
- **Language**: TypeScript (strict mode)
- **Testing**: Bun test runner (`bun:test`)

## Design Language: Monochrome + Player Accent

- **Surfaces**: Dark neutral backgrounds (`#080a0f`), crisp flat borders (`#2a3142`). No neon, glows, or shadows.
- **Accents**: Player colors are the primary accents. They drive active states and focus indicators.
- **Typography**:
  - **Silkscreen**: Board identity (tiles, labels), headers, primary buttons.
  - **IBM Plex Mono**: All other UI (player cards, HUD, logs, inputs).
- **Layout**: Dominant central **Board Stack** grouping the board and control strip (rack + actions) vertically. Unified Flexbox HUD at the top.

## Architecture & Workflow

- **Game Engine**: Pure TypeScript in `packages/game/`. No platform dependencies. Testable in isolation.
- **Multilayered UI**: React handles all stateful shell UI, overlays, and controls. PixiJS is strictly for board rendering.
- **State Flow**: Authoritative state from server (`PublicSnapshot`). Local state via `useTurnController` for drafting.
- **Deterministic**: Use `seedrandom` via `shuffle` utility for all game randomness.
- **Surgical Edits**: Prefer minimal, precise changes to existing files. Maintain consistent naming and patterns.

## Commands

```bash
rtk bun run dev          # Start server (port 2567)
rtk bun run dev:web      # Start Vite dev server
rtk bun test             # Run all tests
rtk bun run typecheck    # Type-check all packages
```

For web-only work:
```bash
cd apps/web && rtk bun run build
cd apps/web && rtk bun test apps/web/src/ui/tile-display.test.ts apps/web/src/board/board-interaction.test.ts apps/web/src/turn/turn-controls.test.ts
```
