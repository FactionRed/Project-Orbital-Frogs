// Tuned game-physics constants. NOT real SI — abstract "KSP units," calibrated
// so surface gravity is ~10 m/s^2 (Earth-like, intuitive) and orbital velocity
// at the surface is ~173 m/s (achievable with a good two-stage rocket).
//
// Scale: 10× larger than v0.1 — planets feel vast, horizons flatten, flights
// take longer. Surface g is unchanged (mass scales with radius²).

export const G = 1; // gravitational constant in game units

// Planet: surface g = G*M/R^2 = 1 * 9.0e7 / 3000^2 = 10 m/s^2
//         surface v_orb = sqrt(G*M/R) = sqrt(9.0e7 / 3000) ≈ 173 m/s
export const PLANET = {
  name: 'Terra',
  radius: 3000, // m (was 300)
  mass: 9.0e7, // t  (was 9.0e5; mu = G*M = 90,000,000; surface g = 10 m/s^2)
  color: 0x3366cc,
  kind: 'planet' as const,
  seed: 1337, // procedural terrain seed
  position: new Float64Array([0, 0, 0]),
  // SOI computed in orbit-math; for the planet (parent of nothing) it's infinite.
};

// Moon: surface g = G*M/R^2 = 1 * 1.28e6 / 800^2 = 2 m/s^2
//       surface v_orb = sqrt(G*M/R) = sqrt(1.28e6 / 800) ≈ 40 m/s
export const MOON = {
  name: 'Luna',
  radius: 800, // m (was 80)
  mass: 1.28e6, // t  (was 1.28e4; mu = 1,280,000; surface g = 2 m/s^2)
  color: 0xaaaaaa,
  kind: 'moon' as const,
  seed: 7, // procedural terrain seed
  orbitRadius: 40000, // m from planet center (was 4000)
  orbitPeriod: 1800, // s (full orbit); used for moon position over time
};

// Direction FROM any body TO the sun, in world space. The procedural shader uses
// this for the day/night terminator + atmosphere sunlit limb. Kept here as a
// single source of truth; flight-controller updates each body with it per frame.
export const SUN_DIRECTION = new Float64Array([1, 0.35, 0.6]);

// Moon's sphere of influence: a * (m_body / m_parent)^(2/5).
// Precomputed so all consumers (HUD, win-states, gravity) use the exact same
// boundary instead of hardcoding an approximation that drifts.
import { sphereOfInfluence } from './orbit-math';
export const MOON_SOI = sphereOfInfluence(MOON.orbitRadius, MOON.mass, PLANET.mass);
