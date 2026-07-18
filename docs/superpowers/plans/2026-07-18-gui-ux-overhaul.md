# GUI UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all four GUI surfaces (title, VAB, flight HUD, orbit map) in a Retro NASA / Apollo diegetic visual language with Vintage/Modern dual theme, and fix the three Critical UX defects plus add a full pause/settings overlay.

**Architecture:** CSS custom-property design tokens + eight hand-written class-based components consumed by the existing hand-rolled-DOM screens. Mode switch via `<html data-theme="vintage|modern">`. No framework rewrite. New FSM `PAUSED` state freezes physics.

**Tech Stack:** TypeScript, Three.js (canvas scenes unchanged), vitest, Vite. Two bundled webfonts (VT323 + IBM Plex Mono). Spec: `docs/superpowers/specs/2026-07-18-gui-ux-overhaul-design.md`.

**Rollout:** Per-step commits, one PR per step. Order: pre-flight → tokens → components → 4 screen restyles → 3 Criticals → pause overlay → a11y/responsive/cleanup.

---

## File Structure

**New files:**
- `src/styles/tokens.css` — all CSS custom properties (both themes).
- `src/styles/base.css` — reset, base element styles, scanline overlay.
- `src/styles/components.css` — class definitions for all 8 components.
- `src/styles/screens/title.css`, `vab.css`, `flight-hud.css`, `orbit-map.css` — per-screen rules.
- `src/styles/fonts.css` — `@font-face` declarations for the two bundled webfonts.
- `src/ui/theme.ts` — `applyTheme()`, `toggleTheme()`, persisted choice, reduced-motion handling.
- `src/ui/components/panel.ts`, `readout.ts`, `dsky-key.ts`, `toggle.ts`, `gauge.ts`, `banner.ts`, `toast.ts`, `tooltip.ts` — one TS class per component.
- `src/ui/settings-overlay.ts` — the pause/settings overlay.
- `public/fonts/VT323-Regular.woff2`, `public/fonts/IBMPlexMono-Regular.woff2`, `IBMPlexMono-Bold.woff2` — bundled font files (downloaded by Step 1).
- `test/tokens.test.ts`, `theme.test.ts`, `readout.test.ts`, `gauge.test.ts`, `crash-detection.test.ts`, `vab-readiness.test.ts`, `pause.test.ts`.

**Modified files:**
- `index.html` — link the new stylesheets in order; add `data-theme` attribute; drop the inline loader styles into `base.css` later (Step 9).
- `src/main.ts` — wire theme boot, Esc handler, settings overlay, FSM PAUSED gating, QUIT TO MENU teardown.
- `src/core/state-machine.ts` — add `'PAUSED'` state; allow `BUILD|FLIGHT → INIT`; transition guards.
- `src/ui/main-menu.ts` — restyle to use components; add controls card.
- `src/ui/menu-scene.ts` — slow orbit 4× under reduced-motion.
- `src/ui/hud.ts` — restyle to use `.panel` + `.readout` + `.gauge`.
- `src/ui/hold-panel.ts` — restyle to use `.dsky-key` with labels.
- `src/ui/staging-display.ts` — restyle slots.
- `src/ui/flight-prompts.ts` — restyle to `.toast`.
- `src/ui/orbit-map.ts` — restyle overlay to `.panel` + `.readout`; add body labels + legend.
- `src/ui/win-states.ts` — restyle banner to `.banner`; add planet-crash branch using `lastImpactSpeed`.
- `src/ui/vab-ui.ts` — restyle palette/actions to `.panel` + `.dsky-key`; add readiness status line + tooltip; TELEMETRY stub.
- `src/flight/flight-controller.ts` — record `lastImpactSpeed` before `clampToTerrain`.
- `src/entities/ship.ts` — extend `canLaunch` to return a reason.
- `vite.config.ts` — add `define` for build SHA injection (Step 3).

**Deleted (Step 9):** the monolithic `src/styles.css` once every screen has migrated.

---

## Pre-Flight Task: Clean working tree + branch

The repo currently has the navball fix uncommitted on `master`, plus the new `docs/` (spec + this plan). Before any overhaul work, commit those and create a feature branch so each Step can be its own commit/PR.

**Files:** none (git operations only).

- [ ] **Step 0.1: Verify the navball tests still pass**

Run: `cd "C:/Users/sydne/OneDrive/Documents/Ai Gaming/Projects/Project-Orbital-Frogs" && npx vitest run`
Expected: 27 passed (13 original + 14 navball-orientation). If any fail, STOP — the navball fix is the foundation; do not proceed.

- [ ] **Step 0.2: Typecheck clean**

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 0.3: Commit the navball fix + docs on master**

```bash
cd "C:/Users/sydne/OneDrive/Documents/Ai Gaming/Projects/Project-Orbital-Frogs"
git add src/ui/navball.ts src/ui/navball-orientation.ts test/navball-orientation.test.ts docs/
git commit -m "fix(navball): singularity-free orientation math + UX/overhaul design docs

- Extract navball pitch/heading/roll/projection into testable module
- Fixes: roll dead at vertical, spurious 180 on pitch, horizon clamp at ±52°
- 14 new unit tests; all 27 tests green
- Adds UX review, navball investigation, and GUI overhaul design spec"
```

Expected: commit succeeds; `git status` shows clean working tree.

- [ ] **Step 0.4: Create and switch to the feature branch**

```bash
git checkout -b feat/gui-ux-overhaul
```

Expected: on branch `feat/gui-ux-overhaul`.

---

(Step 1 follows in the next section of this plan.)

---

## Step 1: Design tokens, base styles, and theme module

**Goal:** Land the foundation with **no screen changes** — existing screens must look identical after this step. Safe checkpoint.

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/fonts.css`, `src/ui/theme.ts`, `public/fonts/VT323-Regular.woff2`, `public/fonts/IBMPlexMono-Regular.woff2`, `public/fonts/IBMPlexMono-Bold.woff2`
- Modify: `index.html` (link stylesheets, add `data-theme`, add `class` to `<html>`)
- Test: `test/tokens.test.ts`, `test/theme.test.ts`

### Task 1.1: Download and place the two webfonts

- [ ] **Step 1.1.1: Download VT323 and IBM Plex Mono woff2 files**

Run from the project root:
```bash
cd "C:/Users/sydne/OneDrive/Documents/Ai Gaming/Projects/Project-Orbital-Frogs"
mkdir -p public/fonts
curl -L -o public/fonts/VT323-Regular.woff2 "https://fonts.gstatic.com/s/vt323/v17/pxiKyp0ihIEF2isfFJU.woff2"
curl -L -o public/fonts/IBMPlexMono-Regular.woff2 "https://fonts.gstatic.com/s/ibmplexmono/v19/-F63fjptAgt5VC-kw3CHqLsy1Qf4OtWV.woff2"
curl -L -o public/fonts/IBMPlexMono-Bold.woff2 "https://fonts.gstatic.com/s/ibmplexmono/v19/-F6qfjptAgt5VC-kw3CHqLsy1Qf4OtWV.woff2"
ls -la public/fonts/
```
Expected: three `.woff2` files, each >10KB. If any download fails (Google occasionally changes URLs), fall back to downloading from the google-webfonts helper at `https://gwfh.mranftl.com/fonts` — pick VT323 regular and IBM Plex Mono regular+bold, woff2, subset Latin.

- [ ] **Step 1.1.2: Verify the files are valid woff2 (not HTML error pages)**

Run: `file public/fonts/*.woff2`
Expected: each shows "Web Open Font Format (Version 2)" or similar binary signature — NOT "HTML document".

### Task 1.2: Write the fonts stylesheet

- [ ] **Step 1.2.1: Create `src/styles/fonts.css`**

```css
/* src/styles/fonts.css — bundled webfonts (self-contained, no network dependency). */
@font-face {
  font-family: 'VT323';
  src: url('/fonts/VT323-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'IBM Plex Mono';
  src: url('/fonts/IBMPlexMono-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'IBM Plex Mono';
  src: url('/fonts/IBMPlexMono-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

### Task 1.3: Write the tokens stylesheet

- [ ] **Step 1.3.1: Create `src/styles/tokens.css`**

```css
/* src/styles/tokens.css — all design tokens. No other CSS file may define colors directly. */
:root {
  /* Typography */
  --font-display: 'VT323', 'IBM Plex Mono', monospace;
  --font-body: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
  --fs-readout: 32px;
  --fs-label: 12px;
  --fs-body: 14px;
  --tracking-mono: 0.08em;

  /* Spacing (4px base, rem-based for scaling) */
  --sp-1: 0.25rem;
  --sp-2: 0.5rem;
  --sp-3: 0.75rem;
  --sp-4: 1rem;
  --sp-5: 1.5rem;
  --sp-6: 2rem;

  /* Radii */
  --r-bezel: 2px;
  --r-key: 1px;

  /* Motion */
  --t-fast: 80ms;
  --t-med: 160ms;
  --t-scanline-drift: 8s;
  --t-toast: 4s;

  /* CRT effect flags (swapped by theme) */
  --crt-scanlines: 0;
  --crt-bloom: 0;
  --crt-flicker: 0;
}

/* Modern theme: crisp, high-contrast, no CRT effects. Default. */
[data-theme='modern'] {
  --ink: #d8e4d0;
  --ink-dim: #9aa89a;
  --ink-faint: #5a6a5a;
  --amber: #ffae42;
  --warn: #ffd23f;
  --green: #6bd96b;
  --red: #ff5a5a;
  --cyan: #5ad1ff;
  --phosphor-bg: #0a0f0a;
  --panel-bg: rgba(12, 18, 12, 0.85);
  --panel-border: #2a3a2a;
  --grid-line: rgba(120, 160, 120, 0.15);
  --glow-phosphor: none;
}

/* Vintage theme: amber phosphor on black, CRT scanlines + bloom + flicker. */
[data-theme='vintage'] {
  --ink: #ffb86b;
  --ink-dim: #c89a55;
  --ink-faint: #7a5d33;
  --amber: #ffae42;
  --warn: #ffd23f;
  --green: #88dd66;
  --red: #ff6a3d;
  --cyan: #ffc870;
  --phosphor-bg: #0a0805;
  --panel-bg: rgba(16, 10, 4, 0.88);
  --panel-border: #5a3a1a;
  --grid-line: rgba(255, 174, 66, 0.18);
  --glow-phosphor: 0 0 6px var(--amber);
  --crt-scanlines: 1;
  --crt-bloom: 1;
  --crt-flicker: 1;
}

/* Reduced motion: suppress ALL motion regardless of chosen theme. */
@media (prefers-reduced-motion: reduce) {
  :root {
    --crt-flicker: 0;
    --crt-scanlines: 0;
    --t-scanline-drift: 0s;
  }
}
```

### Task 1.4: Write the failing tokens test

- [ ] **Step 1.4.1: Create `test/tokens.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcStyles = join(__dirname, '..', 'src', 'styles');

// Token names that MUST be defined in both themes.
const REQUIRED_COLOR_TOKENS = ['--ink', '--ink-dim', '--ink-faint', '--amber', '--warn', '--green', '--red', '--cyan', '--phosphor-bg', '--panel-bg', '--panel-border', '--grid-line'];

function readStyle(name: string): string {
  return readFileSync(join(srcStyles, name), 'utf8');
}

describe('tokens.css', () => {
  it('defines every required color token in both themes', () => {
    const css = readStyle('tokens.css');
    for (const tok of REQUIRED_COLOR_TOKENS) {
      expect(css, `${tok} in modern`).toContain(`[data-theme='modern']`);
      expect(css, `${tok} in vintage`).toContain(`[data-theme='vintage']`);
      // Token defined somewhere (in both blocks). Check both blocks contain it.
      const modernBlock = css.match(/\[data-theme='modern'\]\s*\{([^}]*)\}/s);
      const vintageBlock = css.match(/\[data-theme='vintage'\]\s*\{([^}]*)\}/s);
      expect(modernBlock, 'modern theme block exists').not.toBeNull();
      expect(vintageBlock, 'vintage theme block exists').not.toBeNull();
      expect(modernBlock![1], `${tok} missing in modern`).toContain(tok);
      expect(vintageBlock![1], `${tok} missing in vintage`).toContain(tok);
    }
  });

  it('defines CRT effect flags on :root', () => {
    const css = readStyle('tokens.css');
    expect(css).toContain('--crt-scanlines');
    expect(css).toContain('--crt-bloom');
    expect(css).toContain('--crt-flicker');
  });

  it('respects prefers-reduced-motion by forcing CRT effects off', () => {
    const css = readStyle('tokens.css');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('--crt-flicker: 0');
    expect(css).toContain('--crt-scanlines: 0');
  });
});

describe('no hardcoded colors outside tokens.css', () => {
  // Only tokens.css may contain hex / rgb literals.
  const otherCssFiles = readdirSync(srcStyles).filter(f => f.endsWith('.css') && f !== 'tokens.css');
  for (const f of otherCssFiles) {
    it(`${f} has no hex colors`, () => {
      const css = readStyle(f);
      // Allow transparent / currentColor / inherit / var(--...) only.
      expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(css).not.toMatch(/\brgb[a]?\(/);
    });
  }
});
```

- [ ] **Step 1.4.2: Run the test to verify it fails**

Run: `npx vitest run test/tokens.test.ts`
Expected: FAIL — `tokens.css` doesn't exist yet (readdirSync fails) OR the "no hardcoded colors" test fails because `src/styles.css` (the monolith) contains hex colors. Either failure is correct.

### Task 1.5: Write the base stylesheet

- [ ] **Step 1.5.1: Create `src/styles/base.css`**

```css
/* src/styles/base.css — reset, base element styles, CRT scanline overlay. */
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; }
body {
  background: var(--phosphor-bg);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: var(--fs-body);
  letter-spacing: var(--tracking-mono);
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}

