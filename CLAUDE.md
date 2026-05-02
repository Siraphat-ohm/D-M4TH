# D-M4TH

Multiplayer math equation game (Scrabble-like). Players build equations on a grid board using number/operator tiles. Real-time multiplayer via WebSocket.

## Architecture

Bun monorepo with workspaces:

- `apps/server/` — Bun WebSocket server (`apps/server/src/index.ts`, `room-registry.ts`). Routes messages, delegates to game engine.
- `apps/web/` — React 19 + Vite client. PixiJS 8 for board canvas and setup preview only.
- `packages/game/` — Pure game engine: board state, equation parser, scoring, tile catalog. No I/O dependencies.
- `packages/config/` — Match config factories (classical/party mode presets).
- `packages/protocol/` — Type-safe client/server message definitions.

Key decisions:
- React handles lobby, player info, rack, action bar, dialogs, logs, and shell UI. PixiJS handles board canvas only (ADR 0002).
- Game engine is pure TypeScript — testable without server or client.
- Use `seedrandom` via generic `shuffle` utility for deterministic randomization (see `packages/game/src/utils.ts`).
- Server is thin adapter: validates protocol, calls engine, broadcasts snapshots.
- Turn state extracted into `useTurnController` hook which wraps the pure `DraftManager` (see `apps/web/src/turn/use-turn-controller.ts` and `packages/game/src/draft.ts`).
- Player start order randomized at match start using match ID as seed.
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

- Current theme is **Monochrome + Player Accent**: dark neutral surfaces, crisp flat borders, no neon glow, no heavy gradients, no decorative shadows, and no tile shadows.
- **Typography Identity**: 
  - **Silkscreen**: Used for board identity (tiles, premium labels, stars), headers, and primary action buttons.
  - **IBM Plex Mono**: Used for all other UI elements, including player cards, HUD metrics, logs, and inputs.
- Player colors are the only strong accents. Active player color drives the active player card border, turn timer value, primary buttons, selected rack tile, and pending board tile border.
- Player palette: `#EF476F`, `#8B5CF6`, `#06D6A0`, `#FFD166`, `#118AB2`, `#F97316`.
- Bonus cells are muted so they do not compete with player identity: `2P #8A5A38`, `3P #3E7774`, `2E #8A7A3A`, `3E #80394D`.
- Rack and placed board tiles use off-white faces with dark text.
- Rack stays 8 slots with empty placeholders.
- Draft board tiles return to rack on double click / double tap.
- **Match Layout**:
  - Gameplay uses a fixed-height `100dvh` shell with `play-surface` rows: top HUD, flexible board slot, and final control strip.
  - The board is visually dominant, but `BoardCanvas` must clamp to the actual `.match-main` / `.board-stage` slot height so rack and action controls remain visible.
  - Tablet landscape uses tighter HUD/rack sizing and a more aggressive board cap.
  - Short phone landscape uses a compact two-column layout: board on the left, compressed HUD/rack/actions on the right.
- **Top HUD**: 
  - Unified Flexbox layout with compact player cards.
  - Turn Timer and Tile Bag count are integrated into the HUD metrics cluster next to player cards.
- Preview score highlights on the active player's score, not in the action bar.
- Gameplay accepted-action notices do not render as in-play banners; actions go to the match log.
- Match log is a side panel that can be opened via a floating launcher.
- Scaling uses a single ratio-based system (`--layout-scale`) derived from the viewport, supporting resolutions down to 1024x768.
- Create/lobby screen is two columns: setup panel left, read-only board preview right.

## Current Work

Flat gameplay UI redesign in progress. Full audit and phase reference in `PLAN.md`.

Agents: `frontend-ux-game-team` (UI/UX), `backend-game-dev` (server/engine).

## Code Conventions

- TypeScript strict mode. No runtime framework in packages/game.
- Tests use Bun test runner (`bun:test`). Tests colocated with source (`*.test.ts`).
- PixiJS loaded dynamically (`import("pixi.js")`) — keep PixiJS types minimal in BoardCanvas.
- All authoritative game state flows through `PublicSnapshot` from server. Transient multiplayer state (like ghost placements) flows through separate `room:presence` messages.
- Draft placements managed client-side via `useTurnController` hook in `turn/use-turn-controller.ts`.
- ProtocolClient message routing: turn-related messages (preview/rejection) handled by `turnHandleRef` before App-level handling.
- Keep React UI split into focused components under `apps/web/src/ui/`; avoid dumping new UI into `App.tsx`.
- Keep styles split under `apps/web/src/styles/`; `apps/web/src/styles.css` should stay import-only.

## Implementation Rules (Required)

- Use standard library and existing project helpers first. Add external dependencies only when necessary.
- If a technical detail is uncertain (API behavior, security property, browser/runtime compatibility), verify from official docs or trusted sources before implementation.
- If logic appears in multiple places, create a centralized shared function/service and migrate callers to it instead of copy-paste.
- For reconnect/auth/session features, keep validation/rotation/revocation in one server-side shared module and reuse across endpoints/handlers.

## Project Structure

```
apps/server/src/
  index.ts              # Bun HTTP/WS server entry
  room-registry.ts      # Room lifecycle, message routing
apps/web/src/
  main.tsx              # React root
  ui/App.tsx            # Shell, protocol wiring, high-level layout
  ui/BoardCanvas.tsx    # PixiJS board adapter and board preview
  ui/Rack.tsx           # Rack tiles and drag preview
  ui/MatchTopBar.tsx    # Match player cards, turn timer, tiles-left
  ui/MatchLogPanel.tsx  # Collapsible in-match log side panel
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
