// src/ui/orbit-map.ts
import * as THREE from 'three';
import type { FlightController } from '../flight/flight-controller';

const TRAJECTORY_STEPS = 1500;
const TRAJECTORY_DT = 0.5;

/**
 * 3D orbital map view — player-centered.
 *
 * The camera follows the ship's position and orbits around it. The planet,
 * moon, and trajectory are drawn in world space. A ship marker (cyan dot)
 * marks the vessel, and Ap/Pe markers appear on the trajectory line itself.
 *
 * Left-drag rotates, wheel zooms, M closes.
 */
export class OrbitMap {
  visible = false;
  private overlay: HTMLElement;
  private apPeText: HTMLElement;
  private trajectoryLine: THREE.Line | null = null;
  private apMarker: THREE.Mesh | null = null;
  private peMarker: THREE.Mesh | null = null;
  private shipMarker: THREE.Mesh | null = null;

  // Map camera state (separate from flight camera).
  private mapAzimuth = Math.PI / 4;
  private mapPitch = Math.PI / 6;
  private mapDistance = 3000;
  private readonly minDistance = 200;
  private readonly maxDistance = 20000;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'map-overlay';
    Object.assign(this.overlay.style, {
      position: 'absolute',
      left: '12px',
      top: '12px',
      color: '#8fa',
      font: '12px monospace',
      background: 'rgba(0,0,10,0.7)',
      border: '1px solid #2a4',
      borderRadius: '4px',
      padding: '6px 10px',
      zIndex: '20',
      display: 'none',
      pointerEvents: 'none',
    } as Partial<CSSStyleDeclaration>);
    this.overlay.innerHTML = `
      <div id="map-title" style="color:#8fa;font-weight:bold;margin-bottom:4px">MAP — following ship</div>
      <div id="map-appe" style="color:#ffd700">Ap/Pe: —</div>
      <div id="map-help" style="color:#7a8aa5">drag rotate · wheel zoom · M close</div>
    `;
    document.body.appendChild(this.overlay);
    this.apPeText = this.overlay.querySelector('#map-appe')!;
  }

  /** Mouse handlers — attached only while the map is open to avoid stealing flight input. */
  private onDown: ((e: PointerEvent) => void) | null = null;
  private onMove: ((e: PointerEvent) => void) | null = null;
  private onUp: (() => void) | null = null;
  private onWheel: ((e: WheelEvent) => void) | null = null;
  private dom: HTMLElement | null = null;

  private attachControls(dom: HTMLElement): void {
    this.detachControls();
    this.dom = dom;
    this.onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    };
    this.onMove = (e: PointerEvent) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.mapAzimuth += dx * 0.005;
      this.mapPitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.mapPitch - dy * 0.005));
    };
    this.onUp = () => {
      this.dragging = false;
    };
    this.onWheel = (e: WheelEvent) => {
      const factor = e.deltaY < 0 ? 1 / 1.15 : 1.15;
      this.mapDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.mapDistance * factor));
      e.preventDefault();
    };
    dom.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private detachControls(): void {
    if (this.dom && this.onDown) this.dom.removeEventListener('pointerdown', this.onDown);
    if (this.onMove) window.removeEventListener('pointermove', this.onMove);
    if (this.onUp) window.removeEventListener('pointerup', this.onUp);
    if (this.dom && this.onWheel) this.dom.removeEventListener('wheel', this.onWheel);
    this.dom = null;
  }

  toggle(dom: HTMLElement, flight?: FlightController): void {
    this.visible = !this.visible;
    if (this.visible) {
      this.overlay.style.display = 'block';
      this.attachControls(dom);
      if (flight) {
        this.recomputeTrajectory(flight);
        this.createShipMarker();
        // Snap initial distance to something sensible based on ship altitude.
        const shipPos = flight.ship.rootBody.position;
        const alt = Math.hypot(shipPos.x, shipPos.y, shipPos.z);
        this.mapDistance = Math.max(800, Math.min(this.maxDistance, alt * 3));
      }
    } else {
      this.overlay.style.display = 'none';
      this.detachControls();
      this.clearAll();
    }
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.overlay.style.display = 'none';
    this.detachControls();
    this.clearAll();
  }

  /** Recompute trajectory + position the camera. Called each frame while open. */
  draw(flight: FlightController): void {
    if (!this.visible) return;
    this.recomputeTrajectory(flight);
    this.updateOverlay(flight);

    // Camera orbits the SHIP position (not system origin).
    const sp = flight.ship.rootBody.position;
    const x = sp.x + Math.cos(this.mapPitch) * Math.cos(this.mapAzimuth) * this.mapDistance;
    const y = sp.y + Math.sin(this.mapPitch) * this.mapDistance;
    const z = sp.z + Math.cos(this.mapPitch) * Math.sin(this.mapAzimuth) * this.mapDistance;
    this.camera.up.set(0, 1, 0);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(sp.x, sp.y, sp.z);

    // Update ship marker position.
    if (this.shipMarker) {
      this.shipMarker.position.set(sp.x, sp.y, sp.z);
    }
  }

  private recomputeTrajectory(flight: FlightController): void {
    const root = flight.ship.rootBody;
    const dom = flight.dominantBodyFor(root.position);
    const mu = dom.mu;
    const bx = dom.position.x;
    const by = dom.position.y;
    const bz = dom.position.z;
    let px = root.position.x;
    let py = root.position.y;
    let pz = root.position.z;
    let vx = root.velocity.x;
    let vy = root.velocity.y;
    let vz = root.velocity.z;

    const pts: THREE.Vector3[] = [];
    // Track apoapsis / periapsis positions for markers.
    let apR = -Infinity;
    let peR = Infinity;
    let apX = 0, apY = 0, apZ = 0;
    let peX = 0, peY = 0, peZ = 0;

    for (let i = 0; i < TRAJECTORY_STEPS; i++) {
      const rx = px - bx;
      const ry = py - by;
      const rz = pz - bz;
      const r2 = rx * rx + ry * ry + rz * rz;
      const r = Math.sqrt(r2);
      if (r < dom.data.radius) break;

      // Track Ap (max r) and Pe (min r) positions.
      if (r > apR) { apR = r; apX = px; apY = py; apZ = pz; }
      if (r < peR) { peR = r; peX = px; peY = py; peZ = pz; }

      pts.push(new THREE.Vector3(px, py, pz));
      const a = -mu / (r2 * r);
      vx += a * rx * TRAJECTORY_DT;
      vy += a * ry * TRAJECTORY_DT;
      vz += a * rz * TRAJECTORY_DT;
      px += vx * TRAJECTORY_DT;
      py += vy * TRAJECTORY_DT;
      pz += vz * TRAJECTORY_DT;
    }

    this.clearTrajectory();
    if (pts.length < 2) return;

    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x33ff66, transparent: true, opacity: 0.7 });
    this.trajectoryLine = new THREE.Line(geom, mat);
    this.scene.add(this.trajectoryLine);

    // Place Ap/Pe markers on the trajectory line.
    this.placeMarker(this.apMarker, apX, apY, apZ, 0xff4444, 60);
    this.apMarker = this.lastCreatedMarker;
    this.placeMarker(this.peMarker, peX, peY, peZ, 0x4444ff, 60);
    this.peMarker = this.lastCreatedMarker;
  }

  private lastCreatedMarker: THREE.Mesh | null = null;

  private placeMarker(existing: THREE.Mesh | null, x: number, y: number, z: number, color: number, size: number): void {
    // Remove existing if present — we recreate each frame.
    if (existing) {
      this.scene.remove(existing);
      existing.geometry.dispose();
      (existing.material as THREE.Material).dispose();
    }
    const geom = new THREE.SphereGeometry(size, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.lastCreatedMarker = mesh;
  }

  private createShipMarker(): void {
    if (this.shipMarker) return;
    const geom = new THREE.SphereGeometry(30, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x44ddff });
    this.shipMarker = new THREE.Mesh(geom, mat);
    this.scene.add(this.shipMarker);
  }

  private clearTrajectory(): void {
    if (this.trajectoryLine) {
      this.scene.remove(this.trajectoryLine);
      this.trajectoryLine.geometry.dispose();
      (this.trajectoryLine.material as THREE.Material).dispose();
      this.trajectoryLine = null;
    }
    if (this.apMarker) {
      this.scene.remove(this.apMarker);
      this.apMarker.geometry.dispose();
      (this.apMarker.material as THREE.Material).dispose();
      this.apMarker = null;
    }
    if (this.peMarker) {
      this.scene.remove(this.peMarker);
      this.peMarker.geometry.dispose();
      (this.peMarker.material as THREE.Material).dispose();
      this.peMarker = null;
    }
  }

  private clearAll(): void {
    this.clearTrajectory();
    if (this.shipMarker) {
      this.scene.remove(this.shipMarker);
      this.shipMarker.geometry.dispose();
      (this.shipMarker.material as THREE.Material).dispose();
      this.shipMarker = null;
    }
  }

  private updateOverlay(flight: FlightController): void {
    const root = flight.ship.rootBody;
    // Use the dominant body so Ap/Pe is correct when in Luna's SOI.
    const dom = flight.dominantBodyFor(root.position);
    const dx = root.position.x - dom.position.x;
    const dy = root.position.y - dom.position.y;
    const dz = root.position.z - dom.position.z;
    const r = Math.hypot(dx, dy, dz);
    const v = Math.hypot(root.velocity.x, root.velocity.y, root.velocity.z);
    const mu = dom.mu;
    const energy = (v * v) / 2 - mu / r;
    let apPe = 'escape';
    if (energy < 0) {
      // eccentricity from state vectors
      const rvDot = dx * root.velocity.x + dy * root.velocity.y + dz * root.velocity.z;
      const v2 = v * v;
      const kx = (v2 - mu / r) * dx - rvDot * root.velocity.x;
      const ky = (v2 - mu / r) * dy - rvDot * root.velocity.y;
      const kz = (v2 - mu / r) * dz - rvDot * root.velocity.z;
      const ecc = Math.hypot(kx, ky, kz) / mu;
      const a = -mu / (2 * energy);
      const ap = a * (1 + ecc) - dom.data.radius;
      const pe = a * (1 - ecc) - dom.data.radius;
      apPe = `Ap ${ap.toFixed(0)} m / Pe ${pe.toFixed(0)} m (${dom.data.name})`;
    } else {
      apPe = `Escape trajectory (${dom.data.name})`;
    }
    this.apPeText.textContent = apPe;
  }
}
