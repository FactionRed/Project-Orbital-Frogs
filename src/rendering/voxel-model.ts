// src/rendering/voxel-model.ts
import * as THREE from 'three';

/**
 * Voxel model builder — constructs a merged Three.js mesh from a 3D grid of
 * colored voxels. Interior faces between adjacent voxels are culled, so the
 * result is a single BufferGeometry carrying only the visible shell.
 *
 * Design: purely procedural, no external files. Each part defines its shape as
 * a function that fills a VoxelModel with colored cubes.
 *
 * Models are built by layering shapes over each other — a later shape recolors
 * the voxels it covers. Passing `CARVE` instead of a color removes them
 * instead, which is how hollow forms (a nozzle throat, a truss bay) are made.
 */

export type Voxel = {
  x: number; y: number; z: number;
  color: number;
};

/** Pass instead of a color to remove voxels rather than paint them. */
export const CARVE = null;

/** A color to paint with, or CARVE to cut away. */
export type Paint = number | typeof CARVE;

/** Multiply a hex color's channels by `f` (clamped). For shading detail. */
export function shade(hex: number, f: number): number {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n * f)));
  return (c((hex >> 16) & 0xff) << 16) | (c((hex >> 8) & 0xff) << 8) | c(hex & 0xff);
}

export class VoxelModel {
  /**
   * Sparse grid keyed by "x,y,z". A Map rather than an array + Set because
   * models are built by overpainting: an array would need a linear scan to
   * find the voxel being recolored, making construction quadratic in voxel
   * count. At the resolutions the part models use that is the difference
   * between milliseconds and seconds.
   */
  private cells = new Map<string, Voxel>();
  /** Size of each voxel cube in world units. */
  readonly voxelSize: number;

  constructor(voxelSize = 0.5) {
    this.voxelSize = voxelSize;
  }

  get size(): number {
    return this.cells.size;
  }

  /** Paint (or carve) a single voxel at grid coordinates. */
  add(x: number, y: number, z: number, color: Paint): this {
    const key = `${x},${y},${z}`;
    if (color === CARVE) {
      this.cells.delete(key);
      return this;
    }
    const existing = this.cells.get(key);
    if (existing) existing.color = color;
    else this.cells.set(key, { x, y, z, color });
    return this;
  }

