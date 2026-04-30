# D-M4TH Context

## Domain Terms

- **Match**: One playable game with configured rules, players, board state, scores, racks, clocks, and end condition.
- **Room**: Ephemeral multiplayer container addressed by room code or invite link. It owns a single match and connected sockets.
- **Rack**: A private set of up to 8 tiles held by one player. Opponent rack contents are never included in public snapshots.
- **Tile Bag**: Shuffled supply of undealt tiles. The Classical bag scales by player count for Party-ready rooms.
- **Board**: Odd square grid. Classical mode uses a fixed 15x15 layout.
- **Start Star**: The center cell. The first committed play must cover it.
- **Premium Cell**: Board cell that modifies placed tile score (`2P`, `3P`) or the equation score (`2E`, `3E`).
- **Draft Placement**: A local, uncommitted tile placement controlled by the active player before previewing or committing a play.
- **Ghost Placement**: A non-authoritative draft placement broadcast to other players before a move is committed.
- **Rule Set**: Syntax, placement, action, timer, and endgame rules used by the engine.
- **Scoring Profile**: Score values, premium behavior, and bonuses used when previewing or committing a play.
- **Skill Node**: Future Party-mode board node that can trigger a skill effect. Reserved in config and types, disabled in MVP.
