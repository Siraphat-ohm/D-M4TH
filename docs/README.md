# D-M4TH Docs

This docs folder is for engineers and agents changing the codebase.

## Start Here

- [Architecture](./architecture.md): system boundaries, data flow, and key decisions.
- [Code Map](./code-map.md): where main behavior lives.
- [Web UI](./web-ui.md): current match UI structure, theme rules, and browser QA.
- [ADR 0001](./adr/0001-bun-websocket-runtime.md): Bun WebSocket runtime decision.
- [ADR 0002](./adr/0002-react-hud-phaser-board.md): React UI with Phaser board adapter decision.

## Command Reference

Use Bun through RTK:

```bash
rtk bun test
rtk bun run typecheck
rtk bun run build
rtk bun run dev
rtk bun run dev:web
```

For web-only UI work:

```bash
cd apps/web && rtk bun run typecheck
cd apps/web && rtk bun run build
rtk bun test apps/web/src/ui/tile-display.test.ts apps/web/src/board/board-interaction.test.ts apps/web/src/turn/turn-controls.test.ts
```

