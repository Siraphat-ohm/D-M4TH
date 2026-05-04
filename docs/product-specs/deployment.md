# Deployment

## Product Behavior

Production web clients should connect to the WebSocket server through the same public web origin.

Default public endpoints for the Docker bundle:

- Web: `http://PUBLIC_IP:8080`
- Browser WebSocket: `ws://PUBLIC_IP:8080/ws`

The browser should not connect to `localhost` in production.

## Runtime Expectation

The web container serves the client through nginx and proxies WebSocket traffic to the server container on the internal Docker network.

The server container can remain private as `server:2567`.

## Configuration Rule

For normal production builds, do not set `VITE_SERVER_URL` to localhost. Vite embeds `VITE_*` variables at build time, so a localhost value becomes part of the shipped JavaScript bundle.

Operator commands live in [Docker Release](../references/docker-release.md).
