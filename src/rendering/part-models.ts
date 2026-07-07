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
 * Visual style draws from ULA cutaway references (Atlas V, Delta IV Heavy,
 * Vulcan Centaur): ogive nose cones, tank sections with visible cap details,
 * bell-shaped engine nozzles with mount plates, and truss-like struts.
 * Collision shapes stay as simple boxes (physics), only the visual mesh changes.
 */

// Color palette — inspired by ULA rockets: white tanks, dark engines,
// orange/copper nozzle bells, blue acoustic panels, silver interstages.
const C = {
  // Pod
  podWhite: 0xe8e8e8,
  podDark: 0x666666,
  podGlass: 0x3388cc,
  podAccent: 0xcc3333,
  podGrey: 0xaaaaaa,
  // Tank
  tankWhite: 0xf0f0f0,
  tankStripe: 0xcc3333,
  tankDark: 0x888888,
  tankSilver: 0xbbbbbb,
  tankBlue: 0x3355aa, // LOX tank indicator (blue-ish like ULA diagrams)
  tankOrange: 0xcc6611, // fuel tank indicator (warm tone)
  // Engine
  engineDark: 0x333333,
  engineBell: 0x998866, // copper/bronze bell like RL10/BE-4
  engineBellDark: 0x554433,
  engineGlow: 0xff5500,
  engineAccent: 0x776655,
  engineMount: 0x555555,
  // Winglet
  wingletRed: 0xcc3333,
  wingletDark: 0x882222,
  wingletGrey: 0x888888,
  // Strut
  strutGrey: 0x999999,
  strutDark: 0x555555,
  strutTruss: 0x666666,
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
    case 'thermometer':
      mesh = buildThermometer(m);
      break;
    case 'barometer':
      mesh = buildBarometer(m);
      break;
    case 'gravity_scanner':
      mesh = buildGravityScanner(m);
      break;
    default:
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(def.size[0] * 2, def.size[1] * 2, def.size[2] * 2),
        new THREE.MeshStandardMaterial({ color: def.color }),
      );
  }

  // Scale the voxel mesh to exactly match the part's collision half-extents.
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
    mat.depthWrite = false;
  }

  return mesh;
}

/**
 * Command Pod — ogive nose cone (like Atlas V fairing) with:
 * - Pointed nose tip
 * - Blue window strip (acoustic panel vibe)
 * - Cylindrical lower section (service module)
 * - Dark base ring (payload adapter)
 */
function buildPod(m: VoxelModel): THREE.Mesh {
  // Nose cone — ogive shape: starts wide, tapers to a point.
  // Use a cone from radius 3 at base to radius 0 at tip.
  m.addCone(0, 0, 3, 0, 5, C.podWhite);
  // Blunt tip cap (a single voxel for a rounded nose).
  m.add(0, 5, 0, C.podGrey);

  // Cylindrical lower section (service module / adapter).
  m.addCylinder(0, 0, 3, -3, 0, C.podGrey);

  // Window strip — blue voxels in a ring at mid-height.
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    const wx = Math.round(Math.cos(ang) * 2.5);
    const wz = Math.round(Math.sin(ang) * 2.5);
    m.add(wx, 2, wz, C.podGlass);
  }

  // Red accent ring (visibility marker like ULA markings).
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    const wx = Math.round(Math.cos(ang) * 2.5);
    const wz = Math.round(Math.sin(ang) * 2.5);
    m.add(wx, 1, wz, C.podAccent);
  }

  // Dark base ring (payload adapter / interstage).
  m.addCylinder(0, 0, 3, -4, -3, C.podDark);

  return m.buildMesh();
}

/**
 * Fuel Tank — ULA-style propellant section with:
 * - White main body cylinder
 * - Red stripe bands at top and bottom (ULA marking bands)
 * - Silver/dark end caps (common bulkhead suggestion)
 * - Subtle blue tint on upper portion (LOX tank indicator)
 */
function buildTank(m: VoxelModel): THREE.Mesh {
  // Main body — tall cylinder, white.
  m.addCylinder(0, 0, 3, -5, 5, C.tankWhite);

  // Upper section — slight blue tint (LOX tank area, like ULA cutaways).
  m.addCylinder(0, 0, 3, 2, 5, C.tankBlue);

  // Lower section — warm tint (fuel tank area).
  m.addCylinder(0, 0, 3, -5, -2, C.tankOrange);

  // Red stripe bands at top and bottom (ULA-style marking bands).
  m.addCylinder(0, 0, 3, 4, 5, C.tankStripe);
  m.addCylinder(0, 0, 3, -5, -4, C.tankStripe);

  // Silver end caps (common bulkhead suggestion).
  m.addCylinder(0, 0, 3, 5, 5, C.tankSilver);
  m.addCylinder(0, 0, 3, -5, -5, C.tankSilver);

  // Center band — darker ring (weld line / common bulkhead).
  m.addCylinder(0, 0, 3, 0, 0, C.tankDark);

  return m.buildMesh();
}

