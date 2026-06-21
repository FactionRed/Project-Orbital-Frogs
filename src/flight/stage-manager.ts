// src/flight/stage-manager.ts
import type { ShipDesign } from '../entities/ship';
import { getPartDef } from '../entities/parts-catalog';

export interface Stage {
  engineUids: string[];
  tankUids: string[];
  /** Uid of the decoupler strut that, when staged, detaches this stage. */
  decouplerUid?: string;
}

/**
 * Build the stage list bottom-up. We treat each `strut` part as a potential
 * decoupler that splits stages. The lowest engine+tank group (below the lowest
 * decoupler) is stage 0 (fired first); each subsequent group above is a later stage.
 *
 * Simplified model: walk the attach tree from each engine upward, collecting tanks,
 * stopping at a strut. Group engines that share the same decoupler ancestor.
 */
export function buildStages(design: ShipDesign): Stage[] {
  const byUid = new Map(design.parts.map((p) => [p.uid, p]));
  const parentOf = (uid: string): string | undefined => byUid.get(uid)?.attachParentUid;

  const engines = design.parts.filter((p) => getPartDef(p.partId).kind === 'engine');

  // For each engine, walk up collecting tanks until a strut or root.
  const groups = engines.map((eng) => {
    const tanks: string[] = [];
    let decoupler: string | undefined;
    let cur: string | undefined = eng.uid;
    while (cur) {
      const part = byUid.get(cur);
      if (!part) break;
      if (getPartDef(part.partId).kind === 'tank') tanks.push(cur);
      if (getPartDef(part.partId).kind === 'strut') {
        decoupler = cur;
        break;
      }
      cur = parentOf(cur);
    }
    return { engine: eng.uid, tanks, decoupler };
  });

  // Merge engines sharing the same decoupler into one stage.
  const byDecoupler = new Map<string | 'none', Stage>();
  for (const g of groups) {
    const key = g.decoupler ?? 'none';
    const existing = byDecoupler.get(key);
    if (existing) {
      existing.engineUids.push(g.engine);
      existing.tankUids.push(...g.tanks);
    } else {
      byDecoupler.set(key, {
        engineUids: [g.engine],
        tankUids: g.tanks,
        decouplerUid: g.decoupler,
      });
    }
  }

  // Order: stage with a decoupler that is lowest in the tree fires first.
  // Heuristic: sort by decoupler depth (deepest first); 'none' goes last.
  const depthOf = (uid: string | undefined): number => {
    let d = 0;
    let cur = uid;
    while (cur) {
      d++;
      cur = parentOf(cur);
    }
    return d;
  };
  return [...byDecoupler.values()].sort(
    (a, b) => depthOf(b.decouplerUid) - depthOf(a.decouplerUid),
  );
}
