// src/entities/parts-catalog.ts
import type { PartDef } from './part';

// Tuned for surface g = 10 m/s^2 and orbital velocity ~173 m/s (10× scale).
// Target: a 2-stage rocket can reach orbit and transfer to the moon.
// With FUEL_BURN_RATE = 0.5, exhaust velocity is 100 m/s, giving a single
// stage (pod+tank+engine) ~252 m/s delta-v — ~1.46× orbital velocity (173 m/s).
// Escape velocity is 245 m/s, so a single stage cannot escape — it can orbit
// with a gravity turn but falls back if launched straight up. Atmospheric drag
// in the lower 1km costs ~30-60 m/s; a gravity turn minimizes this loss.
// A 2-stage rocket has comfortable margin for orbit + moon transfer.
//
// Fuel has mass (fuel × FUEL_DENSITY). Mass breakdown (2-stage):
//   Pod 0.8t + Tank 0.25t + 1200 fuel × 0.02 = 24t + Engine 1t + Strut 0.05t
//   Total wet mass ≈ 26.1t, dry mass ≈ 2.1t
//   Stage 1 TWR = 700 / (26.1 × 10) ≈ 2.7
export const FUEL_DENSITY = 0.02; // tonnes per fuel unit
export const PARTS_CATALOG: PartDef[] = [
  { id: 'pod', name: 'Command Pod', kind: 'pod', dryMass: 0.8, desc: 'Crew capsule — required to fly', size: [1.2, 1.2, 1.2], color: 0x999999 },
  { id: 'tank', name: 'Fuel Tank', kind: 'tank', dryMass: 0.25, fuel: 1200, desc: 'Holds fuel for the engine', size: [1.5, 2.5, 1.5], color: 0xdddddd },
  // Engine 700 kN: TWR for a 2-stage ~26t rocket = 700 / (26 * 10) ≈ 2.7
  { id: 'engine', name: 'Engine', kind: 'engine', dryMass: 1.0, thrust: 700, desc: 'Burns fuel to provide thrust', size: [1.0, 1.0, 1.0], color: 0x666666 },
  { id: 'winglet', name: 'Winglet', kind: 'winglet', dryMass: 0.1, desc: 'Aerodynamic fin for stability', size: [2.0, 0.5, 0.5], color: 0xcc4444 },
  { id: 'strut', name: 'Strut', kind: 'strut', dryMass: 0.05, desc: 'Structural connector / decoupler', size: [0.5, 2.0, 0.5], color: 0x888888 },
];

export function getPartDef(id: string): PartDef {
  const def = PARTS_CATALOG.find((p) => p.id === id);
  if (!def) throw new Error(`Unknown part id: ${id}`);
  return def;
}
