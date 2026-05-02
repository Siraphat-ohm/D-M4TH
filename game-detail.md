# 1. Classical Mode (Standard 1v1)

A standard competitive mode strictly designed for two players, utilizing a fixed configuration and standard rule set.

## 1.1 Player Actions (Turn Options)

A player must choose one of the following actions during their turn:

Play: Submit a valid mathematical equation onto the board and calculate the score.

Swap: Exchange 1 to 8 tiles from the rack with new ones from the tile bag. This action skips the current turn. Condition: Cannot be performed if the tile bag has $\le 5$ tiles remaining.

Pass: Skip the turn without taking any action.

## 1.2 Time Management

Total Match Time: 22 minutes per player.

Turn Time Limit: 3 minutes per turn.

Penalty: Exceeding the 3-minute turn limit incurs a penalty of -10 points.

## 1.3 Equipment & Assets

Board Dimensions: $15 \times 15$ grid (225 total slots).

Multipliers: Fixed locations for Triple Equation (3x), Double Equation (2x), Triple Piece (3x), and Double Piece (2x).

Tile Inventory: 100 tiles total. Players start with 8 tiles on their rack. (Includes numbers 0-20, operators $+$, $-$, $\pm$, $\times$, $\div$, $\times/\div$, $=$, and 4 BLANK tiles scoring 0 points).

## 1.4 Core Equation Rules (Syntax Validation)

Unary Operations: Only unary minus preceding a non-zero number is permitted (e.g., $-6 = 4 - 10$ is valid).

Digit Concatenation: A maximum of 3 single-digit tiles can be concatenated to form a larger number (e.g., $1, 2, 3$ becomes $123$).

Zero-Padding Restriction: Leading zeros are strictly invalid (e.g., $012 = 11 + 1$ is rejected).

Chained Equalities: Multiple equals signs are allowed in a single contiguous sequence (e.g., $3 = 3 = 3$ or $3 + 4 = 7 + 0 = -6 + 13$).

## 1.5 Scoring System

Base score is derived from tile values multiplied by piece multipliers, then the total equation score is multiplied by equation multipliers.

Scoring uses one contiguous equation direction: horizontal or vertical, not cross scoring.

Bingo Bonus: Successfully playing all 8 tiles from the rack in a single turn yields a +40 extra point bonus.

## 1.6 Endgame Conditions (Game Resolution)

The game terminates immediately if any of the following occur:

1. Depletion: The tile bag is empty AND one player has exhausted all tiles on their rack.

2. Stalemate: Players pass consecutively 3 times. (A 'Pass' button becomes mandatory when the bag is empty).

3. Time Out: A player's total match time reaches zero. Edge Case: If time runs out during the final turn, the player may complete the play; if the turn time limit is exceeded, deduct 10 points before ending the game.

# 2. Party Mode (Custom Multiplayer)

A highly scalable, highly configurable mode supporting $\ge 2$ players, introducing dynamic elements and custom skill sets.

on this mode include classical mode

## 2.1 Advanced Configuration

Player Capacity: 2 or more players.

Action Set: 4 Actions (Play, Swap, Pass, Use Skill).

Custom Time Controls: Adjustable total time, increment time per move (e.g., +10 seconds upon turn completion), and turn time limits.

## 2.2 Dynamic Equipment

Board Dimensions: Custom grid size $N \times N$, where $N \ge 15$ and $N$ must be an odd number.

Extended Multipliers: Introduces $4x$, $5x$, $6x$, etc.

Special Nodes: Custom slots such as "Skill Nodes", "Exponential Score", or "Fibonacci Score".

Tile Scaling: The total tile count scales proportionally with the number of players.

Special Tiles: Introduces advanced mathematical operations (e.g., $^2$, $\sqrt{}$).

Custom Tiles: code must support adding custom tiles like `<` `<=` `>` `>=` , or custom fuction like ( f(x) = 3\*x )

Example Skill Node:

- Double down : 2 x after scoring

- Triple down : 3 x after scoring

- Swap with opponent : Swap tile on player hand with opponent hand after use this skill play can play

## 2.3 Endgame Conditions (Party Variations)

Includes all Classical conditions.

Party Stalemate: Game ends if there are consecutive passes equal to the number of players (1 pass per player continuously) when the bag is empty.

# UX/UI

## Current Match UI Direction

The current gameplay theme is **Monochrome + Player Accent**:

- Background, panels, empty board cells, rack container, log panel, dialogs, and secondary buttons use neutral dark colors.
- Player colors are the only strong accents.
- Active player color drives the active player card border, turn timer value, PLAY button, selected rack tile, and pending board tile border.
- Player palette: `#EF476F`, `#8B5CF6`, `#06D6A0`, `#FFD166`, `#118AB2`, `#F97316`.
- Bonus cells use muted colors so they do not compete with player colors: `2P #8A5A38`, `3P #3E7774`, `2E #8A7A3A`, `3E #80394D`.
- Rack tiles and placed board tiles use off-white faces with dark text.
- UI stays flat and crisp: no neon glow, heavy gradients, decorative shadows, rounded card styling, or tile shadows.

## Lobby

- Players can create or join a room by invite link or room code.
- Lobby can select mode: Classical or Party.
- Each player selects their own color from the fixed player palette or custom color input.
- Setup/lobby board preview is display-only and must not create game state.

## Match Screen

- Top match bar shows compact player cards with name, score, and mini full timer.
- TURN timer is centered and uses the active player color for the numeric value.
- TILES LEFT remains neutral.
- Match screen has no gameplay brand card; board, players, log, rack, and actions are the focus.
- Match log is a right-side React panel with `Hide/Show` collapse and `View All` full dialog.
- Accepted gameplay actions are written to the log and do not show as in-play notice banners.
- Rack always has 8 slots with empty placeholders.
- Action bar has PLAY, SWAP, PASS, and RECALL. PLAY uses active player color; SWAP/PASS/RECALL stay neutral.
- Preview score appears on the active player's score after a valid equation preview.

## Board Interaction

- PixiJS owns board canvas rendering only.
- React owns lobby, player cards, rack, action buttons, dialogs, logs, and all non-board UI.
- Draft placements are client-side and managed by turn controller state.
- Placement supports snap-to-grid. Desktop supports drag/drop and click placement. Mobile/iPad primarily support tap rack tile, then tap board cell.
- Draft board tiles return to rack on double click / double tap.
- Live opponent placements appear as ghost placements until submitted.
- Pending tiles on the board use off-white faces, dark text, and active player color border.

## Responsive Support

- Web UI must support desktop, laptop, iPad/tablet, and mobile.
- Board sizing uses viewport budgeting and PixiJS resize handling.
- Rack tile size is capped so rack tiles remain readable without overpowering the board.
- Browser QA is required for gameplay layout changes at wide desktop, short laptop, tablet, and phone sizes.

## Later Polish

- BINGO animation is planned for later.
- Turn-change and scoring feedback can be improved later, but must stay low-noise and avoid glow-heavy effects.
