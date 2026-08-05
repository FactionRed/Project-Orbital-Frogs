// src/rendering/part-models.ts
import * as THREE from 'three';
import { VoxelModel, CARVE, shade } from './voxel-model';
import type { PartDef } from '../entities/part';

/**
 * Procedural voxel models for each ship part.
 *
 * Style: recognisable launch-vehicle hardware, drawn in voxels and taking
 * liberties where the grid or the readability demands it. References are the
 * usual suspects — Atlas V / Vulcan for tanks and interstages, RL10 and BE-4
 * for the engine bell, Mercury and Apollo for the capsule.
 *
 * Two rules govern every model here:
 *
 * 1. **Build on the part's own grid.** Models are laid out on a voxel grid
 *    sized from `def.size`, and the finished mesh is scaled *uniformly* to fit
 *    inside the collision box. A model may under-fill an axis — a fin is
 *    thinner than its box — and it stays thin instead of being stretched out
 *    to fill, which is what turned the winglet into a doorstop.
 *
 * 2. **Silhouette first.** At this resolution the outline carries the read;
 *    colour only reinforces it. Detail that does not change the outline —
 *    stringers, cooling ribs, panel seams — is painted on afterwards with
 *    paintIf rather than modelled.
 *
 * Collision shapes stay simple boxes; only the visual mesh lives here.
 */

// Palette. Launch vehicles are mostly white, grey and shadow, with colour
// reserved for the few things that matter: markings, glass, and hot metal.
const C = {
  hull: 0xe9ecef,        // primary white — tank and capsule skin
  hullShade: 0xc3c8cf,   // the same white in shadow, for stringers and seams
  panel: 0x9aa3ad,       // structural grey
  panelDark: 0x5d646d,   // deep structural grey
  metal: 0xb9bfc6,       // bare metal
  metalDark: 0x7b828a,
  charcoal: 0x33383e,    // shadowed cavities, nozzle interior
  marking: 0xc03a34,     // red marking bands, warning stripes
  glass: 0x2f7bb5,       // window
  glassLit: 0x6fb6e0,    // window highlight
  lox: 0xb9cfe2,         // cryogenic-oxidiser section tint
  fuel: 0xd6b48a,        // fuel section tint
  ablative: 0x6b5340,    // heat shield
  bell: 0xa9805a,        // nozzle bronze
  bellHot: 0x8a5f3d,     // nozzle bronze in shadow
  copper: 0xc08a55,      // plumbing
};

/**
 * Voxels per world unit. Every model is built on a grid `def.size × 2 × RES`
 * so its proportions match the collision box and the final scale is uniform.
 */
const RES = 12;

/**
 * Finished geometry per catalog part. Building a model touches tens of
 * thousands of voxels, and a mesh is requested for every placed part, every
 * ghost, and every piece of menu debris — all of which are the same few
 * shapes. Geometry is shared; materials are not, because callers tint
 * individual meshes (ghost transparency, VAB selection emissive).
 */
const geometryCache = new Map<string, { geom: THREE.BufferGeometry; scale: THREE.Vector3 }>();

/** Build a voxel mesh for a given part definition. */
export function buildPartMesh(def: PartDef, ghost = false): THREE.Mesh {
  let entry = geometryCache.get(def.id);
  if (!entry) {
    const m = new VoxelModel(1 / RES);
    switch (def.kind) {
      case 'pod': buildPod(m, def); break;
      case 'tank': buildTank(m, def); break;
      case 'engine': buildEngine(m, def); break;
      case 'winglet': buildWinglet(m, def); break;
      case 'strut': buildStrut(m, def); break;
      case 'decoupler': buildDecoupler(m, def); break;
      default: buildFallback(m, def); break;
    }
    const geom = m.buildGeometry();

    // Fit the finished shell inside the collision box, uniformly. Scaling each
    // axis independently would force every model to fill its box exactly,
    // which distorts anything whose natural proportions differ — a thin fin
    // gets inflated, a squat engine gets stretched. Taking the tightest of the
    // three ratios keeps the shape and never pokes outside the collider.
    geom.computeBoundingBox();
    const size = new THREE.Vector3();
    geom.boundingBox!.getSize(size);
    const fit = Math.min(
      size.x > 0 ? (def.size[0] * 2) / size.x : Infinity,
      size.y > 0 ? (def.size[1] * 2) / size.y : Infinity,
      size.z > 0 ? (def.size[2] * 2) / size.z : Infinity,
    );
    const scale = new THREE.Vector3(fit, fit, fit);
    entry = { geom, scale };
    geometryCache.set(def.id, entry);
  }

  const mesh = new THREE.Mesh(entry.geom, new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.62,
    metalness: 0.12,
    transparent: ghost,
    opacity: ghost ? 0.5 : 1,
    depthWrite: !ghost,
  }));
  mesh.scale.copy(entry.scale);
  return mesh;
}

