# Docker Deploy

GitHub Actions publishes:

- `ghcr.io/<owner>/<repo>-server:<tag>`
- `ghcr.io/<owner>/<repo>-web:<tag>`

For a public-IP server without a reverse proxy, expose:

- web: `http://PUBLIC_IP:8080`
- websocket server: `ws://PUBLIC_IP:2567/ws`

The web client defaults to `ws://<page-host>:2567/ws`, so the default compose file works when both containers run on the same public-IP machine.

## Run Release 0.0.1

```bash
mkdir -p d-m4th && cd d-m4th
curl -fsSLO https://raw.githubusercontent.com/OWNER/REPO/main/deploy/docker/docker-compose.prod.yml

cat > .env <<'EOF'
SERVER_IMAGE=ghcr.io/OWNER/REPO-server:v0.0.1
WEB_IMAGE=ghcr.io/OWNER/REPO-web:v0.0.1
WEB_PORT=8080
SERVER_PORT=2567
EOF

docker compose --env-file .env -f docker-compose.prod.yml pull
docker compose --env-file .env -f docker-compose.prod.yml up -d
```

Replace `OWNER/REPO` with the lowercase GitHub owner/repo path.

## Optional Custom WebSocket URL

If you later put the server behind HTTPS or a reverse proxy, set the GitHub repository variable `VITE_SERVER_URL` before building the image, for example:

```text
https://game.example.com
```

The workflow passes that value as a web build arg.
