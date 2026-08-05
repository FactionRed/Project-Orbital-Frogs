// src/flight/crash-detection.ts
// Shared crash threshold (spec §6.1) — Terra and Luna use the same value.
export const IMPACT_CRASH_THRESHOLD = 30; // m/s inward radial speed

/** Altitude below which the ship counts as being at a surface rather than above it (m). */
export const SURFACE_CONTACT_ALT = 50;

/**
 * How far below a body's mean radius the ship may sit and still be "on" it (m).
 * Terrain dips below the mean radius, so a legitimate landing reads slightly
 * negative; deeper than this the ship is inside the body, i.e. wreckage. Shared
 * by the landing and crash tests so the two verdicts stay mutually exclusive.
 */
export const SURFACE_PENETRATION_TOLERANCE = 10;

/**
 * True if the given inward radial impact speed counts as a crash.
 *
 * Defensive against NaN/Infinity and against the -1 sentinel that
 * FlightController.lastImpactSpeed carries before any terrain contact, so a
 * ship that has never touched down is never reported as wrecked.
 */
export function isCrashImpact(inwardRadialSpeed: number): boolean {
  if (!Number.isFinite(inwardRadialSpeed)) return false;
  return inwardRadialSpeed >= IMPACT_CRASH_THRESHOLD;
}
