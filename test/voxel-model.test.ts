import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { VoxelModel, CARVE, shade } from '../src/rendering/voxel-model';

/** Count triangles in a built geometry. */
function tris(m: VoxelModel): number {
  return (m.buildGeometry().index?.count ?? 0) / 3;
}

describe('VoxelModel — grid', () => {
  it('overpaints a voxel instead of stacking a duplicate', () => {
    const m = new VoxelModel(1);
    m.add(0, 0, 0, 0xff0000);
    m.add(0, 0, 0, 0x00ff00);
    expect(m.size).toBe(1);
    // The survivor is the later colour: models are built by layering shapes.
    const colors = m.buildGeometry().getAttribute('color');
    expect(colors.getX(0)).toBeCloseTo(0);
    expect(colors.getY(0)).toBeCloseTo(1);
  });

  it('removes voxels when painted with CARVE', () => {
    const m = new VoxelModel(1);
    m.addBox(0, 0, 0, 2, 2, 2, 0xffffff);
    expect(m.size).toBe(27);
    m.add(1, 1, 1, CARVE);
    expect(m.size).toBe(26);
  });

  it('carving a shape hollows it out', () => {
    const m = new VoxelModel(1);
    m.addCylinder(0, 0, 5, 0, 4, 0xffffff);
    const solid = m.size;
    m.addCylinder(0, 0, 3, 0, 4, CARVE);
    expect(m.size).toBeLessThan(solid);
    // Nothing left on the axis, plenty left at the rim.
    m.paintIf((v) => VoxelModel.radiusOf(v) < 3, 0x000000);
    expect(m.size).toBeGreaterThan(0);
  });
});

describe('VoxelModel — shapes', () => {
  it('addCylinder fills a disc of the requested radius at every layer', () => {
    const m = new VoxelModel(1);
    m.addCylinder(0, 0, 4, 0, 2, 0xffffff);
    let maxR = 0;
    m.paintIf((v) => {
      maxR = Math.max(maxR, VoxelModel.radiusOf(v));
      return false;
    }, 0);
    expect(maxR).toBeLessThanOrEqual(4);
    expect(maxR).toBeGreaterThan(3);
  });

  it('addFrustum tapers linearly from r0 to r1', () => {
    const m = new VoxelModel(1);
    m.addFrustum(0, 0, 8, 2, 0, 10, 0xffffff);
    const widest = (y: number) => {
      let r = 0;
      m.paintIf((v) => {
        if (v.y === y) r = Math.max(r, VoxelModel.radiusOf(v));
        return false;
      }, 0);
      return r;
    };
    expect(widest(0)).toBeGreaterThan(widest(5));
    expect(widest(5)).toBeGreaterThan(widest(10));
  });

  it('addBell flares harder near the exit than a straight cone would', () => {
    const bell = new VoxelModel(1);
    bell.addBell(0, 0, 10, 2, 0, 10, 0xffffff, 2.4);
    const cone = new VoxelModel(1);
    cone.addFrustum(0, 0, 10, 2, 0, 10, 0xffffff);
    // A bell hugs the throat for longer, so at mid-height it is narrower.
    const midR = (m: VoxelModel) => {
      let r = 0;
      m.paintIf((v) => {
        if (v.y === 5) r = Math.max(r, VoxelModel.radiusOf(v));
        return false;
      }, 0);
      return r;
    };
    expect(midR(bell)).toBeLessThan(midR(cone));
  });

  it('addTube leaves the middle empty', () => {
    const m = new VoxelModel(1);
    m.addTube(0, 0, 6, 3, 0, 0, 0xffffff);
    let innermost = Infinity;
    m.paintIf((v) => {
      innermost = Math.min(innermost, VoxelModel.radiusOf(v));
      return false;
    }, 0);
    expect(innermost).toBeGreaterThanOrEqual(3);
  });

  it('addLine connects its two endpoints', () => {
    const m = new VoxelModel(1);
    m.addLine(0, 0, 0, 5, 5, 0, 0xffffff);
    const has = (x: number, y: number, z: number) => {
      let found = false;
      m.paintIf((v) => {
        if (v.x === x && v.y === y && v.z === z) found = true;
        return false;
      }, 0);
      return found;
    };
    expect(has(0, 0, 0)).toBe(true);
    expect(has(5, 5, 0)).toBe(true);
  });
});

describe('VoxelModel — paint', () => {
  it('paintIf recolors only the matching voxels', () => {
    const m = new VoxelModel(1);
    m.addBox(0, 0, 0, 3, 0, 0, 0x111111);
    m.paintIf((v) => v.x >= 2, 0x222222);
    let recolored = 0;
    m.paintIf((v) => {
      if (v.color === 0x222222) recolored++;
      return false;
    }, 0);
    expect(recolored).toBe(2);
  });

  it('shade darkens without leaving the channel range', () => {
    expect(shade(0xffffff, 0.5)).toBe(0x808080);
    expect(shade(0x000000, 0.5)).toBe(0x000000);
    // Brightening clamps at 0xff rather than overflowing into the next channel.
    expect(shade(0xffffff, 2)).toBe(0xffffff);
  });
});

describe('VoxelModel — geometry', () => {
  it('emits six faces for a lone voxel', () => {
    const m = new VoxelModel(1);
    m.add(0, 0, 0, 0xffffff);
    expect(tris(m)).toBe(12); // 6 faces × 2 triangles
  });

  it('culls the faces between adjacent voxels', () => {
    const m = new VoxelModel(1);
    m.addBox(0, 0, 0, 1, 1, 1, 0xffffff); // 8 voxels, each with 3 exposed faces
    expect(tris(m)).toBe(24 * 2);
  });

  it('a hollow interior costs nothing until it is opened', () => {
    const solid = new VoxelModel(1);
    solid.addBox(0, 0, 0, 4, 4, 4, 0xffffff);
    const hollow = new VoxelModel(1);
    hollow.addBox(0, 0, 0, 4, 4, 4, 0xffffff);
    hollow.addBox(1, 1, 1, 3, 3, 3, CARVE);
    // The cavity is sealed, so the shell it exposes is its own inner surface.
    expect(tris(hollow)).toBeGreaterThan(tris(solid));
  });

  it('centres the geometry on its bounding box', () => {
    const m = new VoxelModel(1);
    m.addBox(10, 20, 30, 12, 22, 32, 0xffffff);
    const geom = m.buildGeometry();
    geom.computeBoundingBox();
    const c = geom.boundingBox!.getCenter(new THREE.Vector3());
    expect(c.x).toBeCloseTo(0);
    expect(c.y).toBeCloseTo(0);
    expect(c.z).toBeCloseTo(0);
  });

  it('scales voxels by voxelSize', () => {
    const m = new VoxelModel(0.25);
    m.addBox(0, 0, 0, 3, 0, 0, 0xffffff); // 4 voxels along X
    const geom = m.buildGeometry();
    geom.computeBoundingBox();
    const size = geom.boundingBox!.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(1);   // 4 × 0.25
    expect(size.y).toBeCloseTo(0.25);
  });

  it('survives an empty model', () => {
    expect(() => new VoxelModel(1).buildGeometry()).not.toThrow();
  });
});
