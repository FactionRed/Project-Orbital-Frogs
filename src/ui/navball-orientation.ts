// src/ui/navball-orientation.ts
//
// Pure orientation math for the navball, extracted from the drawing code so it
// can be unit-tested. This replaces the previous Euler-decomposition approach
// (which went singular at vertical attitudes — roll died on the launch pad,
// pitch clamped at ±52°, a pure pitch maneuver spuriously reported roll=180°).
//
// THE KEY IDEA
// ------------
// The navball is a sphere. A direction in the world projects onto the 2D ball
// by expressing it in a per-frame "ball space" whose axes are derived directly
// from the ship quaternion and the local reference frame — NOT from Euler
// angles. Because ball space is defined by a full quaternion, it never goes
// singular: roll is well-defined at every attitude, pitch is continuous
// through ±90°, and a pure pitch input never contaminates roll.
//
// Ball-space axes (what each axis means on screen):
//   x  →  screen right      (= ship's right wing axis, in world)
//   y  →  screen up         (= nose × shipRight — the "top of canopy" axis
//                             projected into the screen plane; this is what
//                             rolls)
//   z  →  along the nose    (the look direction; only its sign matters for
//                             the front/back visibility test)
//
// A world direction `d` projected to screen pixels:
//   screenX = (d · shipRight)   * scale
//   screenY = -(d · screenUp)   * scale      (canvas y is down)
// Hidden when d · nose < 0 (behind the ship).
//
// Pitch / heading / roll are then read off these same vectors, with no
// Euler decomposition of the ship quaternion:
//   pitch   = asin(nose · up3)                       — nose above local horizon
//   heading = atan2(noseHoriz · east, noseHoriz · north) — compass of nose
//   roll    = atan2(ballRight · sideRef, ballRight · upRef)
//   where upRef  = the part of `up3` perpendicular to nose (the "up" line on
//          the ball), and sideRef = nose × upRef (the "right" line on the ball).
//   Crucially ballRight is the SHIP's right axis (constant under pitch), so
//   roll measures how the ship is banked relative to the horizon — invariant
//   under pure pitch, which is exactly what KSP does.

import * as THREE from 'three';

export interface NavballProjection {
  /** Project a world direction to ball-space pixels. `scale` is pixels-per-unit
   *  at the ball's centre (i.e. the radius to use). Returns null if the
   *  direction is behind the ship (more than ~90° off the nose). */
  project(dir: THREE.Vector3): { x: number; y: number } | null;
}

export interface NavballOrientation extends NavballProjection {
  /** Nose angle above the local horizon, radians. Range [-π/2, +π/2]. */
  pitch: number;
  /** Compass heading of the nose's horizon projection, radians. Range
   *  (-π, π]; 0 = north, +π/2 = east. */
  heading: number;
  /** Ship bank angle — how far the wing axis has rolled off wings-level,
   *  radians. Well-defined at every attitude including straight up/down. */
  roll: number;
}

/**
 * Compute navball orientation/projection for one frame.
 *
 * @param qShip  Ship body quaternion (cannon→three convention: x,y,z,w).
 * @param up3    Unit vector radial-out at the ship (local "up").
 * @param east   Unit east axis at the ship.
 * @param north  Unit north axis at the ship.
 * @param rimPx  Optional clip radius for the projection (default 78). The
 *               projection is linear in sin(half-angle); values near ±90°
 *               approach the rim and are clamped to it.
 */
export function navballOrientation(
  qShip: THREE.Quaternion,
  up3: THREE.Vector3,
  east: THREE.Vector3,
  north: THREE.Vector3,
  rimPx = 78,
): NavballOrientation {
  // Ship axes in world space. The ship model's nose = local +Y, right wing =
  // local +X, tail = local +Z.
  const nose = new THREE.Vector3(0, 1, 0).applyQuaternion(qShip).normalize();
  const shipRight = new THREE.Vector3(1, 0, 0).applyQuaternion(qShip).normalize();

  // Screen frame for the projection. Looking along the nose, the screen is the
  // plane perpendicular to nose. Its horizontal axis is the ship's right wing
  // (already perpendicular to nose by construction). Its vertical axis is the
  // third orthonormal vector, screenUp = nose × shipRight — this is the ship's
  // "top of canopy" direction projected into the screen plane. Crucially this
  // frame is always well-defined (no singularity) because it is built from two
  // perpendicular ship axes.
  const screenUp = new THREE.Vector3().crossVectors(nose, shipRight).normalize();

  // --- Pitch: nose above local horizon. -------------------------------------
  const pitch = Math.asin(THREE.MathUtils.clamp(nose.dot(up3), -1, 1));

  // --- Heading: compass direction of the nose's horizon projection. ---------
  // Project nose onto the local horizon plane (perp to up3).
  const horizNose = nose.clone().sub(up3.clone().multiplyScalar(nose.dot(up3)));
  let heading = 0;
  if (horizNose.lengthSq() > 1e-8) {
    horizNose.normalize();
    heading = Math.atan2(horizNose.dot(east), horizNose.dot(north));
  }

  // --- Roll: bank of the ship relative to the horizon. ----------------------
  // The ship's "canopy up" axis is shipUp = nose × shipRight — the direction
  // that should point at the sky when wings are level. The "up line" on the
  // ball is the part of local-up perpendicular to the nose (upRef); the "right
  // line" on the ball is sideRef = upRef × nose. Roll = angle of shipUp
  // measured from upRef toward sideRef. Wings level (shipUp ∥ upRef) → roll 0.
  //
  // When the nose is vertical (launch pad, vertical climb), upRef collapses —
  // we then measure roll from the ship's right axis projected into the horizon
  // plane. This is the fix for the previous "roll dead on the pad" defect.
  let roll = 0;
  const shipUp = new THREE.Vector3().crossVectors(nose, shipRight).normalize();
  const upRef = up3.clone().sub(nose.clone().multiplyScalar(up3.dot(nose)));
  if (upRef.lengthSq() > 1e-6) {
    upRef.normalize();
    const sideRef = new THREE.Vector3().crossVectors(upRef, nose).normalize();
    roll = Math.atan2(shipUp.dot(sideRef), shipUp.dot(upRef));
  } else {
    // Nose ∥ up3: use the horizon plane (perp to up3) as the roll reference.
    const rightHoriz = shipRight.clone().sub(
      up3.clone().multiplyScalar(shipRight.dot(up3)));
    if (rightHoriz.lengthSq() > 1e-8) {
      rightHoriz.normalize();
      roll = Math.atan2(rightHoriz.dot(north), rightHoriz.dot(east));
    }
  }

  // --- Projection. ----------------------------------------------------------
  // Linear in the screen-frame components, clamped to the rim. A direction
  // 90° off the nose (cosA ≈ 0) lands at the rim; the 0.85 factor insets the
  // markers slightly to match the previous visual scale.
  const project = (dir: THREE.Vector3): { x: number; y: number } | null => {
    const cosA = dir.dot(nose);
    if (cosA < -0.05) return null; // behind the ship
    const px = dir.dot(shipRight) * rimPx * 0.85;
    // canvas y is down, so negate the screen-up component
    const py = -dir.dot(screenUp) * rimPx * 0.85;
    return {
      x: THREE.MathUtils.clamp(px, -rimPx, rimPx),
      y: THREE.MathUtils.clamp(py, -rimPx, rimPx),
    };
  };

  return { pitch, heading, roll, project };
}
