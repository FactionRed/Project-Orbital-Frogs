// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { Hud } from '../src/flight/hud';
import type { FlightController } from '../src/flight/flight-controller';
import { ATMOSPHERE } from '../src/physics/constants';

// A structural stand-in for the slice of FlightController that Hud reads.
// Building a real one would need three + cannon and a whole scene graph.
const RADIUS = 1000;
const MU = 1e6;

interface StubOpts {
  altitude?: number;
  speed?: number;
  fuel?: number;
  throttle?: number;
  sas?: boolean;
  onMoon?: boolean;
}

function stubFlight(o: StubOpts = {}): FlightController {
  const alt = o.altitude ?? 1000;
  const r = RADIUS + alt;
  // Speed defaults to the circular value at r, so the orbit is closed.
  const speed = o.speed ?? Math.sqrt(MU / r);
  const planet = {
    position: { x: 0, y: 0, z: 0 },
    mu: MU,
    data: { radius: RADIUS, name: 'Terra' },
  };
  const moon = {
    position: { x: 1e9, y: 0, z: 0 }, // far outside MOON_SOI unless onMoon
    mu: MU / 10,
    data: { radius: RADIUS / 4, name: 'Luna' },
  };
  const shipPos = { x: r, y: 0, z: 0 };
  return {
    ship: { rootBody: { position: shipPos, velocity: { x: 0, y: speed, z: 0 } }, fuel: o.fuel ?? 1200 },
    planet,
    moon: o.onMoon ? { ...moon, position: shipPos } : moon,
    throttle: o.throttle ?? 0,
    sasEnabled: o.sas ?? false,
    dominantBodyFor: () => planet,
  } as unknown as FlightController;
}

function text(label: string): string {
  const rows = [...document.querySelectorAll('#hud .readout')];
  const row = rows.find(r => r.querySelector('.readout__label')!.textContent === label)!;
  return row.querySelector('.readout__value')!.textContent ?? '';
}
function unit(label: string): string {
  const rows = [...document.querySelectorAll('#hud .readout')];
  const row = rows.find(r => r.querySelector('.readout__label')!.textContent === label)!;
  return row.querySelector('.readout__unit')!.textContent ?? '';
}
function state(label: string): string {
  const rows = [...document.querySelectorAll('#hud .readout')];
  const row = rows.find(r => r.querySelector('.readout__label')!.textContent === label)! as HTMLElement;
  return row.dataset.state ?? '';
}
function gauge(index: number) {
  const g = document.querySelectorAll('#hud .gauge')[index];
  return {
    width: Number(g.querySelector('rect[data-fill]')!.getAttribute('width')),
    label: g.querySelector('.gauge__value')!.textContent,
    threshold: (g as HTMLElement).dataset.threshold,
  };
}

let hud: Hud;

beforeEach(() => {
  document.body.replaceChildren();
  hud = new Hud();
});

describe('Hud readouts', () => {
  it('labels every numeric readout with a unit', () => {
    hud.update(stubFlight());
    expect(unit('ALT')).toBe('m');
    expect(unit('VEL')).toBe('m/s');
    expect(unit('Ap')).toBe('m');
    expect(unit('Pe')).toBe('m');
    expect(unit('Q')).toBe('kPa');
  });

  it('shows altitude above the dominant body surface', () => {
    hud.update(stubFlight({ altitude: 1349 }));
    expect(text('ALT')).toBe('1349');
  });

  it('shows apsides for a closed orbit', () => {
    hud.update(stubFlight({ altitude: 1000 }));
    // Circular orbit: both apsides sit at the current altitude.
    expect(text('Ap')).toBe('1000');
    expect(text('Pe')).toBe('1000');
    expect(state('Ap')).toBe('nominal');
  });

  it('flags an escape trajectory instead of printing junk apsides', () => {
    const r = RADIUS + 1000;
    hud.update(stubFlight({ altitude: 1000, speed: 3 * Math.sqrt(MU / r) }));
    expect(text('Ap')).toBe('ESC');
    expect(text('Pe')).toBe('ESC');
    expect(state('Ap')).toBe('caution');
  });

  it('reports SAS state', () => {
    hud.update(stubFlight({ sas: true }));
    expect(text('SAS')).toBe('ON');
    expect(state('SAS')).toBe('nominal');
    hud.update(stubFlight({ sas: false }));
    expect(text('SAS')).toBe('OFF');
    expect(state('SAS')).toBe('caution');
  });

  it('raises a Q alarm above the threshold and stays quiet below it', () => {
    // Deep in the atmosphere and fast → high dynamic pressure.
    const fast = stubFlight({ altitude: 10, speed: 400 });
    hud.update(fast);
    expect(Number(text('Q'))).toBeGreaterThan(200);
    expect(state('Q')).toBe('alarm');

    // Above the atmosphere Q is zero regardless of speed.
    hud.update(stubFlight({ altitude: ATMOSPHERE.height + 1, speed: 4000 }));
    expect(text('Q')).toBe('0');
    expect(state('Q')).toBe('nominal');
  });
});

describe('Hud fuel gauge', () => {
  it('captures tank capacity from the first update and shows the fraction', () => {
    hud.update(stubFlight({ fuel: 1200 }));
    expect(gauge(1)).toMatchObject({ width: 100, label: '1200 / 1200', threshold: 'nominal' });

    hud.update(stubFlight({ fuel: 600 }));
    expect(gauge(1)).toMatchObject({ width: 50, label: '600 / 1200' });
  });

  it('cautions under 20% and alarms at empty', () => {
    hud.update(stubFlight({ fuel: 1000 }));
    hud.update(stubFlight({ fuel: 150 }));
    expect(gauge(1).threshold).toBe('caution');
    hud.update(stubFlight({ fuel: 0 }));
    expect(gauge(1).threshold).toBe('alarm');
  });

  it('resetMaxFuel re-captures capacity for the next vessel', () => {
    hud.update(stubFlight({ fuel: 1200 }));
    hud.update(stubFlight({ fuel: 600 }));
    expect(gauge(1).width).toBe(50);

    // Without the reset the new, smaller vessel would read as half-empty.
    hud.resetMaxFuel();
    hud.update(stubFlight({ fuel: 600 }));
    expect(gauge(1)).toMatchObject({ width: 100, label: '600 / 600' });
  });

  it('does not divide by zero when a vessel launches dry', () => {
    hud.update(stubFlight({ fuel: 0 }));
    expect(gauge(1)).toMatchObject({ width: 0, label: '0 / 0', threshold: 'alarm' });
  });
});

describe('Hud throttle gauge', () => {
  it('shows throttle as a percentage', () => {
    hud.update(stubFlight({ throttle: 0.42 }));
    expect(gauge(0)).toMatchObject({ width: 42, label: '42%' });
  });
});
