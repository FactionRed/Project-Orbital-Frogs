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

// Atmosphere: exponential density model for aerodynamic drag during ascent.
// The planet has a thin atmosphere that creates a mild speed-vs-altitude ceiling
// — going too fast too low wastes a little delta-v to drag, which makes gravity
// turns worthwhile. The drag is deliberately LIGHT: it costs ~30-60 m/s of delta-v
// during a straight-up ascent, not enough to prevent flight, just enough that a
// gravity turn (ascend through the thick air, then pitch east) is more efficient.
//
// Density profile: ρ(h) = surfaceDensity × exp(-h / scaleHeight), clamped to 0
// above `height`. The atmosphere is thin (1km) relative to the 3000m planet.
export const ATMOSPHERE = {
  height: 1000, // m above planet surface — top of atmosphere (drag = 0 above this)
  scaleHeight: 200, // m — exponential decay rate of air density
  surfaceDensity: 0.01, // game force units — light drag that penalizes low/fast
  dragFactor: 0.02, // combined Cd × A — low so terminal velocity > orbital velocity
};

// Moon's sphere of influence: a * (m_body / m_parent)^(2/5).
// Precomputed so all consumers (HUD, win-states, gravity) use the exact same
// boundary instead of hardcoding an approximation that drifts.
import { sphereOfInfluence } from './orbit-math';
export const MOON_SOI = sphereOfInfluence(MOON.orbitRadius, MOON.mass, PLANET.mass);
