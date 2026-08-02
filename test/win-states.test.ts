import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  WinStates,
  SURFACE_CONTACT_ALT,
  SURFACE_PENETRATION_TOLERANCE,
  IMPACT_CRASH_THRESHOLD,
  type WinEvent,
} from '../src/ui/win-states';
import { G, PLANET, MOON } from '../src/physics/constants';
import type { FlightController } from '../src/flight/flight-controller';

// --- Minimal DOM stub -------------------------------------------------------
// vitest runs in the `node` environment (see vite.config.ts), but WinStates
// builds its banner element in the constructor. These tests only care about the
// emitted event stream, so a hand-rolled stub is cheaper than pulling in jsdom.
// setTimeout is a no-op: the auto-hide timer is presentation, not event logic.

function stubElement(): Record<string, unknown> {
  return {
    id: '',
    innerHTML: '',
    textContent: '',
    style: {},
    querySelector: () => stubElement(),
    addEventListener: () => {},
    appendChild: () => {},
  };
}

let savedDocument: unknown;
let savedWindow: unknown;

beforeEach(() => {
  savedDocument = (globalThis as any).document;
  savedWindow = (globalThis as any).window;
  (globalThis as any).document = {
    createElement: () => stubElement(),
    body: { appendChild: () => {} },
  };
  (globalThis as any).window = {
    setTimeout: () => 0,
    clearTimeout: () => {},
  };
});

afterEach(() => {
  (globalThis as any).document = savedDocument;
  (globalThis as any).window = savedWindow;
});

// --- Stub flight ------------------------------------------------------------
// Only the fields WinStates.update reads: ship.rootBody position/velocity,
// planet position/mu/data.radius, moon position/data.radius.

type V3 = [number, number, number];

/** Luna parked on the +X axis, matching CelestialBody.update at t = 0. */
const MOON_AT: V3 = [MOON.orbitRadius, 0, 0];

function stubFlight(pos: V3, vel: V3 = [0, 0, 0], moonPos: V3 = MOON_AT): FlightController {
  return {
    ship: {
      rootBody: {
        position: { x: pos[0], y: pos[1], z: pos[2] },
        velocity: { x: vel[0], y: vel[1], z: vel[2] },
      },
    },
    planet: {
      position: { x: 0, y: 0, z: 0 },
      mu: G * PLANET.mass,
      data: PLANET,
    },
    moon: {
      position: { x: moonPos[0], y: moonPos[1], z: moonPos[2] },
      data: MOON,
    },
  } as unknown as FlightController;
}

/** A point `alt` metres above (or below, if negative) Luna's mean radius, on +Y. */
function nearMoon(alt: number): V3 {
  return [MOON.orbitRadius, MOON.radius + alt, 0];
}

function runUpdate(flight: FlightController): WinEvent[] {
  const win = new WinStates();
  const events: WinEvent[] = [];
  win.onEvent = (e) => events.push(e);
  win.update(flight);
  return events;
}

describe('WinStates — lunar landing vs. crash', () => {
  it('reports a slow touchdown just above the surface as a landing', () => {
    expect(runUpdate(stubFlight(nearMoon(10)))).toEqual(['moon-landed']);
  });

  it('reports a fast impact at the surface as a crash, not a landing', () => {
    // Straight down (−Y here, since the ship sits on Luna's +Y side).
    const vImpact = IMPACT_CRASH_THRESHOLD * 2;
    const events = runUpdate(stubFlight(nearMoon(10), [0, -vImpact, 0]));
    expect(events).toEqual(['crash']);
  });

  it('does not report a landing for a ship at rest inside the moon', () => {
    // Regression: `moonAlt` is measured from Luna's centre, so it goes NEGATIVE
    // inside the body. A ship 200 m under the surface with zero velocity used to
    // satisfy the landing test (alt < 50, vertical speed < threshold) and emit
    // 'moon-landed' before the crash branch got a chance to fire.
    const events = runUpdate(stubFlight(nearMoon(-200)));
    expect(events).not.toContain('moon-landed');
    expect(events).toEqual(['crash']);
  });

  it('still counts a landing that settles slightly below the mean radius', () => {
    // Luna's terrain dips below its mean radius, so a legitimate landing can read
    // a small negative altitude. The landing floor matches the crash branch's
    // tolerance, so the two verdicts stay mutually exclusive.
    const alt = -SURFACE_PENETRATION_TOLERANCE / 2;
    expect(runUpdate(stubFlight(nearMoon(alt)))).toEqual(['moon-landed']);
  });

  it('emits exactly one verdict per resting position — never both', () => {
    const tol = SURFACE_PENETRATION_TOLERANCE;
    const alts = [-400, -200, -50, -tol - 1, -tol, -tol + 1, 0, SURFACE_CONTACT_ALT - 1];
    for (const alt of alts) {
      const events = runUpdate(stubFlight(nearMoon(alt)));
      expect(events, `alt=${alt}`).toHaveLength(1);
    }
  });

  it('emits nothing while hovering slowly above the landing ceiling', () => {
    expect(runUpdate(stubFlight(nearMoon(SURFACE_CONTACT_ALT + 1)))).toEqual([]);
  });
});

describe('WinStates — orbit', () => {
  it('emits orbit for a circular orbit around Terra', () => {
    const r = PLANET.radius + 1000;
    const vc = Math.sqrt(G * PLANET.mass / r);
    expect(runUpdate(stubFlight([r, 0, 0], [0, 0, vc]))).toEqual(['orbit']);
  });

  it('does not emit orbit for a sub-orbital lob', () => {
    const r = PLANET.radius + 1000;
    expect(runUpdate(stubFlight([r, 0, 0], [0, 0, 10]))).toEqual([]);
  });

  it('does not emit orbit while inside Luna SOI', () => {
    // Circular orbit about Luna, well inside its sphere of influence.
    const alt = MOON.radius + 200;
    const vc = Math.sqrt(G * MOON.mass / alt);
    const events = runUpdate(stubFlight([MOON.orbitRadius, alt, 0], [0, 0, vc]));
    expect(events).not.toContain('orbit');
  });
});

describe('WinStates — crash into Terra', () => {
  it('emits crash below the planet surface', () => {
    expect(runUpdate(stubFlight([PLANET.radius - 200, 0, 0]))).toEqual(['crash']);
  });
});

describe('WinStates — safe return', () => {
  it('emits safe-return after leaving Luna SOI and touching down slowly', () => {
    const win = new WinStates();
    const events: WinEvent[] = [];
    win.onEvent = (e) => events.push(e);

    win.update(stubFlight(nearMoon(10))); // land on Luna
    win.update(stubFlight([PLANET.radius + 50, 0, 0], [0, 0, 10])); // home, slow
    expect(events).toEqual(['moon-landed', 'safe-return']);
  });

  it('does not emit safe-return for a fast re-entry', () => {
    const win = new WinStates();
    const events: WinEvent[] = [];
    win.onEvent = (e) => events.push(e);

    win.update(stubFlight(nearMoon(10)));
    win.update(stubFlight([PLANET.radius + 50, 0, 0], [0, 0, 200]));
    expect(events).not.toContain('safe-return');
  });
});