/** Half-extents of the voxel grid for a part, in whole voxels. */
function grid(def: PartDef): { hx: number; hy: number; hz: number } {
  return {
    hx: Math.round(def.size[0] * RES),
    hy: Math.round(def.size[1] * RES),
    hz: Math.round(def.size[2] * RES),
  };
}

/**
 * Command Pod — a crew capsule in the Mercury/Apollo line: ablative heat
 * shield, tapered pressure vessel, a window, and a parachute canister with a
 * docking ring on top. It is the part the crew rides in, so it gets the one
 * piece of glass in the catalog.
 */
function buildPod(m: VoxelModel, def: PartDef): void {
  const { hx, hy } = grid(def);
  const r = hx;                       // shoulder radius — the widest point
  const H = hy * 2;
  const at = (f: number) => Math.round(-hy + f * H);   // fraction of height → y

  const yBase = at(0);
  const yShoulder = at(0.11);
  const yDeck = at(0.80);
  const yCan = at(0.93);
  const yTop = at(1);

  // Ablative heat shield — a shallow dome, widening to the shoulder. Kept
  // shallow: a deeper dome bulges and the whole part reads as a flask.
  m.addProfile(0, 0, yBase, yShoulder, (t) => r * (0.84 + 0.16 * t), C.ablative);
  // The outer edge takes the worst of re-entry.
  m.paintIf((v) => v.y <= yBase + 2 && VoxelModel.radiusOf(v) > r * 0.5, shade(C.ablative, 0.7));

  // Shoulder flange where the shield meets the hull.
  m.addTube(0, 0, r, r - 2, yShoulder, yShoulder + 1, C.panelDark);

  // Pressure vessel — the capsule proper. The cone carries almost the whole
  // height and only a shallow taper, so the mass stays low and broad.
  m.addProfile(0, 0, yShoulder + 1, yDeck, (t) => r - r * 0.44 * t, C.hull);

  // Docking tunnel and ring — short, or it turns into a neck.
  m.addCylinder(0, 0, Math.round(r * 0.34), yDeck, yCan, C.panel);
  m.addTube(0, 0, Math.round(r * 0.40), Math.round(r * 0.22), yCan, yTop, C.metalDark);

  // Window: painted onto the hull it already has, never added on top of it —
  // adding voxels here is what previously grew a blue lump off the side.
  const yWin = at(0.44);
  const wy = Math.max(1, Math.round(H * 0.06));
  const wa = 0.30;                                   // half-width in radians
  m.paintIf((v) => {
    if (v.color !== C.hull) return false;
    if (Math.abs(v.y - yWin) > wy) return false;
    const a = VoxelModel.angleOf(v);
    return Math.abs(a - Math.PI / 2) < wa;           // facing +Z
  }, C.glass);
  // Bright sill along the bottom of the glass so it catches the eye.
  m.paintIf((v) => v.color === C.glass && v.y <= yWin - wy + 1, C.glassLit);

  // Four shadowed panel seams down the capsule.
  m.paintIf((v) => {
    if (v.color !== C.hull) return false;
    if (v.y <= yShoulder + 1 || v.y >= yDeck) return false;
    const a = VoxelModel.angleOf(v);
    return [0, 0.5, 1, 1.5].some((k) => Math.abs(a - k * Math.PI) < 0.05);
  }, C.hullShade);
}

