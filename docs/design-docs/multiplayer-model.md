# Multiplayer Model

D-M4TH supports live multiplayer rooms with guest identity, room codes, and invite links.

## Match Authority

The server validates protocol messages and calls the game engine. The engine owns turn order, scoring, legality, leave/forfeit state, and match end state.

Clients receive authoritative snapshots and events. They must not compute authoritative winners, score, turn order, or leave results.

## Room Flow

1. Host creates a room.
2. Host receives room metadata and joins the match flow.
3. Other players join through invite link or room code.
4. Lobby/setup is display and configuration flow only.
5. Match starts when configured player and ready conditions are met.

## Disconnect Versus Leave

Normal disconnect is ambiguous and must preserve reconnect.

Intentional leave uses explicit protocol message `room:leave`.

- Normal disconnect: mark disconnected, preserve reconnect, do not end immediately.
- Intentional leave: mark left/forfeited through engine, revoke reconnect binding where available, clear only the current room reconnect token on client, close intentionally, reset local match state, and return to lobby.

If intentional leave leaves fewer than two active non-left players, the match may end.

## Party Mode

Party mode supports 2 or more players, custom time controls, custom board sizes, dynamic tile scaling, and optional skill actions.
