// src/ui/navball.ts
import * as THREE from 'three';
import type { FlightController } from '../flight/flight-controller';

/**
 * KSP-style navball HUD instrument.
 *
 * Uses a quaternion-based approach to avoid Euler angle gimbal lock.
 * The ball's orientation is computed as a single quaternion transform
 * from the local reference frame (up/north/east) to the ship's frame.
 * Markers are projected by transforming world directions into the
 * ship's local frame and reading off the x/y components.
 *
 * Rendered on a fixed 160px canvas anchored bottom-center of the screen.
 */
export class NavBall {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private readonly size = 160;
  // Stored previous orientation state for smoothing/degenerate fallback.
  private hasPrev = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'navball';
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    Object.assign(this.canvas.style, {
      position: 'absolute',
      left: '50%',
      bottom: '12px',
      transform: 'translateX(-50%)',
      background: 'rgba(0,0,10,0.6)',
      border: '2px solid #445',
      borderRadius: '50%',
      zIndex: '15',
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  show(): void { this.canvas.style.display = 'block'; }
  hide(): void { this.canvas.style.display = 'none'; }

  update(flight: FlightController): void {
    const ctx = this.ctx;
    const s = this.size;
    const cx = s / 2;
    const cy = s / 2;
    const R = s / 2 - 2;
    ctx.clearRect(0, 0, s, s);

    const root = flight.ship.rootBody;
    const domBody = flight.dominantBodyFor(root.position);
    const bodyCenter = domBody.position;

    // Local reference frame at the ship:
    //   up    = unit(ship - bodyCenter)  (radial out)
    //   north = project world-up onto plane perp to up
    //   east  = up × north
    const up3 = new THREE.Vector3(
      root.position.x - bodyCenter.x,
      root.position.y - bodyCenter.y,
      root.position.z - bodyCenter.z,
    ).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    let east = new THREE.Vector3().crossVectors(up3, worldUp);
    if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
    east.normalize();
    const north = new THREE.Vector3().crossVectors(east, up3).normalize();

    // Ship orientation quaternion (cannon → three).
    const qShip = new THREE.Quaternion(
      root.quaternion.x, root.quaternion.y,
      root.quaternion.z, root.quaternion.w,
    );

    // Ship's local axes in world space.
    const nose = new THREE.Vector3(0, 1, 0).applyQuaternion(qShip).normalize();
    const shipRight = new THREE.Vector3(1, 0, 0).applyQuaternion(qShip).normalize();
    const shipForward = new THREE.Vector3(0, 0, 1).applyQuaternion(qShip).normalize();

    // The navball is viewed from behind the ship. A world direction `dir`
    // projects onto the 2D ball as:
    //   screenX = dir · shipRight   (right = +x on screen)
    //   screenY = -(dir · shipForward)  (up on screen = -z in ship frame,
    //                                    because canvas y is down)
    // Hidden if dir · nose < 0 (behind the ship).
    const project = (dir: THREE.Vector3): { x: number; y: number } | null => {
      const cosAngle = dir.dot(nose);
      if (cosAngle < -0.05) return null; // behind the ship (small tolerance)
      const px = dir.dot(shipRight) * R * 0.85;
      const py = -dir.dot(shipForward) * R * 0.85;
      return { x: THREE.MathUtils.clamp(px, -R, R),
               y: THREE.MathUtils.clamp(py, -R, R) };
    };

    // --- Compute pitch and heading for readouts ---
    // pitch = angle of nose above local horizon.
    const pitchRad = Math.asin(THREE.MathUtils.clamp(nose.dot(up3), -1, 1));
    // heading = direction of nose's horizontal projection.
    const horizNose = nose.clone().sub(up3.clone().multiplyScalar(nose.dot(up3)));
    let headingRad = 0;
    if (horizNose.length() > 1e-5) {
      horizNose.normalize();
      headingRad = Math.atan2(horizNose.dot(east), horizNose.dot(north));
    } else if (this.hasPrev) {
      // Preserve previous heading near poles.
      // Extract from prevBallQuat — just use 0 as fallback.
      headingRad = 0;
    }

    // --- Compute roll for horizon rotation ---
    // Roll = angle of shipRight relative to the local horizon plane.
    // Project shipRight onto the plane perpendicular to nose.
    const rightInPlane = shipRight.clone().sub(
      nose.clone().multiplyScalar(shipRight.dot(nose)));
    // Project local up onto the same plane.
    const upInPlane = up3.clone().sub(
      nose.clone().multiplyScalar(up3.dot(nose)));
    let rollRad = 0;
    if (rightInPlane.length() > 1e-5 && upInPlane.length() > 1e-5) {
      rightInPlane.normalize();
      upInPlane.normalize();
      const sideRef = new THREE.Vector3().crossVectors(nose, upInPlane).normalize();
      rollRad = Math.atan2(rightInPlane.dot(sideRef), rightInPlane.dot(upInPlane));
    }

    this.hasPrev = true;

    // --- Draw navball disk ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(cx, cy);
    ctx.rotate(-rollRad);

    // Horizon offset: pitch in pixels.
    const pitchPx = THREE.MathUtils.clamp(
      THREE.MathUtils.radToDeg(pitchRad) * 1.5, -R, R);

    // Sky (above horizon)
    ctx.fillStyle = '#1a3a6a';
    ctx.fillRect(-R, -R - pitchPx, R * 2, R + pitchPx);
    // Ground (below horizon)
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(-R, -pitchPx, R * 2, R + pitchPx);
    // Horizon line
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-R, -pitchPx);
    ctx.lineTo(R, -pitchPx);
    ctx.stroke();
    // Pitch ladder (every 15°)
    ctx.strokeStyle = 'rgba(220,220,220,0.5)';
    ctx.fillStyle = 'rgba(220,220,220,0.7)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    for (let deg = -90; deg <= 90; deg += 15) {
      if (deg === 0) continue;
      const y = -pitchPx - deg * 1.5;
      if (y < -R || y > R) continue;
      const len = deg % 30 === 0 ? R * 0.35 : R * 0.18;
      ctx.beginPath();
      ctx.moveTo(-len, y);
      ctx.lineTo(len, y);
      ctx.stroke();
      ctx.fillText(`${Math.abs(deg)}`, 0, y - 2);
    }
    ctx.restore();

    // --- Markers (fixed screen space) ---
    // Velocity markers
    const velLen = Math.hypot(root.velocity.x, root.velocity.y, root.velocity.z);
    if (velLen > 1e-3) {
      const vel = new THREE.Vector3(
        root.velocity.x, root.velocity.y, root.velocity.z).normalize();
      const p = project(vel);
      if (p) this.drawMarker(ctx, cx + p.x, cy + p.y, '#ffee00', false);
      const r = project(vel.clone().multiplyScalar(-1));
      if (r) this.drawMarker(ctx, cx + r.x, cy + r.y, '#33dd33', true);
    }

    // Radial out (cyan diamond) = +up3
    const radOut = project(up3);
    if (radOut) this.drawDiamondMarker(ctx, cx + radOut.x, cy + radOut.y, '#44ddff', false);
    // Radial in = -up3
    const radIn = project(up3.clone().multiplyScalar(-1));
    if (radIn) this.drawDiamondMarker(ctx, cx + radIn.x, cy + radIn.y, '#44ddff', true);

    // --- Fixed overlay ---
    // Center crosshair
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx, cy + 10);
    ctx.stroke();

