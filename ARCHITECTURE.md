# D-M4TH Architecture

D-M4TH is a multiplayer math equation board game built as a Bun monorepo.

## Workspace

- `apps/server`: Bun HTTP/WebSocket server.
- `apps/web`: React 19 + Vite client.
- `packages/game`: pure TypeScript game engine.
- `packages/protocol`: shared message contracts.
- `packages/config`: match presets and shared config.
- `packages/db`: reconnect/session persistence where applicable.

## Authority Model

The game engine is the source of truth for scoring, turn order, rack and draft legality, penalties, leave/forfeit state, and match end state.

The server is a thin adapter around the engine. It validates protocol messages, calls the game engine, manages sessions and connections, and broadcasts snapshots/events.

The client is never authoritative. React may manage draft placements and local interaction state, but submitted actions must be validated by server and engine before they become match state.

## Package Boundaries

`packages/game` must stay pure TypeScript. It must not depend on I/O, DOM, React, PixiJS, database, WebSocket, or server modules.

`apps/server` owns transport/session glue. `RoomRegistry` must not own rules; it should delegate match behavior to `GameEngine`.

`apps/web` owns UI and interaction orchestration. PixiJS 8 renders the board canvas only. React owns lobby, HUD, rack, actions, dialogs, toasts, logs, and match shell layout.

## Determinism

Randomization must use `seedrandom` through the repo shuffle utility in `packages/game/src/utils.ts`. Player start order is randomized at match start using the match ID as seed.

## Sessions And Reconnect

Normal disconnect and intentional leave are different states.

- Normal disconnect marks a player disconnected, preserves reconnect, and must not immediately end the match.
- Intentional `room:leave` marks a player left/forfeited through the game engine, revokes reconnect binding where available, and may end a match when fewer than two active non-left players remain.

Reconnect token parsing, validation, rotation, and revoke behavior must stay centralized in server reconnect/session services. Do not duplicate reconnect token logic in UI or room registry code.

## UI Rendering Boundary

React owns all non-board UI. PixiJS receives exact board pixel size from the React board host and renders only board cells, tiles, premium labels, selection state, and placement previews.

Setup/lobby board preview is display-only and must not create game state.
