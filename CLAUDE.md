# D-M4TH

Multiplayer math equation game (Scrabble-like). Players build equations on a grid board using number/operator tiles. Real-time multiplayer via WebSocket.

## Architecture

Bun monorepo with workspaces:

- `apps/server/` — Bun WebSocket server (`apps/server/src/index.ts`, `room-registry.ts`). Routes messages, delegates to game engine.
- `apps/web/` — React 19 + Vite client. Phaser 4 for board canvas and setup preview only.
- `packages/game/` — Pure game engine: board state, equation parser, scoring, tile catalog. No I/O dependencies.
- `packages/config/` — Match config factories (classical/party mode presets).
- `packages/protocol/` — Type-safe client/server message definitions.

Key decisions:
- React handles lobby, player info, rack, action bar, dialogs, logs, and shell UI. Phaser handles board canvas only (ADR 0002).
- Game engine is pure TypeScript — testable without server or client.
- Server is thin adapter: validates protocol, calls engine, broadcasts snapshots.
- Turn state extracted into `useTurnController` hook (see `apps/web/src/turn/use-turn-controller.ts`).
- Setup/lobby board preview is read-only UI. It must not create or mutate authoritative game state.

## Commands

```bash
rtk bun run dev          # Start server (port 2567)
rtk bun run dev:web      # Start Vite dev server
rtk bun test             # Run tests (Bun test runner)
rtk bun run typecheck    # TypeScript check all workspaces
rtk bun run build        # Build all packages
```

Web-only validation:

```bash
cd apps/web && rtk bun run typecheck
cd apps/web && rtk bun run build
rtk bun test apps/web/src/ui/tile-display.test.ts apps/web/src/board/board-interaction.test.ts apps/web/src/turn/turn-controls.test.ts
```

## Domain Terms

Defined in `CONTEXT.md`. Key ones: Match, Room, Rack (8 tiles), Tile Bag, Board (15x15 classical), Draft Placement, Ghost Placement, Premium Cell.

## Game Rules (Classical)

- 1v1, 15x15 board, 100 tiles, 8 per rack
- Turn actions: Play (submit equation), Swap (1-8 tiles), Pass
- Total match time: 22 min per player. Turn limit: 3 min (-10 penalty if exceeded)
- Equation rules: unary minus, max 3-digit concatenation, no leading zeros, chained equalities OK
- Scoring: tile value × piece multiplier, then × equation multiplier. Bingo (+40) for all 8 tiles played
- Endgame: tile bag empty + rack empty, 3 consecutive passes, or time out

Full rules in `game-detail.md`.

## Current UI Decisions

- Flat UI: no rounded corners, glow, decorative shadows, or tile shadows.
- Functional colors stay for player identity, premium cells, and action state.
- Rack stays 8 slots with empty placeholders.
- Draft board tiles return to rack on double click / double tap.
- PlayerInfo replaces the old HUD list and shows name, score, turn timer, full timer, and penalty when present.
- Preview score highlights on the active player's score, not in the action bar.
- Log opens from a fixed bottom-right button during match.
- Create/lobby screen is two columns: setup panel left, read-only board preview right.

## Current Work

Flat gameplay UI redesign in progress. Full audit and phase reference in `PLAN.md`.

Agents: `frontend-ux-game-team` (UI/UX), `backend-game-dev` (server/engine).

## Code Conventions

- TypeScript strict mode. No runtime framework in packages/game.
- Tests use Bun test runner (`bun:test`). Tests colocated with source (`*.test.ts`).
- Phaser loaded dynamically (`import("phaser")`) — keep Phaser types minimal in BoardCanvas.
- All game state flows through `PublicSnapshot` from server. Client never computes authoritative state.
- Draft placements managed client-side via `useTurnController` hook in `turn/use-turn-controller.ts`.
- ProtocolClient message routing: turn-related messages (preview/rejection) handled by `turnHandleRef` before App-level handling.
- Keep React UI split into focused components under `apps/web/src/ui/`; avoid dumping new UI into `App.tsx`.
- Keep styles split under `apps/web/src/styles/`; `apps/web/src/styles.css` should stay import-only.

## Project Structure

```
apps/server/src/
  index.ts              # Bun HTTP/WS server entry
  room-registry.ts      # Room lifecycle, message routing
apps/web/src/
  main.tsx              # React root
  ui/App.tsx            # Shell, protocol wiring, high-level layout
  ui/BoardCanvas.tsx    # Phaser board adapter and board preview
  ui/Rack.tsx           # Rack tiles and drag preview
  ui/PlayerInfoList.tsx # Player rows, timers, score preview
  ui/Dialogs.tsx        # Face selection and match log dialogs
  ui/ColorPicker.tsx    # Player color picker
  ui/tile-display.ts    # UI-only tile label formatting
  board/board-interaction.ts  # Board coordinate math, tile rendering helpers
  protocol-client.ts    # WebSocket client
  turn/turn-controls.ts # Pure draft placement, swap selection functions
  turn/use-turn-controller.ts # Turn state hook (draft, swap, preview, face placement)
  styles.css            # Import-only style entrypoint
  styles/               # Split CSS by concern: base, layout, panels, game, dialogs, color picker
packages/game/src/
  engine.ts             # Game state machine, turn processing
  types.ts              # All game types (Tile, Placement, PublicSnapshot, etc.)
  equation-parser.ts    # Equation syntax validation
  scoring.ts            # Score calculation
  board-layout.ts       # Premium cell positions
  tile-catalog.ts       # Tile definitions and bag generation
packages/config/src/
  index.ts              # createClassicalConfig(), createPartyConfig()
packages/protocol/src/
  index.ts              # ClientMessage, ServerMessage union types
docs/adr/               # Architecture Decision Records
PLAN.md                 # UI redesign plan + audit
```
