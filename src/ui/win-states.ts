// src/ui/win-states.ts
import type { FlightController } from '../flight/flight-controller';
import { isClosedOrbit } from '../physics/orbit-math';
import { MOON_SOI } from '../physics/constants';

export type WinEvent = 'orbit' | 'moon-landed' | 'safe-return' | 'crash';

/** Radial speed at/above which touching a surface is an impact, not a landing (m/s). */
export const IMPACT_CRASH_THRESHOLD = 30;
/** Altitude below which the ship counts as being at the surface rather than above it (m). */
export const SURFACE_CONTACT_ALT = 50;
/**
 * How far below a body's mean radius the ship may sit and still be "on" it (m).
 * Terrain dips below the mean radius, so a legitimate landing reads slightly
 * negative; deeper than this the ship is inside the body, i.e. wreckage. Shared
 * by the landing and crash tests so the two verdicts stay mutually exclusive.
 */
export const SURFACE_PENETRATION_TOLERANCE = 10;

export class WinStates {
  private banner: HTMLElement;
  private bannerText: HTMLElement;
  private bannerBtn: HTMLButtonElement;
  private achieved = new Set<WinEvent>();
  private wasInMoonSoi = false;
  private hideTimer = 0;
  onEvent: (e: WinEvent) => void = () => {};
  onBuildAgain: () => void = () => {};

  constructor() {
    this.banner = document.createElement('div');
    this.banner.id = 'win-banner';
    this.banner.innerHTML = `
      <div id="banner-text"></div>
      <button id="banner-btn">Build Again</button>
    `;
    document.body.appendChild(this.banner);
    this.bannerText = this.banner.querySelector('#banner-text')!;
    this.bannerBtn = this.banner.querySelector('#banner-btn')!;
    this.bannerBtn.addEventListener('click', () => this.onBuildAgain());
  }

  private show(text: string, terminal = false): void {
    this.bannerText.textContent = text;
    this.banner.style.display = 'block';
    this.bannerBtn.style.display = terminal ? 'inline-block' : 'none';
    window.clearTimeout(this.hideTimer);
    if (!terminal) {
      this.hideTimer = window.setTimeout(() => {
        this.banner.style.display = 'none';
      }, 4000);
    }
  }

  update(flight: FlightController): void {
    const root = flight.ship.rootBody;
    const planet = flight.planet;

    const r: [number, number, number] = [
      root.position.x - planet.position.x,
      root.position.y - planet.position.y,
      root.position.z - planet.position.z,
    ];
    const v: [number, number, number] = [root.velocity.x, root.velocity.y, root.velocity.z];
    const moonPos = flight.moon.position;
    const moonDist = Math.hypot(
      root.position.x - moonPos.x,
      root.position.y - moonPos.y,
      root.position.z - moonPos.z,
    );
    const inMoonSoi = moonDist < MOON_SOI;

    // Orbit achieved (around planet, not yet entered moon SOI).
    if (
      !this.achieved.has('orbit') &&
      !inMoonSoi &&
      isClosedOrbit(r, v, planet.mu, planet.data.radius)
    ) {
      this.achieved.add('orbit');
      this.show('🌱 Orbit Achieved!');
      this.onEvent('orbit');
    }

    if (inMoonSoi) this.wasInMoonSoi = true;

    // Landing and impact are decided from one set of moon-relative numbers, so a
    // single position can never satisfy both.
    //
    // `moonAlt` is measured from Luna's center, so it goes NEGATIVE inside the
    // body: wreckage buried under the surface must not read as a gentle
    // touchdown merely because it has come to rest.
    //
    // "Vertical speed" is the component of velocity along the radial direction
    // from moon center to ship — NOT world-Y, because the moon orbits in the
    // XZ plane and its surface normal can point in any direction.
    const moonAlt = moonDist - flight.moon.data.radius;
    const moonDx = root.position.x - moonPos.x;
    const moonDy = root.position.y - moonPos.y;
    const moonDz = root.position.z - moonPos.z;
    const radialVel = moonDist > 1e-3
      ? (root.velocity.x * moonDx + root.velocity.y * moonDy + root.velocity.z * moonDz) / moonDist
      : 0;
    const vertSpeed = Math.abs(radialVel);
    const onMoonSurface =
      moonAlt >= -SURFACE_PENETRATION_TOLERANCE && moonAlt < SURFACE_CONTACT_ALT;

    // Moon landed: in moon SOI, on the surface, very low radial speed.
    if (inMoonSoi && onMoonSurface && vertSpeed < IMPACT_CRASH_THRESHOLD) {
      if (!this.achieved.has('moon-landed')) {
        this.achieved.add('moon-landed');
        this.show('🌕 Lunar Landing!');
        this.onEvent('moon-landed');
      }
    }

    // Crashed into either body.
    const planetAlt = Math.hypot(r[0], r[1], r[2]) - planet.data.radius;
    // Moon crash: inside the moon OR at the surface with high radial speed.
    const moonCrashed = inMoonSoi && (
      moonAlt < -SURFACE_PENETRATION_TOLERANCE ||
      (onMoonSurface && vertSpeed >= IMPACT_CRASH_THRESHOLD)
    );
    if (planetAlt < -SURFACE_PENETRATION_TOLERANCE || moonCrashed) {
      if (!this.achieved.has('crash')) {
        this.achieved.add('crash');
        this.show('💥 Crashed — Revert with F1');
        this.onEvent('crash');
      }
    }

    // Safe return: terminal — was on moon, now back near planet surface, slow touchdown.
    if (this.wasInMoonSoi && !inMoonSoi && !this.achieved.has('safe-return')) {
      if (planetAlt < 100 && Math.hypot(v[0], v[1], v[2]) < 50) {
        this.achieved.add('safe-return');
        this.show('🏆 Mission Complete! Safe Return.', true);
        this.onEvent('safe-return');
      }
    }
  }

  reset(): void {
    this.achieved.clear();
    this.wasInMoonSoi = false;
    window.clearTimeout(this.hideTimer);
    this.banner.style.display = 'none';
  }

  hide(): void {
    this.banner.style.display = 'none';
  }
}
