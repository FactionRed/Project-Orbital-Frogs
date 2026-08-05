// src/entities/parts-catalog.ts
import type { PartDef } from './part';

// Tuned for surface g = 10 m/s^2 and orbital velocity ~173 m/s.
//
// WHAT THE NUMBERS ARE FOR
//
// A stage's burn time is close to its own delta-v divided by its acceleration,
// so on a planet this small the propulsion tuning decides whether the player
// has time to fly at all. The previous numbers gave every engine an exhaust
// velocity of 100 m/s, which needs a 12.7:1 mass ratio to produce any useful
// delta-v — and that rocket ends its burn pulling 34 g with the tank empty
// after 3.4 seconds. A gravity turn here takes 25-40 seconds. There was no
// time to steer, so every launch was a cannon shot into the thickest air.
//
// Exhaust velocities are now 320 m/s (booster) and 450 m/s (vacuum), mass
// ratios are around 1.5-1.8, and a two-stage rocket flies for ~17 seconds and
// peaks near 4 g. Reaching orbit is still not free — it needs roughly 350 m/s
// once gravity and drag losses are paid — but it is now a flying problem
// rather than a reflex test.
//
// THE DESIGN PUZZLE
//
// The two engines are deliberately bad at each other's job, so where they go
// matters more than how many you bolt on:
//
//   correct 2-stage (booster below, vacuum above)  411 m/s, TWR 1.30  -> orbit
//   one stage, booster only                        157 m/s, TWR 3.87  -> far short
//   one stage, vacuum only                         252 m/s, TWR 0.98  -> never lifts
//   vacuum engine on the first stage                          TWR 0.31  -> never lifts
//   booster on both stages                         309 m/s, TWR 1.26  -> short
//
// Fuel has mass (fuel × FUEL_DENSITY), so a tank is mostly propellant.
export const FUEL_DENSITY = 0.02; // tonnes per fuel unit

/** Fuel per kN of vacuum thrust per second when an engine doesn't specify one. */
export const DEFAULT_BURN_RATE = 0.15625; // exhaust velocity 320 m/s

export const PARTS_CATALOG: PartDef[] = [
  {
    id: 'pod', name: 'Command Pod', kind: 'pod', dryMass: 0.8,
    desc: 'Crew capsule — required to fly', size: [1.2, 1.2, 1.2], color: 0x999999,
    attachNodes: [
      { pos: [0, -1.2, 0], dir: [0, -1, 0] }, // bottom — sits on tank
    ],
  },
  {
    id: 'tank', name: 'Fuel Tank', kind: 'tank', dryMass: 1.2, fuel: 120,
    desc: 'Holds fuel — 2.4 t full, 1.2 t empty', size: [1.5, 2.5, 1.5], color: 0xdddddd,
    attachNodes: [
      { pos: [0, 2.5, 0], dir: [0, 1, 0] },  // top
      { pos: [0, -2.5, 0], dir: [0, -1, 0] }, // bottom
    ],
  },
  {
    // Sea-level booster: a low expansion ratio keeps it working in thick air,
    // at the cost of efficiency. Almost all the thrust in the catalog.
    id: 'engine', name: 'Booster Engine', kind: 'engine', dryMass: 1.8,
    thrust: 265, thrustSea: 240, burnRate: 0.15625, // ve 320 vac / 290 sea
    desc: 'High thrust, sea-level nozzle — lifts the first stage',
    size: [1.0, 1.0, 1.0], color: 0x666666,
    attachNodes: [
      { pos: [0, 1.0, 0], dir: [0, 1, 0] }, // top — attaches to the tank above
    ],
  },
  {
    // Vacuum engine: a big bell wrings far more out of each unit of fuel, but
    // air pressure crushes it at sea level. Cannot lift a rocket off the pad.
    id: 'engine-vac', name: 'Vacuum Engine', kind: 'engine', dryMass: 1.2,
    thrust: 130, thrustSea: 55, burnRate: 0.11111, // ve 450 vac / 190 sea
    desc: 'Efficient in vacuum, feeble in air — for upper stages only',
    size: [1.1, 1.3, 1.1], color: 0x5a5a66,
    attachNodes: [
      { pos: [0, 1.3, 0], dir: [0, 1, 0] },
    ],
  },
  {
    // The part that makes staging possible: everything below it separates.
    id: 'decoupler', name: 'Stack Decoupler', kind: 'decoupler', dryMass: 0.2,
    desc: 'Splits stages — everything below it separates when staged',
    size: [1.3, 0.35, 1.3], color: 0xb08040,
    attachNodes: [
      { pos: [0, 0.35, 0], dir: [0, 1, 0] },
      { pos: [0, -0.35, 0], dir: [0, -1, 0] },
    ],
  },
  {
    id: 'winglet', name: 'Winglet', kind: 'winglet', dryMass: 0.1,
    desc: 'Aerodynamic fin — currently decorative', size: [2.0, 0.5, 0.5], color: 0xcc4444,
    // No stack nodes — surface-attach only (sticks to the side of a tank).
  },
  {
    id: 'strut', name: 'Strut', kind: 'strut', dryMass: 0.05,
    desc: 'Structural connector — does NOT split stages', size: [0.5, 2.0, 0.5], color: 0x888888,
    attachNodes: [
      { pos: [0, 2.0, 0], dir: [0, 1, 0] },
      { pos: [0, -2.0, 0], dir: [0, -1, 0] },
    ],
  },
];

export function getPartDef(id: string): PartDef {
  const def = PARTS_CATALOG.find((p) => p.id === id);
  if (!def) throw new Error(`Unknown part id: ${id}`);
  return def;
}

/** Exhaust velocity in vacuum, m/s — the number that sets a stage's delta-v. */
export function exhaustVelocity(def: PartDef): number {
  return 1 / ((def.burnRate ?? DEFAULT_BURN_RATE) * FUEL_DENSITY);
}
