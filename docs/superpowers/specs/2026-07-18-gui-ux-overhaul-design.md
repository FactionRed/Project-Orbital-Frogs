# GUI UX Overhaul — Design Spec

**Project:** Project Orbital Frogs (`Projects/Project-Orbital-Frogs/`, v0.4.0)
**Date:** 2026-07-18
**Status:** Design approved section-by-section; ready for implementation planning.
**Predecessor docs:**
- `Project-Orbital-Frogs-UX-Review.md` (findings report driving this overhaul)
- `Project-Orbital-Frogs-Navball-Investigation.md` + the navball fix (ships alongside or before)

---

## 1. Goal & scope

Restyle all four GUI surfaces (title, VAB, flight HUD, orbit map) in a Retro NASA / Apollo diegetic visual language, and fix the three Critical UX defects from the review plus the Esc / pause / return-to-menu High (pulled in during Section 3 design).

**In scope:**
- New design-token layer (CSS custom properties) + Vintage/Modern dual theme.
- Eight shared class-based components.
- Visual restyle of: title menu, VAB, flight HUD, orbit map.
- Functional fixes: silent-Terra-crash feedback, disabled-Launch reason messaging, controls card on title, full pause/settings overlay (Esc toggles, physics freezes, QUIT TO MENU returns to title with confirm).
- Accessibility: focus rings, keyboard nav, ARIA on canvas instruments, color+glyph state signaling.
- Responsive down to 900px wide.
- Two bundled webfonts (VT323 + IBM Plex Mono).

**Out of scope (deferred, listed in §10):** live VAB stats (mass/TWR/dV) — ships a stub; maneuver nodes / encounter prediction / map focus switching; staging editor, symmetry, save/load, audio, time warp, revert-to-launch; crash particle FX; touch input and mobile layout; full screen-reader live narration; styled `.list` component; generic modal/dialog layer; tooltips beyond hover.

**Non-goal:** a framework rewrite. The architecture stays as hand-rolled DOM + class-based CSS (Approach A).

---

## 2. Decisions log (from brainstorming)

| Decision | Choice |
|---|---|
| Scope | Polish + 3 Criticals (no framework rebuild); pause menu pulled in during Section 3 |
| Visual direction | Retro NASA / Apollo diegetic |
| Screens | Title, VAB, Flight HUD, Orbit map (all four) |
| Functional fixes | Silent Terra crash, disabled-Launch msg, controls on title, full pause menu |
| Authenticity vs legibility | Two modes shipped now: Vintage (full CRT) + Modern (crisp) |
| Typography | VT323 (display) + IBM Plex Mono (body), both bundled |
| Architecture | A — CSS custom-property tokens + hand-written class components |
| Mode default | **Modern** (vintage is opt-in) |
| Token names | DSKY-flavored (`--ink`, `--amber`, `--green`, `--red`, `--warn`) |
| `--warn` | Distinct yellow, separate from `--amber` |
| Components | 8 classes: `.panel`, `.readout`, `.dsky-key`, `.toggle`, `.gauge`, `.banner`, `.toast`, `.tooltip`. The theme toggle is a placement of `.toggle` inside the settings panel, not a separate class (see §4). |
| DSKY-key labels | Single word + hint line (`LAUNCH / to flight`) |
| Theme toggle location | Settings/pause panel only |
| VAB stats panel | Visible-empty stub ("TELEMETRY PENDING") |
| Settings overlay | Full pause menu (toggles + RESUME + QUIT TO MENU + physics freeze) |
| Orbit map | Restyle + body labels + Ap/Pe legend (no maneuver nodes) |
| Crash threshold | 30 m/s radial impact, shared across Terra and Luna |
| Esc behavior | Esc toggles the overlay open/closed |
| QUIT TO MENU | Confirms ("Discard this flight? YES/NO") before teardown |
| Reduced-motion title orbit | Slow to 4× (not hard-stop) |
| Min supported width | 900px |
| Rollout | Per-step commits/PRs (tokens → per-screen → Criticals+pause → cleanup) |

