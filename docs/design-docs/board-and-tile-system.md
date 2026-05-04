# Board And Tile System

## Classical Board

Classical mode uses a fixed 15 x 15 board with 225 slots.

The board includes fixed multiplier locations:

- Triple Equation
- Double Equation
- Triple Piece
- Double Piece

## Party Board

Party mode supports custom odd board sizes where `N >= 15`.

Party maps may add larger multipliers and special nodes, such as skill nodes, exponential score nodes, or Fibonacci score nodes.

## Tile Inventory

Classical mode uses 100 tiles. Players start with 8 rack tiles.

Tile faces include:

- numbers `0` through `20`
- operators `+`, `-`, `+/-`, `x`, `/`, combo operator tiles
- equals `=`
- blank tiles worth 0 points

Party mode can scale tile count with player count and support custom tiles, including comparison operators or custom function-style tiles.

## Rack

Rack size stays 8 slots. Empty rack slots should remain visible as placeholders.

Draft board tiles return to rack on double click or double tap.

## Rendering Ownership

PixiJS renders board canvas only. React owns rack, actions, HUD, dialogs, toasts, logs, and lobby UI.

Setup and lobby board preview is display-only and must not create game state.
