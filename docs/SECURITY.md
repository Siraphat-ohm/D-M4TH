# Security

## Authority

Client input is untrusted. The client may manage draft placement and previews, but server and engine must validate submitted actions before state changes.

## Sessions

Reconnect token parsing, validation, rotation, and revoke behavior must stay centralized server-side. Do not duplicate reconnect token logic in UI or `RoomRegistry`.

## Match Lifecycle

Closing a WebSocket is ambiguous and must not be treated as intentional leave. Intentional leave requires explicit `room:leave`.

## Deployment

Production browser bundles must not bake `localhost` WebSocket URLs. Deployment references live in [references](./references/).
