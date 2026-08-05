// src/ui/win-states.ts
import type { FlightController } from '../flight/flight-controller';
import { isClosedOrbit } from '../physics/orbit-math';
import { MOON_SOI } from '../physics/constants';
import {
  isCrashImpact,
  IMPACT_CRASH_THRESHOLD,
  SURFACE_CONTACT_ALT,
  SURFACE_PENETRATION_TOLERANCE,
} from '../flight/crash-detection';
import { Banner } from './components';
import type { BannerTone } from './components';

export type WinEvent = 'orbit' | 'moon-landed' | 'safe-return' | 'crash';

export class WinStates {
  private banner: Banner;
  private bannerBtn: HTMLButtonElement;
  private achieved = new Set<WinEvent>();
  private wasInMoonSoi = false;
  onEvent: (e: WinEvent) => void = () => {};
  onBuildAgain: () => void = () => {};

  constructor() {
    this.banner = new Banner();
    this.banner.el.id = 'win-banner';
    this.bannerBtn = document.createElement('button');
    this.bannerBtn.id = 'banner-btn';
    this.bannerBtn.type = 'button';
    this.bannerBtn.className = 'dsky-key';
    this.bannerBtn.textContent = 'BUILD AGAIN';
    this.bannerBtn.style.display = 'none';
    this.bannerBtn.addEventListener('click', () => this.onBuildAgain());
    this.banner.el.appendChild(this.bannerBtn);
    document.body.appendChild(this.banner.el);
  }

  /** `terminal` banners stay up and offer BUILD AGAIN; others fade after 4s. */
  private show(text: string, tone: BannerTone = 'info', detail = '', terminal = false): void {
    this.banner.show(text, tone, detail, terminal);
    this.bannerBtn.style.display = terminal ? 'inline-flex' : 'none';
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
      this.show('🌱 ORBIT ACHIEVED', 'success');
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
        this.show('🌕 LUNAR LANDING', 'success');
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

    // Critical #1: hitting Terra used to be silent. The altitude test never
    // fired because clampToTerrain holds the ship AT the surface, so planetAlt
    // never went below -10. The impact speed the clamp recorded is the signal.
    const planetImpactCrash =
      !inMoonSoi
      && flight.peakImpactBody === 'planet'
      && isCrashImpact(flight.peakImpactSpeed);

    if (planetAlt < -SURFACE_PENETRATION_TOLERANCE || moonCrashed || planetImpactCrash) {
      if (!this.achieved.has('crash')) {
        this.achieved.add('crash');
        const speed = Math.max(flight.peakImpactSpeed, 0);
        this.show(
          '■ LITHOBRAKE',
          'alarm',
          `impact at ${speed.toFixed(0)} m/s · press F1 to revert`,
          true, // terminal: a wreck must not scroll away while it's being read
        );
        this.onEvent('crash');
      }
    }

    // Safe return: terminal — was on moon, now back near planet surface, slow touchdown.
    if (this.wasInMoonSoi && !inMoonSoi && !this.achieved.has('safe-return')) {
      if (planetAlt < 100 && Math.hypot(v[0], v[1], v[2]) < 50) {
        this.achieved.add('safe-return');
        this.show('🏆 MISSION COMPLETE', 'success', 'safe return', true);
        this.onEvent('safe-return');
      }
    }
  }

  reset(): void {
    this.achieved.clear();
    this.wasInMoonSoi = false;
    this.banner.hide();
    this.bannerBtn.style.display = 'none';
  }

  hide(): void {
    this.banner.hide();
  }
}
