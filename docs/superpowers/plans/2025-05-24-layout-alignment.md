# Layout Alignment and Tightening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalize layout alignment and tighten board/rack spacing to make the UI feel cohesive and visually dominant.

**Architecture:** Update CSS styles for layout and game components to use flexbox for centering and reduce vertical gaps. Group control elements tightly below the board.

**Tech Stack:** CSS (Flexbox, CSS Variables)

---

### Task 1: Update Layout Styles

**Files:**
- Modify: `apps/web/src/styles/layout.css`

- [ ] **Step 1: Ensure `.match-topbar` is centered**

```css
.match-topbar {
  display: flex;
  justify-content: center;
  width: 100%;
  max-width: none;
  padding: 0 10px;
}
```

- [ ] **Step 2: Update `.play-surface` for centering and gap**

```css
.play-surface {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: start;
  gap: var(--match-gap);
  width: 100%;
  height: auto;
  min-height: 100%;
  padding-bottom: 20px;
}
```

- [ ] **Step 3: Update `.match-main` to use flexbox centering**

```css
.match-main {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  flex: 1;
}
```

### Task 2: Update Game Styles

**Files:**
- Modify: `apps/web/src/styles/game.css`

- [ ] **Step 1: Ensure `.board-stack` is centered with tight gap**

```css
.board-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
}
```

- [ ] **Step 2: Update `.control-strip` to use flexbox and center**

```css
.control-strip {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--match-gap);
  width: fit-content;
  max-width: 100%;
  margin: 0 auto;
  min-width: 0;
  min-height: 0;
}
```

- [ ] **Step 3: Update `.rack-panel` and `.action-panel` for compactness**

```css
.rack-panel, .action-panel {
  display: flex;
  align-items: center;
  background: var(--panel-strong);
  border: 1px solid var(--panel-border);
  padding: var(--rack-padding);
  height: var(--rack-strip-height);
}
```

- [ ] **Step 4: Ensure the board uses `--board-size` as sizing anchor**

```css
.board-host,
.app-shell--playing .board-host--game,
.board-host--preview {
  width: var(--board-size);
  height: var(--board-size);
  min-width: 0;
  max-width: none;
  min-height: 0;
  max-height: none;
  contain: layout paint size;
}
```

### Task 3: Verification

- [ ] **Step 1: Verify CSS changes**
Confirm all changes match the requested objective and instructions.

- [ ] **Step 2: Check for regressions**
Check if any other components are negatively affected by these global style changes.
