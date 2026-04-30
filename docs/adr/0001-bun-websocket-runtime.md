# ADR 0001: Self-Hosted Bun WebSocket Runtime

## Status

Accepted

## Context

D-M4TH needs a Party-ready multiplayer MVP that can be self-hosted later with Docker. The first release uses ephemeral guest rooms and does not need hosted room orchestration, persistence, or PartyKit-specific deployment.

## Decision

Use a Bun HTTP/WebSocket server as the realtime room runtime. Keep the server as an adapter that validates protocol messages, calls the shared game engine, and broadcasts snapshots.

## Consequences

- The runtime remains portable for a future Docker image.
- No PartyKit or Colyseus dependency is required for MVP rooms.
- Reconnection and persistence remain explicit future work instead of hidden framework behavior.
