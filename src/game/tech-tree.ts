// src/game/tech-tree.ts

/**
 * Tech tree — defines which parts are locked at the start and what science
 * cost unlocks them. The base 5 parts (pod, tank, engine, winglet, strut)
 * are always available. Science instruments and advanced parts must be unlocked.
 */

export interface TechNode {
  /** The part id this node unlocks. */
  partId: string;
  /** Display name. */
  name: string;
  /** Science point cost to unlock. */
  cost: number;
  /** Short description shown in the tech tree UI. */
  desc: string;
}

/**
 * Linear tech tree with branching choices. The player can unlock nodes in
 * any order as long as they have enough science points.
 */
export const TECH_TREE: TechNode[] = [
  { partId: 'thermometer', name: 'Thermometer', cost: 5, desc: 'Temperature sensor — works landed or in atmosphere' },
  { partId: 'barometer', name: 'Barometer', cost: 10, desc: 'Pressure sensor — atmosphere only' },
  { partId: 'gravity_scanner', name: 'Gravity Scanner', cost: 15, desc: 'Gravity measurement — landed on any body' },
];

/** Parts available from the start — no unlock needed. */
export const BASE_PART_IDS = new Set(['pod', 'tank', 'engine', 'winglet', 'strut']);

/** Check if a part is unlocked (either base or via tech tree). */
export function isPartUnlocked(
  partId: string,
  unlockedNodes: string[],
): boolean {
  if (BASE_PART_IDS.has(partId)) return true;
  return unlockedNodes.includes(partId);
}

/** Try to unlock a tech node. Returns updated unlock list + success flag. */
export function unlockNode(
  partId: string,
  points: number,
  unlockedNodes: string[],
): { unlocked: boolean; newPoints: number; newNodes: string[]; node: TechNode | null } {
  const node = TECH_TREE.find((n) => n.partId === partId);
  if (!node) return { unlocked: false, newPoints: points, newNodes: unlockedNodes, node: null };
  if (unlockedNodes.includes(partId)) return { unlocked: false, newPoints: points, newNodes: unlockedNodes, node };
  if (points < node.cost) return { unlocked: false, newPoints: points, newNodes: unlockedNodes, node };

  return {
    unlocked: true,
    newPoints: points - node.cost,
    newNodes: [...unlockedNodes, partId],
    node,
  };
}
