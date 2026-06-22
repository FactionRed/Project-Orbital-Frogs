// src/ui/orbit-map.ts
import type { FlightController } from '../flight/flight-controller';

const TRAJECTORY_STEPS = 800;
const TRAJECTORY_DT = 0.5;

/**
 * Full-screen 2D orbital map (top-down, world XZ → canvas XY).
 *
 * Features:
 * - Wheel zoom (in/out, with limits), left-drag pan.
 * - Auto-fit on open: defaults to a scale that shows the whole system
 *   (planet + moon orbit) so you immediately see where you are.
 * - Scale bar + zoom % readout in the corner.
 * - Planet, moon, moon's orbit ring, ship, and a forward-integrated trajectory
 *   relative to the dominant celestial body.
 */
export class OrbitMap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  visible = false;

  /** Pixels per world-meter. Defaulted in open(). */
  private scale = 0.05;
  /** Pan offset in screen pixels from the world origin (planet center). */
  private panX = 0;
  private panY = 0;

  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  /** Bounds for sanity. */
  private readonly minScale = 0.0008; // zoomed all the way out (system view)
  private readonly maxScale = 2; // zoomed all the way in (close on ship)

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'orbit-map';
    const ctx = this.canvas.getContext('2d')!;
    this.ctx = ctx;
    Object.assign(this.canvas.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      background: 'rgba(0,0,5,0.92)',
      display: 'none',
      zIndex: '20',
      cursor: 'grab',
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.canvas);

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Zoom on wheel — zoom toward the cursor so the point under the mouse stays put.
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        // World coords under the cursor before zoom.
        const wx = (mx - this.panX) / this.scale;
        const wy = (my - this.panY) / this.scale;
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor));
        // Keep the world point under the cursor stationary.
        this.panX = mx - wx * this.scale;
        this.panY = my - wy * this.scale;
      },
      { passive: false },
    );

    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.canvas.style.cursor = 'grabbing';
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.panX += e.clientX - this.lastX;
      this.panY += e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener('pointerup', () => {
      this.dragging = false;
      this.canvas.style.cursor = 'grab';
    });
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  toggle(flight?: FlightController): void {
    this.visible = !this.visible;
    this.canvas.style.display = this.visible ? 'block' : 'none';
    if (this.visible && flight) this.autoFit(flight);
  }

  hide(): void {
    this.visible = false;
    this.canvas.style.display = 'none';
  }

  /** Reset zoom/pan to fit the whole system (planet + moon orbit) on screen. */
  private autoFit(flight: FlightController): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const span = flight.moon.orbitRadiusApproxForMap * 2.4; // diameter + margin
    this.scale = Math.min(w, h) / span;
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale));
    // Center on planet (world origin).
    this.panX = w / 2;
    this.panY = h / 2;
  }

  /** Center on the ship and zoom in to a comfortable close view. */
  focusShip(flight: FlightController): void {
    const root = flight.ship.rootBody;
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.scale = Math.max(0.3, Math.min(this.maxScale, this.scale));
    this.panX = w / 2 - root.position.x * this.scale;
    this.panY = h / 2 - root.position.z * this.scale;
  }

  draw(flight: FlightController): void {
    if (!this.visible) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = this.panX;
    const cy = this.panY;
    const s = this.scale;

    // Helpers: world (x,z) → screen (px,py).
    const sx = (wx: number) => cx + wx * s;
    const sy = (wz: number) => cy + wz * s;

    // --- Celestial bodies ---
    // Moon orbit ring
    ctx.strokeStyle = '#345';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, flight.moon.orbitRadiusApproxForMap * s, 0, Math.PI * 2);
    ctx.stroke();

    // Planet
    const pr = Math.max(2, flight.planet.data.radius * s);
    ctx.fillStyle = '#3366cc';
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx.fill();

    // Moon
    const mx = sx(flight.moon.position.x);
    const my = sy(flight.moon.position.z);
    const mr = Math.max(2, flight.moon.data.radius * s);
    ctx.fillStyle = '#aaaaaa';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();

    // --- Predicted trajectory relative to dominant body ---
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

    ctx.strokeStyle = '#2a6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < TRAJECTORY_STEPS; i++) {
      const rx = px - bx;
      const ry = py - by;
      const rz = pz - bz;
      const r2 = rx * rx + ry * ry + rz * rz;
      const r = Math.sqrt(r2);
      if (r < flight.planet.data.radius) break; // crashed
      const a = -mu / (r2 * r);
      vx += a * rx * TRAJECTORY_DT;
      vy += a * ry * TRAJECTORY_DT;
      vz += a * rz * TRAJECTORY_DT;
      px += vx * TRAJECTORY_DT;
      py += vy * TRAJECTORY_DT;
      pz += vz * TRAJECTORY_DT;
      // Project onto map (use x,z of the offset from dominant body).
      const screenX = sx(bx + rx);
      const screenY = sy(bz + rz);
      if (!started) {
        ctx.moveTo(screenX, screenY);
        started = true;
      } else {
        ctx.lineTo(screenX, screenY);
      }
    }
    if (started) ctx.stroke();

    // --- Ship marker ---
    ctx.fillStyle = '#ffee00';
    const shipR = 5;
    ctx.beginPath();
    ctx.arc(sx(root.position.x), sy(root.position.z), shipR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // --- HUD overlays: scale bar + help + focus hint ---
    this.drawScaleBar(ctx, w, h);
    ctx.fillStyle = '#7a8aa5';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('wheel: zoom · drag: pan · M: close', 12, h - 12);
    ctx.textAlign = 'right';
    ctx.fillText(`${(this.scale * 100).toFixed(2)} px/m`, w - 12, h - 12);
  }

  /** Draw a horizontal scale bar (1 / 2 / 5 / 10 / ... world-meters) bottom-left. */
  private drawScaleBar(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Pick a "nice" length roughly 1/4 of the screen width in world meters.
    const targetPx = w * 0.25;
    const targetM = targetPx / this.scale;
    const niceM = niceRound(targetM);
    const barPx = niceM * this.scale;
    const x = 12;
    const y = h - 36;
    ctx.strokeStyle = '#cdd';
    ctx.fillStyle = '#cdd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + barPx, y);
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y + 4);
    ctx.moveTo(x + barPx, y - 4);
    ctx.lineTo(x + barPx, y + 4);
    ctx.stroke();
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(formatDistance(niceM), x, y - 8);
  }
}

/** Round to a "nice" 1/2/5×10^n value (e.g. 732 → 500, 0.83 → 1, 12345 → 10000). */
function niceRound(x: number): number {
  if (x <= 0) return 1;
  const exp = Math.floor(Math.log10(x));
  const base = Math.pow(10, exp);
  const norm = x / base;
  let nice: number;
  if (norm < 1.5) nice = 1;
  else if (norm < 3.5) nice = 2;
  else if (norm < 7.5) nice = 5;
  else nice = 10;
  return nice * base;
}

/** Format a distance in m as "350 m" or "4.0 km". */
function formatDistance(m: number): string {
  if (m < 1000) return `${m.toFixed(0)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