---

## 3. Section 1 — Tokens & theming

### Files
- `src/styles/tokens.css` — all CSS custom properties for both themes.
- `src/styles/base.css` — reset, base element styles, the scanline overlay (`body[data-theme="vintage"]::before`).
- `src/ui/theme.ts` — `applyTheme()`, `toggleTheme()`, persisted choice, reduced-motion handling.
- `index.html` links stylesheets in order: tokens → base → components → screens.

### Mode switch
A single attribute on the root element: `<html data-theme="vintage|modern">`.

- **Vintage** sets `--crt-scanlines: 1`, `--crt-bloom: 1`, `--crt-flicker: 1` and the amber/green-on-black palette.
- **Modern** sets all three CRT vars to `0` and the same palette at higher contrast (brighter text, no phosphor tint).
- `prefers-reduced-motion: reduce` forces `--crt-flicker: 0` and `--crt-scanlines: 0` regardless of chosen theme. (Modern is the default, so reduced-motion users get Modern's look automatically; this rule only matters if a reduced-motion user explicitly chose Vintage.)
- Persistence: `localStorage.setItem('orbital-theme', 'vintage'|'modern')`.
- **Default on first load: Modern.**

### Token taxonomy

| Group | Tokens |
|---|---|
| **Color** | `--ink`, `--ink-dim`, `--ink-faint`, `--amber` (primary accent / DSKY), `--warn` (yellow, caution), `--green` (go / nominal), `--red` (alarm / abort), `--cyan` (informational, sparing), `--phosphor-bg` (screen bg), `--panel-bg`, `--panel-border`, `--grid-line` |
| **Type** | `--font-display` (VT323), `--font-body` (IBM Plex Mono), `--fs-readout` (28-36px), `--fs-label` (11-13px), `--fs-body` (14px), `--tracking-mono` (0.08em) |
| **Spacing** | `--sp-1` (0.25rem) … `--sp-6` (2rem), 4px base |
| **Radii** | `--r-bezel` (2px), `--r-key` (1px) |
| **Glow** | `--glow-phosphor` (`0 0 6px var(--amber)` vintage, `none` modern) |
| **Motion** | `--t-fast` (80ms), `--t-med` (160ms), `--t-scanline-drift` (8s linear infinite), `--t-toast` (4s) |

Every screen consumes only these tokens; no hardcoded colors or magic px values outside `tokens.css` (enforced by a unit test, §8.4).

---

## 4. Section 2 — Shared components

Plain DOM built from TypeScript + CSS classes from `src/styles/components.css`. Each lives in `src/ui/components/<name>.ts` and follows the existing pattern (constructor builds DOM, methods mutate, `show()/hide()`).

| Component | Class | Notes |
|---|---|---|
| **Panel** | `.panel[data-variant="bezel|flat"][data-label="..."]` | Bordered instrument housing; optional etched label strip. |
| **Readout** | `.readout > .readout__label/.readout__value/.readout__unit` with `data-state="nominal|caution|alarm"` | Value uses `--font-display`; state recolors + prepends glyph (`●`/`▲`/`■`). |
| **DSKY key** | `.dsky-key[data-active]` | Square, two-line label (word + hint), inset shadow when active. All buttons use this. |
| **Toggle** | `.toggle > input + .toggle__track > .toggle__thumb + .toggle__label` | Physical bat-handle; track lights green when on. |
| **Gauge** | `.gauge[data-kind="bar|arc"]` with SVG + `.gauge__value` | Bar for throttle/fuel; arc for navball bezel dials. Threshold-colored. |
| **Banner** | `.banner[data-tone="success|info|alarm"]` | Full-width event banner; alarm pulses (suppressed under reduced-motion). |
| **Toast** | `.toast[data-tone]` | Transient top-center message, auto-hides after `--t-toast`. |
| **Tooltip** | `.tooltip` | Hover tooltip replacing native `title=`; used on part catalog and disabled DSKY keys. |
| *(Theme toggle)* | (`.toggle` placed inside settings panel, labeled `CRT FX`) | Not a separate class — places `.toggle` and calls `toggleTheme()`. |

That's **8 component classes** (`.panel`, `.readout`, `.dsky-key`, `.toggle`, `.gauge`, `.banner`, `.toast`, `.tooltip`). The theme toggle is a use of `.toggle`, not a 9th class.

### Intentionally not components
- Navball, orbit-map canvas, VAB 3D viewport — canvas/WebGL surfaces, restyled at edges only.
- Modal/dialog — pause menu composes `.panel` + `.dsky-key` directly.
- Native tooltips replaced only where hover matters (parts, disabled keys).

### Construction pattern (Readout example)
```ts
export class Readout {
  readonly el: HTMLDivElement;
  private valueEl: HTMLSpanElement;
  constructor(label: string, unit = '') { /* build .readout DOM */ }
  setValue(v: string) { this.valueEl.textContent = v; }
  setState(s: 'nominal' | 'caution' | 'alarm') { this.el.dataset.state = s; }
}
```

---

## 5. Section 3 — Per-screen restyle

### 5.1 Title menu (`main-menu.ts`, `menu-scene.ts`)
- Keep: 3D crash-site cinematic.
- Title card → `.panel[data-label="MISSION OPS"]` with VT323 title in `--amber` + `--glow-phosphor`, stenciled subtitle in `--ink-dim`, amber rule.
- Buttons → vertical stack of `.dsky-key`s: `ENTER / VAB`, `SETTINGS / theme, controls`, `QUIT / exit`.
- Version → bottom-left stencil `REL 0.4.0 · BUILD <sha>` in `--ink-faint`. (`<sha>` is the git short SHA at build time, injected via Vite's `define` — not a TBD.)
- **New (Critical #3):** `.panel[data-label="FLIGHT PROCEDURES"]` below buttons — controls card (see §6.3).

### 5.2 VAB (`vab-ui.ts`, viewport chrome)
- Keep: snap-to-node placement, part palette structure.
- Left palette → `.panel[data-label="PARTS CATALOG"]`; each part button → `.dsky-key` with glyph + inline stats; `.tooltip` on hover shows `desc`.
- Actions → `.panel[data-label="ACTIONS"]` row of `.dsky-key`s: `ROT -90 / Q`, `ROT +90 / E`, `DELETE / Del`, `CLEAR / all`, `LAUNCH / to flight`.
- Viewport frame → thin `--panel-border` with etched corner ticks; grid color → `--grid-line`.
- **TELEMETRY stub:** `.panel[data-label="TELEMETRY"]` visible-empty with placeholder text `TELEMETRY PENDING — stats in next release`. Marks the intentional gap with a code comment.
- **Critical #2:** disabled Launch `.dsky-key` shows `.tooltip` + ACTIONS panel status line (see §6.2).

### 5.3 Flight HUD (`hud.ts`, `navball.ts`, `hold-panel.ts`, `staging-display.ts`, `flight-prompts.ts`)
- Top-right HUD → `.panel[data-label="TELEMETRY"]` column of `.readout`s: ALT, VEL, Ap/Pe, FUEL, Q, SOI, SAS. State mapping: Q>200→alarm, fuel<20%→caution, else nominal. Readout component requires a unit — fixes the unitless-Ap/Pe and unitless-FUEL review items.
- Throttle → `.gauge[data-kind="bar"]` along panel top, `--green` fill, percentage label below.
- Navball → keep canvas; wrap in `.panel[data-label="ATTITUDE"]` bezel with corner ticks. Canvas internals unchanged.
- Hold-panel → six `.dsky-key`s: `PRO / velocity`, `RET / retrograde`, `NRM / +normal`, `ANTI / -normal`, `RAD+ / out`, `RAD- / in`. Fixes glyph-only-buttons review item.
- Staging panel → `.panel[data-label="STAGING"]`; slots styled like `.dsky-key` rows; active stage `[data-active]`. `pointer-events:none` retained (drag-reorder out of scope).
- Flight prompts (`#flight-prompt`, `#fuel-prompt`) → `.toast`s with appropriate tones.

### 5.4 Orbit map (`orbit-map.ts`)
- Keep: trajectory line, Ap/Pe markers, ship marker, M-toggle, drag-rotate, wheel-zoom.
- Top-left overlay → `.panel[data-label="ORBITAL TRACK"]` with `.readout`s: `Ap` and `Pe` (both with units — fixes HUD/map inconsistency), plus `BODY` readout showing SOI body name.
- Help line → small `--ink-faint` footer in the panel.
- **In scope:** body labels (`TERRA`, `LUNA` text labels at each body on the map) and an Ap/Pe marker legend (`Ap ●` red / `Pe ●` blue) so marker colors are identified.
- **Out of scope:** maneuver nodes, encounter prediction, focus switching.

### 5.5 New: Settings/Pause overlay (`src/ui/settings-overlay.ts`)
- Triggered by **Esc** in any state (Esc toggles open/closed).
- Centered `.panel[data-label="SYSTEM CONFIG"]` over a dimmed backdrop:
  - `.toggle` `CRT FX` (Vintage/Modern).
  - `.toggle` `REDUCED MOTION` (auto-on if OS pref; user can override).
  - `.dsky-key` `RESUME / Esc`.
  - `.dsky-key` `QUIT TO MENU / discard flight`.
- QUIT TO MENU shows confirm banner `Discard this flight? YES / NO` before teardown.
- Physics freezes while open (see §6.4).

---

## 6. Section 4 — Functional fixes

### 6.1 Critical #1 — Silent Terra crash → visible feedback
- **Behavior:** terrain contact with inward radial speed ≥ **30 m/s** shows `.banner[data-tone=alarm]` `■ LITHOBRAKE / impact at <N> m/s` (where `<N>` is the runtime impact speed, read from `lastImpactSpeed`), terminal (BUILD AGAIN button). Below 30 m/s = soft landing, silent.
- **Threshold:** 30 m/s shared across Terra and Luna (one constant, `IMPACT_CRASH_THRESHOLD = 30`).
- **Code:**
  - `flight-controller.ts` terrain-contact path (`clampToTerrain`, ~L521-561): record inward radial velocity *before* clamping; expose `lastImpactSpeed` and `lastImpactFrame`.
  - `win-states.ts`: add a planet-landing branch mirroring the moon branch (~L86, L103-106) using `IMPACT_CRASH_THRESHOLD`; fire `crash` event with impact speed; call `show(text, true)` so it's terminal (also fixes the "crash banner auto-hides in 4s" review High — terminal banners don't auto-hide).
- **Success criterion:** dropping a fuel-less rocket from altitude produces the red crash banner + BUILD AGAIN. Reproduces clean against `pof-08-silent-crash.png`.

### 6.2 Critical #2 — Unexplained disabled Launch → clear reason
- **Behavior:** disabled Launch `.dsky-key` shows `.tooltip` on hover ("NEEDS COMMAND POD + ENGINE" / "NEEDS COMMAND POD" / "NEEDS ENGINE"); ACTIONS panel shows a persistent status line `○ NOT READY — NEEDS POD` (or `● READY` green when completable).
- **Code:** extend `canLaunch(d)` in `ship.ts` (currently `hasPod && hasEngine`) to return `{ ok: true }` | `{ ok: false, missing: ['pod'|'engine'] }`. VAB UI consumes via the existing per-frame `onReadyChange` path.
- **Success criterion:** empty VAB hover → "NEEDS COMMAND POD + ENGINE"; pod-only → "NEEDS ENGINE"; complete → green `● READY`.

### 6.3 Critical #3 — No controls on title → controls card
- **Behavior:** title gains `.panel[data-label="FLIGHT PROCEDURES"]` below buttons, always visible, two-column stenciled list:

```
BUILD                 FLY
 LMB    place part     SHIFT  throttle +
 RMB-drag orbit view   CTRL   throttle -
 WHEEL  zoom           Z / X  full / cut
 Q / E  rotate part    SPACE  stage
 DEL    remove part    W S A D  pitch/yaw
 L      launch         Q / E  roll
                       T      SAS
                       M      map
                       ESC    menu
                       F1     revert
```

- Styled with Plex Mono, `--ink-dim`, `--grid-line` rules between rows. No new component (plain `<dl>` styling; `.list` deferred).
- `BRIEF / FULL` toggle if it clutters; default FULL.
- **Success criterion:** a first-load player sees how to start, build, and fly within 5 seconds, without opening `#hints` or the README.

### 6.4 Pulled-in High — Esc / pause / return-to-menu
- **Behavior:**
  - Esc anywhere: if a sub-mode is active, the first Esc cancels that sub-mode and a second Esc opens the overlay. If no sub-mode is active, Esc opens the overlay directly. The sub-modes are explicitly: (a) VAB placement mode — a part ghost is following the cursor (Esc calls `cancelPlace()`, which is currently unreachable code per the review — this fix adds the path); (b) flight map view — the orbit map is open (Esc closes the map, equivalent to pressing `M`). No other sub-modes exist.
  - Esc again (toggle) closes overlay.
  - Physics freezes while overlay is open: `animate` loop checks `fsm.current === 'PAUSED'` and skips the physics step + flight HUD update; render still draws last frame under dimmed backdrop.
  - RESUME closes overlay, returns to prior state, physics resumes.
  - QUIT TO MENU shows confirm `Discard this flight? YES / NO`; on YES, tears down scene and returns to `INIT` (title). On NO, returns to overlay.
  - F1 (revert to VAB) unchanged.
- **Code:**
  - New FSM state `'PAUSED'` in `state-machine.ts`, reachable from `BUILD` and `FLIGHT`, returning to prior state on resume.
  - New transition `BUILD|FLIGHT → INIT` for QUIT TO MENU.
  - `SettingsOverlay` class (`src/ui/settings-overlay.ts`).
  - `main.ts`: wire `Escape` key handler (currently dead); open overlay; transition to `PAUSED`; gate physics step in `animate`.
  - New `teardownScene()` helper in `main.ts` (inverse of `enterVab()`/`launchFlight()`).
- **Success criterion:** Esc mid-flight opens overlay and rocket stops; RESUME resumes at exact same state; QUIT TO MENU → confirm → title; player can Enter VAB again.

---

## 7. Section 5 — Accessibility, reduced-motion, responsive, testing, rollout

### 7.1 Accessibility
- `:focus-visible` ring (`--amber`) on every interactive component.
- Title menu keyboard-navigable: Tab cycles, Enter activates; first focus → `ENTER VAB` on load.
- Canvas instruments get `role="img"` + `aria-label` (e.g. "Attitude indicator, pitch +30, heading 090"); HUD panel `role="region" aria-label="Telemetry"`.
- Color+glyph state signaling (`●`/`▲`/`■`) so color-blind players get the glyph.
- Bundled fonts eliminate OS-dependence.
- Out of scope: full screen-reader live narration, switch-control. Documented as future work.

### 7.2 Reduced motion (`prefers-reduced-motion: reduce`)
- All three Vintage motion sources (scanline drift, phosphor flicker, bloom pulse) force off, even if user chose Vintage. Static scanline overlay also dropped to be safe.
- `.toast[data-tone=info]` pulse and `.banner[data-tone=alarm]` red pulse stop animating; alarm banner stays solid red.
- Settings overlay `REDUCED MOTION` toggle reflects OS setting, user can override (force-on regardless of OS). Default = follow OS.
- Title camera orbit (`menu-scene.ts:166`) **slows to 4×** under reduced-motion (does not hard-stop).

### 7.3 Responsive layout
- Three breakpoints: `≥1280px` (default), `900-1279px` (panels shrink, font scale 0.9×), `<900px` (not officially supported but must not break — single-column, navball → 120px, no overlap).
- Typography → `rem`; panel widths → `clamp()` (e.g. VAB palette `width: clamp(220px, 18vw, 280px)`); `--sp-*` tokens `rem`-based.
- HUD uses `position: fixed` + `inset` + `clamp()` so it never clips.
- **Min officially-supported width: 900px.** Recommended 1280×720.
- Out of scope: touch input, portrait-phone layout.

### 7.4 Testing
**Unit (vitest, `test/`):**
- `tokens.test.ts` — both themes define every token; no hardcoded color outside `tokens.css` (grep assertion).
- `theme.test.ts` — `toggleTheme()` flips `data-theme`, persists, respects reduced-motion override.
- `readout.test.ts`, `gauge.test.ts` — DOM + `data-state` → token color via `getComputedStyle`.
- `crash-detection.test.ts` — impact detector fires at ≥30 m/s, not below. Pure function.
- `vab-readiness.test.ts` — reason-returning readiness: empty → `{missing:['pod','engine']}`, pod-only → `{missing:['engine']}`, complete → `{ok:true}`.
- `pause.test.ts` — FSM `BUILD→PAUSED→BUILD`, `FLIGHT→PAUSED→FLIGHT`, illegal transitions rejected, physics step skipped while PAUSED.

**Integration (Playwright via `__game`):**
- Visual regression of each restyled screen against baselines in **both** Vintage and Modern.
- Reproduce all 3 Criticals post-fix.

**Manual QA checklist:**
- Tab through title with keyboard only.
- Toggle Vintage↔Modern on each screen; confirm no layout shift.
- Set OS reduced-motion; confirm flicker/drift stop.
- Resize 1280→900→700; confirm no overlap.
- Trigger all 3 Criticals; confirm fixes.
- Esc toggles overlay; physics freezes; RESUME resumes; QUIT TO MENU confirms and returns to title.

### 7.5 Rollout (per-step commits/PRs)
1. **Tokens + base + components** with no screen changes. Existing screens still work via specificity. Verify no regression — safe checkpoint.
2. **Restyle one screen at a time** (title → flight HUD → VAB → orbit map), each its own commit, each visually verified before the next.
3. **3 Criticals + pause menu** — depend on Steps 1-2 but otherwise independent.
4. **Delete old monolithic `styles.css` rules** once every screen migrated. Remove dead code.

Each step ships green: all tests pass, `tsc --noEmit` clean, `vite build` succeeds, relevant manual QA section passes.

The navball fix in the working tree ships with or before this work.

---

## 8. Out of scope (deferred)

Explicitly deferred to future passes (listed so nothing is silently dropped):
- Live VAB stats (mass/TWR/dV) — TELEMETRY stub ships instead.
- Maneuver nodes, encounter prediction, map focus switching.
- Staging editor, symmetry modes, save/load, audio, time warp, revert-to-launch.
- Crash particle FX, audio feedback.
- Touch input, mobile/portrait layout.
- Full screen-reader live narration of canvas content.
- Switch-control support.
- A styled `.list` component.
- Generic modal/dialog layer.
- Tooltips beyond hover.

---

## 9. Open questions
None. All design decisions resolved during brainstorming (§2).

## 10. Success criteria (overall)

The overhaul is complete when:
1. All four screens render in the Retro NASA visual language, consistent across Vintage and Modern modes.
2. The 3 Criticals are fixed and verified by reproducing their original failure scenarios.
3. The pause/settings overlay works (Esc toggles, physics freezes, RESUME/QUIT TO MENU both function, QUIT confirms).
4. `prefers-reduced-motion` suppresses all Vintage motion; title orbit slows 4×.
5. Layout holds without overlap down to 900px wide.
6. Title menu is fully keyboard-navigable.
7. All unit + integration tests green; `tsc --noEmit` clean; `vite build` succeeds.
8. Manual QA checklist (§7.4) passes.