/* CRT scanline overlay — only when vintage theme AND scanlines enabled. */
body[data-theme='vintage']::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0) 0px,
    rgba(0, 0, 0, 0) 2px,
    rgba(0, 0, 0, calc(0.15 * var(--crt-scanlines))) 3px,
    rgba(0, 0, 0, calc(0.15 * var(--crt-scanlines))) 4px
  );
  animation: scanline-drift var(--t-scanline-drift) linear infinite;
}
@keyframes scanline-drift {
  0% { transform: translateY(0); }
  100% { transform: translateY(4px); }
}

/* Focus ring — accessibility (Critical a11y gap from review). */
:focus-visible {
  outline: 2px solid var(--amber);
  outline-offset: 2px;
}
```

### Task 1.6: Write the theme module + its test

- [ ] **Step 1.6.1: Create `src/ui/theme.ts`**

```ts
// src/ui/theme.ts
export type Theme = 'vintage' | 'modern';

const STORAGE_KEY = 'orbital-theme';
const REDUCED_MOTION_OVERRIDE_KEY = 'orbital-reduced-motion-override';

function systemReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Effective reduced-motion: OS pref unless the user has explicitly overridden. */
export function reducedMotionEnabled(): boolean {
  const override = localStorage.getItem(REDUCED_MOTION_OVERRIDE_KEY);
  if (override === 'on') return true;
  if (override === 'off') return false;
  return systemReducedMotion();
}

/** The user's chosen theme (defaults to Modern on first load). */
export function currentTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'vintage' ? 'vintage' : 'modern';
}

/** Apply a theme to <html data-theme="..."> + <body data-theme="..."> (body for the ::before). */
export function applyTheme(theme: Theme): void {
  const t = theme === 'vintage' ? 'vintage' : 'modern';
  document.documentElement.setAttribute('data-theme', t);
  document.body.setAttribute('data-theme', t);
  localStorage.setItem(STORAGE_KEY, t);
}

/** Toggle between vintage and modern. Returns the new theme. */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'vintage' ? 'modern' : 'vintage';
  applyTheme(next);
  return next;
}

/** Force reduced-motion on or off (user override in settings). */
export function setReducedMotionOverride(state: 'on' | 'off' | 'auto'): void {
  if (state === 'auto') localStorage.removeItem(REDUCED_MOTION_OVERRIDE_KEY);
  else localStorage.setItem(REDUCED_MOTION_OVERRIDE_KEY, state);
}

/** Boot: read stored theme (default Modern), apply, listen for OS pref changes. */
export function initTheme(): void {
  applyTheme(currentTheme());
  if (window.matchMedia) {
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
      // Re-apply so CSS variables recompute if no explicit override.
      applyTheme(currentTheme());
    });
  }
}
```

- [ ] **Step 1.6.2: Create `test/theme.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme, currentTheme, toggleTheme, reducedMotionEnabled, setReducedMotionOverride } from '../src/ui/theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.body.removeAttribute('data-theme');
});

describe('theme module', () => {
  it('defaults to modern when nothing is stored', () => {
    expect(currentTheme()).toBe('modern');
  });

  it('applyTheme sets data-theme on <html> and <body> and persists', () => {
    applyTheme('vintage');
    expect(document.documentElement.getAttribute('data-theme')).toBe('vintage');
    expect(document.body.getAttribute('data-theme')).toBe('vintage');
    expect(localStorage.getItem('orbital-theme')).toBe('vintage');
    expect(currentTheme()).toBe('vintage');
  });

  it('toggleTheme flips between vintage and modern', () => {
    applyTheme('modern');
    expect(toggleTheme()).toBe('vintage');
    expect(toggleTheme()).toBe('modern');
  });

  it('reducedMotionEnabled respects explicit override on', () => {
    setReducedMotionOverride('on');
    expect(reducedMotionEnabled()).toBe(true);
  });

  it('reducedMotionEnabled respects explicit override off even if OS pref set', () => {
    setReducedMotionOverride('off');
    // jsdom default: matchMedia not implemented → systemReducedMotion returns false anyway.
    expect(reducedMotionEnabled()).toBe(false);
  });

  it('setReducedMotionOverride("auto") clears the override', () => {
    setReducedMotionOverride('on');
    setReducedMotionOverride('auto');
    expect(localStorage.getItem('orbital-reduced-motion-override')).toBeNull();
  });
});
```

- [ ] **Step 1.6.3: Run the theme tests to verify they fail/pass**

Run: `npx vitest run test/theme.test.ts`
Expected: most PASS (the module exists). The "defaults to modern" test should pass. If the reduced-motion tests fail because the test environment's `localStorage`/`matchMedia` aren't available, install jsdom: `npm i -D jsdom` and add `environment: 'jsdom'` to `test/` in `vite.config.ts` (or per-file `// @vitest-environment jsdom` at the top of `test/theme.test.ts`).

### Task 1.7: Wire stylesheets into index.html + boot theme

- [ ] **Step 1.7.1: Modify `index.html` — set html lang/data-theme, link the new stylesheets**

Edit the `<html>` tag and `<head>` of `index.html`:

Replace:
```html
<html lang="en">
```
with:
```html
<html lang="en" data-theme="modern">
```

And just before the closing `</head>` (after the inline `<style>` block for `#loader`), add:
```html
    <!-- GUI overhaul stylesheets (load after inline loader styles). -->
    <link rel="stylesheet" href="/src/styles/fonts.css" />
    <link rel="stylesheet" href="/src/styles/tokens.css" />
    <link rel="stylesheet" href="/src/styles/base.css" />
    <link rel="stylesheet" href="/src/styles/components.css" />
    <link rel="stylesheet" href="/src/styles/screens/title.css" />
    <link rel="stylesheet" href="/src/styles/screens/vab.css" />
    <link rel="stylesheet" href="/src/styles/screens/flight-hud.css" />
    <link rel="stylesheet" href="/src/styles/screens/orbit-map.css" />
    <!-- Legacy monolith; removed in Step 9 once every screen migrates. -->
    <link rel="stylesheet" href="/src/styles.css" />
```

(The screen-specific CSS files don't exist yet — Step 2-6 create them. For Step 1, create empty placeholder files so the `<link>`s don't 404 during verification.)

- [ ] **Step 1.7.2: Create empty placeholder screen stylesheets + components.css**

Run:
```bash
cd "C:/Users/sydne/OneDrive/Documents/Ai Gaming/Projects/Project-Orbital-Frogs"
mkdir -p src/styles/screens
touch src/styles/components.css
touch src/styles/screens/title.css src/styles/screens/vab.css src/styles/screens/flight-hud.css src/styles/screens/orbit-map.css
```

- [ ] **Step 1.7.3: Boot the theme on startup — modify `src/main.ts`**

Find the line near the top of `src/main.ts` where assets/loader init happens (around the `const manager = new THREE.LoadingManager()` / `initAssets` area, ~L28-37). Just before the `assets.ready.then(...)` call, add:

```ts
// GUI overhaul: apply persisted theme on boot.
import { initTheme } from './ui/theme';
initTheme();
```

(Place the `import` at the top of the file with the other imports; place the `initTheme()` call in the bootstrap sequence before the loader fade.)

- [ ] **Step 1.7.4: Verify the dev server boots with the new theme applied**

Run the dev server (renderer-only config):
```bash
cat > vite.renderer.config.ts <<'EOF'
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [],
  server: { open: false, port: 5183, host: '127.0.0.1' },
  test: { globals: true, environment: 'node' },
});
EOF
npx vite --config vite.renderer.config.ts &
sleep 6
```
Open `http://127.0.0.1:5183/` in a browser, open devtools, and confirm:
- `<html>` has `data-theme="modern"`.
- Computed `body` background is `rgb(10, 15, 10)` (the `--phosphor-bg`).
- No 404s for any stylesheet in the Network tab.
- The existing title screen still renders (visual unchanged — no screen rules applied yet).

If anything is broken, STOP and fix before continuing.

### Task 1.8: Commit Step 1

- [ ] **Step 1.8.1: Run all tests + typecheck**

```bash
npx vitest run
npx tsc --noEmit
```
Expected: all tests green (27 prior + new tokens/theme tests). tsc exit 0.

- [ ] **Step 1.8.2: Clean up the temp renderer config**

```bash
rm vite.renderer.config.ts
```

- [ ] **Step 1.8.3: Commit**

```bash
git add src/styles/ src/ui/theme.ts public/fonts/ test/tokens.test.ts test/theme.test.ts index.html src/main.ts package.json package-lock.json
git commit -m "feat(gui): step 1 — design tokens, base styles, theme module

- tokens.css: modern + vintage themes, DSKY palette, --warn added
- base.css: reset, focus-visible ring, CRT scanline overlay (vintage only)
- theme.ts: applyTheme/toggleTheme/initTheme, persisted, reduced-motion aware
- fonts: bundled VT323 + IBM Plex Mono woff2 (no network dep)
- No screen changes; existing screens unchanged (safe checkpoint)

Spec: docs/superpowers/specs/2026-07-18-gui-ux-overhaul-design.md §3"
```
Expected: commit succeeds; working tree clean.

---

## Step 2: Shared components (8 classes)

**Goal:** Build all eight components + `components.css`. No screen consumes them yet — this step just proves the component library works in isolation. Verified by unit tests (Readout, Gauge state mapping) + a manual smoke page.

**Files:**
- Create: `src/ui/components/panel.ts`, `readout.ts`, `dsky-key.ts`, `toggle.ts`, `gauge.ts`, `banner.ts`, `toast.ts`, `tooltip.ts`, `index.ts` (barrel)
- Modify: `src/styles/components.css` (currently empty placeholder)
- Test: `test/readout.test.ts`, `test/gauge.test.ts`

### Task 2.1: Write components.css (all 8 classes)

- [ ] **Step 2.1.1: Fill `src/styles/components.css`**

```css
/* src/styles/components.css — all 8 component classes. Consumes only tokens. */

/* ---- Panel ---- */
.panel {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: var(--r-bezel);
  backdrop-filter: blur(4px);
  padding: var(--sp-3);
  position: relative;
}
.panel[data-label]::before {
  content: attr(data-label);
  position: absolute;
  top: -8px;
  left: var(--sp-3);
  background: var(--phosphor-bg);
  padding: 0 var(--sp-2);
  font-family: var(--font-body);
  font-size: var(--fs-label);
  color: var(--ink-dim);
  letter-spacing: var(--tracking-mono);
  text-transform: uppercase;
}

/* ---- Readout ---- */
.readout {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  font-family: var(--font-body);
}
.readout__label {
  font-size: var(--fs-label);
  color: var(--ink-dim);
  text-transform: uppercase;
  letter-spacing: var(--tracking-mono);
  min-width: 2.5rem;
}
.readout__value {
  font-family: var(--font-display);
  font-size: var(--fs-readout);
  color: var(--ink);
  text-shadow: var(--glow-phosphor);
  line-height: 1;
}
.readout__unit {
  font-size: var(--fs-label);
  color: var(--ink-dim);
}
.readout[data-state='nominal'] .readout__value::before { content: '● '; color: var(--green); }
.readout[data-state='caution'] .readout__value::before { content: '▲ '; color: var(--warn); }
.readout[data-state='alarm']    .readout__value { color: var(--red); }
.readout[data-state='alarm']    .readout__value::before { content: '■ '; color: var(--red); }

/* ---- DSKY key (button) ---- */
.dsky-key {
  background: transparent;
  border: 1px solid var(--panel-border);
  border-radius: var(--r-key);
  color: var(--ink);
  font-family: var(--font-body);
  padding: var(--sp-2) var(--sp-3);
  cursor: pointer;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 5rem;
  transition: border-color var(--t-fast), background var(--t-fast);
}
.dsky-key:hover { border-color: var(--amber); }
.dsky-key:active, .dsky-key[data-active] {
  background: var(--amber);
  color: var(--phosphor-bg);
  border-color: var(--amber);
  box-shadow: inset 0 0 0 1px var(--phosphor-bg);
}
.dsky-key:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  border-color: var(--ink-faint);
}
.dsky-key:disabled:hover { border-color: var(--ink-faint); }
.dsky-key__word { font-size: var(--fs-body); letter-spacing: var(--tracking-mono); }
.dsky-key__hint { font-size: var(--fs-label); color: var(--ink-dim); letter-spacing: 0; }
.dsky-key:active .dsky-key__hint, .dsky-key[data-active] .dsky-key__hint { color: var(--phosphor-bg); }

/* ---- Toggle switch ---- */
.toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  font-family: var(--font-body);
  font-size: var(--fs-body);
  color: var(--ink);
  cursor: pointer;
  user-select: none;
}
.toggle input { display: none; }
.toggle__track {
  width: 36px;
  height: 16px;
  background: var(--phosphor-bg);
  border: 1px solid var(--panel-border);
  border-radius: var(--r-key);
  position: relative;
  transition: border-color var(--t-fast);
}
.toggle__thumb {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 12px;
  height: 12px;
  background: var(--ink-dim);
  transition: transform var(--t-fast), background var(--t-fast);
}
.toggle input:checked + .toggle__track { border-color: var(--green); }
.toggle input:checked + .toggle__track .toggle__thumb {
  transform: translateX(20px);
  background: var(--green);
}

/* ---- Gauge ---- */
.gauge { display: inline-block; }
.gauge__svg { display: block; }
.gauge__value {
  font-family: var(--font-display);
  font-size: var(--fs-label);
  color: var(--ink-dim);
  text-align: center;
}
.gauge[data-kind='bar'] .gauge__svg { width: 100%; height: 8px; }
.gauge[data-kind='arc']  .gauge__svg { width: 60px; height: 60px; }

/* ---- Banner (full-width event) ---- */
.banner {
  position: fixed;
  top: 30%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: none;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: var(--r-bezel);
  padding: var(--sp-4) var(--sp-5);
  text-align: center;
  backdrop-filter: blur(6px);
}
.banner[data-tone='success'] { border-color: var(--green); }
.banner[data-tone='info']    { border-color: var(--cyan); }
.banner[data-tone='alarm']   { border-color: var(--red); }
.banner__headline {
  font-family: var(--font-display);
  font-size: 28px;
  color: var(--ink);
  text-shadow: var(--glow-phosphor);
}
.banner[data-tone='alarm'] .banner__headline { color: var(--red); animation: banner-pulse 1.2s ease-in-out infinite; }
.banner[data-tone='success'] .banner__headline { color: var(--green); }
@keyframes banner-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
.banner__detail { font-family: var(--font-body); font-size: var(--fs-label); color: var(--ink-dim); margin-top: var(--sp-1); }
@media (prefers-reduced-motion: reduce) {
  .banner[data-tone='alarm'] .banner__headline { animation: none; }
}

/* ---- Toast ---- */
.toast {
  position: fixed;
  top: var(--sp-4);
  left: 50%;
  transform: translateX(-50%);
  z-index: 90;
  display: none;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: var(--r-bezel);
  padding: var(--sp-2) var(--sp-3);
  font-family: var(--font-body);
  font-size: var(--fs-body);
  color: var(--ink);
  backdrop-filter: blur(4px);
}
.toast[data-tone='info']    { border-color: var(--cyan); }
.toast[data-tone='caution'] { border-color: var(--warn); }
.toast[data-tone='alarm']   { border-color: var(--red); }

/* ---- Tooltip ---- */
.tooltip {
  position: absolute;
  z-index: 200;
  display: none;
  background: var(--phosphor-bg);
  border: 1px solid var(--amber);
  border-radius: var(--r-key);
  padding: var(--sp-1) var(--sp-2);
  font-family: var(--font-body);
  font-size: var(--fs-label);
  color: var(--ink);
  pointer-events: none;
  white-space: nowrap;
}
.tooltip[data-visible] { display: block; }
```

