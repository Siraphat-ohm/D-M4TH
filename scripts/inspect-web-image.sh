#!/usr/bin/env sh
set -eu
IMAGE="${1:?usage: inspect-web-image.sh <web-image>}"
docker run --rm "$IMAGE" sh -lc 'grep -R "localhost\|127.0.0.1\|:2567" -n /usr/share/nginx/html || true'
