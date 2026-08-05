# Project Orbital Frogs

A 3D space flight game inspired by Kerbal Space Program. Build a rocket,
launch it, reach orbit, fly to the moon, land, and come back alive.

## Quick Start

**Easiest:** Download the `.exe` from [Releases](../../releases/latest) and
double-click it. No install needed.

> Windows SmartScreen may warn — it's just unsigned. Click
> **More info → Run anyway**.

**From source** (needs [Node.js 18+](https://nodejs.org/)):

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## How to Play

### Building a Rocket (VAB)

- Click a part on the left, then click in the scene to place it
- **Right-drag** to orbit camera, **wheel** to zoom
- `Q`/`E` rotate selected part · `Delete` to remove it
- You need at least a **Command Pod** and an **Engine** to launch
- Add **Fuel Tanks** for range and a **Stack Decoupler** to split stages
- **Booster Engines** have the thrust to leave the pad; **Vacuum Engines** are
  far more efficient but too feeble to lift anything through air. Boosters
  below, vacuum engines on top — one stage is never enough

### Flying

| Key | Action |
|-----|--------|
| `Shift`/`Ctrl` | Throttle up/down |
| `Z`/`X` | Full / cut throttle |
| `Space` | Stage (drop bottom stage) |
| `W`/`S`/`A`/`D` | Pitch / yaw |
| `Q`/`E` | Roll |
| `T` | Stability Assist (SAS) |
| `M` | Toggle orbit map |
| `F1` | Back to VAB |
| `H` | Toggle control hints |

The buttons beside the navball auto-point your ship at prograde, retrograde,
normal, or anti-normal heading.

### Goal

Orbit Terra → transfer to Luna → land softly → lift off → return to Terra
and touch down safely. Banners mark each milestone.

## Build Your Own .exe

```bash
npm run build:exe
```

> **Windows:** Enable **Developer Mode** first (Settings → System → For
> Developers). Without it the build fails on symlink permissions.

## Tech

Three.js · cannon-es · simplex-noise · Vite + TypeScript · Electron · Vitest

## For Developers

Physics constants live in `src/physics/constants.ts` and part stats in
`src/entities/parts-catalog.ts` — tuned for a two-stage rocket to reach orbit
and the moon. Adjust to taste.

[**docs/GDD.md**](docs/GDD.md) is the game design document: every system, every
tuning constant and what it governs, the invariants not to break, and the
`window.__game` API for driving the game programmatically. Written to be read by
people and by coding agents.
