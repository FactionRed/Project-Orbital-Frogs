// src/building/vab-controller.ts
import * as THREE from 'three';
import type { ShipDesign } from '../entities/ship';
import type { PlacedPart, PartDef } from '../entities/part';
import { getPartDef } from '../entities/parts-catalog';
import { canLaunch } from '../entities/ship';
import type { VabCamera } from './vab-camera';

import { buildPartMesh } from '../rendering/part-models';

/** Snap distance threshold — ghost must be within this many world units of a node. */
const NODE_SNAP_RANGE = 2.5;

export class VabController {
  readonly group = new THREE.Group();
  design: ShipDesign = { parts: [], rootPartUid: '' };

  private meshes = new Map<string, THREE.Mesh>(); // uid -> mesh
  private selectedPartId: string | null = null; // catalog partId being placed
  private selectedUid: string | null = null; // placed uid currently selected
  private ghost: THREE.Mesh | null = null;

  /** Visual markers for available attachment nodes (shown while dragging). */
  private nodeMarkers: THREE.Mesh[] = [];
  private nodeMarkerGroup = new THREE.Group();

  private uidCounter = 0;

  constructor(scene: THREE.Scene, private camera: VabCamera) {
    scene.add(this.group);
    this.group.add(this.nodeMarkerGroup);
  }

  /** True when a part is currently being dragged from the palette (ghost shown). */
  isPlacing(): boolean {
    return this.ghost !== null;
  }

  /** Begin placing a part from the palette. */
  beginPlace(partId: string): void {
    this.cancelPlace();
    this.selectedPartId = partId;
    const def = getPartDef(partId);
    this.ghost = this.makeMesh(def, true);
    this.group.add(this.ghost);
    this.updateNodeMarkers();
  }

  cancelPlace(): void {
    if (this.ghost) {
      this.group.remove(this.ghost);
      this.ghost = null;
    }
    this.selectedPartId = null;
    this.clearNodeMarkers();
  }

  /**
   * Drag the ghost to follow the pointer. Snapping priority:
   * 1. Node-to-node snap (if ghost has nodes and a placed part has an opposing node within range)
   * 2. Surface attach (raycast against placed parts — winglets, or parts with no nodes)
   * 3. Ground plane (Y=0, default for first part)
   */
  onPointerMove(ndc: THREE.Vector2): void {
    if (!this.ghost) return;
    const def = getPartDef(this.selectedPartId!);

    // 1. Try node-based snapping first.
    const nodeSnap = this.findNearestNodeSnap(ndc, def);
    if (nodeSnap) {
      this.ghost.position.copy(nodeSnap.position);
      this.ghost.rotation.copy(nodeSnap.rotation);
      this.setGhostColor(true);
      return;
    }

    // 2. Surface attach — raycast against existing parts.
    const meshes = [...this.meshes.values()];
    const snap = this.camera.pickSurface(meshes, ndc);
    if (snap) {
      // Offset outward by the ghost's half-extent along the hit normal.
      const half = Math.abs(snap.normal.x * def.size[0]) + Math.abs(snap.normal.y * def.size[1]) + Math.abs(snap.normal.z * def.size[2]);
      this.ghost.position.copy(snap.point).addScaledVector(snap.normal, half);
      // Surface-attach: don't change rotation (let the player rotate manually).
      this.setGhostColor(true);
      return;
    }

    // 3. Ground plane fallback.
    const pt = this.camera.pointerOnGround(ndc);
    if (pt) {
      this.ghost.position.set(pt.x, def.size[1], pt.z);
      this.ghost.rotation.set(0, 0, 0);
      this.setGhostColor(false);
    }
  }

