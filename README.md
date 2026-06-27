# miniKSP

A super-basic 3D Kerbal Space Program prototype. Build a rocket in the VAB,
launch it, reach orbit, transfer to the moon, land, and return safely.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Controls

**VAB (builder):** Click a part in the left palette, then click in the scene to
place it. Right-drag to orbit the camera, mouse wheel to zoom. `Q`/`E` rotate the
selected part, `Delete` removes it. A launchable design needs at least a Command
Pod and an Engine; add Fuel Tanks for reaction mass and use Struts as decoupler
joints between stages.

**Flight:** `Shift`/`Ctrl` throttle up/down, `Z` full throttle, `X` cut, `Space`
to stage (drops the bottom engine+tank stage). `W`/`S` pitch, `A`/`D` yaw,
`Q`/`E` roll. `M` toggles the orbit map, `F1` reverts to the VAB, `H` toggles
the on-screen control hints.

## Goal

Reach a closed orbit around Terra, transfer to Luna, land softly, lift off and
return to Terra's surface, touching down safely. Banners mark each milestone;
**🏆 Mission Complete** ends the run with a "Build Again" button.

## Desktop build (standalone .exe)

miniKSP can be packaged into a standalone Windows executable via Electron — no
browser, Node, or install needed for the end user.

```bash
npm install
npm run build:exe        # → release/miniKSP-<version>-portable.exe
```

The portable `.exe` runs by double-clicking. Requires Windows x64.

### ⚠️ One-time setup: enable Developer Mode (Windows)

On a default Windows install, `npm run build:exe` fails unpacking
`electron-builder`'s code-signing toolchain with:

```
ERROR: Cannot create symbolic link : A required privilege is not held by the client
```

This is because the toolchain archive contains macOS symlinks that Windows
won't let a non-admin process recreate. Fix it once:

**Settings → System → For developers → Developer Mode → On**

Then re-run `npm run build:exe`. (Alternatively, run the build from an
Administrator terminal — that also grants the symlink privilege.)

### Development with hot reload

```bash
npm run dev:electron      # launches the app in an Electron window with HMR
```

## Design & implementation

- Design spec: `docs/superpowers/specs/2026-06-21-miniksp-design.md`
- Implementation plan: `docs/superpowers/plans/2026-06-21-miniksp.md`

## Tuning note

The physics constants in `src/physics/constants.ts` and the part stats in
`src/entities/parts-catalog.ts` are first-pass values calibrated so a two-stage
rocket can plausibly reach orbit and the moon. They are intended to be tuned by
playtesting — see spec §7 risk #4.
