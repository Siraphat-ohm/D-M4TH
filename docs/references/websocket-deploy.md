# WebSocket Deploy

## Production Rule

The browser should connect to WebSocket through the same public origin as the web app:

```text
ws://PUBLIC_IP:8080/ws
```

For HTTPS:

```text
wss://PUBLIC_HOST/ws
```

## Avoid

- Do not ship production browser bundles that connect to `localhost`.
- Do not default production browser traffic to `:2567` unless direct server exposure is intentionally configured.
- Do not expose server port `2567` publicly for normal production.

## Reference

Docker-specific commands live in [Docker Release](./docker-release.md).
