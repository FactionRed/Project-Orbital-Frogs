// src/entities/parts-catalog.ts
import type { PartDef } from './part';

// Tuned for surface g = 10 m/s^2 and orbital velocity ~173 m/s (10× scale).
// Target: a 2-stage rocket can reach orbit and transfer to the moon.
// v_orb ≈ 173 m/s means we need ~350-400 m/s of delta-v with gravity losses.
// With engine thrust 350 kN and TWR ~2, a 2-stage design has enough fuel.
export const PARTS_CATALOG: PartDef[] = [
  { id: 'pod', name: 'Command Pod', kind: 'pod', dryMass: 0.8, size: [1.2, 1.2, 1.2], color: 0x999999 },
  { id: 'tank', name: 'Fuel Tank', kind: 'tank', dryMass: 0.25, fuel: 1200, size: [1.5, 2.5, 1.5], color: 0xdddddd },
  // Engine 350 kN: TWR for a 2-stage ~18t rocket = 350 / (18 * 10) ≈ 1.9
  { id: 'engine', name: 'Engine', kind: 'engine', dryMass: 1.0, thrust: 350, size: [1.0, 1.0, 1.0], color: 0x666666 },
  { id: 'winglet', name: 'Winglet', kind: 'winglet', dryMass: 0.1, size: [2.0, 0.5, 0.5], color: 0xcc4444 },
  { id: 'strut', name: 'Strut', kind: 'strut', dryMass: 0.05, size: [0.5, 2.0, 0.5], color: 0x888888 },
];

export function getPartDef(id: string): PartDef {
  const def = PARTS_CATALOG.find((p) => p.id === id);
  if (!def) throw new Error(`Unknown part id: ${id}`);
  return def;
}
