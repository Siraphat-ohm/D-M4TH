# Game Rules

This page is the durable docs home for D-M4TH game rules. The game engine remains the executable source of truth.

## Classical Mode

Classical mode is a standard competitive mode for two players using a fixed board and standard ruleset.

### Player Actions

A player must choose one action during their turn:

- Play: submit a valid mathematical equation onto the board and calculate score.
- Swap: exchange 1 to 8 rack tiles with new tiles from the bag. This skips the turn. Swap is not allowed when the tile bag has 5 or fewer tiles.
- Pass: skip the turn without taking action.

### Time Management

- Total match time: 22 minutes per player.
- Turn time limit: 3 minutes per turn.
- Penalty: exceeding the 3-minute turn limit incurs a 10 point penalty.

### Equipment

- Board: 15 x 15 grid, 225 total slots.
- Multipliers: fixed Triple Equation, Double Equation, Triple Piece, and Double Piece locations.
- Tile inventory: 100 tiles.
- Rack: players start with 8 tiles.
- Tile faces: numbers `0` through `20`, operators `+`, `-`, `+/-`, `x`, `/`, combo operator tiles, equals `=`, and 4 blank tiles worth 0.

### Equation Syntax

- Unary minus is allowed only before a non-zero number, for example `-6 = 4 - 10`.
- At most 3 single-digit tiles may concatenate into a larger number, for example `1`, `2`, `3` as `123`.
- Leading zero numbers are invalid, for example `012 = 11 + 1`.
- Chained equalities are allowed, for example `3 = 3 = 3` or `3 + 4 = 7 + 0 = -6 + 13`.

### Scoring

- Base score comes from tile values.
- Piece multipliers apply to individual tiles first.
- Equation multipliers apply to the total equation score.
- Scoring includes the primary equation plus any valid perpendicular equations created by newly placed tiles.
- Each created cross equation must be scored once.
- Playing all 8 rack tiles in one turn gives a 40 point bonus.

### Endgame

The match ends immediately when one of these conditions is met:

- Depletion: the tile bag is empty and one player has exhausted all rack tiles.
- Stalemate: players pass consecutively 3 times. A Pass button becomes mandatory when the bag is empty.
- Time out: a player's total match time reaches zero. If time runs out during the final turn, the player may complete the play; if the turn time limit is exceeded, deduct 10 points before ending the game.

## Party Mode

Party mode includes Classical mode rules and adds configurable multiplayer options.

### Configuration

- Player capacity: 2 or more players.
- Action set: Play, Swap, Pass, and Use Skill.
- Time controls: adjustable total time, increment per move, and turn limits.

### Dynamic Equipment

- Board dimensions: custom odd `N x N`, where `N >= 15`.
- Extended multipliers: can include 4x, 5x, 6x, and beyond.
- Special nodes: can include skill nodes, exponential score, Fibonacci score, or other configured effects.
- Tile scaling: total tile count scales with player count.
- Special/custom tiles: can support advanced operations, comparison operators, or custom function-like tiles.

Example skill nodes:

- Double down: 2x after scoring.
- Triple down: 3x after scoring.
- Swap with opponent: swap a tile in hand with an opponent after using the skill.

### Party Endgame

Party mode includes Classical conditions.

Party stalemate ends the game if consecutive passes equal the number of players when the bag is empty.
