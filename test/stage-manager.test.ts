import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildStages } from '../src/flight/stage-manager';
import type { ShipDesign } from '../src/entities/ship';

describe('buildStages', () => {
  it('returns one stage for a simple pod+tank+engine stack', () => {
    const design: ShipDesign = {
      rootPartUid: 'pod',
      parts: [
        { uid: 'pod', partId: 'pod', position: new THREE.Vector3(0, 6, 0), rotation: new THREE.Euler(), attachParentUid: undefined },
        { uid: 'tank', partId: 'tank', position: new THREE.Vector3(0, 3, 0), rotation: new THREE.Euler(), attachParentUid: 'pod' },
        { uid: 'eng', partId: 'engine', position: new THREE.Vector3(0, 0, 0), rotation: new THREE.Euler(), attachParentUid: 'tank' },
      ],
    };
    const stages = buildStages(design);
    expect(stages.length).toBe(1);
    expect(stages[0].engineUids).toContain('eng');
    expect(stages[0].tankUids).toContain('tank');
  });

  it('returns multiple stages when there are two engine+tank stacks', () => {
    const design: ShipDesign = {
      rootPartUid: 'pod',
      parts: [
        { uid: 'pod', partId: 'pod', position: new THREE.Vector3(0, 9, 0), rotation: new THREE.Euler() },
        { uid: 't1', partId: 'tank', position: new THREE.Vector3(0, 6, 0), rotation: new THREE.Euler(), attachParentUid: 'pod' },
        { uid: 'e1', partId: 'engine', position: new THREE.Vector3(0, 3, 0), rotation: new THREE.Euler(), attachParentUid: 't1' },
        { uid: 'dec1', partId: 'strut', position: new THREE.Vector3(0, 1.5, 0), rotation: new THREE.Euler(), attachParentUid: 'e1' },
        { uid: 't2', partId: 'tank', position: new THREE.Vector3(0, -1.5, 0), rotation: new THREE.Euler(), attachParentUid: 'dec1' },
        { uid: 'e2', partId: 'engine', position: new THREE.Vector3(0, -4.5, 0), rotation: new THREE.Euler(), attachParentUid: 't2' },
      ],
    };
    const stages = buildStages(design);
    expect(stages.length).toBe(2);
  });
});
