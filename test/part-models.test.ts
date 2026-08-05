import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildPartMesh } from '../src/rendering/part-models';
import { PARTS_CATALOG } from '../src/entities/parts-catalog';
import type { PartDef } from '../src/entities/part';

/** World-space size of a built part mesh, with its scale applied. */
function worldSize(def: PartDef, ghost = false): THREE.Vector3 {
  const mesh = buildPartMesh(def, ghost);
  mesh.updateMatrixWorld(true);
  const size = new THREE.Vector3();
  new THREE.Box3().setFromObject(mesh).getSize(size);
  return size;
}

describe.each(PARTS_CATALOG.map((d) => [d.id, d] as const))('part model: %s', (_id, def) => {
  it('fits inside its collision box on every axis', () => {
    const size = worldSize(def);
    // A model that pokes outside its collider would visually clip through
    // terrain and neighbouring parts.
    expect(size.x).toBeLessThanOrEqual(def.size[0] * 2 + 1e-6);
    expect(size.y).toBeLessThanOrEqual(def.size[1] * 2 + 1e-6);
    expect(size.z).toBeLessThanOrEqual(def.size[2] * 2 + 1e-6);
  });

  it('fills its collision box on at least one axis', () => {
    const size = worldSize(def);
    // Uniform fitting means the tightest axis touches the box. If none does,
    // the part is floating inside an oversized collider.
    const touches = [
      size.x / (def.size[0] * 2),
      size.y / (def.size[1] * 2),
      size.z / (def.size[2] * 2),
    ];
    expect(Math.max(...touches)).toBeCloseTo(1, 5);
  });

  it('is scaled uniformly, so the shape is never squashed', () => {
    const mesh = buildPartMesh(def);
    expect(mesh.scale.x).toBeCloseTo(mesh.scale.y, 10);
    expect(mesh.scale.y).toBeCloseTo(mesh.scale.z, 10);
  });

  it('builds geometry with vertex colours', () => {
    const mesh = buildPartMesh(def);
    expect(mesh.geometry.getAttribute('color')).toBeDefined();
    expect((mesh.material as THREE.MeshStandardMaterial).vertexColors).toBe(true);
  });

  it('is centred on its own origin', () => {
    const mesh = buildPartMesh(def);
    mesh.updateMatrixWorld(true);
    const center = new THREE.Vector3();
    new THREE.Box3().setFromObject(mesh).getCenter(center);
    expect(center.length()).toBeLessThan(1e-6);
  });
});

describe('part model caching', () => {
  it('shares one geometry between every mesh of the same part', () => {
    const def = PARTS_CATALOG[0];
    // Geometry is the expensive half and is identical per part; materials are
    // not shared, because callers tint individual meshes.
    expect(buildPartMesh(def).geometry).toBe(buildPartMesh(def).geometry);
  });

  it('gives every mesh its own material', () => {
    const def = PARTS_CATALOG[0];
    const a = buildPartMesh(def);
    const b = buildPartMesh(def);
    expect(a.material).not.toBe(b.material);

    // A caller tinting one mesh must not tint the others — this is what the
    // VAB does for selection highlighting and the placement ghost.
    (a.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x333300);
    expect((b.material as THREE.MeshStandardMaterial).emissive?.getHex() ?? 0).toBe(0);
  });

  it('builds ghosts transparent and solid parts opaque', () => {
    const def = PARTS_CATALOG[0];
    const ghost = buildPartMesh(def, true).material as THREE.MeshStandardMaterial;
    const solid = buildPartMesh(def, false).material as THREE.MeshStandardMaterial;
    expect(ghost.transparent).toBe(true);
    expect(ghost.opacity).toBeLessThan(1);
    expect(solid.transparent).toBe(false);
    expect(solid.opacity).toBe(1);
  });

  it('gives a ghost the same geometry and scale as the solid part', () => {
    const def = PARTS_CATALOG[0];
    expect(buildPartMesh(def, true).geometry).toBe(buildPartMesh(def, false).geometry);
    expect(worldSize(def, true).toArray()).toEqual(worldSize(def, false).toArray());
  });
});
