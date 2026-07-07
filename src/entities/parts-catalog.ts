// src/entities/parts-catalog.ts
import type { PartDef } from './part';

// Tuned for surface g = 10 m/s^2 and orbital velocity ~173 m/s (10× scale).
// Target: a 2-stage rocket can reach orbit and transfer to the moon.
// v_orb ≈ 173 m/s means we need ~350-400 m/s of delta-v with gravity losses.
//
// Fuel has mass (fuel × FUEL_DENSITY). A 2-stage rocket with 1 tank + 1 engine
// per stage has TWR ~2 at liftoff and enough delta-v to reach orbit and the moon.
//
// Mass breakdown (2-stage: pod + tank + engine + strut + tank + engine):
//   Pod 0.8t + Tank 0.25t + 1200 fuel × 0.02 = 24t + Engine 1t + Strut 0.05t
//   Total wet mass ≈ 26.1t, dry mass ≈ 2.1t
//   Stage 1 TWR = 700 / (26.1 × 10) ≈ 2.7
//   Delta-v (Tsiolkovsky) = 350 × ln(26.1/14.1) ≈ 350 × 0.615 ≈ 215 m/s per stage
//   Total 2-stage delta-v ≈ 430 m/s (enough for 173 m/s orbit + transfer)
export const FUEL_DENSITY = 0.02; // tonnes per fuel unit
export const PARTS_CATALOG: PartDef[] = [
  { id: 'pod', name: 'Command Pod', kind: 'pod', dryMass: 0.8, size: [1.2, 1.2, 1.2], color: 0x999999 },
  { id: 'tank', name: 'Fuel Tank', kind: 'tank', dryMass: 0.25, fuel: 1200, size: [1.5, 2.5, 1.5], color: 0xdddddd },
  // Engine 700 kN: TWR for a 2-stage ~26t rocket = 700 / (26 * 10) ≈ 2.7
  { id: 'engine', name: 'Engine', kind: 'engine', dryMass: 1.0, thrust: 700, size: [1.0, 1.0, 1.0], color: 0x666666 },
  { id: 'winglet', name: 'Winglet', kind: 'winglet', dryMass: 0.1, size: [2.0, 0.5, 0.5], color: 0xcc4444 },
  { id: 'strut', name: 'Strut', kind: 'strut', dryMass: 0.05, size: [0.5, 2.0, 0.5], color: 0x888888 },
];

export function getPartDef(id: string): PartDef {
  const def = PARTS_CATALOG.find((p) => p.id === id);
  if (!def) throw new Error(`Unknown part id: ${id}`);
  return def;
}
