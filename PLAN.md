# D-M4TH UI Redesign Plan

## Current State Audit (45 problems)

### Critical — Blocks Mobile Usability

1. **Board cells ~23px on phone** — `calc(100vh - 180px)` on 375px iPhone yields cells too small for touch (44px min). Tile labels ~8.5px, unreadable.
2. **Single breakpoint at 820px** — No tablet-specific layout. Portrait tablet gets same stacked layout as phone.
3. **Premium cell labels 7px on mobile** — `Math.max(7, cellSize * 0.18)` fails at small cell sizes. Start star also too small.

### High — Degrades Gameplay Experience

4. **No turn indicator on the board** — Only indicator is sidebar HUD. On mobile, sidebar scrolled off = no way to know whose turn.
5. **Sidebar pushes board below fold on mobile** — No collapse/hide mechanism during gameplay. Must scroll past lobby/HUD to see board.
6. **Board `scene.children.removeAll()` rebuilds 500+ objects** — Every prop change = full teardown. Causes visual stuttering during rapid interactions.
7. **Action bar has no visual hierarchy** — Play/Swap/Pass/Recall all equal styling. No grouping of commit vs correction actions.
8. **Play button disabled state doesn't explain why** — Same gray for "not your turn" and "no tiles placed."
9. **No mobile touch drag alternative** — Only HTML5 drag. Tap-to-select + tap-on-board works but has no visual teaching cue.
10. **Preview score appears with zero animation** — Static green text, no scale/pulse/reward feel.

### Medium — Visual/UX Polish Gaps

11. **Zero border-radius everywhere** — Deliberate pixel art, but fights Balatro's rounded card aesthetic.
12. **Color-to-meaning inconsistent** — Gold, cyan, mint all signal "active/important" in different contexts.
13. **Panel pseudo-labels `[ rack ]` `[ action bar ]` are noise** — No functional purpose, visual clutter.
14. **Global `text-shadow: 1px 1px 0 #000` muddies small text** — Bad on tile value labels, muted labels.
15. **Phaser background `#141414` doesn't match design system** `--bg: #060911` — Visible color mismatch between CSS and canvas.
16. **Tiles flat bevel, no depth** — Two rectangles same color, reads as stamped not raised.
17. **Ghost tiles at 0.55 alpha look broken** — No border/animation to communicate "opponent placing."
18. **Tiles disappear from rack when drafted** — No ghost/placeholder, remaining tiles jump positions.
19. **Recall button label change subtle** — "Recall" vs "Cancel" same style, easy to miss mode switch.
20. **Room code crammed next to copy button** — Most important lobby info not prominent enough.
21. **No loading state for Phaser board** — Dark empty rectangle while Phaser loads.
22. **Notice has no dismissal** — Persists until next server message. No close/auto-dismiss.
23. **Face dialog no keyboard trap** — Tab escapes, no Escape shortcut, no autoFocus.
24. **Face buttons no hover states** — Inline styles bypass CSS hover effects.
25. **Color picker custom input resets to black** — After selecting preset, custom shows black.

### Missing Balatro Feel

26. **No card depth/layering** — Flat bevels vs Balatro's raised cards with elevation shadows.
27. **No gradients on tiles/panels** — Everything flat solid. Balatro uses radial gradients for volume.
28. **No animation system** — Only `.selected` translateY(-4px). No placement, scoring, turn-change, rack shuffle animations.
29. **No micro-interactions on buttons** — No press scale, no ripple, no glow pulse.
30. **No scoring reward feedback** — Static text vs Balatro's flying numbers, pulses, screen effects.
31. **No ambient board motion** — Premium cells don't pulse, star doesn't glow, board is dead grid.
32. **No typographic hierarchy** — All Silkscreen 400. `strong` = same weight. No dramatic score/label/detail scale.
33. **No background texture** — Minimal grid pattern. Balatro uses felt texture, noise, depth-of-field.
34. **No effect/animation infrastructure** — No event bus, no animation queue for future audio sync.

### Low — Minor Inconsistencies

35. **No horizontal overflow protection** at intermediate widths.
36. **Face dialog no max-height/scroll** for many options.
37. **`.puzzle-phaser-stage` unused CSS** — Dead class.
38. **HUD timer re-renders full player list** — Could optimize to only update time cells.
39. **Lobby form no validation feedback** — Errors in disconnected notice bar.
40. **Player swatch 14x14px** — Below touch target, nearly invisible on small screens.
41. **No player separator for 6-player party mode** — Rows blend together.
42. **`thisCanvasWidth()` queries DOM directly** — Should use Phaser scale manager.
43. **Control strip two-column grid breaks at intermediate widths** — Action buttons wrap unpredictably.
44. **No sound-synchronized visual infrastructure** — No event bus for audio pairing.
45. **Rack 8→4 column transition abrupt** — No intermediate layout.

## Redesign Approach

### Phase 1: Mobile Foundation
- Fix board sizing for phone screens (min cell size, scroll/zoom)
- Add tablet breakpoint (~600-820px)
- Collapsible sidebar during gameplay
- Fix premium label readability

### Phase 2: Balatro Visual System
- Card-like tile rendering (gradients, elevation shadows, rounded corners for tiles)
- Rich panel styling (inner gradients, layered borders)
- Background atmosphere (subtle noise/texture overlay)
- Consistent color hierarchy (gold=primary, cyan=selection, mint=success, rose=danger)

### Phase 3: Animation & Feedback
- Tile placement animation (slide + settle bounce)
- Preview score animation (scale in, pulse)
- Turn change feedback (board border glow, "YOUR TURN" flash)
- Button micro-interactions (press scale, hover glow)
- Rack tile shuffle animation on draw

### Phase 4: Board Enhancement
- Ambient premium cell glow/pulse
- Start star animation
- Ghost tile styling (dashed border, subtle pulse)
- Phaser incremental render (don't destroy all children)

### Phase 5: Polish
- Loading state for board
- Notice auto-dismiss + animation
- Face dialog keyboard support
- Typography hierarchy
- Sound-ready animation infrastructure
