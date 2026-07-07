// src/rendering/part-models.ts
import * as THREE from 'three';
import { VoxelModel } from './voxel-model';
import type { PartDef } from '../entities/part';

/**
 * Procedural voxel models for each ship part type.
 * Each function returns a THREE.Mesh built from colored voxels.
 * The mesh is centered at origin and sized to roughly match the part's
 * bounding box (def.size = half-extents).
 *
 * Collision shapes stay as simple boxes (physics), only the visual mesh changes.
 */

// Color palette for parts.
const C = {
  podWhite: 0xdddddd,
  podDark: 0x888888,
  podGlass: 0x4488cc,
  podAccent: 0xcc4444,
  tankWhite: 0xeeeeee,
  tankStripe: 0xcc4444,
  tankDark: 0x999999,
  engineDark: 0x444444,
  engineBell: 0x666666,
  engineGlow: 0xff6600,
  engineAccent: 0x884400,
  wingletRed: 0xcc3333,
  wingletDark: 0x882222,
  strutGrey: 0x888888,
  strutDark: 0x555555,
};

/** Build a voxel mesh for a given part definition. */
export function buildPartMesh(def: PartDef, ghost = false): THREE.Mesh {
  const voxelSize = 0.4; // ~0.4m per voxel — chunky, readable
  const m = new VoxelModel(voxelSize);
  let mesh: THREE.Mesh;

  switch (def.kind) {
    case 'pod':
      mesh = buildPod(m);
      break;
    case 'tank':
      mesh = buildTank(m);
      break;
    case 'engine':
      mesh = buildEngine(m);
      break;
    case 'winglet':
      mesh = buildWinglet(m);
      break;
    case 'strut':
      mesh = buildStrut(m);
      break;
    default:
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(def.size[0] * 2, def.size[1] * 2, def.size[2] * 2),
        new THREE.MeshStandardMaterial({ color: def.color }),
      );
  }

  // Scale the voxel mesh to exactly match the part's collision half-extents.
  // The VAB snapping logic uses def.size for placement offsets, so the visual
  // mesh must fill the same bounding box or parts won't connect flush.
  const bbox = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  if (size.x > 0 && size.y > 0 && size.z > 0) {
    mesh.scale.set(
      (def.size[0] * 2) / size.x,
      (def.size[1] * 2) / size.y,
      (def.size[2] * 2) / size.z,
    );
  }

  if (ghost) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.transparent = true;
    mat.opacity = 0.5;
    mat.depthWrite = false; // prevents z-fighting with parts behind the ghost
  }

  return mesh;
}

/** Command Pod — nose cone shape with a window and accent ring. */
function buildPod(m: VoxelModel): THREE.Mesh {
  // Cone from wide base (radius 3) to pointed top.
  m.addCone(0, 0, 3, -3, 3, C.podWhite);
  // Darker base ring.
  m.addBox(-3, -3, -3, 3, -3, 3, C.podDark);
  // Window strip (blue voxels on the +Z face).
  m.addBox(-1, 1, 3, 1, 2, 3, C.podGlass);
  // Red accent ring near top.
  m.addBox(-1, 2, -3, 1, 2, 3, C.podAccent);
  return m.buildMesh();
}

/** Fuel Tank — cylinder with stripes. */
function buildTank(m: VoxelModel): THREE.Mesh {
  // Main body — tall cylinder.
  m.addCylinder(0, 0, 3, -5, 5, C.tankWhite);
  // Red stripes at top and bottom.
  m.addCylinder(0, 0, 3, -5, -4, C.tankStripe);
  m.addCylinder(0, 0, 3, 4, 5, C.tankStripe);
  // Darker end caps.
  m.addBox(-3, -5, -3, 3, -5, 3, C.tankDark);
  m.addBox(-3, 5, -3, 3, 5, 3, C.tankDark);
  return m.buildMesh();
}

/** Engine — bell shape with nozzle glow. */
function buildEngine(m: VoxelModel): THREE.Mesh {
  // Upper mount block (connects to tank).
  m.addBox(-2, 1, -2, 2, 3, 2, C.engineDark);
  // Bell cone — narrows upward, widens downward.
  m.addCone(0, 0, 3, -3, 1, C.engineBell);
  // Orange glow at the nozzle base.
  m.addBox(-2, -3, -2, 2, -3, 2, C.engineGlow);
  // Side accent strips.
  m.addBox(-2, 0, -2, -2, 2, 2, C.engineAccent);
  m.addBox(2, 0, -2, 2, 2, 2, C.engineAccent);
  return m.buildMesh();
}

/** Winglet — triangular fin. */
function buildWinglet(m: VoxelModel): THREE.Mesh {
  // Triangular fin pointing up and outward.
  m.addFin(0, -2, -1, 5, 4, 2, C.wingletRed);
  // Dark leading edge.
  m.addFin(0, -2, -1, 5, 1, 2, C.wingletDark);
  return m.buildMesh();
}

/** Strut — thin connector. */
function buildStrut(m: VoxelModel): THREE.Mesh {
  // Thin vertical bar.
  m.addBox(0, -4, 0, 0, 4, 0, C.strutGrey);
  // Dark end caps.
  m.addBox(-1, -4, -1, 1, -4, 1, C.strutDark);
  m.addBox(-1, 4, -1, 1, 4, 1, C.strutDark);
  return m.buildMesh();
}
