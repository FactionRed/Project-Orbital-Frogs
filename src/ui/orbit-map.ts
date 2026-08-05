// src/ui/orbit-map.ts
import * as THREE from 'three';
import type { FlightController } from '../flight/flight-controller';
import { Panel, Readout } from './components';

const TRAJECTORY_STEPS = 2100;
const TRAJECTORY_DT = 0.5;

/**
 * Apsis marker colors. These must stay in step with the --map-ap / --map-pe
 * tokens, which color the on-screen legend — the legend is a lie otherwise.
 * The 3D scene carries no theme, so these are fixed rather than per-theme.
 */
const MARKER_COLORS = { ap: 0xff5a5a, pe: 0x5ad1ff, ship: 0x44ddff } as const;

/** Body name labels drawn in the 3D map. */
const LABEL_COLOR = '#d8e4d0';
const LABEL_CANVAS = { w: 256, h: 64 } as const;

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
  private apReadout: Readout;
  private peReadout: Readout;
  private bodyReadout: Readout;
  /** TERRA / LUNA name plates, added with the map and disposed with it. */
  private bodyLabels: THREE.Sprite[] = [];
  // Persistent objects — created once, updated in-place each frame (no per-frame
  // create/dispose cycle which caused flicker during zoom).
  private trajectoryLine: THREE.Line | null = null;
  private trajectoryGeom: THREE.BufferGeometry | null = null;
  private apMarker: THREE.Mesh | null = null;
  private peMarker: THREE.Mesh | null = null;
  private shipMarker: THREE.Mesh | null = null;

  // Map camera state (separate from flight camera).
  private mapAzimuth = Math.PI / 4;
  private mapPitch = Math.PI / 6;
  private mapDistance = 30000;
  private readonly minDistance = 2000;
  private readonly maxDistance = 200000;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    const panel = new Panel('ORBITAL TRACK');
    this.overlay = panel.el;
    this.overlay.id = 'map-overlay';
    this.overlay.style.display = 'none';
    this.overlay.setAttribute('role', 'region');
    this.overlay.setAttribute('aria-label', 'Orbital track');

    this.apReadout = new Readout('Ap', 'm');
    this.peReadout = new Readout('Pe', 'm');
    this.bodyReadout = new Readout('BODY');
    this.bodyReadout.el.classList.add('readout--compact');

    const legend = document.createElement('div');
    legend.className = 'ap-pe-legend';
    for (const [cls, text] of [['legend-ap', 'Ap'], ['legend-pe', 'Pe']] as const) {
      const item = document.createElement('span');
      item.className = cls;
      item.textContent = `● ${text}`;
      legend.appendChild(item);
    }

    const help = document.createElement('div');
    help.className = 'orbit-help';
    help.textContent = 'drag rotate · wheel zoom · M close';

    this.overlay.append(this.apReadout.el, this.peReadout.el, this.bodyReadout.el, legend, help);
    document.body.appendChild(this.overlay);
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
      this.overlay.style.display = 'flex'; // column stack, see orbit-map.css
      this.attachControls(dom);
      if (flight) {
        this.recomputeTrajectory(flight);
        this.createShipMarker();
        this.createBodyLabels(flight);
        // Snap initial distance to something sensible based on ship altitude.
        const shipPos = flight.ship.rootBody.position;
        const alt = Math.hypot(shipPos.x, shipPos.y, shipPos.z);
        this.mapDistance = Math.max(5000, Math.min(this.maxDistance, alt * 3));
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

    // Bodies move (the moon orbits), so re-seat their labels each frame.
    this.updateBodyLabels(flight);

    // Scale markers smoothly based on current zoom (no recreate flicker).
    this.updateMarkerScales();
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

    // Reuse a flat array to avoid per-frame allocation.
    const pts: number[] = [];
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

      if (r > apR) { apR = r; apX = px; apY = py; apZ = pz; }
      if (r < peR) { peR = r; peX = px; peY = py; peZ = pz; }

      pts.push(px, py, pz);
      const a = -mu / (r2 * r);
      vx += a * rx * TRAJECTORY_DT;
      vy += a * ry * TRAJECTORY_DT;
      vz += a * rz * TRAJECTORY_DT;
      px += vx * TRAJECTORY_DT;
      py += vy * TRAJECTORY_DT;
      pz += vz * TRAJECTORY_DT;
    }

    if (pts.length < 6) return;

    // Update existing geometry in-place (no dispose/recreate).
    const positions = new Float32Array(pts);
    if (!this.trajectoryGeom) {
      this.trajectoryGeom = new THREE.BufferGeometry();
      this.trajectoryGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({ color: 0x33ff66, transparent: true, opacity: 0.7 });
      this.trajectoryLine = new THREE.Line(this.trajectoryGeom, mat);
      this.scene.add(this.trajectoryLine);
    } else {
      this.trajectoryGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      this.trajectoryGeom.computeBoundingSphere();
    }

    // Update marker positions and scales in-place.
    this.ensureMarker(this.apMarker, MARKER_COLORS.ap);
    if (this.lastCreatedMarker) this.apMarker = this.lastCreatedMarker;
    if (this.apMarker) this.apMarker.position.set(apX, apY, apZ);

    this.ensureMarker(this.peMarker, MARKER_COLORS.pe);
    if (this.lastCreatedMarker) this.peMarker = this.lastCreatedMarker;
    if (this.peMarker) this.peMarker.position.set(peX, peY, peZ);
  }

  private lastCreatedMarker: THREE.Mesh | null = null;

  /** Create marker if it doesn't exist; do nothing if it already does. */
  private ensureMarker(existing: THREE.Mesh | null, color: number): void {
    if (existing) {
      this.lastCreatedMarker = null;
      return;
    }
    const geom = new THREE.SphereGeometry(1, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geom, mat);
    this.scene.add(mesh);
    this.lastCreatedMarker = mesh;
  }

  /** Update marker scales based on current zoom distance (in-place, no recreate). */
  private updateMarkerScales(): void {
    const markerSize = Math.max(30, this.mapDistance * 0.008);
    const shipSize = Math.max(20, this.mapDistance * 0.005);
    if (this.apMarker) this.apMarker.scale.setScalar(markerSize);
    if (this.peMarker) this.peMarker.scale.setScalar(markerSize);
    if (this.shipMarker) this.shipMarker.scale.setScalar(shipSize);
  }

  private createShipMarker(): void {
    if (this.shipMarker) {
      this.scene.remove(this.shipMarker);
      this.shipMarker.geometry.dispose();
      (this.shipMarker.material as THREE.Material).dispose();
    }
    const geom = new THREE.SphereGeometry(1, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: MARKER_COLORS.ship });
    this.shipMarker = new THREE.Mesh(geom, mat);
    this.scene.add(this.shipMarker);
  }

  /** Name plates for Terra and Luna, so the two grey spheres are tellable apart. */
  private createBodyLabels(flight: FlightController): void {
    this.clearBodyLabels();
    for (const body of [flight.planet, flight.moon]) {
      const sprite = makeLabelSprite(body.data.name.toUpperCase());
      sprite.userData.bodyRadius = body.data.radius;
      this.scene.add(sprite);
      this.bodyLabels.push(sprite);
    }
    this.updateBodyLabels(flight);
  }

  /** Re-seat each label above its body and keep it legible at any zoom. */
  private updateBodyLabels(flight: FlightController): void {
    if (this.bodyLabels.length === 0) return;
    const bodies = [flight.planet, flight.moon];
    // Screen-stable size: labels scale with view distance, like the markers.
    const width = Math.max(600, this.mapDistance * 0.06);
    const height = width * (LABEL_CANVAS.h / LABEL_CANVAS.w);
    for (let i = 0; i < this.bodyLabels.length && i < bodies.length; i++) {
      const label = this.bodyLabels[i];
      const b = bodies[i];
      label.position.set(b.position.x, b.position.y + b.data.radius * 1.15 + height, b.position.z);
      label.scale.set(width, height, 1);
    }
  }

  private clearBodyLabels(): void {
    for (const label of this.bodyLabels) {
      this.scene.remove(label);
      const mat = label.material as THREE.SpriteMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
    this.bodyLabels = [];
  }

  private clearTrajectory(): void {
    if (this.trajectoryLine) {
      this.scene.remove(this.trajectoryLine);
      this.trajectoryLine.geometry.dispose();
      (this.trajectoryLine.material as THREE.Material).dispose();
      this.trajectoryLine = null;
    }
    this.trajectoryGeom = null;
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
    this.clearBodyLabels();
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
    this.bodyReadout.setValue(dom.data.name.toUpperCase());
    if (energy < 0) {
      // eccentricity from state vectors
      const rvDot = dx * root.velocity.x + dy * root.velocity.y + dz * root.velocity.z;
      const v2 = v * v;
      const kx = (v2 - mu / r) * dx - rvDot * root.velocity.x;
      const ky = (v2 - mu / r) * dy - rvDot * root.velocity.y;
      const kz = (v2 - mu / r) * dz - rvDot * root.velocity.z;
      const ecc = Math.hypot(kx, ky, kz) / mu;
      const a = -mu / (2 * energy);
      this.apReadout.setValue((a * (1 + ecc) - dom.data.radius).toFixed(0));
      this.peReadout.setValue((a * (1 - ecc) - dom.data.radius).toFixed(0));
      this.apReadout.setState('nominal');
      this.peReadout.setState('nominal');
    } else {
      this.apReadout.setValue('ESC');
      this.peReadout.setValue('ESC');
      this.apReadout.setState('caution');
      this.peReadout.setState('caution');
    }
  }
}

/** Text plate drawn on a canvas texture. Cheap, and readable at any zoom. */
function makeLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = LABEL_CANVAS.w;
  canvas.height = LABEL_CANVAS.h;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `32px 'IBM Plex Mono', monospace`;
  ctx.fillStyle = LABEL_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, LABEL_CANVAS.w / 2, LABEL_CANVAS.h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  return new THREE.Sprite(mat);
}
