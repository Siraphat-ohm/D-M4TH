# D-M4TH Docker Deploy v0.1.0

This deploy bundle serves the web client through nginx and proxies WebSocket traffic through the same web origin.

Default public endpoints:

- Web: `http://PUBLIC_IP:8080`
- WebSocket used by the browser: `ws://PUBLIC_IP:8080/ws`
- Server container remains internal on Docker network as `server:2567`

The web client should not connect to `localhost` in production.

## Required app code change

Apply `patches/protocol-client.same-origin.patch` before building v0.1.0 images. The important fallback is:

```ts
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
return `${protocol}//${window.location.host}/ws`;
```

That keeps custom ports like `:8080`. Do not use `window.location.hostname:2567` as the production default.

## Build images locally

From repository root:

```bash
docker build -f deploy/docker/Dockerfile.server -t d-m4th-server:v0.1.0 .
docker build -f deploy/docker/Dockerfile.web -t d-m4th-web:v0.1.0 .
```

For normal production, do not set `VITE_SERVER_URL`. Vite embeds `VITE_*` variables at build time, so setting it to localhost will bake localhost into the JavaScript bundle.

## Run locally with built images

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

Expected WebSocket URL in browser devtools:

```text
ws://127.0.0.1:8080/ws
```

## Deploy GHCR release

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

## Optional public server port for debugging

Normal production does not need to expose `2567` publicly. If debugging direct WebSocket access:

```bash
docker compose --env-file .env \
  -f docker-compose.prod.yml \
  -f docker-compose.expose-server.yml \
  up -d
```

Then direct server WebSocket is also available at:

```text
ws://PUBLIC_IP:2567/ws
```

## Smoke test

```bash
curl -i http://127.0.0.1:8080/health
curl -i http://127.0.0.1:8080/
```

Then open the site and create/join a room. The browser must connect to `/ws` on the web port, not `localhost` and not `:2567` unless you explicitly configured it.

## Inspect built web image for accidental localhost

```bash
docker run --rm "$WEB_IMAGE" sh -lc 'grep -R "localhost\|127.0.0.1" -n /usr/share/nginx/html || true'
```

Expected output for production image: no matches.