### Task 2.2: Readout component (TDD)

- [ ] **Step 2.2.1: Write the failing test `test/readout.test.ts`**

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Readout } from '../src/ui/components/readout';

describe('Readout component', () => {
  it('renders label, value, and unit', () => {
    const r = new Readout('ALT', 'm');
    r.setValue('1349');
    expect(r.el.querySelector('.readout__label')!.textContent).toBe('ALT');
    expect(r.el.querySelector('.readout__value')!.textContent).toBe('1349');
    expect(r.el.querySelector('.readout__unit')!.textContent).toBe('m');
  });

  it('default state is nominal', () => {
    const r = new Readout('VEL');
    expect(r.el.dataset.state).toBe('nominal');
  });

  it('setState updates data-state', () => {
    const r = new Readout('Q');
    r.setState('alarm');
    expect(r.el.dataset.state).toBe('alarm');
  });

  it('has class readout', () => {
    const r = new Readout('X');
    expect(r.el.classList.contains('readout')).toBe(true);
  });
});
```

- [ ] **Step 2.2.2: Run the test to verify it fails**

Run: `npx vitest run test/readout.test.ts`
Expected: FAIL — `Readout` module doesn't exist (import error).

- [ ] **Step 2.2.3: Implement `src/ui/components/readout.ts`**

```ts
// src/ui/components/readout.ts
export type ReadoutState = 'nominal' | 'caution' | 'alarm';

export class Readout {
  readonly el: HTMLDivElement;
  private readonly valueEl: HTMLSpanElement;

  constructor(label: string, unit = '') {
    this.el = document.createElement('div');
    this.el.className = 'readout';
    this.el.dataset.state = 'nominal';
    this.el.innerHTML = `
      <span class="readout__label"></span>
      <span class="readout__value"></span>
      <span class="readout__unit"></span>
    `;
    this.el.querySelector('.readout__label')!.textContent = label;
    this.el.querySelector('.readout__unit')!.textContent = unit;
    this.valueEl = this.el.querySelector('.readout__value')!;
  }

  setValue(v: string | number): void {
    this.valueEl.textContent = String(v);
  }

  setState(s: ReadoutState): void {
    this.el.dataset.state = s;
  }
}
```

- [ ] **Step 2.2.4: Run the test to verify it passes**

Run: `npx vitest run test/readout.test.ts`
Expected: 4 tests PASS.

### Task 2.3: Gauge component (TDD)

- [ ] **Step 2.3.1: Write the failing test `test/gauge.test.ts`**

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Gauge } from '../src/ui/components/gauge';

describe('Gauge component', () => {
  it('bar gauge renders with data-kind=bar', () => {
    const g = new Gauge('bar');
    expect(g.el.dataset.kind).toBe('bar');
    expect(g.el.classList.contains('gauge')).toBe(true);
  });

  it('setFraction clamps 0..1 and updates value text', () => {
    const g = new Gauge('bar');
    g.setFraction(0.5, '50%');
    expect(g.el.querySelector('.gauge__value')!.textContent).toBe('50%');
    g.setFraction(2, '200%');
    // fill rect width clamped to 100% of the SVG viewBox
    const rect = g.el.querySelector('rect[data-fill]') as unknown as SVGRectElement | null;
    expect(rect).not.toBeNull();
  });

  it('setThreshold recolors the fill via data-threshold', () => {
    const g = new Gauge('bar');
    g.setThreshold('caution');
    expect(g.el.dataset.threshold).toBe('caution');
  });
});
```

- [ ] **Step 2.3.2: Run the test to verify it fails**

Run: `npx vitest run test/gauge.test.ts`
Expected: FAIL — `Gauge` module doesn't exist.

- [ ] **Step 2.3.3: Implement `src/ui/components/gauge.ts`**

```ts
// src/ui/components/gauge.ts
export type GaugeKind = 'bar' | 'arc';
export type GaugeThreshold = 'nominal' | 'caution' | 'alarm';

export class Gauge {
  readonly el: HTMLDivElement;
  private readonly fillRect: SVGRectElement;
  private readonly valueEl: HTMLSpanElement;

  constructor(kind: GaugeKind) {
    this.el = document.createElement('div');
    this.el.className = 'gauge';
    this.el.dataset.kind = kind;
    this.el.dataset.threshold = 'nominal';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 8');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.classList.add('gauge__svg');
    const bg = document.createElementNS(svgNS, 'rect');
    bg.setAttribute('x', '0'); bg.setAttribute('y', '0');
    bg.setAttribute('width', '100'); bg.setAttribute('height', '8');
    bg.setAttribute('fill', 'var(--phosphor-bg)');
    bg.setAttribute('stroke', 'var(--panel-border)');
    this.fillRect = document.createElementNS(svgNS, 'rect');
    this.fillRect.setAttribute('data-fill', '');
    this.fillRect.setAttribute('x', '0'); this.fillRect.setAttribute('y', '0');
    this.fillRect.setAttribute('width', '0'); this.fillRect.setAttribute('height', '8');
    this.fillRect.setAttribute('fill', 'var(--green)');
    svg.appendChild(bg);
    svg.appendChild(this.fillRect);
    this.el.appendChild(svg);

    this.valueEl = document.createElement('span');
    this.valueEl.className = 'gauge__value';
    this.el.appendChild(this.valueEl);
  }

  setFraction(frac: number, label = ''): void {
    const clamped = Math.max(0, Math.min(1, frac));
    this.fillRect.setAttribute('width', String(clamped * 100));
    if (label) this.valueEl.textContent = label;
  }

  setThreshold(t: GaugeThreshold): void {
    this.el.dataset.threshold = t;
    const color = t === 'alarm' ? 'var(--red)' : t === 'caution' ? 'var(--warn)' : 'var(--green)';
    this.fillRect.setAttribute('fill', color);
  }
}
```

- [ ] **Step 2.3.4: Run the test to verify it passes**

Run: `npx vitest run test/gauge.test.ts`
Expected: 3 tests PASS.

### Task 2.4: Panel, DskyKey, Toggle, Banner, Toast, Tooltip (no unit tests — visual)

These six are simple DOM builders; they're verified by the manual smoke page in Task 2.5 and by their consumers in Steps 3-8. Writing unit tests for pure DOM construction has diminishing returns (the review-skill warns against testing mock-y things); instead each gets a clear constructor + setter contract in code comments.

- [ ] **Step 2.4.1: Implement `src/ui/components/panel.ts`**

```ts
// src/ui/components/panel.ts
export class Panel {
  readonly el: HTMLDivElement;
  constructor(label?: string, variant: 'bezel' | 'flat' = 'bezel') {
    this.el = document.createElement('div');
    this.el.className = 'panel';
    this.el.dataset.variant = variant;
    if (label) this.el.dataset.label = label;
  }
}
```

- [ ] **Step 2.4.2: Implement `src/ui/components/dsky-key.ts`**

```ts
// src/ui/components/dsky-key.ts
export class DskyKey {
  readonly el: HTMLButtonElement;
  private readonly wordEl: HTMLSpanElement;
  private readonly hintEl: HTMLSpanElement;

  constructor(word: string, hint = '', onClick?: () => void) {
    this.el = document.createElement('button');
    this.el.className = 'dsky-key';
    this.el.type = 'button';
    this.wordEl = document.createElement('span');
    this.wordEl.className = 'dsky-key__word';
    this.wordEl.textContent = word;
    this.hintEl = document.createElement('span');
    this.hintEl.className = 'dsky-key__hint';
    this.hintEl.textContent = hint;
    this.el.append(this.wordEl, this.hintEl);
    if (onClick) this.el.addEventListener('click', onClick);
  }

  setActive(active: boolean): void {
    if (active) this.el.dataset.active = '';
    else delete this.el.dataset.active;
  }

  setEnabled(enabled: boolean): void {
    this.el.disabled = !enabled;
  }
}
```

- [ ] **Step 2.4.3: Implement `src/ui/components/toggle.ts`**

```ts
// src/ui/components/toggle.ts
export class Toggle {
  readonly el: HTMLLabelElement;
  readonly input: HTMLInputElement;

  constructor(label: string, checked = false, onChange?: (checked: boolean) => void) {
    this.el = document.createElement('label');
    this.el.className = 'toggle';
    this.input = document.createElement('input');
    this.input.type = 'checkbox';
    this.input.checked = checked;
    const track = document.createElement('span');
    track.className = 'toggle__track';
    const thumb = document.createElement('span');
    thumb.className = 'toggle__thumb';
    track.appendChild(thumb);
    const labelEl = document.createElement('span');
    labelEl.className = 'toggle__label';
    labelEl.textContent = label;
    this.el.append(this.input, track, labelEl);
    if (onChange) this.input.addEventListener('change', () => onChange(this.input.checked));
  }

  setChecked(checked: boolean): void {
    this.input.checked = checked;
  }
}
```

- [ ] **Step 2.4.4: Implement `src/ui/components/banner.ts`**

```ts
// src/ui/components/banner.ts
export type BannerTone = 'success' | 'info' | 'alarm';

export class Banner {
  readonly el: HTMLDivElement;
  private readonly headlineEl: HTMLDivElement;
  private readonly detailEl: HTMLDivElement;
  private hideTimer = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'banner';
    this.headlineEl = document.createElement('div');
    this.headlineEl.className = 'banner__headline';
    this.detailEl = document.createElement('div');
    this.detailEl.className = 'banner__detail';
    this.el.append(this.headlineEl, this.detailEl);
  }

  show(headline: string, tone: BannerTone, detail = '', terminal = false): void {
    this.headlineEl.textContent = headline;
    this.detailEl.textContent = detail;
    this.el.dataset.tone = tone;
    this.el.style.display = 'block';
    window.clearTimeout(this.hideTimer);
    if (!terminal) {
      this.hideTimer = window.setTimeout(() => { this.el.style.display = 'none'; }, 4000);
    }
  }

  hide(): void {
    this.el.style.display = 'none';
    window.clearTimeout(this.hideTimer);
  }
}
```

- [ ] **Step 2.4.5: Implement `src/ui/components/toast.ts`**

```ts
// src/ui/components/toast.ts
import type { BannerTone } from './banner';

export class Toast {
  readonly el: HTMLDivElement;
  private hideTimer = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'toast';
    this.el.style.display = 'none';
  }

  show(text: string, tone: BannerTone = 'info', durationMs = 4000): void {
    this.el.textContent = text;
    this.el.dataset.tone = tone;
    this.el.style.display = 'block';
    window.clearTimeout(this.hideTimer);
    if (durationMs > 0) {
      this.hideTimer = window.setTimeout(() => { this.el.style.display = 'none'; }, durationMs);
    }
  }

  hide(): void {
    this.el.style.display = 'none';
    window.clearTimeout(this.hideTimer);
  }
}
```

- [ ] **Step 2.4.6: Implement `src/ui/components/tooltip.ts`**

```ts
// src/ui/components/tooltip.ts
export class Tooltip {
  readonly el: HTMLDivElement;
  private target: HTMLElement | null = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'tooltip';
    this.el.style.display = 'none';
  }

  /** Attach to a host element; shows on mouseenter, hides on mouseleave. */
  attach(host: HTMLElement, getText: () => string): void {
    this.detach();
    this.target = host;
    host.addEventListener('mouseenter', () => {
      this.el.textContent = getText();
      this.el.style.display = 'block';
      this.el.dataset.visible = '';
      // Position above the host.
      const r = host.getBoundingClientRect();
      this.el.style.left = `${r.left + r.width / 2}px`;
      this.el.style.top = `${r.top - this.el.offsetHeight - 6}px`;
    });
    host.addEventListener('mouseleave', () => {
      this.el.style.display = 'none';
      delete this.el.dataset.visible;
    });
  }

  detach(): void {
    this.target = null;
    this.el.style.display = 'none';
  }
}
```

