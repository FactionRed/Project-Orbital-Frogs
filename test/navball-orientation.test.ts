// Tests for the pure orientation math behind the navball.
//
// The navball draws three things from the ship's orientation:
//   - pitch (nose angle above horizon)
//   - heading (compass direction of nose's horizon projection)
//   - roll (rotation of the horizon/ladder about the screen center)
// plus it projects markers (prograde/retrograde/radial) to screen.
//
// These are pure functions of:
//   - qShip        : the ship body's quaternion (cannon→three convention)
//   - up3          : unit radial-out at the ship (local "up")
//   - east, north  : local reference axes (east = up×worldUp, north = east×up)
//
// The previous implementation decomposed qShip into Euler angles and went
// singular at vertical attitudes (roll died on the launch pad; pitch clamped
// at ±52°; a pure pitch maneuver spuriously reported roll=180°). These tests
// pin the *desired* KSP-like behaviour so the rewrite can't regress them.
//
// ROTATION CONVENTIONS IN THESE TESTS
// -----------------------------------
// Ship model axes at identity: nose = +Y, right wing = +X, tail = +Z.
// To produce an UNAMBIGUOUS "pure pitch" (nose tips forward, wings stay level),
// rotate about the WING axis. At the launch pad the wing axis = +X (east), so
// a pure pitch takes the nose from +Y toward +Z (north) — not east. We then
// pick heading/roll expectations that match this. Rotations about world Z or
// world Y at the vertical attitude are *combined* pitch+roll (gimbal-coupled),
// so we avoid asserting "pure" behaviour from them.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { navballOrientation } from '../src/ui/navball-orientation';

// Local reference frame, matching the launch-pad case in navball.ts:51-60
// (ship straight up at the equator; worldUp=(0,1,0) so east=up×worldUp=0 →
// fallback (1,0,0); north = east × up = +Z).
const up3 = new THREE.Vector3(0, 1, 0);
const east = new THREE.Vector3(1, 0, 0);
const north = new THREE.Vector3(0, 0, 1);

const Q = THREE.Quaternion;
const rot = (axis: THREE.Vector3, deg: number) =>
  new Q().setFromAxisAngle(axis.clone().normalize(), (deg * Math.PI) / 180);
const deg = (r: number) => (r * 180) / Math.PI;
const approx = (x: number, dp = 1) => {
  const r = Math.round(x * 10 ** dp) / 10 ** dp;
  return r === 0 ? 0 : r; // normalize -0 to +0
};

describe('navballOrientation — pitch', () => {
  it('reports +90° when nose points straight up (launch pad)', () => {
    const o = navballOrientation(new Q(), up3, east, north);
    expect(approx(deg(o.pitch))).toBe(90);
  });

  it('reports 0° after a pure pitch to the horizon (wing-axis rotation +90°)', () => {
    // Pure pitch about the wing axis (+X). Nose goes from +Y to +Z (north).
    const q = rot(new THREE.Vector3(1, 0, 0), 90);
    const o = navballOrientation(q, up3, east, north);
    expect(approx(deg(o.pitch))).toBe(0);
  });

  it('reports -90° when nose points straight down (inverted, 180° wing-axis pitch)', () => {
    const q = rot(new THREE.Vector3(1, 0, 0), 180);
    const o = navballOrientation(q, up3, east, north);
    expect(approx(deg(o.pitch))).toBe(-90);
  });
});

