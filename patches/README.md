# Patches

Apply before building v0.1.0 images:

```bash
git apply patches/protocol-client.same-origin.patch
```

This changes the default WebSocket URL from direct `:2567` access to same-origin `/ws`, which nginx proxies to the server container.
