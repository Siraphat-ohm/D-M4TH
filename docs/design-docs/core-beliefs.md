# Core Beliefs

D-M4TH is a Scrabble-like math equation board game for live multiplayer play.

## Product Shape

- The core game should be understandable from visible board, rack, score, and turn state.
- Player skill should come from equation construction, board placement, tile timing, and risk management.
- Multiplayer should feel party-ready: quick room creation, guest identity, invite links, and no account requirement for the MVP.
- The game engine must remain the source of truth so the same rules can be tested, replayed, and reused outside the web client.

## Design Principles

- Board and rack readability matter more than decorative effects.
- The active player should be obvious through text and structure, not color alone.
- Penalties and scoring feedback should appear near the player score.
- Game logs are history, not forced gameplay notices.
- Blocking UI is reserved for decisions that require an answer, such as face selection.

## Visual Direction

The current match UI direction is Monochrome + Player Accent.

- Dark monochrome surfaces are the default.
- Player colors are the only strong accents.
- Rack tiles and placed board tiles use off-white faces with dark text.
- Avoid neon glow, heavy gradients, decorative shadows, rounded card styling, tile shadows, CRT effects, and casino styling.
