# Quality Score

Use this page as a quality review index.

## Gameplay UX

- HUD visible.
- Board visible and rendered after resize.
- Rack visible.
- Action buttons visible.
- Toasts/logs do not cover board, rack, or actions.
- Active state does not rely on color alone.

## Engineering

- `packages/game` stays pure TypeScript.
- Client does not compute authoritative scoring, winners, turn order, or leave results.
- Server delegates rules to `GameEngine`.
- Reconnect token lifecycle remains centralized server-side.
