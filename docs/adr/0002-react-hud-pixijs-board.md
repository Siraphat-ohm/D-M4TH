# ADR 0002: React HUD With PixiJS 8 Board Adapter

## Status

Accepted

## Context

The product needs responsive lobby, HUD, rack, and action controls while the board benefits from canvas rendering, drag/drop, snap-to-grid, and pixel-art animation hooks.

## Decision

Use React for application state, lobby, HUD, rack, action bar, and forms. Use PixiJS 8 only inside the board adapter. The adapter renders board state and emits placement intents; it does not own rules or scoring.

## Consequences

- UI controls stay accessible and responsive with normal DOM.
- Board interactions can grow into richer animation without coupling rules to rendering.
- The game engine remains pure and testable.