describe('navballOrientation — roll (the previous big defect)', () => {
  it('reports ~0° roll when wings level on the pad', () => {
    const o = navballOrientation(new Q(), up3, east, north);
    expect(approx(deg(o.roll))).toBe(0);
  });

  it('reports the input roll after a 90° roll input on the pad (was: 0°, dead)', () => {
    // Roll about the ship's nose axis (+Y) by +90° (right-hand rule: right wing
    // rotates toward north). Whatever sign convention we pick, the magnitude
    // must be 90°, not 0° — the previous implementation returned 0 here.
    const q = rot(new THREE.Vector3(0, 1, 0), 90);
    const o = navballOrientation(q, up3, east, north);
    expect(Math.abs(approx(deg(o.roll)))).toBe(90);
  });

  it('reports the input roll after a 180° roll input on the pad', () => {
    const q = rot(new THREE.Vector3(0, 1, 0), 180);
    const o = navballOrientation(q, up3, east, north);
    expect(Math.abs(approx(deg(o.roll)))).toBe(180);
  });

  it('reports ~0° roll for a pure pitch to the horizon (was: spurious 180°)', () => {
    // Pure pitch about the wing axis — wings stay level, so roll must be 0.
    // This is the headline regression test: previously a pitch maneuver
    // flipped the horizon upside down.
    const q = rot(new THREE.Vector3(1, 0, 0), 90);
    const o = navballOrientation(q, up3, east, north);
    expect(approx(deg(o.roll))).toBe(0);
  });

  it('reports the input roll after a pure pitch + roll (climbing turn)', () => {
    // Pitch 30° about wing axis, THEN roll 45° about the (now-tilted) nose.
    // q = rollQ * pitchQ so the roll is intrinsic to the pitched frame.
    const pitchQ = rot(new THREE.Vector3(1, 0, 0), 30);
    const noseAfterPitch = new THREE.Vector3(0, 1, 0).applyQuaternion(pitchQ);
    const rollQ = rot(noseAfterPitch, 45);
    const q = rollQ.multiply(pitchQ);
    const o = navballOrientation(q, up3, east, north);
    // Magnitude must match the applied 45° roll — previously this attitude
    // produced a spurious reading; we pin the magnitude, not the sign
    // (sign is a convention choice left to the drawing layer).
    expect(Math.abs(approx(deg(o.roll)))).toBe(45);
  });
});

describe('navballOrientation — heading', () => {
  it('is well-defined and stable when nose is on the horizon', () => {
    // Pure pitch about +X takes nose from +Y to +Z = north → heading 0°.
    const q = rot(new THREE.Vector3(1, 0, 0), 90);
    const o = navballOrientation(q, up3, east, north);
    expect(approx(deg(o.heading))).toBe(0);
  });

  it('reads 90° (east) when the nose points east on the horizon', () => {
    // Pitch nose down to north (+Z), then world-yaw +90° about up3 to face east.
    // Composition order: v' = yawQ * pitchQ * v  →  q = yawQ.multiply(pitchQ).
    const pitchQ = rot(new THREE.Vector3(1, 0, 0), 90);
    const yawQ = rot(new THREE.Vector3(0, 1, 0), 90);
    const q = yawQ.multiply(pitchQ);
    const o = navballOrientation(q, up3, east, north);
    expect(approx(deg(o.heading))).toBe(90);
  });
});

describe('navballOrientation — marker projection', () => {
  it('places radial-out at screen centre when nose points up', () => {
    const o = navballOrientation(new Q(), up3, east, north);
    const p = o.project(up3);
    expect(p).not.toBeNull();
    expect(approx(p!.x)).toBe(0);
    expect(approx(p!.y)).toBe(0);
  });

  it('returns null for a direction behind the ship', () => {
    // Nose up; -up3 (radial in) is directly behind.
    const o = navballOrientation(new Q(), up3, east, north);
    expect(o.project(up3.clone().multiplyScalar(-1))).toBeNull();
  });

  it('places radial-out at the top of the ball when flying level on the horizon', () => {
    // Nose pitched to north horizon (+Z), wings level. Radial-out (+Y) is the
    // sky directly above the cockpit — it sits on the upper half of the ball
    // (canvas y < 0). This is the key "feels like KSP" property: pitching the
    // nose down moves "up" to the top of the ball.
    const q = rot(new THREE.Vector3(1, 0, 0), 90);
    const o = navballOrientation(q, up3, east, north);
    const p = o.project(up3);
    expect(p).not.toBeNull();
    expect(p!.y).toBeLessThan(0); // upper half on a y-down canvas
  });
});

// Marker-projection scale sanity: a 90°-off-axis direction lands near the rim.
describe('navballOrientation — projection scale', () => {
  it('places a 90°-off-nose direction near the rim, not clamped', () => {
    // Nose up; east is 90° off → should project near the rim radius.
    const o = navballOrientation(new Q(), up3, east, north);
    const R = 78;
    const p = o.project(east);
    expect(p).not.toBeNull();
    expect(Math.abs(p!.x)).toBeGreaterThan(R * 0.7);
  });
});
