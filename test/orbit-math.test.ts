import { describe, it, expect } from 'vitest';
import { orbitalEnergy, apoapsisPeriapsis, sphereOfInfluence } from '../src/physics/orbit-math';
import { G, PLANET, MOON } from '../src/physics/constants';

type V3 = [number, number, number];

const MU = G * PLANET.mass; // gravitational parameter for Terra

describe('orbitalEnergy', () => {
  it('is negative for a bound circular-ish orbit', () => {
    const r: V3 = [PLANET.radius + 100, 0, 0];
    const v: V3 = [0, 0, 50]; // sub-orbital-ish speed
    const e = orbitalEnergy(r, v, MU);
    expect(e).toBeLessThan(0);
  });
});

describe('apoapsisPeriapsis', () => {
  it('returns Ap > Pe and both > 0 for an elliptical orbit', () => {
    const r: V3 = [PLANET.radius + 100, 0, 0];
    const v: V3 = [0, 0, 60];
    const { apoapsis, periapsis } = apoapsisPeriapsis(r, v, MU);
    expect(apoapsis).toBeGreaterThan(periapsis);
    expect(periapsis).toBeGreaterThan(0);
  });

  it('returns equal Ap and Pe for a circular orbit', () => {
    const r: V3 = [PLANET.radius + 100, 0, 0];
    // circular speed v = sqrt(mu / r)
    const vc = Math.sqrt(MU / (PLANET.radius + 100));
    const v: V3 = [0, 0, vc];
    const { apoapsis, periapsis } = apoapsisPeriapsis(r, v, MU);
    expect(apoapsis).toBeCloseTo(PLANET.radius + 100, 1);
    expect(periapsis).toBeCloseTo(PLANET.radius + 100, 1);
  });
});

describe('sphereOfInfluence', () => {
  it('Luna SOI is a sensible fraction of its orbit radius', () => {
    const soi = sphereOfInfluence(MOON.orbitRadius, MOON.mass, PLANET.mass);
    // formula: a * (m/m_parent)^(2/5)
    const expected = MOON.orbitRadius * Math.pow(MOON.mass / PLANET.mass, 0.4);
    expect(soi).toBeCloseTo(expected, 1);
    expect(soi).toBeGreaterThan(100);
    expect(soi).toBeLessThan(MOON.orbitRadius);
  });
});
