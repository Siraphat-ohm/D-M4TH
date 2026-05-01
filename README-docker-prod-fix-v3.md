# D-M4TH Docker production fix v3

This patch makes the server image keep the monorepo layout inside the image and creates explicit workspace links for:

- `@d-m4th/game`
- `@d-m4th/config`
- `@d-m4th/protocol`

It also keeps the release workflow Dockerfile paths as `deploy/docker/Dockerfile.*`.

## Local test

```bash
docker build --no-cache -f deploy/docker/Dockerfile.server -t d-m4th-server:local .
docker run --rm -it -e PORT=2567 -p 2567:2567 d-m4th-server:local
```

In another terminal:

```bash
curl -i http://127.0.0.1:2567/health
```

## Release

Prefer a new tag, for example `v0.0.4`:

```bash
git add .
git commit -m "fix server workspace links in docker image"
git tag -a v0.0.4 -m "v0.0.4"
git push origin main
git push origin v0.0.4
```

On the server:

```bash
cd ~/D-M4TH/deploy/docker
sed -i 's|SERVER_IMAGE=.*|SERVER_IMAGE=ghcr.io/siraphat-ohm/d-m4th-server:v0.0.4|' .env
sed -i 's|WEB_IMAGE=.*|WEB_IMAGE=ghcr.io/siraphat-ohm/d-m4th-web:v0.0.4|' .env

docker compose --env-file .env -f docker-compose.prod.yml pull
docker compose --env-file .env -f docker-compose.prod.yml up -d --force-recreate
docker compose --env-file .env -f docker-compose.prod.yml ps
docker logs docker-server-1 --tail=100
```