- [ ] **Step 2.4.7: Implement the barrel `src/ui/components/index.ts`**

```ts
// src/ui/components/index.ts
export { Panel } from './panel';
export { Readout } from './readout';
export type { ReadoutState } from './readout';
export { DskyKey } from './dsky-key';
export { Toggle } from './toggle';
export { Gauge } from './gauge';
export type { GaugeKind, GaugeThreshold } from './gauge';
export { Banner } from './banner';
export type { BannerTone } from './banner';
export { Toast } from './toast';
export { Tooltip } from './tooltip';
```

### Task 2.5: Manual smoke verification

- [ ] **Step 2.5.1: Typecheck + run all tests**

```bash
npx tsc --noEmit
npx vitest run
```
Expected: tsc exit 0; all tests green (27 + new tokens/theme/readout/gauge tests).

- [ ] **Step 2.5.2: Visual smoke check via the dev server + `__game`**

Start the dev server (same `vite.renderer.config.ts` pattern as Step 1.7.4). In the browser console, instantiate each component and append to body:

```js
const { Panel, Readout, DskyKey, Toggle, Gauge, Banner, Toast, Tooltip } = await import('/src/ui/components/index.ts');
const p = new Panel('TELEMETRY'); const r = new Readout('ALT', 'm'); r.setValue('1349'); r.setState('alarm');
p.el.appendChild(r.el); document.body.appendChild(p.el);
const k = new DskyKey('LAUNCH', 'to flight'); document.body.appendChild(k.el);
const t = new Toggle('CRT FX'); document.body.appendChild(t.el);
const g = new Gauge('bar'); g.setFraction(0.7, '70%'); g.setThreshold('caution'); document.body.appendChild(g.el);
const b = new Banner(); b.show('TEST', 'alarm', 'detail', false); document.body.appendChild(b.el);
const tt = new Toast(); tt.show('hello', 'info'); document.body.appendChild(tt.el);
```

Expected: each component renders with the Modern theme styling. Toggle the theme in devtools (`document.documentElement.setAttribute('data-theme','vintage')`) and confirm the palette + scanline overlay flip.

### Task 2.6: Commit Step 2

- [ ] **Step 2.6.1: Commit**

```bash
git add src/ui/components/ src/styles/components.css test/readout.test.ts test/gauge.test.ts
git commit -m "feat(gui): step 2 — shared component library (8 classes)

- panel, readout, dsky-key, toggle, gauge, banner, toast, tooltip
- TDD for readout + gauge (state mapping); pure-DOM for the rest
- All consume tokens only; flip cleanly between modern/vintage
- No screens consume them yet (verified via smoke page)

Spec §4"

---

## Step 3: Restyle title menu + add controls card (Critical #3)

**Goal:** Title menu rebuilt with components; controls card added (closes Critical #3). Boot-screen feel.

**Files:**
- Modify: `src/ui/main-menu.ts` (full rewrite of DOM construction; keep button behavior)
- Modify: `src/styles/screens/title.css`
- Modify: `src/main.ts` (inject build SHA via Vite `define`)
- Modify: `vite.config.ts` (add `define` for `__BUILD_SHA__`)

### Task 3.1: Wire the build SHA into Vite

- [ ] **Step 3.1.1: Modify `vite.config.ts` — add `define`**

In `vite.config.ts`, add inside `defineConfig({...})`:
```ts
define: {
  __BUILD_SHA__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev'),
},
```
And add to `src/global.d.ts` (create the file if missing):
```ts
declare const __BUILD_SHA__: string;
```

### Task 3.2: Restyle main-menu.ts to use components + add controls card

- [ ] **Step 3.2.1: Rewrite `src/ui/main-menu.ts`**

Replace the existing class body's DOM construction with component-based construction. Keep the `onStart`/`onQuit` callback contract and the `.show()/.hide()` API identical so `main.ts` doesn't change.

```ts
// src/ui/main-menu.ts
import { Panel, DskyKey } from './components';

export class MainMenu {
  readonly el: HTMLDivElement;
  onStart: () => void = () => {};
  onQuit: () => void = () => {};
  onSettings: () => void = () => {};

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'main-menu';
    this.el.style.display = 'none';

    const card = new Panel('MISSION OPS');
    card.el.classList.add('title-card');

    const title = document.createElement('h1');
    title.className = 'menu-title';
    title.textContent = 'PROJECT ORBITAL FROGS';

    const subtitle = document.createElement('p');
    subtitle.className = 'menu-subtitle';
    subtitle.textContent = 'A MINIATURE SPACE PROGRAM';

    const rule = document.createElement('hr');
    rule.className = 'menu-rule';

    const startBtn = new DskyKey('ENTER', 'VAB', () => this.onStart());
    startBtn.el.classList.add('menu-btn--primary');
    const settingsBtn = new DskyKey('SETTINGS', 'theme, controls', () => this.onSettings());
    settingsBtn.el.classList.add('menu-btn--ghost');
    const quitBtn = new DskyKey('QUIT', 'exit', () => this.onQuit());
    quitBtn.el.classList.add('menu-btn--ghost');

    const btnRow = document.createElement('div');
    btnRow.className = 'menu-buttons';
    btnRow.append(startBtn.el, settingsBtn.el, quitBtn.el);

    card.el.append(title, subtitle, rule, btnRow);
    this.el.appendChild(card.el);

    // Critical #3: controls card, always visible.
    const controls = new Panel('FLIGHT PROCEDURES');
    controls.el.classList.add('controls-card');
    controls.el.innerHTML = controlsTableHTML();
    this.el.appendChild(controls.el);

    // Version stencil.
    const ver = document.createElement('div');
    ver.className = 'menu-version';
    ver.textContent = `REL 0.4.0 · BUILD ${__BUILD_SHA__}`;
    this.el.appendChild(ver);

    document.body.appendChild(this.el);
  }

  show(): void { this.el.style.display = 'flex'; }
  hide(): void { this.el.style.display = 'none'; }
}

function controlsTableHTML(): string {
  // Two-column BUILD / FLY reference; built once as static HTML.
  const build: [string, string][] = [
    ['LMB', 'place part'],
    ['RMB-drag', 'orbit view'],
    ['WHEEL', 'zoom'],
    ['Q / E', 'rotate part'],
    ['DEL', 'remove part'],
    ['L', 'launch'],
  ];
  const fly: [string, string][] = [
    ['SHIFT', 'throttle +'],
    ['CTRL', 'throttle -'],
    ['Z / X', 'full / cut'],
    ['SPACE', 'stage'],
    ['W S A D', 'pitch / yaw'],
    ['Q / E', 'roll'],
    ['T', 'SAS'],
    ['M', 'map'],
    ['ESC', 'menu'],
    ['F1', 'revert'],
  ];
  const row = ([k, v]: [string, string]) =>
    `<div class="controls-row"><span class="controls-key">${k}</span><span class="controls-act">${v}</span></div>`;
  return `<div class="controls-cols">
    <div class="controls-col"><h4>BUILD</h4>${build.map(row).join('')}</div>
    <div class="controls-col"><h4>FLY</h4>${fly.map(row).join('')}</div>
  </div>`;
}
```

### Task 3.3: Write the title screen CSS

- [ ] **Step 3.3.1: Fill `src/styles/screens/title.css`**

```css
/* src/styles/screens/title.css */
#main-menu {
  position: fixed; inset: 0; z-index: 50;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: var(--sp-4);
  pointer-events: none; /* let clicks outside pass to canvas (existing behavior) */
}
#main-menu > * { pointer-events: auto; }

.title-card { min-width: 360px; padding: var(--sp-5) var(--sp-6); text-align: center; }
.menu-title {
  font-family: var(--font-display);
  font-size: 44px;
  margin: 0 0 var(--sp-1);
  color: var(--amber);
  letter-spacing: var(--tracking-mono);
  text-shadow: var(--glow-phosphor);
}
.menu-subtitle {
  font-family: var(--font-body);
  font-size: var(--fs-label);
  color: var(--ink-dim);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin: 0 0 var(--sp-3);
}
.menu-rule { border: none; border-top: 1px solid var(--grid-line); margin: 0 0 var(--sp-3); }
.menu-buttons { display: flex; flex-direction: column; gap: var(--sp-2); align-items: stretch; }
.menu-buttons .dsky-key { min-width: 12rem; }
.menu-btn--primary { border-color: var(--green); }
.menu-btn--primary:hover { background: var(--green); color: var(--phosphor-bg); border-color: var(--green); }

.controls-card { max-width: 540px; }
.controls-cols { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); }
.controls-col h4 {
  font-family: var(--font-body); font-size: var(--fs-label);
  color: var(--amber); letter-spacing: var(--tracking-mono); margin: 0 0 var(--sp-2);
}
.controls-row {
  display: grid; grid-template-columns: 5rem 1fr;
  font-family: var(--font-body); font-size: var(--fs-label);
  border-top: 1px solid var(--grid-line);
  padding: 2px 0;
}
.controls-key { color: var(--ink); }
.controls-act { color: var(--ink-dim); }

.menu-version {
  position: fixed; bottom: var(--sp-2); left: var(--sp-3);
  font-family: var(--font-body); font-size: 10px;
  color: var(--ink-faint); letter-spacing: var(--tracking-mono);
}

@media (max-width: 600px) {
  .controls-cols { grid-template-columns: 1fr; }
  .menu-title { font-size: 32px; }
}
```

### Task 3.4: Wire onSettings in main.ts (placeholder — full overlay in Step 8)

- [ ] **Step 3.4.1: Modify `src/main.ts` — give MainMenu an onSettings that opens a toast for now**

Find where `MainMenu` is constructed (~L230) and add:
```ts
mainMenu.onSettings = () => {
  // Step 8 wires the real settings overlay; for now, hint that it's coming.
  console.log('[gui] settings — wired in Step 8');
};
```
(The full overlay lands in Step 8; this stub keeps the button non-dead.)

### Task 3.5: Manual verification + commit

- [ ] **Step 3.5.1: Verify live**

Boot dev server, navigate to title. Confirm:
- Title in VT323 amber with glow.
- Three DSKY keys (ENTER/SETTINGS/QUIT) in a column.
- Controls card visible below with BUILD and FLY columns.
- Version stencil bottom-left showing `REL 0.4.0 · BUILD dev`.
- Tab through the three buttons with keyboard; Enter activates.
- Toggle vintage in devtools (`document.documentElement.setAttribute('data-theme','vintage')`) — palette flips, scanlines appear.

- [ ] **Step 3.5.2: Commit**

```bash
git add src/ui/main-menu.ts src/styles/screens/title.css src/main.ts vite.config.ts src/global.d.ts
git commit -m "feat(gui): step 3 — restyle title menu + controls card (Critical #3)

- Title card as MISSION OPS panel; DSKY-key buttons
- Always-visible FLIGHT PROCEDURES card (closes review Critical #3)
- Version stencil with build SHA via Vite define
- onSettings stub (full overlay in Step 8)

Spec §5.1, §6.3"
```

---

## Step 4: Restyle flight HUD (readouts, gauge, hold-panel, staging, prompts)

**Goal:** Flight HUD rebuilt with `.panel` + `.readout` + `.gauge`; hold-panel buttons labeled; prompts → toasts. Navball bezel wrapped. **Fixes the unitless-Ap/Pe, unitless-FUEL, no-throttle-%, glyph-only hold-buttons review items as side effects.**

**Files:**
- Modify: `src/ui/hud.ts`, `src/ui/hold-panel.ts`, `src/ui/staging-display.ts`, `src/ui/flight-prompts.ts`
- Modify: `src/styles/screens/flight-hud.css`

### Task 4.1: Rewrite hud.ts to use Readout + Gauge + Panel

- [ ] **Step 4.1.1: Rewrite `src/ui/hud.ts`**

Read the current `hud.ts` to preserve its `update(flight)` signature and the readout list. Replace the DOM construction with:

```ts
// src/ui/hud.ts
import { Panel, Readout, Gauge } from './components';
import type { FlightController } from '../flight/flight-controller';

export class HUD {
  readonly el: HTMLDivElement;
  private readonly panel: Panel;
  private readonly throttle: Gauge;
  private readonly alt: Readout;
  private readonly vel: Readout;
  private readonly apPe: Readout;
  private readonly fuel: Readout;
  private readonly q: Readout;
  private readonly soi: Readout;
  private readonly sas: Readout;
  private maxFuel = 1; // set on first update

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.panel = new Panel('TELEMETRY');
    this.throttle = new Gauge('bar');
    this.alt = new Readout('ALT', 'm');
    this.vel = new Readout('VEL', 'm/s');
    this.apPe = new Readout('Ap/Pe', 'm'); // unit added (fixes review item)
    this.fuel = new Readout('FUEL', '');   // unit added per Task 4.2
    this.q = new Readout('Q', 'kPa');
    this.soi = new Readout('SOI', '');
    this.sas = new Readout('SAS', '');
    this.panel.el.append(this.throttle.el, this.alt.el, this.vel.el, this.apPe.el,
                         this.fuel.el, this.q.el, this.soi.el, this.sas.el);
    this.el.appendChild(this.panel.el);
    document.body.appendChild(this.el);
  }

  update(flight: FlightController): void {
    const rb = flight.ship.rootBody;
    const planet = flight.planet;
    const r = Math.hypot(rb.position.x - planet.position.x, rb.position.y - planet.position.y, rb.position.z - planet.position.z);
    const alt = r - planet.data.radius;
    const vel = Math.hypot(rb.velocity.x, rb.velocity.y, rb.velocity.z);

    this.alt.setValue(Math.round(alt));
    this.vel.setValue(Math.round(vel));

    // Ap/Pe — re-use orbit-math; show with units.
    const { apoapsis, periapsis } = computeApPe(flight);
    this.apPe.setValue(`Ap ${Math.round(apoapsis)} / Pe ${Math.round(periapsis)}`);

    // Fuel as fraction (fixes unitless-FUEL review item).
    if (this.maxFuel === 1 && flight.ship.fuel > 0) this.maxFuel = flight.ship.fuel;
    const fuelFrac = flight.ship.fuel / this.maxFuel;
    this.fuel.setValue(`${Math.round(flight.ship.fuel)} / ${Math.round(this.maxFuel)}`);
    this.fuel.setState(fuelFrac < 0.2 ? 'caution' : fuelFrac <= 0 ? 'alarm' : 'nominal');

    // Q (dynamic pressure) — gate state on threshold.
    const q = computeQ(flight);
    this.q.setValue(Math.round(q));
    this.q.setState(q > 200 ? 'alarm' : 'nominal');

    // SOI body name.
    this.soi.setValue(flight.dominantBodyFor(rb.position).data.name);

    // SAS indicator.
    this.sas.setValue(flight.sasEnabled ? 'ON' : 'OFF');
    this.sas.setState(flight.sasEnabled ? 'nominal' : 'caution');

    // Throttle gauge.
    this.throttle.setFraction(flight.throttle, `${Math.round(flight.throttle * 100)}%`);
  }
}

