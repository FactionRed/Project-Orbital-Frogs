// src/flight/crash-detection.ts
// Shared crash threshold (spec §6.1) — Terra and Luna use the same value.
export const IMPACT_CRASH_THRESHOLD = 30; // m/s inward radial speed

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
