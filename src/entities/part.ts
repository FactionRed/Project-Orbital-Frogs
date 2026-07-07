// src/entities/part.ts
import * as THREE from 'three';

export type PartKind = 'pod' | 'tank' | 'engine' | 'winglet' | 'strut' | 'thermometer' | 'barometer' | 'gravity_scanner';

/**
 * An attachment hardpoint on a part. Parts snap together when two nodes with
 * opposing direction vectors are brought close together.
 *
 * `pos` is in local space, relative to the part center, using the same units as
 * `PartDef.size` (half-extents). `dir` is the outward-pointing normal of the
 * node — the direction a child part extends away from this node.
 *
 * Modeled on KSP's `node_stack_top` / `node_stack_bottom` / `node_attach`:
 *   node_stack_top    = pos [0, +h, 0], dir [0, +1, 0]
 *   node_stack_bottom = pos [0, -h, 0], dir [0, -1, 0]
 *   node_attach       = pos on surface, dir = surface normal
 */
export interface AttachNode {
  /** Local-space position relative to part center (same units as size half-extents). */
  pos: [number, number, number];
  /** Outward direction (normal) of the node — child extends this way. */
  dir: [number, number, number];
}

export interface PartDef {
  id: string;
  name: string;
  kind: PartKind;
  dryMass: number; // tonnes
  fuel?: number; // units (tanks only)
  thrust?: number; // kN (engines only)
  /** Short user-facing description of what this part does. */
  desc: string;
  /** Half-extents of the part's bounding box, used for mesh + collision. */
  size: [number, number, number];
  color: number;
  /**
   * Attachment hardpoints. When dragging a part in the VAB, it snaps to the
   * nearest opposing node pair (ghost node dir · target node dir < 0).
   * Parts with no nodes use surface-attach only (raycast hit normal).
   */
  attachNodes?: AttachNode[];
}

/** A placed part within a ship design (local-space transform within the VAB). */
export interface PlacedPart {
  uid: string; // unique within a design
  partId: string; // references PartDef.id
  position: THREE.Vector3; // local position relative to design origin
  rotation: THREE.Euler; // local rotation
  attachParentUid?: string; // uid of the part this is welded to
  /** Index of the parent's node this part is attached to (for occupancy tracking). */
  attachParentNodeIndex?: number;
}
