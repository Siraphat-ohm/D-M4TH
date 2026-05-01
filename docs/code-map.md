# Code Map

Use this as a lookup map before editing.

## Game Engine

- `packages/game/src/engine.ts`: match lifecycle, turn actions, rack/tile bag flow, snapshots.
- `packages/game/src/types.ts`: core domain types such as `Tile`, `Placement`, `PublicSnapshot`.
- `packages/game/src/equation-parser.ts`: equation syntax and validation.
- `packages/game/src/scoring.ts`: tile value, premium cell, equation multiplier, bingo scoring.
- `packages/game/src/board-layout.ts`: classical premium cell layout.
- `packages/game/src/tile-catalog.ts`: tile definitions and tile bag generation.

Engine tests live in `packages/game/tests/`.

## Server

- `apps/server/src/index.ts`: Bun HTTP/WebSocket entrypoint.
- `apps/server/src/room-registry.ts`: room lifecycle, message routing, and engine adapter behavior.
- `apps/server/tests/room-registry.test.ts`: server room behavior tests.

Server should stay thin: validate protocol, call engine, broadcast snapshots.

## Web Client

- `apps/web/src/main.tsx`: React root.
- `apps/web/src/protocol-client.ts`: WebSocket client wrapper.
- `apps/web/src/ui/App.tsx`: high-level app shell, protocol wiring, room/create/join flow.
- `apps/web/src/ui/LobbyRoom.tsx`: create/join/setup/lobby UI.
- `apps/web/src/ui/MatchTopBar.tsx`: player cards, turn timer, tiles-left.
- `apps/web/src/ui/MatchLogPanel.tsx`: collapsible match log side panel.
- `apps/web/src/ui/BoardCanvas.tsx`: Phaser board adapter and setup preview.
- `apps/web/src/ui/Rack.tsx`: rack slots, rack tile selection, drag preview.
- `apps/web/src/ui/Dialogs.tsx`: face selection and full log dialog.
- `apps/web/src/ui/ColorPicker.tsx`: player color picker.
- `apps/web/src/turn/use-turn-controller.ts`: draft placements, swap mode, preview handling.
- `apps/web/src/turn/turn-controls.ts`: pure draft/swap helper functions.
- `apps/web/src/board/board-interaction.ts`: board coordinate math and render tile helpers.

Web tests live beside helpers:

- `apps/web/src/ui/tile-display.test.ts`
- `apps/web/src/board/board-interaction.test.ts`
- `apps/web/src/turn/turn-controls.test.ts`

## Styles

- `apps/web/src/styles.css`: import-only entrypoint.
- `apps/web/src/styles/base.css`: theme tokens and base elements.
- `apps/web/src/styles/layout.css`: app shell and match layout.
- `apps/web/src/styles/panels.css`: panels, player cards, lobby pieces.
- `apps/web/src/styles/game.css`: board host, rack, actions, match log.
- `apps/web/src/styles/dialogs.css`: dialogs.
- `apps/web/src/styles/color-picker.css`: color picker.

Do not dump new styles into `styles.css`.