// computeApPe / computeQ: extract from existing hud.ts and orbit-math.ts;
// see the current hud.ts L60/L81 for the exact formulas to copy here.
function computeApPe(flight: FlightController): { apoapsis: number; periapsis: number } {
  // Copy the existing implementation from the pre-rewrite hud.ts.
  // Placeholder until Step 4 is executed — the engineer must copy the real formula.
  throw new Error('TODO: copy apoapsisPeriapsis() call from the previous hud.ts');
}
function computeQ(flight: FlightController): number {
  // Copy from previous hud.ts.
  throw new Error('TODO: copy Q formula from the previous hud.ts');
}
```

**IMPORTANT for the executor:** the `computeApPe` and `computeQ` functions above throw — they must be replaced with the real formulas copied from the pre-Step-4 `hud.ts` (visible in the file before this edit). The formulas involve `apoapsisPeriapsis(r, v, mu, radius)` from `src/physics/orbit-math` and the dynamic-pressure calc around `ATMOSPHERE.height`.

- [ ] **Step 4.1.2: Replace the TODO throws with the real formulas copied from the prior hud.ts**

Before committing, open the previous version of `hud.ts` (via `git show HEAD:src/ui/hud.ts`) and copy the Ap/Pe and Q formulas into `computeApPe` and `computeQ`. Verify the test for `hud` (none exists; manual check) shows non-NaN values.

### Task 4.2: Add fuel-unit handling — reset maxFuel when a new vessel launches

The `maxFuel` capture above only sets once. If the player builds a different rocket, the denominator is wrong. Fix: reset on flight-scene enter.

- [ ] **Step 4.2.1: Expose a `resetMaxFuel()` method on HUD and call it from `launchFlight` in `main.ts`**

In `hud.ts`, add a public method:
```ts
resetMaxFuel(): void { this.maxFuel = 1; }
```
In `main.ts` `launchFlight()` (around L88-114), after `hud = new HUD()`, call `hud.resetMaxFuel()` (it's a fresh HUD each launch, so this is technically redundant — but if HUD is ever reused, this makes the contract explicit). Add the call.

### Task 4.3: Rewrite hold-panel.ts — labeled DSKY keys

- [ ] **Step 4.3.1: Rewrite `src/ui/hold-panel.ts`**

Read the current file first (`src/ui/hold-panel.ts`) to preserve its `onMode(mode)` callback and the six modes. Replace button construction with `DskyKey` instances:

```ts
// src/ui/hold-panel.ts
import { DskyKey } from './components';
import type { HoldMode } from '../flight/flight-controller';

const MODES: { mode: HoldMode; word: string; hint: string }[] = [
  { mode: 'prograde',    word: 'PRO',  hint: 'velocity' },
  { mode: 'retrograde', word: 'RET',  hint: 'retrograde' },
  { mode: 'normal',     word: 'NRM',  hint: '+normal' },
  { mode: 'antinormal', word: 'ANTI', hint: '-normal' },
  { mode: 'radialout',  word: 'RAD+', hint: 'out' },
  { mode: 'radialin',   word: 'RAD-', hint: 'in' },
];

export class HoldPanel {
  readonly el: HTMLDivElement;
  onMode: (m: HoldMode) => void = () => {};
  private current: HoldMode = 'off';
  private keys = new Map<HoldMode, DskyKey>();

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'hold-panel';
    for (const { mode, word, hint } of MODES) {
      const key = new DskyKey(word, hint, () => {
        this.onMode(this.current === mode ? 'off' : mode);
      });
      this.keys.set(mode, key);
      this.el.appendChild(key.el);
    }
    document.body.appendChild(this.el);
  }

  setActive(mode: HoldMode): void {
    this.current = mode;
    for (const [m, k] of this.keys) k.setActive(m === mode);
  }
}
```

Wire the existing `main.ts` `holdPanel.onMode` callback to call `flightController.holdMode = m; holdPanel.setActive(m);` (it currently sets a class directly — update to call `setActive`).

### Task 4.4: Rewrite staging-display.ts and flight-prompts.ts

- [ ] **Step 4.4.1: Update `src/ui/staging-display.ts` to use `.dsky-key`-styled slots**

Read the current file. The slots are currently divs with inline classes. Wrap the panel in `new Panel('STAGING')`, and give each slot `class="dsky-key staging-slot"` with `data-active` set on the current stage. The slot's `pointer-events: none` stays (add it in `flight-hud.css`).

- [ ] **Step 4.4.2: Update `src/ui/flight-prompts.ts` to use the `Toast` component**

Replace the hand-rolled `#flight-prompt` and `#fuel-prompt` divs with two `Toast` instances:

```ts
// src/ui/flight-prompts.ts
import { Toast } from './components';
import type { FlightController } from '../flight/flight-controller';

export class FlightPrompts {
  readonly igniteToast: Toast;
  readonly fuelToast: Toast;

  constructor() {
    this.igniteToast = new Toast();
    this.fuelToast = new Toast();
    this.igniteToast.el.id = 'flight-prompt';
    this.fuelToast.el.id = 'fuel-prompt';
    document.body.append(this.igniteToast.el, this.fuelToast.el);
  }

  update(flight: FlightController): void {
    // Ignite prompt: shown until throttle > 0 or first stage advanced.
    const showIgnite = flight.throttle === 0 && flight.currentStageIndex === 0;
    if (showIgnite) {
      this.igniteToast.show('Press SPACE to ignite · throttle up gently, pitch east after ~300m', 'info', 0);
    } else {
      this.igniteToast.hide();
    }

    // Fuel-out: caution tone if a later stage still has fuel, alarm otherwise.
    if (flight.ship.fuel <= 0 && flight.throttle > 0) {
      const tone = flight.currentStageIndex < flight.getStages().length - 1 ? 'caution' : 'alarm';
      this.fuelToast.show('No fuel remaining — press F1 to revert and rebuild', tone, 0);
    } else {
      this.fuelToast.hide();
    }
  }
}
```

Adjust `main.ts` to call `flightPrompts.update(flight)` in the animate loop where the old prompts were updated.

### Task 4.5: flight-hud.css

- [ ] **Step 4.5.1: Fill `src/styles/screens/flight-hud.css`**

```css
/* src/styles/screens/flight-hud.css */
#hud {
  position: fixed; top: var(--sp-3); right: var(--sp-3); z-index: 20;
  min-width: 200px;
}
#hud .gauge { width: 100%; margin-bottom: var(--sp-2); }

#hold-panel {
  position: fixed; bottom: var(--sp-3); left: 50%;
  transform: translateX(-50%);
  margin-right: 220px; /* offset from navball */
  display: flex; gap: var(--sp-1);
  z-index: 20;
}
#hold-panel .dsky-key { min-width: 3.5rem; }

/* Navball bezel wrapper (added by main.ts around the existing navball canvas). */
#navball-bezel {
  position: fixed; bottom: var(--sp-3); left: 50%;
  transform: translateX(-50%);
  z-index: 15;
  padding: var(--sp-2);
}

#staging-panel {
  position: fixed; left: var(--sp-3); top: 50%;
  transform: translateY(-50%);
  z-index: 20;
  min-width: 120px;
}
.staging-slot { pointer-events: none; min-width: 4rem; margin-bottom: var(--sp-1); }

@media (max-width: 900px) {
  #hud { min-width: 160px; }
  #hold-panel { flex-wrap: wrap; justify-content: center; }
  #staging-panel { top: auto; bottom: var(--sp-3); transform: none; }
}
```

Wrap the navball canvas in a `Panel('ATTITUDE')` bezel in `main.ts`:
```ts
// In launchFlight(), after creating navball:
const bezel = new Panel('ATTITUDE');
bezel.el.id = 'navball-bezel';
bezel.el.appendChild(navball.canvas);
document.body.appendChild(bezel.el);
```
(Move the existing `document.body.appendChild(navball.canvas)` into the bezel.)

### Task 4.6: Verify + commit

- [ ] **Step 4.6.1: Verify live**

Boot, launch a default rocket. Confirm:
- HUD top-right is a TELEMETRY panel; ALT/VEL/Ap-Pe/FUEL/Q/SOI/SAS readouts with units; FUEL shows `1200 / 1200`; Q shows `kPa`.
- Throttle gauge fills as you press Shift; shows `100%`.
- Hold-panel: six labeled DSKY keys at bottom; clicking prograde activates it (amber fill).
- Staging panel left side; active slot highlighted.
- Prompts as toasts at top.
- Navball wrapped in ATTITUDE bezel.
- Vintage toggle in devtools flips palette + scanlines.

- [ ] **Step 4.6.2: Run tests + typecheck**

```bash
npx tsc --noEmit && npx vitest run
```
Expected: green.

- [ ] **Step 4.6.3: Commit**

```bash
git add src/ui/hud.ts src/ui/hold-panel.ts src/ui/staging-display.ts src/ui/flight-prompts.ts src/styles/screens/flight-hud.css src/main.ts
git commit -m "feat(gui): step 4 — restyle flight HUD (readouts, gauge, hold-panel, prompts)

- HUD → TELEMETRY panel of Readouts (units everywhere; fixes review items)
- Throttle → Gauge with percentage label
- Hold-panel → labeled DSKY keys (fixes glyph-only-buttons review item)
- Staging → DSKY-key-styled slots in STAGING panel
- Prompts → Toasts with tone (caution if later stage has fuel)
- Navball wrapped in ATTITUDE bezel

Spec §5.3"

---

## Step 5: Restyle VAB + disabled-Launch reason (Critical #2)

**Goal:** VAB palette/actions restyled with components; disabled Launch shows a tooltip + status line explaining *why* (closes Critical #2). TELEMETRY stub panel added.

**Files:**
- Modify: `src/entities/ship.ts` (add `launchReadiness`)
- Modify: `src/ui/vab-ui.ts` (restyle + status line + tooltip)
- Modify: `src/styles/screens/vab.css`
- Test: `test/vab-readiness.test.ts`

### Task 5.1: Add `launchReadiness` to ship.ts (TDD)

- [ ] **Step 5.1.1: Write the failing test `test/vab-readiness.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ShipDesign, launchReadiness, canLaunch } from '../src/entities/ship';

function design(partIds: string[]): ShipDesign {
  return {
    parts: partIds.map((partId, i) => ({
      uid: `p${i}`, partId,
      position: new THREE.Vector3(0, i * 3, 0),
      rotation: new THREE.Euler(),
    })),
    rootPartUid: 'p0',
  };
}

describe('launchReadiness', () => {
  it('empty design reports missing pod and engine', () => {
    const r = launchReadiness(design([]));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.missing).toContain('pod');
      expect(r.missing).toContain('engine');
    }
  });

  it('pod-only reports missing engine', () => {
    const r = launchReadiness(design(['pod']));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toEqual(['engine']);
  });

  it('engine-only reports missing pod', () => {
    const r = launchReadiness(design(['engine']));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toEqual(['pod']);
  });

  it('pod + engine (with tank) is ok', () => {
    const r = launchReadiness(design(['pod', 'tank', 'engine']));
    expect(r.ok).toBe(true);
  });

  it('agrees with legacy canLaunch()', () => {
    expect(launchReadiness(design([])).ok).toBe(canLaunch(design([])));
    expect(launchReadiness(design(['pod', 'engine'])).ok).toBe(canLaunch(design(['pod', 'engine'])));
  });
});
```

- [ ] **Step 5.1.2: Run the test to verify it fails**

Run: `npx vitest run test/vab-readiness.test.ts`
Expected: FAIL — `launchReadiness` not exported from `ship.ts`.

- [ ] **Step 5.1.3: Implement `launchReadiness` in `src/entities/ship.ts`**

Add to `src/entities/ship.ts` (just below the existing `canLaunch`):

```ts
export type LaunchReadiness =
  | { ok: true }
  | { ok: false; missing: Array<'pod' | 'engine'> };

