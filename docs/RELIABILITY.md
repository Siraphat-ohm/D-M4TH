# Reliability

## Reconnect

Normal disconnect must preserve reconnect and must not be treated as intentional leave.

Intentional leave uses `room:leave`, revokes reconnect binding where available, clears only the current room reconnect token on client, and returns the leaving player to lobby.

## Rendering

Board sizing must come from the actual React board host slot. PixiJS receives exact board pixel size and should not remain stuck on `Loading board` after resize or app recreation.

## Validation

For protocol, server, game, or shared changes:

```bash
rtk bun run typecheck
rtk bun test
```

For web UI changes:

```bash
cd apps/web && rtk bun run typecheck
cd apps/web && rtk bun run build
```