/**
 * Fuel Tank — a stage barrel. The details that sell it are longitudinal
 * stringers around the skin and a cable conduit running the full height; both
 * are what makes a plain cylinder read as flight hardware.
 */
function buildTank(m: VoxelModel, def: PartDef): void {
  const { hx, hy } = grid(def);
  const r = hx;
  const yBot = -hy;
  const yTop = hy;

  // Barrel, with the top and bottom edges drawn in slightly to suggest domes.
  const chamfer = Math.round(hy * 0.05);
  m.addProfile(0, 0, yBot, yTop, (t) => {
    const y = yBot + t * (yTop - yBot);
    if (y < yBot + chamfer) return r - (yBot + chamfer - y);
    if (y > yTop - chamfer) return r - (y - (yTop - chamfer));
    return r;
  }, C.hull);

  // Propellant sections: cryogenic oxidiser above, fuel below, common
  // bulkhead between them.
  const split = Math.round(hy * 0.12);
  m.paintIf((v) => v.y > split + 2, C.lox);
  m.paintIf((v) => v.y < split - 2 && v.y > yBot + hy * 0.22, C.fuel);
  m.addTube(0, 0, r, r - 2, split - 2, split + 2, C.metal);

  // Marking bands near each end.
  m.addTube(0, 0, r, r - 2, yTop - Math.round(hy * 0.20), yTop - Math.round(hy * 0.20) + 2, C.marking);
  m.addTube(0, 0, r, r - 2, yBot + Math.round(hy * 0.18), yBot + Math.round(hy * 0.18) + 2, C.marking);

  // End rings.
  m.addTube(0, 0, r - chamfer, r - chamfer - 3, yTop - 1, yTop, C.metalDark);
  m.addTube(0, 0, r - chamfer, r - chamfer - 3, yBot, yBot + 1, C.metalDark);

  // Longitudinal stringers — alternating angular slices of the outer shell
  // drop into shadow. Pure paint, no change to the silhouette. Only the three
  // skin colours are eligible: painting over the marking bands would chop them
  // into dashes, and over the conduit would erase it.
  // Each skin colour is shaded to its own darker tone rather than to one grey,
  // so the propellant sections keep their tint through the ribbing.
  const STRINGERS = 22;
  const inShadow = (v: { x: number; y: number; z: number }) => {
    if (VoxelModel.radiusOf(v) < r - 1.6) return false;
    return Math.floor((VoxelModel.angleOf(v) / (Math.PI * 2)) * STRINGERS) % 2 === 0;
  };
  for (const base of [C.hull, C.lox, C.fuel])
    m.paintIf((v) => v.color === base && inShadow(v), shade(base, 0.86));

  // Cable conduit down the -X side, standing proud of the skin.
  const cw = Math.max(1, Math.round(r * 0.14));
  m.addBox(-r - 1, yBot + 2, -cw, -r + 1, yTop - 2, cw, C.panelDark);
  m.addBox(-r - 1, yBot + 2, -cw + 1, -r - 1, yTop - 2, cw - 1, C.panel);
}

/**
 * Engine — the bell is the part everyone recognises, so it gets most of the
 * height and all of the width: a hard flare from a narrow throat, a hollow
 * interior you can see up into, cooling ribs down the outside, and a
 * turbopump bolted to one side.
 */
