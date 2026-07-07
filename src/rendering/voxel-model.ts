// src/rendering/voxel-model.ts
import * as THREE from 'three';

/**
 * Voxel model builder — constructs a merged Three.js mesh from a 3D grid of
 * colored voxels. Each voxel is a small cube; adjacent voxels share faces so
 * the result is a single efficient BufferGeometry with vertex colors.
 *
 * Design: purely procedural, no external files. Each part defines its shape
 * as a function that fills a VoxelModel with colored cubes.
 */

export type Voxel = {
  x: number; y: number; z: number;
  color: number;
};

export class VoxelModel {
  private voxels: Voxel[] = [];
  /** Size of each voxel cube in world units. */
  readonly voxelSize: number;

  constructor(voxelSize = 0.5) {
    this.voxelSize = voxelSize;
  }

  /** Add a single voxel at grid coordinates (x, y, z) with a color. */
  add(x: number, y: number, z: number, color: number): this {
    this.voxels.push({ x, y, z, color });
    return this;
  }

  /** Add a filled box region of voxels. */
  addBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number): this {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++)
          this.add(x, y, z, color);
    return this;
  }

  /** Add a hollow box (walls only, no interior). */
  addHollowBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number): this {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++)
          if (x === x0 || x === x1 || y === y0 || y === y1 || z === z0 || z === z1)
            this.add(x, y, z, color);
    return this;
  }

  /** Add a cylinder-like stack (filled circle at each Y layer). */
  addCylinder(cx: number, cz: number, radius: number, y0: number, y1: number, color: number): this {
    for (let y = y0; y <= y1; y++)
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++)
        for (let z = Math.floor(cz - radius); z <= Math.ceil(cz + radius); z++)
          if ((x - cx) ** 2 + (z - cz) ** 2 <= radius * radius)
            this.add(x, y, z, color);
    return this;
  }

  /** Add a cone (tapered cylinder — radius shrinks linearly from base to top). */
  addCone(cx: number, cz: number, baseRadius: number, y0: number, y1: number, color: number): this {
    const height = y1 - y0;
    for (let y = y0; y <= y1; y++) {
      const t = height > 0 ? (y - y0) / height : 0;
      const r = baseRadius * (1 - t);
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
          if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r)
            this.add(x, y, z, color);
    }
    return this;
  }

  /** Add a triangular fin (for winglets). */
  addFin(x0: number, y0: number, z0: number, height: number, width: number, depth: number, color: number): this {
    for (let y = 0; y < height; y++) {
      const w = Math.max(1, Math.round(width * (1 - y / height)));
      const d = Math.max(1, Math.round(depth * (1 - y / height)));
      for (let x = 0; x < w; x++)
        for (let z = 0; z < d; z++)
          this.add(x0 + x, y0 + y, z0 + z, color);
    }
    return this;
  }

  /**
   * Build a merged Three.js mesh from the voxel grid.
   * Returns a Mesh with vertex colors and standard material.
   * The mesh is centered at the origin (averaged voxel center).
   */
  buildMesh(transparent = false, opacity = 1): THREE.Mesh {
    if (this.voxels.length === 0) {
      return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x888888 }));
    }

    // Compute center for normalization.
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const v of this.voxels) {
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
    }
    const offX = (minX + maxX) / 2;
    const offY = (minY + maxY) / 2;
    const offZ = (minZ + maxZ) / 2;

    // Build a set of occupied voxels for face culling.
    const occ = new Set<string>();
    for (const v of this.voxels) occ.add(`${v.x},${v.y},${v.z}`);

    const vs: number[] = [];      // vertices
    const cols: number[] = [];    // vertex colors (r,g,b floats 0-1)
    const idx: number[] = [];     // triangle indices

    const s = this.voxelSize;
    const half = s / 2;

    // Face definitions: normal, 4 corner offsets, winding.
    const faces = [
      { n: [1, 0, 0],  corners: [[half,-half,-half],[half,half,-half],[half,half,half],[half,-half,half]] },
      { n: [-1, 0, 0], corners: [[-half,-half,half],[-half,half,half],[-half,half,-half],[-half,-half,-half]] },
      { n: [0, 1, 0],  corners: [[-half,half,-half],[-half,half,half],[half,half,half],[half,half,-half]] },
      { n: [0,-1, 0],  corners: [[-half,-half,half],[-half,-half,-half],[half,-half,-half],[half,-half,half]] },
      { n: [0, 0, 1],  corners: [[half,-half,half],[half,half,half],[-half,half,half],[-half,-half,half]] },
      { n: [0, 0,-1],  corners: [[-half,-half,-half],[-half,half,-half],[half,half,-half],[half,-half,-half]] },
    ];

    let vertCount = 0;
    for (const v of this.voxels) {
      const wx = (v.x - offX) * s;
      const wy = (v.y - offY) * s;
      const wz = (v.z - offZ) * s;

      const r = ((v.color >> 16) & 0xff) / 255;
      const g = ((v.color >> 8) & 0xff) / 255;
      const b = (v.color & 0xff) / 255;

      for (const f of faces) {
        // Skip faces that are hidden by an adjacent voxel.
        const nx = v.x + f.n[0], ny = v.y + f.n[1], nz = v.z + f.n[2];
        if (occ.has(`${nx},${ny},${nz}`)) continue;

        for (const c of f.corners) {
          vs.push(wx + c[0], wy + c[1], wz + c[2]);
          cols.push(r, g, b);
        }
        // Two triangles for this face.
        idx.push(vertCount, vertCount + 1, vertCount + 2, vertCount, vertCount + 2, vertCount + 3);
        vertCount += 4;
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geom.setIndex(idx);
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent,
      opacity,
      roughness: 0.6,
      metalness: 0.1,
    });

    return new THREE.Mesh(geom, mat);
  }
}
