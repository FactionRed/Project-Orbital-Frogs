// src/physics/collision-groups.ts
// Bitwise groups for cannon-es collisionFilterGroup / collisionFilterMask.
// Key invariant: ship parts share a group but mask it OUT, so welded parts
// never collide with each other (the LockConstraint handles their relationship),
// while still colliding with celestial bodies so the ship can land.

export const COLLISION_GROUP = {
  CELESTIAL: 1, // planets / moons
  SHIP: 2, // ship parts (engines, tanks, pod, etc.)
} as const;

/** Mask for a ship part: collide with CELESTIAL only, ignore other SHIP parts. */
export const SHIP_COLLISION_MASK = COLLISION_GROUP.CELESTIAL;
/** Mask for a celestial body: collide with SHIP (and other celestial bodies). */
export const CELESTIAL_COLLISION_MASK = COLLISION_GROUP.CELESTIAL | COLLISION_GROUP.SHIP;
