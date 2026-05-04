# Tech Debt Tracker

## Active Debt

- Keep `apps/web` and root typecheck green before adding new gameplay UI features.
- Keep leave/reconnect regression coverage green when touching protocol, server, or engine match lifecycle.
- Continue toast/log placement validation with browser screenshots before visual polish.
- Avoid growing `useTurnController`; split `useDraftPlacement` only when growth justifies it.
- Keep layout and state orchestration out of `App.tsx`.
- Keep CSS under focused files in `apps/web/src/styles/`.

## Watch Items

- Phone rack behavior still needs final product decision: 8-wide horizontal scroll or 4x2 wrap.
- User-opened match log can overlay gameplay on very short phone landscape; keep it user-opened and tune only if screenshots show critical controls blocked.
- Timeout penalty feedback should prefer protocol/snapshot metadata over UI score-diff guessing.