  /**
   * Find the nearest opposing node pair between the ghost's nodes and all
   * placed parts' nodes. Returns the ghost position+rotation that aligns the
   * ghost's node with the target's node (facing opposite directions), or null.
   */
  private findNearestNodeSnap(
    ndc: THREE.Vector2,
    ghostDef: PartDef,
  ): { position: THREE.Vector3; rotation: THREE.Euler; targetUid: string; targetNodeIndex: number } | null {
    if (!ghostDef.attachNodes || ghostDef.attachNodes.length === 0) return null;

    // Raycast to get approximate pointer position in world space.
    const meshes = [...this.meshes.values()];
    const surfaceHit = this.camera.pickSurface(meshes, ndc);
    if (!surfaceHit) return null;

    const pointerWorld = surfaceHit.point;
    let bestDist = NODE_SNAP_RANGE;
    let bestResult: { position: THREE.Vector3; rotation: THREE.Euler; targetUid: string; targetNodeIndex: number } | null = null;

    for (const [uid] of this.meshes) {
      const placed = this.design.parts.find((p) => p.uid === uid);
      if (!placed) continue;
      const targetDef = getPartDef(placed.partId);
      if (!targetDef.attachNodes) continue;

      for (let ni = 0; ni < targetDef.attachNodes.length; ni++) {
        // Skip occupied nodes.
        if (this.isNodeOccupied(uid, ni)) continue;

        const tNode = targetDef.attachNodes[ni];

        // Target node position in world space.
        const tNodePos = new THREE.Vector3(...tNode.pos);
        tNodePos.applyEuler(placed.rotation);
        tNodePos.add(placed.position);

        // Target node direction in world space.
        const tNodeDir = new THREE.Vector3(...tNode.dir);
        tNodeDir.applyEuler(placed.rotation).normalize();

        for (const gNode of ghostDef.attachNodes) {
          const gNodeDir = new THREE.Vector3(...gNode.dir);

          // Nodes must face opposite directions (dot < 0) to connect.
          const dot = gNodeDir.dot(tNodeDir);
          if (dot >= -0.1) continue; // not opposing enough

          // Distance from pointer to the target node position.
          const dist = pointerWorld.distanceTo(tNodePos);
          if (dist >= bestDist) continue;

          // Compute ghost position: ghost node coincides with target node.
          // ghostPos = tNodePos - gNodePos (rotated to align directions).
          // We need to find a rotation that makes gNodeDir point opposite to tNodeDir.
          const alignQuat = new THREE.Quaternion().setFromUnitVectors(
            gNodeDir,
            tNodeDir.clone().negate(),
          );
          const alignEuler = new THREE.Euler().setFromQuaternion(alignQuat);

          // Ghost node position in world space after rotation.
          const gNodePosRotated = new THREE.Vector3(...gNode.pos);
          gNodePosRotated.applyEuler(alignEuler);

          const ghostPos = tNodePos.clone().sub(gNodePosRotated);

          bestDist = dist;
          bestResult = {
            position: ghostPos,
            rotation: alignEuler,
            targetUid: uid,
            targetNodeIndex: ni,
          };
        }
      }
    }

    return bestResult;
  }

  /** Check if a node on a placed part is already occupied by a child. */
  private isNodeOccupied(uid: string, nodeIndex: number): boolean {
    return this.design.parts.some(
      (p) => p.attachParentUid === uid && p.attachParentNodeIndex === nodeIndex,
    );
  }

  /** Tint the ghost green (snapping) or blue (free-floating) for visual feedback. */
  private setGhostColor(snapping: boolean): void {
    if (!this.ghost) return;
    const mat = this.ghost.material as THREE.MeshStandardMaterial;
    if (mat.emissive) {
      mat.emissive.setHex(snapping ? 0x004400 : 0x001133);
    }
  }

  /**
   * Render small sphere markers on available (unoccupied) attachment nodes of
   * placed parts that could accept the ghost part. Green = compatible (opposing
   * direction), grey = incompatible.
   */
  private updateNodeMarkers(): void {
    this.clearNodeMarkers();
    if (!this.ghost || !this.selectedPartId) return;
    const ghostDef = getPartDef(this.selectedPartId);
    if (!ghostDef.attachNodes) return;

    const markerGeom = new THREE.SphereGeometry(0.15, 8, 6);
    const greenMat = new THREE.MeshBasicMaterial({ color: 0x00ff44 });
    const greyMat = new THREE.MeshBasicMaterial({ color: 0x446644 });

    for (const [uid] of this.meshes) {
      const placed = this.design.parts.find((p) => p.uid === uid);
      if (!placed) continue;
      const targetDef = getPartDef(placed.partId);
      if (!targetDef.attachNodes) continue;

      for (let ni = 0; ni < targetDef.attachNodes.length; ni++) {
        if (this.isNodeOccupied(uid, ni)) continue;

        const tNode = targetDef.attachNodes[ni];
        const worldPos = new THREE.Vector3(...tNode.pos);
        worldPos.applyEuler(placed.rotation).add(placed.position);

        const tNodeDir = new THREE.Vector3(...tNode.dir);
        tNodeDir.applyEuler(placed.rotation).normalize();

        // Check if any ghost node opposes this target node.
        let compatible = false;
        if (ghostDef.attachNodes) {
          for (const gNode of ghostDef.attachNodes) {
            const gDir = new THREE.Vector3(...gNode.dir);
            if (gDir.dot(tNodeDir) < -0.1) {
              compatible = true;
              break;
            }
          }
        }

        const marker = new THREE.Mesh(markerGeom, compatible ? greenMat : greyMat);
        marker.position.copy(worldPos);
        this.nodeMarkers.push(marker);
        this.nodeMarkerGroup.add(marker);
      }
    }
  }

