# Docker Release

This is the operator reference for the Docker deploy bundle.

The bundle serves the web client through nginx and proxies WebSocket traffic through the same web origin.

## Public Endpoints

- Web: `http://PUBLIC_IP:8080`
- Browser WebSocket: `ws://PUBLIC_IP:8080/ws`
- Internal server container: `server:2567`

The web client should not connect to `localhost` in production.

## Required Same-Origin WebSocket Fallback

Production web fallback should use the current page origin:

```ts
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
return `${protocol}//${window.location.host}/ws`;
```

This preserves custom ports like `:8080`. Do not use `window.location.hostname:2567` as the production default.

## Build Images Locally

```bash
docker build -f deploy/docker/Dockerfile.server -t d-m4th-server:v0.1.0 .
docker build -f deploy/docker/Dockerfile.web -t d-m4th-web:v0.1.0 .
```

For normal production, do not set `VITE_SERVER_URL`. Vite embeds `VITE_*` variables at build time.

## Run Locally With Built Images

```bash
cp deploy/docker/.env.example .env
sed -i 's|ghcr.io/OWNER/REPO-server:v0.1.0|d-m4th-server:v0.1.0|' .env
sed -i 's|ghcr.io/OWNER/REPO-web:v0.1.0|d-m4th-web:v0.1.0|' .env

docker compose --env-file .env -f deploy/docker/docker-compose.prod.yml up -d
```

Open:

```text
http://127.0.0.1:8080
```

Expected browser WebSocket URL:

```text
ws://127.0.0.1:8080/ws
```

## Deploy GHCR Release

```bash
mkdir -p d-m4th && cd d-m4th
curl -fsSLO https://raw.githubusercontent.com/OWNER/REPO/main/deploy/docker/docker-compose.prod.yml
curl -fsSLO https://raw.githubusercontent.com/OWNER/REPO/main/deploy/docker/.env.example
mv .env.example .env

# edit OWNER/REPO and tag if needed
vim .env

docker compose --env-file .env -f docker-compose.prod.yml pull
docker compose --env-file .env -f docker-compose.prod.yml up -d
```

## Optional Public Server Port For Debugging

Normal production does not need to expose `2567` publicly.

```bash
docker compose --env-file .env \
  -f docker-compose.prod.yml \
  -f docker-compose.expose-server.yml \
  up -d
```

Direct debug WebSocket:

```text
ws://PUBLIC_IP:2567/ws
```

## Smoke Test

```bash
curl -i http://127.0.0.1:8080/health
curl -i http://127.0.0.1:8080/
```

Create and join a room in browser. The browser must connect to `/ws` on the web port, not `localhost` and not `:2567` unless explicitly configured.

## Inspect Built Web Image For Accidental Localhost

```bash
docker run --rm "$WEB_IMAGE" sh -lc 'grep -R "localhost\|127.0.0.1" -n /usr/share/nginx/html || true'
```

Expected production output: no matches.
