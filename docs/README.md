# D-M4TH Documentation

This directory contains high-level documentation and architectural decisions for the D-M4TH project.

## Core Resources

- **[ADRs](./adr/)**: Architectural Decision Records (historical context).

---

## System Overview (Consolidated Architecture)

D-M4TH is a realtime multiplayer math board game built as a Bun monorepo.

### Tech Stack
- **Engine**: Pure TypeScript (`packages/game`).
- **Server**: Bun HTTP/WebSocket adapter (`apps/server`).
- **Web**: React 19 + Vite + PixiJS 8 (`apps/web`).
- **Protocol**: Shared message types (`packages/protocol`).

### Authority Rules
- **Server** owns the authoritative match state.
- **Client** never computes authoritative scores or game state.
- **PixiJS** is strictly for board canvas rendering; React owns the rest of the UI.
- **Leave vs Disconnect**: Intentional leave (`room:leave`) ends or forfeits a match; accidental disconnects preserve reconnection.

## Development Commands

Use Bun through RTK:

```bash
rtk bun test             # Run all tests
rtk bun run typecheck    # Type-check all packages
rtk bun run build        # Build all packages
rtk bun run dev          # Start local development environment
```

### Web-Specific
```bash
cd apps/web
bun run test:e2e        # Run Playwright E2E tests
bun test src/__tests__  # Run Bun unit tests
```

---

*Note: For detailed implementation guidance, design language rules, and current task priorities, refer to `AGENTS.md` and `GEMINI.md` at the project root.*