function buildEngine(m: VoxelModel, def: PartDef): void {
  const { hx, hy } = grid(def);
  const exit = hx;                                  // bell exit fills the box
  // A vacuum nozzle is longer and pinches harder at the throat — that huge
  // bell is exactly what buys its efficiency and what ruins it in thick air.
  // Engines taller than they are wide get that treatment.
  const vacuumNozzle = def.size[1] > def.size[0];
  const throat = Math.max(2, Math.round(hx * (vacuumNozzle ? 0.18 : 0.26)));
  const yExit = -hy;
  const yThroat = yExit + Math.round(hy * (vacuumNozzle ? 1.35 : 1.15));
  const yTop = hy;

  // Mount flange at the top, where the engine bolts to the stage above.
  m.addTube(0, 0, Math.round(hx * 0.44), Math.round(hx * 0.16), yTop - 1, yTop, C.panelDark);

  // Combustion chamber: pinched at the throat, swelling to the injector head.
  m.addProfile(0, 0, yThroat, yTop - 1,
    (t) => throat + (hx * 0.34 - throat) * Math.sin(t * Math.PI * 0.62), C.metal);

  // The bell.
  m.addBell(0, 0, exit, throat, yExit, yThroat, C.bell);

  // Hollow it out so the nozzle reads as a nozzle and not a spinning top.
  m.addBell(0, 0, exit - 2, Math.max(1, throat - 2), yExit - 1, yThroat - 1, CARVE);
  // Line what is now visible of the interior with soot.
  m.addBell(0, 0, exit - 1, Math.max(1, throat - 1), yExit, yThroat - 1, C.charcoal);
  m.addBell(0, 0, exit - 2, Math.max(1, throat - 2), yExit - 1, yThroat - 1, CARVE);

  // Cooling ribs — alternating shadowed slices down the bell exterior.
  const RIBS = 28;
  m.paintIf((v) => {
    if (v.color !== C.bell) return false;
    const bin = Math.floor((VoxelModel.angleOf(v) / (Math.PI * 2)) * RIBS);
    return bin % 2 === 0;
  }, C.bellHot);

  // Exit lip — a bright ring at the mouth reads as a machined edge.
  m.paintIf((v) => v.y <= yExit + 1 && v.color === C.bell, C.metal);
  m.paintIf((v) => v.y <= yExit + 1 && v.color === C.bellHot, C.metalDark);

  // Turbopump, tucked against the chamber rather than floating beside it, with
  // a feed line down to the throat and a duct up to the injector.
  const px = Math.round(hx * 0.42);
  const py = yThroat + Math.round(hy * 0.42);
  const pr = Math.max(1, Math.round(hx * 0.14));
  m.addCylinder(px, 0, pr, py - pr, py + pr, C.panelDark);
  m.addCylinder(px, 0, Math.max(1, pr - 1), py + pr, py + pr + 2, C.metal);
  m.addLine(px, py - pr, 0, Math.round(hx * 0.22), yThroat + 1, 0, C.copper);
  m.addLine(px, py + pr + 2, 0, Math.round(hx * 0.2), yTop - 2, 0, C.copper);
}

/**
 * Winglet — a swept delta fin. Span runs along local X (the part's long axis),
 * chord along Y, thickness along Z; the collision box is 4:1:1, so the fin is
 * short-chorded and wide, and the sweep is what keeps it from reading as a
 * plank.
 */
function buildWinglet(m: VoxelModel, def: PartDef): void {
  const { hx, hy, hz } = grid(def);
  const span = hx * 2;
  const rootLead = hy;                 // leading edge at the root
  const trail = -hy;                   // trailing edge, constant
  // A plate, not a wedge: a couple of voxels thick at the root, one at the
  // tip. Uniform fitting lets it stay this thin inside a much deeper box.
  const rootThick = Math.max(1, Math.round(hz * 0.22));

  const leadAt = (t: number) => Math.round(rootLead - (rootLead - trail * 0.55) * t);

  for (let i = 0; i <= span; i++) {
    const x = -hx + i;
    const t = i / span;                                  // 0 root → 1 tip
    const lead = leadAt(t);
    if (lead <= trail) break;
    const half = Math.max(0, Math.round(rootThick * (1 - 0.6 * t)));
    for (let y = trail; y <= lead; y++)
      for (let z = -half; z <= half; z++)
        m.add(x, y, z, C.marking);
  }

  // Darkened leading edge — the strip that meets the airflow.
  m.paintIf((v) => v.y >= leadAt((v.x + hx) / span) - 1, shade(C.marking, 0.6));

  // Root rib and mounting bracket, standing slightly proud of the plate.
  m.addBox(-hx, trail, -rootThick - 1, -hx + 1, rootLead, rootThick + 1, C.panel);
  m.addBox(-hx, trail + 1, -rootThick - 1, -hx + Math.round(span * 0.10),
    trail + Math.round(hy * 0.7), rootThick + 1, C.panelDark);
}

