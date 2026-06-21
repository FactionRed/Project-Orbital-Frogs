import { describe, it, expect } from 'vitest';
import { gravityForce } from '../src/physics/gravity';

describe('gravityForce', () => {
  it('points toward the body and scales as 1/r^2', () => {
    const mu = 9.82 * 5e7;
    // body at origin, ship at (1000,0,0), mass 1t
    const bodyPos: [number, number, number] = [0, 0, 0];
    const shipPos: [number, number, number] = [1000, 0, 0];
    const f = gravityForce(bodyPos, mu, shipPos, 1);
    // F = mu * m / r^2 = 9.82*5e7 * 1 / 1e6 = 491
    expect(f[0]).toBeCloseTo(-491, 0); // pointing -x (toward origin)
    expect(f[1]).toBeCloseTo(0, 6);
    expect(f[2]).toBeCloseTo(0, 6);
  });

  it('doubles when mass doubles', () => {
    const mu = 9.82 * 5e7;
    const bodyPos: [number, number, number] = [0, 0, 0];
    const shipPos: [number, number, number] = [1000, 0, 0];
    const f1 = gravityForce(bodyPos, mu, shipPos, 1);
    const f2 = gravityForce(bodyPos, mu, shipPos, 2);
    expect(f2[0]).toBeCloseTo(2 * f1[0], 6);
  });
});