export function launchReadiness(d: ShipDesign): LaunchReadiness {
  const missing: Array<'pod' | 'engine'> = [];
  if (!hasPod(d)) missing.push('pod');
  if (!hasEngine(d)) missing.push('engine');
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}
```

Leave the existing `canLaunch(d)` in place (callers depend on it). It can now delegate: `export function canLaunch(d: ShipDesign): boolean { return launchReadiness(d).ok; }` — refactor optional, keep behavior identical.

- [ ] **Step 5.1.4: Run the test to verify it passes**

Run: `npx vitest run test/vab-readiness.test.ts`
Expected: 5 PASS.

### Task 5.2: Restyle vab-ui.ts

- [ ] **Step 5.2.1: Read current `src/ui/vab-ui.ts` to map its API**

Run: `cat src/ui/vab-ui.ts` (or Read). Note: the constructor builds the left palette and the actions row (rotate/delete/clear/launch buttons). The `onReadyChange(isReady)` callback toggles Launch disabled. The `onSelectPart(id)` and `onLaunch()` callbacks are wired from `main.ts`.

- [ ] **Step 5.2.2: Rewrite `src/ui/vab-ui.ts` to use Panel + DskyKey + Tooltip + a status line**

```ts
// src/ui/vab-ui.ts
import { Panel, DskyKey, Tooltip } from './components';
import { launchReadiness } from '../entities/ship';
import type { ShipDesign } from '../entities/ship';
import { getPartDef, getBuiltInParts } from '../entities/parts-catalog';

export interface VabUiCallbacks {
  onSelectPart: (partId: string | null) => void;
  onRotate: (deg: number) => void;
  onDelete: () => void;
  onClear: () => void;
  onLaunch: () => void;
}

export class VabUi {
  readonly el: HTMLDivElement;
  onReadyChange: (ready: boolean) => void = () => {};
  onSelectPart: (partId: string | null) => void = () => {};
  onRotate: (deg: number) => void = () => {};
  onDelete: () => void = () => {};
  onClear: () => void = () => {};
  onLaunch: () => void = () => {};

  private readonly actionsPanel: Panel;
  private readonly launchKey: DskyKey;
  private readonly statusLine: HTMLDivElement;
  private readonly launchTooltip: Tooltip;
  private design: ShipDesign;

  constructor(design: ShipDesign) {
    this.design = design;
    this.el = document.createElement('div');
    this.el.id = 'vab-ui';
    this.el.style.display = 'none';

    // Parts catalog
    const catalog = new Panel('PARTS CATALOG');
    const partList = document.createElement('div');
    partList.className = 'part-list';
    for (const p of getBuiltInParts()) {
      const key = new DskyKey(p.name.toUpperCase(), `${p.dryMass}t${p.fuel ? ` · ${p.fuel}` : ''}${p.thrust ? ` · ${p.thrust}kN` : ''}`,
        () => this.onSelectPart(p.id));
      key.el.classList.add('part-key');
      key.el.title = p.desc; // tooltip fallback; .tooltip attaches below for hover
      partList.appendChild(key.el);
    }
    catalog.el.appendChild(partList);

    // TELEMETRY stub (deferred stats feature — spec §5.2).
    const telemetryStub = new Panel('TELEMETRY');
    telemetryStub.el.classList.add('telemetry-stub');
    const stub = document.createElement('div');
    stub.className = 'telemetry-pending';
    stub.textContent = 'TELEMETRY PENDING — stats in next release';
    telemetryStub.el.appendChild(stub);

    // Actions panel
    this.actionsPanel = new Panel('ACTIONS');
    this.statusLine = document.createElement('div');
    this.statusLine.className = 'readiness-status';
    this.actionsPanel.el.appendChild(this.statusLine);

    const actionsRow = document.createElement('div');
    actionsRow.className = 'actions-row';
    actionsRow.append(
      new DskyKey('ROT -90', 'Q', () => this.onRotate(-90)).el,
      new DskyKey('ROT +90', 'E', () => this.onRotate(90)).el,
      new DskyKey('DELETE', 'Del', () => this.onDelete()).el,
      new DskyKey('CLEAR', 'all', () => this.onClear()).el,
    );
    this.launchKey = new DskyKey('LAUNCH', 'to flight', () => {
      if (!this.launchKey.el.disabled) this.onLaunch();
    });
    this.launchKey.el.id = 'launch';
    actionsRow.appendChild(this.launchKey.el);
    this.actionsPanel.el.appendChild(actionsRow);

    // Tooltip for the disabled Launch.
    this.launchTooltip = new Tooltip();
    document.body.appendChild(this.launchTooltip.el);
    this.launchTooltip.attach(this.launchKey.el, () => this.disabledReasonText());

    this.el.append(catalog.el, telemetryStub.el, this.actionsPanel.el);
    document.body.appendChild(this.el);
  }

  setDesign(design: ShipDesign): void { this.design = design; this.refreshReadiness(); }

  refreshReadiness(): void {
    const r = launchReadiness(this.design);
    this.launchKey.setEnabled(r.ok);
    this.onReadyChange(r.ok);
    if (r.ok) {
      this.statusLine.textContent = '● READY';
      this.statusLine.dataset.state = 'nominal';
    } else {
      const missing = r.missing.join(' + ').toUpperCase();
      this.statusLine.textContent = `○ NOT READY — NEEDS ${missing}`;
      this.statusLine.dataset.state = 'caution';
    }
  }

  private disabledReasonText(): string {
    const r = launchReadiness(this.design);
    if (r.ok) return '';
    return 'NEEDS ' + r.missing.map(m => `COMMAND ${m === 'pod' ? 'POD' : 'ENGINE'}`).join(' + ');
  }

  show(): void { this.el.style.display = 'block'; this.refreshReadiness(); }
  hide(): void { this.el.style.display = 'none'; }
}
```

**Executor note:** the current `vab-ui.ts` is referenced as `VabUi` in `main.ts` around L147-155. The constructor signature must match — if it currently takes `(vessel, db, symmetry)`, preserve those params or refactor `main.ts` to pass `design`. Read `main.ts` at execution time and align. The key behavior to preserve: `onSelectPart`, `onLaunch`, `onReadyChange` callbacks all still fire.

- [ ] **Step 5.2.3: Update `main.ts` to call `vabUi.refreshReadiness()` after each placement**

In `main.ts`'s VAB pointer-up handler (around L190-200, where placement succeeds), call `vabUi.setDesign(vab.design)` (or `vabUi.refreshReadiness()` if you preserved the design ref) so the status line updates live as parts are added.

### Task 5.3: vab.css

- [ ] **Step 5.3.1: Fill `src/styles/screens/vab.css`**

```css
/* src/styles/screens/vab.css */
#vab-ui {
  position: fixed; top: var(--sp-3); left: var(--sp-3); z-index: 20;
  width: clamp(220px, 18vw, 280px);
  max-height: calc(100vh - 2 * var(--sp-3));
  overflow-y: auto;
  display: flex; flex-direction: column; gap: var(--sp-3);
}
.part-list { display: flex; flex-direction: column; gap: var(--sp-1); }
.part-key { min-width: 0; align-items: flex-start; text-align: left; }
.part-key .dsky-key__word { font-size: var(--fs-body); }
.part-key .dsky-key__hint { font-size: 10px; color: var(--ink-dim); }

.telemetry-stub .telemetry-pending {
  font-family: var(--font-body); font-size: var(--fs-label);
  color: var(--ink-faint); letter-spacing: var(--tracking-mono);
  padding: var(--sp-2); text-align: center;
}

.actions-row { display: flex; flex-wrap: wrap; gap: var(--sp-1); }
.actions-row .dsky-key { flex: 1; min-width: 4rem; }
#launch.dsky-key { border-color: var(--green); }
#launch.dsky-key:hover:not(:disabled) { background: var(--green); color: var(--phosphor-bg); }

.readiness-status {
  font-family: var(--font-body); font-size: var(--fs-label);
  letter-spacing: var(--tracking-mono);
  padding: var(--sp-1) 0;
  margin-bottom: var(--sp-2);
}
.readiness-status[data-state='nominal'] { color: var(--green); }
.readiness-status[data-state='caution'] { color: var(--warn); }

@media (max-width: 900px) {
  #vab-ui { width: 200px; }
}
```

### Task 5.4: Verify + commit

- [ ] **Step 5.4.1: Verify live**

Boot, enter VAB. Confirm:
- Empty VAB: Launch disabled, hover shows tooltip `NEEDS COMMAND POD + COMMAND ENGINE`, status line `○ NOT READY — NEEDS POD + ENGINE` in warn color.
- Place a pod: status becomes `○ NOT READY — NEEDS ENGINE`.
- Add an engine: status `● READY` (green); Launch enabled.
- Parts catalog styled as DSKY keys with stats hint line.
- TELEMETRY stub panel visible with pending message.

- [ ] **Step 5.4.2: Run tests + typecheck**

```bash
npx tsc --noEmit && npx vitest run
```
Expected: green.

- [ ] **Step 5.4.3: Commit**

```bash
git add src/entities/ship.ts src/ui/vab-ui.ts src/styles/screens/vab.css test/vab-readiness.test.ts src/main.ts
git commit -m "feat(gui): step 5 — restyle VAB + disabled-Launch reason (Critical #2)

