# D-M4TH

Multiplayer math equation game (Scrabble-like). Players build equations on a grid board using number/operator tiles. Real-time 1v1 via WebSocket.

## Architecture

Bun monorepo with workspaces:

- `apps/server/` — Bun WebSocket server (`apps/server/src/index.ts`, `room-registry.ts`). Routes messages, delegates to game engine.
- `apps/web/` — React 19 + Vite client. Phaser 4 for board canvas. All UI in `apps/web/src/ui/App.tsx`.
- `packages/game/` — Pure game engine: board state, equation parser, scoring, tile catalog. No I/O dependencies.
- `packages/config/` — Match config factories (classical/party mode presets).
- `packages/protocol/` — Type-safe client/server message definitions.

Key decisions:
- React handles lobby, HUD, rack, action bar. Phaser handles board canvas only (ADR 0002).
- Game engine is pure TypeScript — testable without server or client.
- Server is thin adapter: validates protocol, calls engine, broadcasts snapshots.

## Commands

```bash
bun run dev          # Start server (port 2567)
bun run dev:web      # Start Vite dev server
bun test             # Run tests (Bun test runner)
bun run typecheck    # TypeScript check all workspaces
bun run build        # Build all packages
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

## Known Bugs

- Match timer: shows initial value, doesn't tick until first play. Should count from match start.
- Copy link: `navigator.clipboard.writeText` in lobby fails on some browsers/contexts.
- Rack panel: doesn't fit 8 tiles comfortably on mobile.

## UI Direction

Balatro-inspired aesthetic. Board + HUD + rack pending redesign using `frontend-design` skill.

## Code Conventions

- TypeScript strict mode. No runtime framework in packages/game.
- Tests use Bun test runner (`bun:test`). Tests colocated with source (`*.test.ts`).
- Phaser loaded dynamically (`import("phaser")`) — keep Phaser types minimal in BoardCanvas.
- All game state flows through `PublicSnapshot` from server. Client never computes authoritative state.
- Draft placements managed client-side in `turn-controls.ts`. Preview score via `play:preview` protocol message.

## Project Structure

```
apps/server/src/
  index.ts              # Bun HTTP/WS server entry
  room-registry.ts      # Room lifecycle, message routing
apps/web/src/
  main.tsx              # React root
  ui/App.tsx            # All UI components (lobby, HUD, rack, actions)
  ui/BoardCanvas.tsx    # Phaser board adapter
  board/board-interaction.ts  # Board coordinate math, tile rendering helpers
  protocol-client.ts    # WebSocket client
  turn/turn-controls.ts # Draft placement, swap selection logic
  styles.css            # Global styles
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
```
