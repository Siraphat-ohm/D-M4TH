#!/usr/bin/env sh
set -eu
BASE_URL="${1:-http://127.0.0.1:8080}"
curl -fsS "$BASE_URL/health"
printf '\n'
curl -fsSI "$BASE_URL/" | sed -n '1,10p'