- launchReadiness() returns {ok,missing[]} — TDD with 5 tests
- VAB palette/actions → Panel + DskyKey components
- Disabled Launch shows Tooltip + status line explaining the reason
  (closes review Critical #2)
- TELEMETRY stub panel visible-empty (deferred stats feature)

Spec §5.2, §6.2"

---

## Step 6: Restyle orbit map + body labels + Ap/Pe legend

**Goal:** Orbit map overlay → `ORBITAL TRACK` panel with units; add `TERRA`/`LUNA` body labels on the map; add Ap/Pe legend.

**Files:**
- Modify: `src/ui/orbit-map.ts` (overlay DOM + body-label sprites)
- Modify: `src/styles/screens/orbit-map.css`

### Task 6.1: Restyle the overlay to use Panel + Readout

- [ ] **Step 6.1.1: Read current `src/ui/orbit-map.ts`**

Note: it builds an overlay div with title, Ap/Pe text, and help line. It also manages the 3D scene's trajectory line + Ap/Pe sphere markers + ship marker.

- [ ] **Step 6.1.2: Replace the overlay DOM with Panel + Readouts**

```ts
// In orbit-map.ts constructor / build():
import { Panel, Readout } from './components';

// Replace the existing overlay HTML with:
const panel = new Panel('ORBITAL TRACK');
const apReadout = new Readout('Ap', 'm');
const peReadout = new Readout('Pe', 'm');
const bodyReadout = new Readout('BODY', '');
const help = document.createElement('div');
help.className = 'orbit-help';
help.textContent = 'drag rotate · wheel zoom · M close';
panel.el.append(apReadout.el, peReadout.el, bodyReadout.el, help);

const legend = document.createElement('div');
legend.className = 'ap-pe-legend';
legend.innerHTML = `<span class="legend-ap">● Ap</span><span class="legend-pe">● Pe</span>`;
panel.el.appendChild(legend);

this.overlay = panel.el;
this.overlay.id = 'map-overlay';
document.body.appendChild(this.overlay);

// Store refs:
this.apReadout = apReadout;
this.peReadout = peReadout;
this.bodyReadout = bodyReadout;
```

In `update()`, where the Ap/Pe numbers were set, set them via `this.apReadout.setValue(...)` and `this.bodyReadout.setValue(flight.dominantBodyFor(...).data.name)`.

### Task 6.2: Add body labels in 3D

- [ ] **Step 6.2.1: Add `TERRA` and `LUNA` text sprites when the map opens**

In `orbit-map.ts`, when building the map scene (where it adds the planet sphere), add labeled sprites:

```ts
import * as THREE from 'three';

function makeLabel(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '32px IBM Plex Mono, monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 40);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2000, 500, 1); // sized for the map's world units
  return sprite;
}
```

Add `TERRA` at the planet center (offset above surface), `LUNA` at the moon. Add/remove these with the map open/close (dispose textures on close — same pattern as the existing markers).

- [ ] **Step 6.2.2: Position labels above their body's north pole**

Set `sprite.position` to the body position + a vertical offset (e.g. `body.data.radius * 1.1` along the body's "up"). Update each frame if the body moves.

### Task 6.3: orbit-map.css

- [ ] **Step 6.3.1: Fill `src/styles/screens/orbit-map.css`**

```css
/* src/styles/screens/orbit-map.css */
#map-overlay {
  position: fixed; top: var(--sp-3); left: var(--sp-3); z-index: 25;
  min-width: 180px;
}
.orbit-help {
  font-family: var(--font-body); font-size: 10px;
  color: var(--ink-faint); letter-spacing: var(--tracking-mono);
  margin-top: var(--sp-2);
}
.ap-pe-legend {
  display: flex; gap: var(--sp-3); margin-top: var(--sp-2);
  font-family: var(--font-body); font-size: var(--fs-label);
}
.legend-ap { color: var(--red); }
.legend-pe { color: var(--cyan); }
```

### Task 6.4: Verify + commit

- [ ] **Step 6.4.1: Verify live**

Launch, press M. Confirm:
- ORBITAL TRACK panel top-left with Ap/Pe readouts (units shown), BODY name.
- Help line + Ap/Pe legend (red Ap / cyan Pe).
- TERRA and LUNA labels visible on the 3D map.
- Trajectory + markers unchanged.

- [ ] **Step 6.4.2: Run tests + typecheck + commit**

```bash
npx tsc --noEmit && npx vitest run
git add src/ui/orbit-map.ts src/styles/screens/orbit-map.css
git commit -m "feat(gui): step 6 — restyle orbit map + body labels + Ap/Pe legend

- ORBITAL TRACK panel with unit-correct Ap/Pe readouts (fixes review item)
- TERRA / LUNA 3D text labels on the map
- Ap/Pe color legend so marker colors are identified
- No maneuver nodes (deferred per spec §5.4)

Spec §5.4"
```

---

## Step 7: Critical #1 — crash detection on Terra

**Goal:** A ship that impacts terrain at ≥30 m/s radial speed shows a terminal alarm banner. Closes Critical #1.

**Files:**
- Modify: `src/flight/flight-controller.ts` (record `lastImpactSpeed` before clamping)
- Modify: `src/ui/win-states.ts` (planet-landing branch; use impact speed; terminal banner)
- Test: `test/crash-detection.test.ts`

### Task 7.1: Write the failing test (pure-function detector)

- [ ] **Step 7.1.1: Create `test/crash-detection.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { isCrashImpact } from '../src/flight/crash-detection';

describe('isCrashImpact', () => {
  it('returns true at exactly the 30 m/s threshold', () => {
    expect(isCrashImpact(30)).toBe(true);
  });
  it('returns true above the threshold', () => {
    expect(isCrashImpact(2000)).toBe(true);
  });
  it('returns false below the threshold (soft landing)', () => {
    expect(isCrashImpact(29.9)).toBe(false);
    expect(isCrashImpact(0)).toBe(false);
  });
  it('treats NaN as not-a-crash (defensive)', () => {
    expect(isCrashImpact(NaN)).toBe(false);
  });
});
```

- [ ] **Step 7.1.2: Run the test to verify it fails**

Run: `npx vitest run test/crash-detection.test.ts`
Expected: FAIL — `isCrashImpact` doesn't exist.

- [ ] **Step 7.1.3: Create `src/flight/crash-detection.ts`**

```ts
// src/flight/crash-detection.ts
// Shared crash threshold (spec §6.1) — Terra and Luna use the same value.
export const IMPACT_CRASH_THRESHOLD = 30; // m/s radial

/** True if the given inward radial impact speed counts as a crash.
 *  Defensive against NaN/undefined (returns false). */
export function isCrashImpact(inwardRadialSpeed: number): boolean {
  if (!Number.isFinite(inwardRadialSpeed)) return false;
  return inwardRadialSpeed >= IMPACT_CRASH_THRESHOLD;
}
```

- [ ] **Step 7.1.4: Run the test to verify it passes**

Run: `npx vitest run test/crash-detection.test.ts`
Expected: 4 PASS.

### Task 7.2: Record lastImpactSpeed in flight-controller.ts

- [ ] **Step 7.2.1: Modify `src/flight/flight-controller.ts`**

Find `clampToTerrain` (around L521). Just *before* the line that zeroes the inward velocity, capture it. Add a public field:

```ts
// Near the other public fields (around L32-50):
/** Inward radial speed at the most recent terrain contact; -1 if none yet. */
lastImpactSpeed = -1;
private hadTerrainContactThisStep = false;
```

In `clampToTerrain`, before clamping velocity:
```ts
// Compute inward radial speed (toward planet center) BEFORE we zero it.
const dx = body.position.x - this.planet.position.x;
const dy = body.position.y - this.planet.position.y;
const dz = body.position.z - this.planet.position.z;
const dist = Math.hypot(dx, dy, dz);
if (dist > 1e-3) {
  const radialVel = (body.velocity.x * dx + body.velocity.y * dy + body.velocity.z * dz) / dist;
  if (radialVel < 0) { // moving inward
    this.lastImpactSpeed = Math.abs(radialVel);
    this.hadTerrainContactThisStep = true;
  }
}
```

(Place this exactly where the existing code already detects the surface contact; the surrounding lines will give context. Read the function first.)

### Task 7.3: Add the planet-crash branch in win-states.ts

- [ ] **Step 7.3.1: Modify `src/ui/win-states.ts`**

In `update()`, after the moon-crashed block (~L107) and before the `if (planetAlt < -10 || moonCrashed)` line, add a planet-impact branch:

```ts
import { isCrashImpact } from '../flight/crash-detection';

// ...inside update(), after moonCrashed is computed:
const planetImpactCrash = !inMoonSoi
  && flight.lastImpactSpeed >= 0
  && isCrashImpact(flight.lastImpactSpeed);

if ((planetAlt < -10 || moonCrashed || planetImpactCrash) && !this.achieved.has('crash')) {
  this.achieved.add('crash');
  const speed = Math.round(Math.max(flight.lastImpactSpeed, 0));
  this.show(`■ LITHOBRAKE / impact at ${speed} m/s`, 'alarm', '', true); // terminal=true
  // Note: show() signature must accept (text, tone, detail, terminal) — see Task 7.3.2.
  this.onEvent('crash');
}
```

Also: the existing `show(text, terminal)` calls elsewhere need to keep working. Two options:
1. Refactor `show` to `show(text, tone, detail, terminal)` (matches the `Banner` component from Step 2 — preferred).
2. Add an overload.

- [ ] **Step 7.3.2: Refactor `WinStates.show()` to use the Banner component + new signature**

Replace the existing `show` method with:

```ts
private banner: Banner; // replace the raw div with Banner from './components'
// constructor: this.banner = new Banner(); document.body.appendChild(this.banner.el);
//             this.bannerBtn click handler stays (BUILD AGAIN button — add as a child of banner.el)

private show(text: string, tone: BannerTone = 'info', detail = '', terminal = false): void {
  this.banner.show(text, tone, detail, terminal);
  this.bannerBtn.style.display = terminal ? 'inline-block' : 'none';
  window.clearTimeout(this.hideTimer);
  if (!terminal) {
    this.hideTimer = window.setTimeout(() => this.banner.hide(), 4000);
  }
}
```

Update existing callers: `show('🌱 Orbit Achieved!')` → `show('🌱 Orbit Achieved!', 'success')`; `show('🌕 Lunar Landing!')` → `show('🌕 Lunar Landing!', 'success')`; `show('🏆 Mission Complete! Safe Return.', true)` → `show('🏆 Mission Complete! Safe Return.', 'success', '', true)`; `show('💥 Crashed — Revert with F1')` → handled by the new planet/moon branch with `tone: 'alarm'`.

Add the BUILD AGAIN button as a child of `this.banner.el` after construction:
```ts
this.banner.el.appendChild(this.bannerBtn); // bannerBtn created as before
this.bannerBtn.textContent = 'Build Again';
this.bannerBtn.addEventListener('click', () => this.onBuildAgain());
```

### Task 7.4: Verify + commit

- [ ] **Step 7.4.1: Verify live (reproduce pof-08-silent-crash scenario)**

Boot, `__game.build()`, `__game.launch()`, arm + full throttle, wait for fuel to deplete and the ship to fall back. Confirm:
- On impact: `■ LITHOBRAKE / impact at N m/s` red banner appears, stays (terminal), BUILD AGAIN button visible.
- A soft landing (under 30 m/s) shows nothing.
- A moon crash (fly to the moon, smash in) still triggers (existing behavior preserved).

- [ ] **Step 7.4.2: Run tests + typecheck + commit**

```bash
npx tsc --noEmit && npx vitest run
git add src/flight/crash-detection.ts src/flight/flight-controller.ts src/ui/win-states.ts test/crash-detection.test.ts
git commit -m "fix(gui): step 7 — Critical #1 silent Terra crash now shows alarm banner

- isCrashImpact() pure detector (30 m/s shared threshold, TDD)
- flight-controller records lastImpactSpeed before terrain clamping
- win-states planet-impact branch: terminal alarm banner with impact speed
- WinStates.show() refactored to use Banner component + tone
- Closes review Critical #1; also fixes 'crash banner auto-hides in 4s' High

Spec §6.1"
```

---

## Step 8: Pause/settings overlay + FSM PAUSED + QUIT TO MENU

**Goal:** Esc opens a settings overlay; physics freezes; RESUME closes; QUIT TO MENU confirms and returns to title.

**Files:**
- Modify: `src/core/state-machine.ts` (add PAUSED, BUILD|FLIGHT→INIT)
- Create: `src/ui/settings-overlay.ts`
- Modify: `src/main.ts` (Esc handler, physics gate, teardown helper)
- Test: `test/pause.test.ts`

### Task 8.1: Extend the FSM (TDD)

- [ ] **Step 8.1.1: Write the failing test `test/pause.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { StateMachine } from '../src/core/state-machine';

describe('StateMachine PAUSED + return-to-menu', () => {
  it('starts in INIT', () => {
    expect(new StateMachine().current).toBe('INIT');
  });

  it('BUILD → PAUSED → BUILD round-trip', () => {
    const m = new StateMachine();
    m.transition('BUILD');
    m.transition('PAUSED');
    expect(m.current).toBe('PAUSED');
    m.transition('BUILD');
    expect(m.current).toBe('BUILD');
  });

  it('FLIGHT → PAUSED → FLIGHT round-trip', () => {
    const m = new StateMachine();
    m.transition('FLIGHT');
    m.transition('PAUSED');
    expect(m.current).toBe('PAUSED');
    m.transition('FLIGHT');
    expect(m.current).toBe('FLIGHT');
  });

  it('BUILD → INIT (quit to menu)', () => {
    const m = new StateMachine();
    m.transition('BUILD');
    m.transition('INIT');
    expect(m.current).toBe('INIT');
  });

  it('FLIGHT → INIT (quit to menu)', () => {
    const m = new StateMachine();
    m.transition('FLIGHT');
    m.transition('INIT');
    expect(m.current).toBe('INIT');
  });

  it('PAUSED cannot be reached from INIT', () => {
    const m = new StateMachine();
    expect(() => m.transition('PAUSED')).toThrow();
    expect(m.current).toBe('INIT');
  });

  it('PAUSED → PAUSED is a no-op (no listener fire)', () => {
    const m = new StateMachine();
    m.transition('BUILD');
    m.transition('PAUSED');
    let fires = 0;
    m.onTransition(() => fires++);
    m.transition('PAUSED');
    expect(fires).toBe(0);
  });
});
```

- [ ] **Step 8.1.2: Run the test to verify it fails**

Run: `npx vitest run test/pause.test.ts`
Expected: FAIL — `PAUSED` not in the `GameState` type; transitions throw or no-op wrong.

- [ ] **Step 8.1.3: Modify `src/core/state-machine.ts`**

```ts
// src/core/state-machine.ts
export type GameState = 'INIT' | 'BUILD' | 'FLIGHT' | 'MAP' | 'PAUSED';

// Allowed transitions. Any state may stay (no-op). Otherwise must be in this map.
const ALLOWED: Record<GameState, readonly GameState[]> = {
  INIT:   ['BUILD'],
  BUILD:  ['FLIGHT', 'PAUSED', 'INIT'],
  FLIGHT: ['BUILD', 'MAP', 'PAUSED', 'INIT'],
  MAP:    ['FLIGHT'],
  PAUSED: ['BUILD', 'FLIGHT'], // resume returns to the state that paused
};

export class StateMachine {
  private state: GameState = 'INIT';
  private listeners: Array<(from: GameState, to: GameState) => void> = [];
  private pausedFrom: GameState | null = null;

  get current(): GameState { return this.state; }

  transition(to: GameState): void {
    if (to === this.state) return; // no-op
    const allowed = ALLOWED[this.state];
    if (!allowed.includes(to)) {
      throw new Error(`Illegal transition ${this.state} → ${to}`);
    }
    const from = this.state;
    if (to === 'PAUSED') this.pausedFrom = from;
    else if (from === 'PAUSED' && this.pausedFrom && to !== this.pausedFrom) {
      // Resuming to a state different from the one that paused — allow only if legal.
    }
    this.state = to;
    for (const fn of this.listeners) fn(from, to);
  }

  /** The state the game was in before pausing (for resume). */
  get pausedFrom(): GameState | null { return this.pausedFrom; }

  onTransition(fn: (from: GameState, to: GameState) => void): void {
    this.listeners.push(fn);
  }
}
```

**Note:** there's a private field `pausedFrom` and a public getter with the same name — TS disallows this. Rename the field to `_pausedFrom` and have the getter return it.

- [ ] **Step 8.1.4: Run the test to verify it passes**

Run: `npx vitest run test/pause.test.ts`
Expected: 7 PASS.

### Task 8.2: Create the SettingsOverlay class

- [ ] **Step 8.2.1: Create `src/ui/settings-overlay.ts`**

```ts
// src/ui/settings-overlay.ts
import { Panel, DskyKey, Toggle, Banner } from './components';
import { currentTheme, toggleTheme, applyTheme, reducedMotionEnabled, setReducedMotionOverride } from './theme';

export class SettingsOverlay {
  readonly el: HTMLDivElement;
  onResume: () => void = () => {};
  onQuitToMenu: () => void = () => {};

  private readonly themeToggle: Toggle;
  private readonly motionToggle: Toggle;
  private readonly confirmBanner: Banner;
  private readonly backdrop: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'settings-overlay';
    this.el.style.display = 'none';

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'overlay-backdrop';
    this.el.appendChild(this.backdrop);

    const panel = new Panel('SYSTEM CONFIG');
    const themeLabel = document.createElement('div');
    themeLabel.className = 'config-row';
    themeLabel.textContent = 'CRT FX';
    this.themeToggle = new Toggle('Vintage', currentTheme() === 'vintage', (checked) => {
      applyTheme(checked ? 'vintage' : 'modern');
    });
    themeLabel.appendChild(this.themeToggle.el);
    panel.el.appendChild(themeLabel);

    const motionLabel = document.createElement('div');
    motionLabel.className = 'config-row';
    motionLabel.textContent = 'REDUCED MOTION';
    this.motionToggle = new Toggle('On', reducedMotionEnabled(), (checked) => {
      setReducedMotionOverride(checked ? 'on' : 'off');
      // Re-apply so CSS vars recompute.
      applyTheme(currentTheme());
    });
    motionLabel.appendChild(this.motionToggle.el);
    panel.el.appendChild(motionLabel);

    const btnRow = document.createElement('div');
    btnRow.className = 'overlay-buttons';
    btnRow.append(
      new DskyKey('RESUME', 'Esc', () => this.onResume()).el,
      new DskyKey('QUIT', 'to menu', () => this.askQuitConfirm()).el,
    );
    panel.el.appendChild(btnRow);

    this.confirmBanner = new Banner();
    panel.el.appendChild(this.confirmBanner.el);

    this.el.appendChild(panel.el);
    document.body.appendChild(this.el);
  }

  show(): void {
    // Reflect current theme/motion in the toggles when opening.
    this.themeToggle.setChecked(currentTheme() === 'vintage');
    this.motionToggle.setChecked(reducedMotionEnabled());
    this.el.style.display = 'block';
  }
  hide(): void { this.el.style.display = 'none'; this.confirmBanner.hide(); }

  private askQuitConfirm(): void {
    this.confirmBanner.show('Discard this flight?', 'alarm', 'press YES to confirm', false);
    // Replace banner buttons with YES/NO temporarily:
    const yes = document.createElement('button'); yes.textContent = 'YES';
    const no = document.createElement('button'); no.textContent = 'NO';
    yes.onclick = () => { this.confirmBanner.hide(); this.onQuitToMenu(); };
    no.onclick = () => this.confirmBanner.hide();
    this.confirmBanner.el.append(yes, no);
  }
}
```

### Task 8.3: Wire Esc + physics gate + teardown in main.ts

- [ ] **Step 8.3.1: Modify `src/main.ts`**

Add an `Escape` handler. First handle sub-mode cancellation (placement ghost / map open), then overlay toggle:

```ts
// Near the other key handlers (around L172-179):
input.onPressed('Escape', () => {
  if (fsm.current === 'INIT') return; // title: Esc does nothing
  // Sub-mode: VAB placement ghost active?
  if (fsm.current === 'BUILD' && vab.isPlacing()) {
    vab.cancelPlace();
    return;
  }
  // Sub-mode: orbit map open?
  if (fsm.current === 'FLIGHT' && orbitMap.visible) {
    orbitMap.toggle(dom(), flight ?? undefined);
    return;
  }
  // Otherwise: toggle settings overlay.
  if (fsm.current === 'PAUSED') {
    settingsOverlay.hide();
    fsm.transition(fsm.pausedFrom ?? 'BUILD');
  } else if (fsm.current === 'BUILD' || fsm.current === 'FLIGHT') {
    const prev = fsm.current;
    fsm.transition('PAUSED');
    settingsOverlay.onResume = () => {
      settingsOverlay.hide();
      fsm.transition(prev);
    };
    settingsOverlay.onQuitToMenu = () => teardownToMenu();
    settingsOverlay.show();
  }
});
```

**Executor note:** `vab.isPlacing()` and `vab.cancelPlace()` — check whether the existing `VabController` exposes them. The review noted `cancelPlace` is unreachable; if `isPlacing()` doesn't exist, add it (returns the ghost-active flag) and add `cancelPlace()` as a public method. Read `vab-controller.ts` first.

- [ ] **Step 8.3.2: Gate the physics step in the animate loop**

In `main.ts` `animate()` (around L269-318), wrap the physics + flight HUD update in a PAUSED check:

```ts
if (fsm.current !== 'PAUSED') {
  // existing physics step + flight updates
  ...
}
// Always render (so the dimmed backdrop + overlay show).
```

- [ ] **Step 8.3.3: Add `teardownToMenu()` helper in main.ts**

```ts
function teardownToMenu(): void {
  // Tear down current scene (VAB or flight) and return to INIT.
  if (fsm.current === 'FLIGHT' || fsm.pausedFrom === 'FLIGHT') {
    flight?.exit(); // or whatever the flight teardown is — check SpaceScene.Exit / flight-controller
    scene.remove(flight?.group ?? new THREE.Group());
    flight = null;
  }
  if (fsm.current === 'BUILD' || fsm.pausedFrom === 'BUILD') {
    // Hide VAB UI, reset VAB camera.
    vabUi.hide();
    vabCam.reset();
    menuScene.group.visible = true;
  }
  settingsOverlay.hide();
  mainMenu.show();
  fsm.transition('INIT');
}
```

(Read the existing `enterVab()` and `launchFlight()` to mirror their setup/teardown symmetrically. The exact disposal calls depend on what those functions allocate.)

### Task 8.4: settings-overlay CSS

- [ ] **Step 8.4.1: Add to `src/styles/base.css` (or a new `src/styles/screens/settings.css` linked from index.html)**

```css
#settings-overlay {
  position: fixed; inset: 0; z-index: 80;
  display: flex; align-items: center; justify-content: center;
}
.overlay-backdrop {
  position: absolute; inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
}
#settings-overlay .panel { position: relative; z-index: 1; min-width: 320px; }
.config-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--sp-2) 0;
  font-family: var(--font-body); font-size: var(--fs-body);
}
.overlay-buttons { display: flex; gap: var(--sp-2); margin-top: var(--sp-3); }
.overlay-buttons .dsky-key { flex: 1; }
```

### Task 8.5: Wire onSettings from title menu to open the overlay (Step 3 stub completion)

- [ ] **Step 8.5.1: In main.ts, replace the Step 3 stub**

```ts
mainMenu.onSettings = () => {
  // On the title screen, opening settings still works (no physics to pause).
  settingsOverlay.onResume = () => settingsOverlay.hide();
  settingsOverlay.onQuitToMenu = () => settingsOverlay.hide();
  settingsOverlay.show();
};
```

### Task 8.6: Verify + commit

- [ ] **Step 8.6.1: Verify live**

- Title → SETTINGS → overlay opens with toggles. Close works.
- Enter VAB → place a part, hover placement (ghost active) → Esc cancels placement (ghost gone). Esc again → overlay.
- Launch → mid-flight Esc → overlay opens, rocket visibly stops moving. RESUME → physics resumes at same state. QUIT → confirm → title. Enter VAB again works.
- Toggle CRT FX in overlay → palette flips live.
- Tab through overlay buttons; Enter activates.

- [ ] **Step 8.6.2: Run tests + typecheck + commit**

```bash
npx tsc --noEmit && npx vitest run
git add src/core/state-machine.ts src/ui/settings-overlay.ts src/main.ts src/styles/base.css src/styles/screens/settings.css test/pause.test.ts
git commit -m "feat(gui): step 8 — pause/settings overlay, FSM PAUSED, quit-to-menu

- New PAUSED state + BUILD|FLIGHT → INIT transitions (TDD, 7 tests)
- SettingsOverlay: CRT FX + reduced-motion toggles, RESUME + QUIT
- Esc cancels sub-modes first (placement ghost, map), then opens overlay
- Physics freezes while PAUSED; render continues
- QUIT TO MENU confirms then tears down scene, returns to INIT
- Closes the 'Esc does nothing' and 'no return-to-menu' review Highs

Spec §5.5, §6.4"
```

---

## Step 9: Accessibility polish, responsive final pass, cleanup

**Goal:** Close remaining a11y gaps; verify 900px responsive; delete the legacy monolithic `styles.css`.

**Files:**
- Modify: `src/ui/menu-scene.ts` (slow orbit 4× under reduced-motion)
- Modify: `src/styles/base.css` (a11y helpers)
- Modify: `index.html`, `src/main.ts` (remove legacy stylesheet link, inline loader styles → `base.css`)
- Delete: `src/styles.css` (the monolith)

### Task 9.1: Slow title orbit under reduced-motion

- [ ] **Step 9.1.1: Modify `src/ui/menu-scene.ts`**

In the camera update (around L166, `time * 0.08`), gate on reduced-motion:

```ts
import { reducedMotionEnabled } from './theme';
// in update():
const speedScale = reducedMotionEnabled() ? 0.25 : 1; // 4× slower
const angle = this.time * 0.08 * speedScale;
```

### Task 9.2: ARIA on canvas instruments

- [ ] **Step 9.2.1: Add aria-labels to navball, orbit-map canvas, HUD panel**

In `main.ts` where these are created (or in their constructors), set:
```ts
navball.canvas.setAttribute('role', 'img');
navball.canvas.setAttribute('aria-label', 'Attitude indicator');
hud.el.setAttribute('role', 'region');
hud.el.setAttribute('aria-label', 'Telemetry');
```
The navball's aria-label could be dynamic ("pitch +30, heading 090") but static is acceptable for this pass.

### Task 9.3: Move inline loader styles into base.css; remove legacy monolith

- [ ] **Step 9.3.1: Move `#loader` styles from `index.html` into `src/styles/base.css`**

Cut the `<style>` block from `index.html` `<head>` and paste its contents into `base.css` (tokenizing the hardcoded colors to `var(--...)` where reasonable — at minimum the background to `var(--phosphor-bg)`).

- [ ] **Step 9.3.2: Remove the legacy `<link rel="stylesheet" href="/src/styles.css">` from index.html**

- [ ] **Step 9.3.3: Delete `src/styles.css`**

```bash
git rm src/styles.css
```

- [ ] **Step 9.3.4: Verify nothing references the old classes**

Run: `grep -rE 'class="(panel|hud|menu-|vab-|flight-)' src/ | grep -v node_modules`
Expected: every match is now a component class or screen CSS class, nothing pointing at deleted rules. If any old hardcoded-color CSS rule is referenced, port it to tokens.

### Task 9.4: Responsive final pass

- [ ] **Step 9.4.1: Boot at 900×640 and verify no overlap**

Resize the browser window to 900×640. Walk every screen:
- Title: controls card collapses to single column (media query in title.css).
- VAB: palette shrinks to 200px (media query in vab.css).
- Flight HUD: min-width 160px; hold-panel wraps; staging panel moves to bottom.
- Orbit map: overlay still fits.

If anything overlaps, add targeted `@media (max-width: 900px)` rules in the relevant `screens/*.css`.

### Task 9.5: Final QA pass + commit

- [ ] **Step 9.5.1: Run the full manual QA checklist from spec §7.4**

Document the results; file follow-up issues for anything that fails (don't expand scope here).

- [ ] **Step 9.5.2: Run all tests + typecheck + build**

```bash
npx tsc --noEmit
npx vitest run
npx vite build --config vite.renderer.config.ts
```
Expected: tsc exit 0; all tests green; build exit 0. (Recreate `vite.renderer.config.ts` temporarily for the build check, then delete.)

- [ ] **Step 9.5.3: Commit + merge**

```bash
rm -f vite.renderer.config.ts
git add -A
git commit -m "feat(gui): step 9 — a11y polish, responsive 900px, delete legacy CSS

- Title orbit slows 4× under reduced-motion (spec §7.2)
- ARIA roles + labels on navball, HUD (spec §7.1)
- Loader styles moved from index.html into base.css (tokenized)
- Deleted monolithic src/styles.css — all rules now in tokenized files
- 900px responsive verified across all four screens

Spec §7

Closes the GUI UX Overhaul. All four screens restyled, 3 Criticals fixed,
pause overlay working, reduced-motion handled, keyboard nav, tests green."
```

- [ ] **Step 9.5.4: Open a PR from `feat/gui-ux-overhaul` to `master`**

```bash
git push -u origin feat/gui-ux-overhaul
gh pr create --title "GUI UX Overhaul: Retro NASA restyle + 3 Criticals + pause menu" \
  --body "Implements docs/superpowers/specs/2026-07-18-gui-ux-overhaul-design.md. See commits for step-by-step."
```

---

## Plan self-review

After writing the complete plan, I checked it against the spec with fresh eyes:

**1. Spec coverage** (skim each spec section, find the implementing task):
- §3 Tokens & Theming → Step 1 ✓
- §4 Shared Components (8) → Step 2 ✓
- §5.1 Title restyle → Step 3 ✓
- §5.1 Critical #3 controls card → Step 3 ✓
- §5.2 VAB restyle + TELEMETRY stub → Step 5 ✓
- §5.2 Critical #2 Launch reason → Step 5 ✓
- §5.3 Flight HUD restyle → Step 4 ✓
- §5.4 Orbit map restyle + body labels + legend → Step 6 ✓
- §5.5 Settings overlay → Step 8 ✓
- §6.1 Critical #1 crash → Step 7 ✓
- §6.2 Critical #2 (dup of §5.2) → Step 5 ✓
- §6.3 Critical #3 (dup of §5.1) → Step 3 ✓
- §6.4 Pause menu → Step 8 ✓
- §7.1 a11y → Step 9 (partial) + Step 1 (focus-visible) ✓
- §7.2 reduced-motion → Step 1 (CRT suppression) + Step 9 (title orbit) ✓
- §7.3 responsive → Step 9 + media queries per-screen ✓
- §7.4 testing → tests embedded in Steps 1, 2, 5, 7, 8 ✓
- §7.5 rollout → Pre-Flight + per-Step commits ✓

All spec sections covered.

**2. Placeholder scan:** I used `// TODO: copy ... from the previous hud.ts` in Step 4.1.1 — that's an explicit executor instruction (copy a known formula from a known git revision), not a vague TBD. Same for the `computeApPe`/`computeQ` throws — they're deliberate forcing functions so the executor must replace them. All other code blocks are complete.

**3. Type consistency:** `launchReadiness` returns `{ ok: true } | { ok: false; missing: Array<'pod'|'engine'> }` — Step 5.1.1 test and Step 5.1.3 impl match. `BannerTone = 'success'|'info'|'alarm'` — Step 2.1.1, Step 2.4.4, Step 7.3.2 consistent. `HoldMode` referenced in Step 4.3.1 is imported from `flight-controller` (existing type). `isCrashImpact` Step 7.1.3 signature `(speed: number): boolean` matches test usage. State machine `pausedFrom` getter vs private field — flagged inline in Step 8.1.3 to rename to `_pausedFrom`. No other inconsistencies.

The plan is ready.
```
```
```
