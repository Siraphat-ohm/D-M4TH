# Architecture

## System Shape

D-M4TH is a Bun monorepo for a realtime multiplayer math board game.

- `packages/game`: pure TypeScript game engine. No I/O, DOM, React, Phaser, or server dependency.
- `packages/protocol`: shared client/server message types.
- `packages/config`: match config presets.
- `apps/server`: Bun HTTP/WebSocket adapter.
- `apps/web`: React 19 + Vite client. Phaser 4 renders board canvas only.

## Runtime Flow

1. Web client connects to Bun WebSocket server.
2. Client sends typed protocol messages from `packages/protocol`.
3. Server validates message shape and room state.
4. Server delegates game rules to `packages/game`.
5. Engine returns state changes, scores, racks, and public snapshots.
6. Server broadcasts `PublicSnapshot` plus private rack data to each player.
7. React updates lobby, HUD, rack, actions, dialogs, and logs.
8. Phaser board adapter renders board and emits placement intents.

## Authority Rules

- Server owns authoritative match state.
- Client never computes authoritative game state or score.
- Client draft placements are local UI intent only until submitted.
- Setup/lobby board preview is display-only and must not create game state.
- Phaser does not own rules, scoring, lobby, HUD, rack, action buttons, or logs.

## Key Decisions

- Bun WebSocket server is the MVP realtime runtime. See [ADR 0001](./adr/0001-bun-websocket-runtime.md).
- React owns all non-board UI; Phaser is a board adapter only. See [ADR 0002](./adr/0002-react-hud-phaser-board.md).
- Match UI uses **Monochrome + Player Accent**: neutral dark surfaces, player colors as strong accents, muted bonus cells.