  /** Filled box region. */
  addBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: Paint): this {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++)
          this.add(x, y, z, color);
    return this;
  }

  /** Box walls only, no interior. */
  addHollowBox(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: Paint): this {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++)
          if (x === x0 || x === x1 || y === y0 || y === y1 || z === z0 || z === z1)
            this.add(x, y, z, color);
    return this;
  }

  /**
   * Solid of revolution: fills each Y layer with a disc whose radius comes from
   * `radiusAt(t)`, t running 0 at y0 to 1 at y1. Every round shape below is a
   * thin wrapper over this.
   */
  addProfile(
    cx: number, cz: number, y0: number, y1: number,
    radiusAt: (t: number) => number,
    color: Paint,
  ): this {
    const span = y1 - y0;
    for (let y = y0; y <= y1; y++) {
      const r = radiusAt(span > 0 ? (y - y0) / span : 0);
      if (r < 0) continue;
      const r2 = r * r;
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
          if ((x - cx) ** 2 + (z - cz) ** 2 <= r2)
            this.add(x, y, z, color);
    }
    return this;
  }

  /** Straight cylinder. */
  addCylinder(cx: number, cz: number, radius: number, y0: number, y1: number, color: Paint): this {
    return this.addProfile(cx, cz, y0, y1, () => radius, color);
  }

  /** Truncated cone: radius r0 at y0 blending linearly to r1 at y1. */
  addFrustum(
    cx: number, cz: number, r0: number, r1: number, y0: number, y1: number, color: Paint,
  ): this {
    return this.addProfile(cx, cz, y0, y1, (t) => r0 + (r1 - r0) * t, color);
  }

  /** Cone tapering to a point at y1. */
  addCone(cx: number, cz: number, baseRadius: number, y0: number, y1: number, color: Paint): this {
    return this.addFrustum(cx, cz, baseRadius, 0, y0, y1, color);
  }

  /**
   * Rocket-nozzle bell: wide exit at y0 flaring in from a narrow throat at y1.
   * `power` shapes the curve — 1 is a straight cone, higher values hug the
   * throat longer and then flare hard, which is what reads as a bell.
   */
  addBell(
    cx: number, cz: number, exitRadius: number, throatRadius: number,
    y0: number, y1: number, color: Paint, power = 2.4,
  ): this {
    return this.addProfile(cx, cz, y0, y1,
      (t) => throatRadius + (exitRadius - throatRadius) * Math.pow(1 - t, power), color);
  }

  /** Hollow cylinder — an annulus at each layer. Good for rings and flanges. */
  addTube(
    cx: number, cz: number, outer: number, inner: number, y0: number, y1: number, color: Paint,
  ): this {
    const o2 = outer * outer;
    const i2 = inner * inner;
    for (let y = y0; y <= y1; y++)
      for (let x = Math.floor(cx - outer); x <= Math.ceil(cx + outer); x++)
        for (let z = Math.floor(cz - outer); z <= Math.ceil(cz + outer); z++) {
          const d2 = (x - cx) ** 2 + (z - cz) ** 2;
          if (d2 <= o2 && d2 >= i2) this.add(x, y, z, color);
        }
    return this;
  }

  /** Voxel line between two grid points, optionally thickened into a bar. */
  addLine(
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    color: Paint, thickness = 0,
  ): this {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t);
      const z = Math.round(z0 + (z1 - z0) * t);
      if (thickness <= 0) this.add(x, y, z, color);
      else this.addBox(x - thickness, y - thickness, z - thickness,
        x + thickness, y + thickness, z + thickness, color);
    }
    return this;
  }

  /**
   * Recolor every voxel matching a predicate. Used for surface detail that is
   * easier to describe after the fact than to build into the shape — stringers
   * around a tank, cooling ribs down a nozzle.
   */
  paintIf(match: (v: Voxel) => boolean, color: number): this {
    for (const v of this.cells.values()) if (match(v)) v.color = color;
    return this;
  }

  /** Angle of a point around the Y axis, in radians from 0 to 2π. */
  static angleOf(v: { x: number; z: number }, cx = 0, cz = 0): number {
    const a = Math.atan2(v.z - cz, v.x - cx);
    return a < 0 ? a + Math.PI * 2 : a;
  }

  /** Distance of a point from the Y axis. */
  static radiusOf(v: { x: number; z: number }, cx = 0, cz = 0): number {
    return Math.hypot(v.x - cx, v.z - cz);
  }

  /**
   * Merged geometry for the current voxel set, centered on its bounding box.
   * Only faces without an occupied neighbour are emitted.
   */
  buildGeometry(): THREE.BufferGeometry {
    if (this.cells.size === 0) return new THREE.BoxGeometry(1, 1, 1);

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const v of this.cells.values()) {
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
    }
    const offX = (minX + maxX) / 2;
    const offY = (minY + maxY) / 2;
    const offZ = (minZ + maxZ) / 2;

    const vs: number[] = [];
    const cols: number[] = [];
    const idx: number[] = [];

    const s = this.voxelSize;
    const half = s / 2;

    const faces = [
      { n: [1, 0, 0],  corners: [[half,-half,-half],[half,half,-half],[half,half,half],[half,-half,half]] },
      { n: [-1, 0, 0], corners: [[-half,-half,half],[-half,half,half],[-half,half,-half],[-half,-half,-half]] },
      { n: [0, 1, 0],  corners: [[-half,half,-half],[-half,half,half],[half,half,half],[half,half,-half]] },
      { n: [0,-1, 0],  corners: [[-half,-half,half],[-half,-half,-half],[half,-half,-half],[half,-half,half]] },
      { n: [0, 0, 1],  corners: [[half,-half,half],[half,half,half],[-half,half,half],[-half,-half,half]] },
      { n: [0, 0,-1],  corners: [[-half,-half,-half],[-half,half,-half],[half,half,-half],[half,-half,-half]] },
    ];

    let vertCount = 0;
    for (const v of this.cells.values()) {
      const wx = (v.x - offX) * s;
      const wy = (v.y - offY) * s;
      const wz = (v.z - offZ) * s;

      const r = ((v.color >> 16) & 0xff) / 255;
      const g = ((v.color >> 8) & 0xff) / 255;
      const b = (v.color & 0xff) / 255;

      for (const f of faces) {
        if (this.cells.has(`${v.x + f.n[0]},${v.y + f.n[1]},${v.z + f.n[2]}`)) continue;
        for (const c of f.corners) {
          vs.push(wx + c[0], wy + c[1], wz + c[2]);
          cols.push(r, g, b);
        }
        idx.push(vertCount, vertCount + 1, vertCount + 2, vertCount, vertCount + 2, vertCount + 3);
        vertCount += 4;
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geom.setIndex(idx);
    geom.computeVertexNormals();
    return geom;
  }

  /** Convenience: geometry plus a standard vertex-colored material. */
  buildMesh(transparent = false, opacity = 1): THREE.Mesh {
    return new THREE.Mesh(this.buildGeometry(), new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent,
      opacity,
      roughness: 0.6,
      metalness: 0.1,
    }));
  }
}