  private clearNodeMarkers(): void {
    for (const m of this.nodeMarkers) this.nodeMarkerGroup.remove(m);
    this.nodeMarkers = [];
  }

  /** Drop the ghost, attaching it to the snapped parent (or free-floating). */
  onPointerUp(ndc: THREE.Vector2): void {
    if (!this.ghost || !this.selectedPartId) return;
    // Re-run snap to get a fresh target.
    const def = getPartDef(this.selectedPartId);
    const nodeSnap = this.findNearestNodeSnap(ndc, def);
    let parentUid: string | undefined;
    let parentNodeIndex: number | undefined;

    if (nodeSnap) {
      this.ghost.position.copy(nodeSnap.position);
      this.ghost.rotation.copy(nodeSnap.rotation);
      parentUid = nodeSnap.targetUid;
      parentNodeIndex = nodeSnap.targetNodeIndex;
    } else {
      const meshes = [...this.meshes.values()];
      const snap = this.camera.pickSurface(meshes, ndc);
      if (snap) {
        const half = Math.abs(snap.normal.x * def.size[0]) + Math.abs(snap.normal.y * def.size[1]) + Math.abs(snap.normal.z * def.size[2]);
        this.ghost.position.copy(snap.point).addScaledVector(snap.normal, half);
        parentUid = (snap.object.userData.uid as string) ?? undefined;
      }
    }

    const uid = `u${this.uidCounter++}`;
    const placed: PlacedPart = {
      uid,
      partId: this.selectedPartId,
      position: this.ghost.position.clone(),
      rotation: this.ghost.rotation.clone(),
      attachParentUid: parentUid,
      attachParentNodeIndex: parentNodeIndex,
    };
    this.design.parts.push(placed);
    if (!this.design.rootPartUid && getPartDef(placed.partId).kind === 'pod') {
      this.design.rootPartUid = uid;
    }
    const mesh = this.makeMesh(getPartDef(placed.partId), false);
    mesh.position.copy(placed.position);
    mesh.rotation.copy(placed.rotation);
    mesh.userData.uid = uid;
    this.meshes.set(uid, mesh);
    this.group.add(mesh);

    this.cancelPlace();
  }

  /** Select an existing placed part for rotate/delete. */
  selectAt(ndc: THREE.Vector2): void {
    const hit = this.pickPartUnder(ndc);
    this.selectedUid = hit;
    for (const [uid, m] of this.meshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.emissive) mat.emissive.setHex(uid === hit ? 0x333300 : 0x000000);
    }
  }

  rotateSelected(deg: number): void {
    if (!this.selectedUid) return;
    const mesh = this.meshes.get(this.selectedUid)!;
    mesh.rotation.y += (deg * Math.PI) / 180;
    const placed = this.design.parts.find((p) => p.uid === this.selectedUid)!;
    placed.rotation.copy(mesh.rotation);
  }

  deleteSelected(): void {
    if (!this.selectedUid) return;
    const uid = this.selectedUid;
    // Re-parent orphaned children before removing the part.
    const parentOfDeleted = this.design.parts.find((p) => p.uid === uid)?.attachParentUid;
    for (const p of this.design.parts) {
      if (p.attachParentUid === uid) {
        p.attachParentUid = parentOfDeleted;
        p.attachParentNodeIndex = undefined; // orphaned — no specific node
      }
    }
    const mesh = this.meshes.get(uid);
    if (mesh) {
      this.group.remove(mesh);
      this.meshes.delete(uid);
    }
    this.design.parts = this.design.parts.filter((p) => p.uid !== uid);
    if (this.design.rootPartUid === uid) {
      const pod = this.design.parts.find((p) => getPartDef(p.partId).kind === 'pod');
      this.design.rootPartUid = pod?.uid ?? '';
    }
    this.selectedUid = null;
  }

  isReady(): boolean {
    return canLaunch(this.design);
  }

  clear(): void {
    for (const m of this.meshes.values()) this.group.remove(m);
    this.meshes.clear();
    this.design = { parts: [], rootPartUid: '' };
    this.cancelPlace();
  }

  private pickPartUnder(ndc: THREE.Vector2): string | null {
    const meshes = [...this.meshes.values()];
    const hit = this.camera.pick(meshes, ndc);
    return hit?.object.userData.uid ?? null;
  }

  private makeMesh(def: PartDef, ghost: boolean): THREE.Mesh {
    const mesh = buildPartMesh(def, ghost);
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.emissive = new THREE.Color(0x000000);
    return mesh;
  }
}
