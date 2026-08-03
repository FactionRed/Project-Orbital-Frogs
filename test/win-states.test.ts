// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WinStates } from '../src/ui/win-states';
import type { WinEvent } from '../src/ui/win-states';
import type { FlightController } from '../src/flight/flight-controller';
import { PLANET, MOON, MOON_SOI } from '../src/physics/constants';

// Structural stand-in for the slice of FlightController that WinStates reads.
interface StubOpts {
  /** Metres above Terra's surface. */
  altitude?: number;
  speed?: number;
  peakImpactSpeed?: number;
  peakImpactBody?: 'planet' | 'moon' | null;
  /** Park the ship inside Luna's sphere of influence instead. */
  nearMoon?: boolean;
}

function stubFlight(o: StubOpts = {}): FlightController {
  const alt = o.altitude ?? 0;
  const r = PLANET.radius + alt;
  const planet = { position: { x: 0, y: 0, z: 0 }, mu: 9.0e7, data: { radius: PLANET.radius, name: 'Terra' } };
  // Luna parked far along +X; the ship sits on the +Y axis, well outside its SOI.
  const moon = { position: { x: MOON.orbitRadius, y: 0, z: 0 }, mu: 1.28e6, data: { radius: MOON.radius, name: 'Luna' } };
  const shipPos = o.nearMoon
    ? { x: MOON.orbitRadius, y: MOON.radius + 10, z: 0 }
    : { x: 0, y: r, z: 0 };
  return {
    ship: { rootBody: { position: shipPos, velocity: { x: o.speed ?? 0, y: 0, z: 0 } } },
    planet,
    moon,
    peakImpactSpeed: o.peakImpactSpeed ?? -1,
    peakImpactBody: o.peakImpactBody ?? null,
  } as unknown as FlightController;
}

function banner() {
  const el = document.getElementById('win-banner')!;
  return {
    visible: el.style.display === 'block',
    tone: el.dataset.tone,
    headline: el.querySelector('.banner__headline')!.textContent ?? '',
    detail: el.querySelector('.banner__detail')!.textContent ?? '',
    buildAgainShown: (document.getElementById('banner-btn') as HTMLElement).style.display !== 'none',
  };
}

let win: WinStates;
let events: WinEvent[];

beforeEach(() => {
  document.body.replaceChildren();
  win = new WinStates();
  events = [];
  win.onEvent = (e) => events.push(e);
});

describe('Terra crash detection (review Critical #1)', () => {
  it('raises a terminal alarm banner after a hard impact on Terra', () => {
    win.update(stubFlight({ peakImpactSpeed: 120, peakImpactBody: 'planet' }));
    const b = banner();
    expect(b.visible).toBe(true);
    expect(b.tone).toBe('alarm');
    expect(b.headline).toContain('LITHOBRAKE');
    expect(b.detail).toContain('120 m/s');
    expect(b.buildAgainShown).toBe(true);
    expect(events).toEqual(['crash']);
  });

  it('stays on screen instead of auto-hiding — a wreck must not scroll away', () => {
    vi.useFakeTimers();
    try {
      win.update(stubFlight({ peakImpactSpeed: 120, peakImpactBody: 'planet' }));
      vi.advanceTimersByTime(10_000);
      expect(banner().visible).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says nothing about a soft landing', () => {
    win.update(stubFlight({ peakImpactSpeed: 5, peakImpactBody: 'planet' }));
    expect(banner().visible).toBe(false);
    expect(events).toEqual([]);
  });

  it('says nothing before the ship has touched anything', () => {
    win.update(stubFlight({ altitude: 500 }));
    expect(banner().visible).toBe(false);
    expect(events).toEqual([]);
  });

  it('fires exactly once even as updates keep arriving', () => {
    const f = stubFlight({ peakImpactSpeed: 400, peakImpactBody: 'planet' });
    win.update(f);
    win.update(f);
    win.update(f);
    expect(events).toEqual(['crash']);
  });

  it('does not blame Terra for an impact recorded against Luna', () => {
    win.update(stubFlight({ peakImpactSpeed: 400, peakImpactBody: 'moon' }));
    expect(banner().visible).toBe(false);
    expect(events).toEqual([]);
  });

  it('reset() clears the banner and re-arms detection for the next flight', () => {
    win.update(stubFlight({ peakImpactSpeed: 120, peakImpactBody: 'planet' }));
    win.reset();
    expect(banner().visible).toBe(false);
    expect(banner().buildAgainShown).toBe(false);

    win.update(stubFlight({ peakImpactSpeed: 90, peakImpactBody: 'planet' }));
    expect(banner().visible).toBe(true);
    expect(events).toEqual(['crash', 'crash']);
  });
});

describe('existing win events still fire', () => {
  it('flags a lunar crash from inside the moon SOI', () => {
    // Just above Luna's surface, falling straight in at 100 m/s: too fast to
    // count as a landing, which is the pre-existing moon-crash branch.
    const f = stubFlight({ nearMoon: true });
    (f.ship.rootBody.velocity as { x: number; y: number; z: number }).y = -100;
    win.update(f);
    expect(banner().tone).toBe('alarm');
    expect(events).toEqual(['crash']);
  });

  it('the moon stub really is inside the SOI the code checks', () => {
    const f = stubFlight({ nearMoon: true });
    const p = f.ship.rootBody.position;
    const d = Math.hypot(p.x - MOON.orbitRadius, p.y, p.z);
    expect(d).toBeLessThan(MOON_SOI);
  });
});
