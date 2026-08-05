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

  /** Two engine+tank groups with `joint` between them. */
  function twoStack(joint: string): ShipDesign {
    return {
      rootPartUid: 'pod',
      parts: [
        { uid: 'pod', partId: 'pod', position: new THREE.Vector3(0, 9, 0), rotation: new THREE.Euler() },
        { uid: 't1', partId: 'tank', position: new THREE.Vector3(0, 6, 0), rotation: new THREE.Euler(), attachParentUid: 'pod' },
        { uid: 'e1', partId: 'engine-vac', position: new THREE.Vector3(0, 3, 0), rotation: new THREE.Euler(), attachParentUid: 't1' },
        { uid: 'j', partId: joint, position: new THREE.Vector3(0, 1.5, 0), rotation: new THREE.Euler(), attachParentUid: 'e1' },
        { uid: 't2', partId: 'tank', position: new THREE.Vector3(0, -1.5, 0), rotation: new THREE.Euler(), attachParentUid: 'j' },
        { uid: 'e2', partId: 'engine', position: new THREE.Vector3(0, -4.5, 0), rotation: new THREE.Euler(), attachParentUid: 't2' },
      ],
    };
  }

  it('splits into two stages at a decoupler', () => {
    const stages = buildStages(twoStack('decoupler'));
    expect(stages.length).toBe(2);
    // Deepest decoupler fires first, so the bottom engine leads.
    expect(stages[0].engineUids).toContain('e2');
    expect(stages[0].decouplerUid).toBe('j');
    expect(stages[1].engineUids).toContain('e1');
  });

  it('does not split at a strut — struts are structural only', () => {
    // A strut used to double as the decoupler, which meant you could not brace
    // a rocket without also cutting it in half.
    const stages = buildStages(twoStack('strut'));
    expect(stages.length).toBe(1);
    expect(stages[0].decouplerUid).toBeUndefined();
  });

  it('groups engines that share a decoupler into one stage', () => {
    const design: ShipDesign = {
      rootPartUid: 'pod',
      parts: [
        { uid: 'pod', partId: 'pod', position: new THREE.Vector3(0, 9, 0), rotation: new THREE.Euler() },
        { uid: 't1', partId: 'tank', position: new THREE.Vector3(0, 6, 0), rotation: new THREE.Euler(), attachParentUid: 'pod' },
        { uid: 'dec', partId: 'decoupler', position: new THREE.Vector3(0, 3, 0), rotation: new THREE.Euler(), attachParentUid: 't1' },
        { uid: 't2', partId: 'tank', position: new THREE.Vector3(0, 0, 0), rotation: new THREE.Euler(), attachParentUid: 'dec' },
        { uid: 'eA', partId: 'engine', position: new THREE.Vector3(-1, -3, 0), rotation: new THREE.Euler(), attachParentUid: 't2' },
        { uid: 'eB', partId: 'engine', position: new THREE.Vector3(1, -3, 0), rotation: new THREE.Euler(), attachParentUid: 't2' },
      ],
    };
    const stages = buildStages(design);
    expect(stages.length).toBe(1);
    expect(stages[0].engineUids).toHaveLength(2);
  });
});