/**
 * Engine — ULA-style bell nozzle assembly with:
 * - Dark mount block (interstage adapter)
 * - Copper/bronze bell cone (wide at bottom, narrows up)
 * - Orange glow at nozzle exit
 * - Side accent plates (engine fairing)
 */
function buildEngine(m: VoxelModel): THREE.Mesh {
  // Mount block — connects to tank above (interstage adapter).
  m.addBox(-2, 2, -2, 2, 3, 2, C.engineMount);

  // Bell cone — inverted: wide at bottom (nozzle exit), narrow at top (throat).
  // This matches real engine bells (RL10, BE-4, RD-180).
  m.addCone(0, 0, 3, -3, 2, C.engineBell);

  // Darker bands on the bell (cooling channel suggestion).
  m.addCylinder(0, 0, 3, -3, -2, C.engineBellDark);
  m.addCylinder(0, 0, 2, 0, 1, C.engineBellDark);

  // Orange glow at the nozzle exit (exhaust plume suggestion).
  m.addCylinder(0, 0, 3, -3, -3, C.engineGlow);

  // Side accent plates (engine fairing / structural support).
  m.addBox(-2, 0, -2, -2, 2, 2, C.engineAccent);
  m.addBox(2, 0, -2, 2, 2, 2, C.engineAccent);

  // Small detail: center feedline suggestion (dark vertical strip).
  m.add(0, 1, 0, C.engineDark);
  m.add(0, 0, 0, C.engineDark);

  return m.buildMesh();
}

/**
 * Winglet — aerodynamic fin with:
 * - Triangular planform (swept back like ULA SRB fins)
 * - Red body with dark leading edge
 * - Grey root attachment
 */
function buildWinglet(m: VoxelModel): THREE.Mesh {
  // Main fin body — triangular, sweeping up and out.
  m.addFin(0, -2, -1, 5, 4, 2, C.wingletRed);

  // Dark leading edge (the front of the fin).
  m.addFin(0, -2, -1, 5, 1, 2, C.wingletDark);

  // Grey root attachment (where it bolts to the core).
  m.addBox(0, -3, -1, 1, -2, 1, C.wingletGrey);

  return m.buildMesh();
}

/**
 * Strut — ULA-style truss/interstage with:
 * - Thin vertical support bars (truss-like, not solid wall)
 * - Dark end caps (attachment points)
 * - Cross-bracing pattern (structural truss suggestion)
 */
function buildStrut(m: VoxelModel): THREE.Mesh {
  // Four vertical corner posts (truss frame).
  m.addBox(-1, -4, -1, -1, 4, -1, C.strutGrey);
  m.addBox(1, -4, -1, 1, 4, -1, C.strutGrey);
  m.addBox(-1, -4, 1, -1, 4, 1, C.strutGrey);
  m.addBox(1, -4, 1, 1, 4, 1, C.strutGrey);

  // Cross-bracing — diagonal pattern on the sides (truss suggestion).
  for (let y = -3; y <= 3; y += 2) {
    m.add(-1, y, 0, C.strutTruss);
    m.add(1, y, 0, C.strutTruss);
    m.add(0, y, -1, C.strutTruss);
    m.add(0, y, 1, C.strutTruss);
  }

  // Dark end caps (attachment rings / decoupler suggestion).
  m.addBox(-1, -4, -1, 1, -4, 1, C.strutDark);
  m.addBox(-1, 4, -1, 1, 4, 1, C.strutDark);

  return m.buildMesh();
}

// --- Science instruments ---

/** Thermometer — small orange sensor pod with antenna spike. */
function buildThermometer(m: VoxelModel): THREE.Mesh {
  m.addBox(-1, -1, -1, 1, 1, 1, 0xcc8800);
  m.addBox(-1, 1, -1, 1, 2, 1, 0xffaa22);
  m.add(0, 3, 0, 0x664400);
  m.add(0, 4, 0, 0x664400);
  return m.buildMesh();
}

/** Barometer — purple cylinder with pressure gauge face. */
function buildBarometer(m: VoxelModel): THREE.Mesh {
  m.addBox(-1, -1, -1, 1, 1, 1, 0x8844cc);
  m.addBox(-1, -1, 1, 1, 1, 2, 0xbbaaff);
  m.addBox(-1, 1, -1, 1, 2, 1, 0x663399);
  return m.buildMesh();
}

/** Gravity Scanner — blue sensor dome on a base plate. */
function buildGravityScanner(m: VoxelModel): THREE.Mesh {
  m.addBox(-2, -2, -2, 2, -1, 2, 0x446688);
  m.addBox(-1, -1, -1, 1, 1, 1, 0x4488cc);
  m.add(0, 2, 0, 0x88ccff);
  m.add(-1, 2, 0, 0x66aadd);
  m.add(1, 2, 0, 0x66aadd);
  m.add(0, 2, -1, 0x66aadd);
  m.add(0, 2, 1, 0x66aadd);
  return m.buildMesh();
}