/**
 * Strut — the interstage truss that also serves as the decoupler. Four corner
 * posts with X-bracing between them, end flanges, and a warning band at the
 * separation plane, since this is the part that splits stages.
 */
function buildStrut(m: VoxelModel, def: PartDef): void {
  const { hx, hy, hz } = grid(def);
  const yBot = -hy;
  const yTop = hy;
  const post = Math.max(1, Math.round(hx * 0.34));

  // Corner posts.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const cx = sx * (hx - post);
      const cz = sz * (hz - post);
      m.addBox(cx - post, yBot, cz - post, cx + post, yTop, cz + post, C.panel);
    }

  // X-bracing on all four faces, in bays up the height.
  const bays = Math.max(2, Math.round((yTop - yBot) / (hx * 2.2)));
  const bayH = (yTop - yBot) / bays;
  for (let b = 0; b < bays; b++) {
    const y0 = Math.round(yBot + b * bayH);
    const y1 = Math.round(yBot + (b + 1) * bayH);
    for (const s of [-1, 1]) {
      // Faces normal to Z.
      m.addLine(-hx + post, y0, s * hz, hx - post, y1, s * hz, C.metalDark);
      m.addLine(-hx + post, y1, s * hz, hx - post, y0, s * hz, C.metalDark);
      // Faces normal to X.
      m.addLine(s * hx, y0, -hz + post, s * hx, y1, hz - post, C.metalDark);
      m.addLine(s * hx, y1, -hz + post, s * hx, y0, hz - post, C.metalDark);
    }
  }

  // End flanges.
  m.addHollowBox(-hx, yBot, -hz, hx, yBot + 1, hz, C.panelDark);
  m.addHollowBox(-hx, yTop - 1, -hz, hx, yTop, hz, C.panelDark);

  // Separation plane — the joint that fires when this stage is dropped.
  m.addHollowBox(-hx, -1, -hz, hx, 1, hz, C.marking);
}

/**
 * Stack Decoupler — a squat separation collar. Explosive bolts around the rim
 * and a hazard band, because this is the part that cuts the rocket in half and
 * the player needs to spot it in a stack at a glance.
 */
function buildDecoupler(m: VoxelModel, def: PartDef): void {
  const { hx, hy } = grid(def);
  const r = hx;

  // Main collar, waisted at the separation plane so the split line reads.
  m.addProfile(0, 0, -hy, hy, (t) => r * (1 - 0.12 * Math.sin(t * Math.PI)), C.panel);

  // Mating flanges top and bottom.
  m.addTube(0, 0, r, r - 2, hy - 1, hy, C.metalDark);
  m.addTube(0, 0, r, r - 2, -hy, -hy + 1, C.metalDark);

  // The separation plane itself.
  m.addTube(0, 0, r, r - 3, -1, 0, C.marking);

  // Explosive bolts spaced around the rim.
  const BOLTS = 8;
  for (let i = 0; i < BOLTS; i++) {
    const a = (i / BOLTS) * Math.PI * 2;
    const bx = Math.round(Math.cos(a) * (r - 1));
    const bz = Math.round(Math.sin(a) * (r - 1));
    m.addBox(bx - 1, -1, bz - 1, bx + 1, 1, bz + 1, C.charcoal);
  }
}

/** Anything without a dedicated model: a plain box in the catalog colour. */
function buildFallback(m: VoxelModel, def: PartDef): void {
  const { hx, hy, hz } = grid(def);
  m.addBox(-hx, -hy, -hz, hx, hy, hz, def.color);
}
