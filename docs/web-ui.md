# Web UI

## Current Direction

The web UI uses **Monochrome + Player Accent**.

- Neutral dark base for background, panels, empty board cells, log panel, rack container, dialogs, and secondary buttons.
- Player colors are the only strong accents.
- Active player color drives active player card border, turn timer value, PLAY button, selected rack tile, and pending board tile border.
- Rack and placed board tiles use off-white faces with dark text.
- Bonus cells are muted: `2P #8A5A38`, `3P #3E7774`, `2E #8A7A3A`, `3E #80394D`.
- No neon glow, heavy gradients, decorative shadows, rounded card styling, or tile shadows.

Player palette:

```text
1 #EF476F
2 #8B5CF6
3 #06D6A0
4 #FFD166
5 #118AB2
6 #F97316
```

## Component Ownership

- React owns lobby, player cards, rack, actions, dialogs, logs, and all non-board UI.
- PixiJS owns board canvas rendering only.
- `useTurnController` owns client-side draft placement and swap state.
- Server snapshot data remains authoritative for match state.

## Match Screen

- Top bar: compact player cards, centered turn timer, neutral tiles-left card.
- Main area: board on left/center and collapsible match log panel on right.
- Bottom strip: rack and action buttons.
- PLAY uses active player color.
- SWAP, PASS, and RECALL are neutral secondary buttons.
- Accepted gameplay actions go to log, not in-play notice banners.
- `View All` opens full log dialog.

## Board Interaction

- Desktop supports drag/drop and click placement.
- Mobile/iPad primarily use tap rack tile, then tap board cell.
- Draft board tiles return to rack on double click / double tap.
- Opponent draft placements render as ghost placements.
- Pending player tiles use off-white faces with active player color border.

## Responsive QA

Use Chrome screenshots for gameplay layout changes. Check:

- Wide desktop around `1920x1080`.
- Short laptop around `1366x768`.
- Tablet portrait and landscape.
- Phone portrait around `390x844`.

Must verify:

- Board renders after resizing and does not stay on `Loading board`.
- Rack tiles remain readable but do not dominate the board.
- Log collapse works.
- No text overlap in player cards, timer, actions, or log rows.
- PixiJS board remains square and input coordinates still snap correctly.

