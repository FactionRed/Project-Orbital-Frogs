// src/physics/gravity.ts
import * as CANNON from 'cannon-es';
import type { CelestialBody } from './celestial-body';
import type { Vec3 } from './orbit-math';

/**
 * Central-force gravity on a point mass, returned as a force vector (kN in game units).
 * bodyPos: center of attracting body. mu = G*M. shipPos: point mass position. shipMass: t.
 */
export function gravityForce(bodyPos: Vec3, mu: number, shipPos: Vec3, shipMass: number): Vec3 {
  const dx = bodyPos[0] - shipPos[0];
  const dy = bodyPos[1] - shipPos[1];
  const dz = bodyPos[2] - shipPos[2];
  const r2 = dx * dx + dy * dy + dz * dz;
  const r = Math.sqrt(r2);
  if (r < 1e-6) return [0, 0, 0];
  const f = (mu * shipMass) / r2;
  return [(f * dx) / r, (f * dy) / r, (f * dz) / r];
}

/**
 * Pick dominant body by SOI. `candidates` carries each body plus the SOI radius
 * to use (caller computes it via sphereOfInfluence). The planet's SOI is Infinity.
 */
export function dominantBody(
  shipPos: Vec3,
  candidates: { body: CelestialBody; soi: number }[],
): CelestialBody {
  let best = candidates[0].body;
  let bestDist = Infinity;
  for (const { body, soi } of candidates) {
    const dx = body.position.x - shipPos[0];
    const dy = body.position.y - shipPos[1];
    const dz = body.position.z - shipPos[2];
    const dist = Math.hypot(dx, dy, dz);
    if (dist < soi && dist < bestDist) {
      bestDist = dist;
      best = body;
    }
  }
  return best;
}

/**
 * System that applies gravity to all dynamic bodies in a cannon world.
 * Call once per physics step.
 */
export class GravitySystem {
  constructor(
    private world: CANNON.World,
    private candidates: () => { body: CelestialBody; soi: number }[],
  ) {}

  applyGravity(): void {
    for (const body of this.world.bodies) {
      if (body.mass === 0) continue; // skip static bodies (planets)
      const shipPos: Vec3 = [body.position.x, body.position.y, body.position.z];
      const dom = dominantBody(shipPos, this.candidates());
      const f = gravityForce(
        [dom.position.x, dom.position.y, dom.position.z],
        dom.mu,
        shipPos,
        body.mass,
      );
      body.force.x += f[0];
      body.force.y += f[1];
      body.force.z += f[2];
    }
  }
}
