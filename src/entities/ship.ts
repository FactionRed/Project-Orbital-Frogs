// src/entities/ship.ts
import type { PlacedPart } from './part';
import { getPartDef } from './parts-catalog';

export interface ShipDesign {
  parts: PlacedPart[];
  rootPartUid: string;
}

export function aggregateMass(d: ShipDesign): number {
  return d.parts.reduce((sum, p) => sum + getPartDef(p.partId).dryMass, 0);
}

export function aggregateFuel(d: ShipDesign): number {
  return d.parts.reduce((sum, p) => sum + (getPartDef(p.partId).fuel ?? 0), 0);
}

export function hasPod(d: ShipDesign): boolean {
  return d.parts.some((p) => getPartDef(p.partId).kind === 'pod');
}

export function hasEngine(d: ShipDesign): boolean {
  return d.parts.some((p) => getPartDef(p.partId).kind === 'engine');
}

/** What a design still needs before it can fly. */
export type LaunchRequirement = 'pod' | 'engine';

export type LaunchReadiness =
  | { ok: true }
  | { ok: false; missing: LaunchRequirement[] };

const REQUIREMENT_LABEL: Record<LaunchRequirement, string> = {
  pod: 'COMMAND POD',
  engine: 'ENGINE',
};

export function launchReadiness(d: ShipDesign): LaunchReadiness {
  const missing: LaunchRequirement[] = [];
  if (!hasPod(d)) missing.push('pod');
  if (!hasEngine(d)) missing.push('engine');
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

/**
 * Why Launch is disabled, in words. Empty when the design is ready.
 * A disabled control that doesn't say what it wants is a dead end for the
 * player — this is the text behind that explanation.
 */
export function launchBlockerText(d: ShipDesign): string {
  const r = launchReadiness(d);
  if (r.ok) return '';
  return `NEEDS ${r.missing.map((m) => REQUIREMENT_LABEL[m]).join(' + ')}`;
}

export function canLaunch(d: ShipDesign): boolean {
  return launchReadiness(d).ok;
}
