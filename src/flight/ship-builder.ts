// src/flight/ship-builder.ts
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import type { ShipDesign } from '../entities/ship';
import { getPartDef } from '../entities/parts-catalog';
import { COLLISION_GROUP, SHIP_COLLISION_MASK } from '../physics/collision-groups';

export interface BodyMeta {
  uid: string;
  partId: string;
  mesh: THREE.Mesh;
}

export interface BuiltShip {
  group: THREE.Group; // all part meshes
  bodies: CANNON.Body[]; // one per part
  constraints: CANNON.Constraint[]; // LockConstraints welding parts to parents
  fuel: number; // shared fuel pool
  rootBody: CANNON.Body; // pod's body — control reference
  engineBodies: CANNON.Body[]; // bodies with engines (thrust applied here)
  /** Per-body metadata (uid, partId, mesh). cannon Body has no userData field. */
  meta: Map<CANNON.Body, BodyMeta>;
}

export function buildShipPhysics(design: ShipDesign): BuiltShip {
  const group = new THREE.Group();
  const bodies: CANNON.Body[] = [];
  const constraints: CANNON.Constraint[] = [];
  const meta = new Map<CANNON.Body, BodyMeta>();
  let fuel = 0;
  const engineBodies: CANNON.Body[] = [];
  let rootBody: CANNON.Body | null = null;

  const bodyByUid = new Map<string, CANNON.Body>();
  const tmpQuat = new THREE.Quaternion();

  for (const placed of design.parts) {
    const def = getPartDef(placed.partId);
    const shape = new CANNON.Box(new CANNON.Vec3(def.size[0], def.size[1], def.size[2]));
    const body = new CANNON.Body({
      mass: def.dryMass,
      shape,
      // Ship parts collide with the planet/moon but NOT with each other — welded
      // parts would otherwise push each other apart and tear the ship apart on spawn.
      collisionFilterGroup: COLLISION_GROUP.SHIP,
      collisionFilterMask: SHIP_COLLISION_MASK,
    });
    body.position.set(placed.position.x, placed.position.y, placed.position.z);
    // Euler → quaternion (use the same Euler order THREE defaults to, XYZ).
    tmpQuat.setFromEuler(placed.rotation);
    body.quaternion.set(tmpQuat.x, tmpQuat.y, tmpQuat.z, tmpQuat.w);
    // Light damping keeps the welded stack stable instead of accumulating jitter.
    body.linearDamping = 0.05;
    body.angularDamping = 0.05;
    bodyByUid.set(placed.uid, body);
    bodies.push(body);

    if (def.fuel) fuel += def.fuel;
    if (def.kind === 'pod') rootBody = body;
    if (def.kind === 'engine') engineBodies.push(body);

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(def.size[0] * 2, def.size[1] * 2, def.size[2] * 2),
      new THREE.MeshStandardMaterial({ color: def.color }),
    );
    mesh.position.copy(placed.position);
    mesh.rotation.copy(placed.rotation);
    group.add(mesh);
    meta.set(body, { uid: placed.uid, partId: placed.partId, mesh });
  }

  // Weld parts to their attach parents with LockConstraint.
  for (const placed of design.parts) {
    if (!placed.attachParentUid) continue;
    const child = bodyByUid.get(placed.uid)!;
    const parent = bodyByUid.get(placed.attachParentUid);
    if (parent) {
      constraints.push(new CANNON.LockConstraint(parent, child));
    }
  }

  return { group, bodies, constraints, fuel, rootBody: rootBody!, engineBodies, meta };
}
