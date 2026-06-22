import { describe, it, expect } from 'vitest';
import { gravityForce } from '../src/physics/gravity';
import { G, PLANET } from '../src/physics/constants';

const MU = G * PLANET.mass; // 1 * 900,000 = 900,000

describe('gravityForce', () => {
  it('points toward the body and scales as 1/r^2', () => {
    // body at origin, ship at (1000,0,0), mass 1t
    const bodyPos: [number, number, number] = [0, 0, 0];
    const shipPos: [number, number, number] = [1000, 0, 0];
    const f = gravityForce(bodyPos, MU, shipPos, 1);
    // F = mu * m / r^2 = 900,000 * 1 / 1,000,000 = 0.9
    expect(f[0]).toBeCloseTo(-0.9, 6); // pointing -x (toward origin)
    expect(f[1]).toBeCloseTo(0, 6);
    expect(f[2]).toBeCloseTo(0, 6);
  });

  it('doubles when mass doubles', () => {
    const bodyPos: [number, number, number] = [0, 0, 0];
    const shipPos: [number, number, number] = [1000, 0, 0];
    const f1 = gravityForce(bodyPos, MU, shipPos, 1);
    const f2 = gravityForce(bodyPos, MU, shipPos, 2);
    expect(f2[0]).toBeCloseTo(2 * f1[0], 6);
  });

  it('produces surface gravity of ~10 m/s^2 at planet surface (F = m*g for m=1)', () => {
    // At the planet's surface, gravity on 1 tonne should be ~10 (g = 10 m/s^2).
    const bodyPos: [number, number, number] = [0, 0, 0];
    const shipPos: [number, number, number] = [PLANET.radius, 0, 0];
    const f = gravityForce(bodyPos, MU, shipPos, 1);
    // F = mu * m / r^2 = 900,000 / 90,000 = 10
    expect(f[0]).toBeCloseTo(-10, 1);
  });
});
