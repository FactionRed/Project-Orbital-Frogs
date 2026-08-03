// src/ui/navball.ts
import * as THREE from 'three';
import type { FlightController } from '../flight/flight-controller';
import { navballOrientation } from './navball-orientation';
import { Panel } from './components';

/**
 * KSP-style navball HUD instrument.
 *
 * All orientation math (pitch / heading / roll / marker projection) is
 * delegated to `navballOrientation`, which derives the ball frame from the
 * ship quaternion and the local up/east/north axes WITHOUT decomposing into
 * Euler angles. This avoids the singularities the previous in-place version
 * suffered at vertical attitudes (roll died on the launch pad; pitch clamped
 * at ~±52°; a pure pitch maneuver spuriously reported roll=180°).
 *
 * Rendered on a fixed 160px canvas anchored bottom-center of the screen.
 */
export class NavBall {
  private canvas: HTMLCanvasElement;
  private bezel: HTMLElement;
  private ctx: CanvasRenderingContext2D;
  private readonly size = 160;
  // Last reported heading, carried over near the poles where the nose's
  // horizon projection collapses (navball-orientation falls back to 0 there).
  private prevHeadingDeg = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'navball';
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Attitude indicator');

    // The instrument sits in a labelled bezel, like the rest of the panel set.
    // The bezel owns the screen position; the canvas is static inside it.
    this.bezel = new Panel('ATTITUDE').el;
    this.bezel.id = 'navball-bezel';
    this.bezel.appendChild(this.canvas);
    document.body.appendChild(this.bezel);

    this.ctx = this.canvas.getContext('2d')!;
  }

  show(): void { this.bezel.style.display = 'block'; }
  hide(): void { this.bezel.style.display = 'none'; }

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

    // Single source of truth for orientation: the singularity-free module.
    const o = navballOrientation(qShip, up3, east, north, R);
    const pitchRad = o.pitch;
    // Carry the previous heading when the nose is too close to vertical for a
    // stable horizon projection — keeps the rim letters from snapping. The
    // horizon-projection length is |cos(pitch)| (the nose's component in the
    // horizon plane).
    let headingRad = o.heading;
    const horizNoseLen = Math.abs(Math.cos(pitchRad));
    if (horizNoseLen < 0.05) {
      headingRad = THREE.MathUtils.degToRad(this.prevHeadingDeg);
    } else {
      this.prevHeadingDeg = THREE.MathUtils.radToDeg(headingRad);
    }
    const rollRad = o.roll;
    const project = o.project;

    // --- Draw navball disk ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(cx, cy);
    ctx.rotate(-rollRad);

    // Horizon offset: pitch in pixels. The previous version clamped here at
    // ±R (≈±52°), tearing the horizon during vertical flight. We now let pitch
    // travel the full range; the clip() above keeps the overflow tidy and the
    // pitch-ladder loop below skips rungs that fall outside the disk.
    const pitchPx = THREE.MathUtils.radToDeg(pitchRad) * 1.5;

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