    // Heading tick marks
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#9ab';
    ctx.fillStyle = '#cdd';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let deg = 0; deg < 360; deg += 45) {
      const ang = THREE.MathUtils.degToRad(
        deg - 90 - THREE.MathUtils.radToDeg(headingRad));
      const tx = Math.cos(ang) * (R - 10);
      const ty = Math.sin(ang) * (R - 10);
      const labels = ['N', 'E', 'S', 'W'];
      ctx.fillText(labels[Math.floor(deg / 90) % 4], tx, ty);
    }
    ctx.restore();

    // Heading readout
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${Math.round(((THREE.MathUtils.radToDeg(headingRad) + 360) % 360))
        .toString().padStart(3, '0')}°`,
      cx, 12);
    // Pitch readout
    ctx.fillText(
      `${Math.round(THREE.MathUtils.radToDeg(pitchRad))}°`, cx, s - 8);
  }

  private drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number,
    color: string, retro: boolean): void {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    if (retro) {
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 3, y - 3);
      ctx.lineTo(x + 3, y + 3);
      ctx.moveTo(x + 3, y - 3);
      ctx.lineTo(x - 3, y + 3);
      ctx.stroke();
    } else {
      ctx.fill();
    }
  }

  private drawDiamondMarker(ctx: CanvasRenderingContext2D, x: number, y: number,
    color: string, outline: boolean): void {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 6, y);
    ctx.lineTo(x, y + 6);
    ctx.lineTo(x - 6, y);
    ctx.closePath();
    if (outline) ctx.stroke();
    else ctx.fill();
  }
}
