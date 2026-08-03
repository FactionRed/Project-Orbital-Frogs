import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { launchReadiness, launchBlockerText, canLaunch } from '../src/entities/ship';
import type { ShipDesign } from '../src/entities/ship';

function design(partIds: string[]): ShipDesign {
  return {
    parts: partIds.map((partId, i) => ({
      uid: `p${i}`,
      partId,
      position: new THREE.Vector3(0, i * 3, 0),
      rotation: new THREE.Euler(),
    })),
    rootPartUid: 'p0',
  };
}

describe('launchReadiness', () => {
  it('empty design reports missing pod and engine', () => {
    const r = launchReadiness(design([]));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.missing).toContain('pod');
      expect(r.missing).toContain('engine');
    }
  });

  it('pod-only reports missing engine', () => {
    const r = launchReadiness(design(['pod']));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toEqual(['engine']);
  });

  it('engine-only reports missing pod', () => {
    const r = launchReadiness(design(['engine']));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toEqual(['pod']);
  });

  it('pod + engine (with tank) is ok', () => {
    expect(launchReadiness(design(['pod', 'tank', 'engine'])).ok).toBe(true);
  });

  it('parts that are neither pod nor engine do not satisfy the check', () => {
    const r = launchReadiness(design(['tank', 'winglet', 'strut']));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toEqual(['pod', 'engine']);
  });

  it('agrees with legacy canLaunch()', () => {
    for (const ids of [[], ['pod'], ['engine'], ['pod', 'engine'], ['tank']]) {
      expect(launchReadiness(design(ids)).ok).toBe(canLaunch(design(ids)));
    }
  });
});

describe('launchBlockerText', () => {
  it('is empty when the design is ready', () => {
    expect(launchBlockerText(design(['pod', 'engine']))).toBe('');
  });

  it('names each missing part so the disabled button explains itself', () => {
    expect(launchBlockerText(design([]))).toBe('NEEDS COMMAND POD + ENGINE');
    expect(launchBlockerText(design(['pod']))).toBe('NEEDS ENGINE');
    expect(launchBlockerText(design(['engine']))).toBe('NEEDS COMMAND POD');
  });
});
