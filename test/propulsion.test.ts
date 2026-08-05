import { describe, it, expect } from 'vitest';
import {
  PARTS_CATALOG, getPartDef, exhaustVelocity, FUEL_DENSITY, DEFAULT_BURN_RATE,
} from '../src/entities/parts-catalog';
import { PLANET, ATMOSPHERE, G, airDensityAt, vacuumFractionAt } from '../src/physics/constants';
import type { PartDef } from '../src/entities/part';

const BOOSTER = getPartDef('engine');
const VACUUM = getPartDef('engine-vac');
const TANK = getPartDef('tank');
const POD = getPartDef('pod');
const DECOUPLER = getPartDef('decoupler');

/** Thrust an engine actually delivers at a given altitude, kN. */
function thrustAt(def: PartDef, altitude: number): number {
  const vac = def.thrust ?? 0;
  const sea = def.thrustSea ?? vac;
  return sea + (vac - sea) * vacuumFractionAt(altitude);
}

/** Delta-v of a stage, m/s. */
function stageDv(engine: PartDef, tanks: number, payload: number, decoupler: boolean): number {
  const dry = payload + engine.dryMass + TANK.dryMass * tanks + (decoupler ? DECOUPLER.dryMass : 0);
  const wet = dry + (TANK.fuel ?? 0) * tanks * FUEL_DENSITY;
  return exhaustVelocity(engine) * Math.log(wet / dry);
}

function stageWet(engine: PartDef, tanks: number, payload: number, decoupler: boolean): number {
  return payload + engine.dryMass + TANK.dryMass * tanks
    + (decoupler ? DECOUPLER.dryMass : 0) + (TANK.fuel ?? 0) * tanks * FUEL_DENSITY;
}

/** Thrust-to-weight at liftoff, which uses SEA-LEVEL thrust. */
function liftoffTwr(engine: PartDef, wet: number, engines = 1): number {
  const g = (G * PLANET.mass) / (PLANET.radius * PLANET.radius);
  return ((engine.thrustSea ?? engine.thrust ?? 0) * engines) / (wet * g);
}

describe('atmosphere model', () => {
  it('is densest at the surface and gone above the atmosphere', () => {
    expect(airDensityAt(0)).toBeCloseTo(ATMOSPHERE.surfaceDensity);
    expect(airDensityAt(ATMOSPHERE.height)).toBe(0);
    expect(airDensityAt(ATMOSPHERE.height + 1)).toBe(0);
    expect(airDensityAt(-10)).toBe(0);
  });

  it('falls off exponentially with the configured scale height', () => {
    expect(airDensityAt(ATMOSPHERE.scaleHeight))
      .toBeCloseTo(ATMOSPHERE.surfaceDensity * Math.exp(-1), 6);
  });

  it('reads as full vacuum above the atmosphere and none at the pad', () => {
    expect(vacuumFractionAt(0)).toBeCloseTo(0);
    expect(vacuumFractionAt(ATMOSPHERE.height)).toBe(1);
    expect(vacuumFractionAt(1000)).toBeGreaterThan(0);
    expect(vacuumFractionAt(1000)).toBeLessThan(1);
  });
});

describe('engine performance', () => {
  it('every engine is weakest at sea level and strongest in vacuum', () => {
    for (const def of PARTS_CATALOG.filter((p) => p.kind === 'engine')) {
      expect(def.thrustSea!).toBeLessThanOrEqual(def.thrust!);
      expect(thrustAt(def, 0)).toBeCloseTo(def.thrustSea!, 5);
      expect(thrustAt(def, ATMOSPHERE.height)).toBeCloseTo(def.thrust!, 5);
    }
  });

  it('thrust rises monotonically with altitude', () => {
    let prev = -Infinity;
    for (let alt = 0; alt <= ATMOSPHERE.height; alt += 100) {
      const t = thrustAt(VACUUM, alt);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it('the vacuum engine loses far more thrust in air than the booster', () => {
    const boosterLoss = 1 - BOOSTER.thrustSea! / BOOSTER.thrust!;
    const vacuumLoss = 1 - VACUUM.thrustSea! / VACUUM.thrust!;
    expect(vacuumLoss).toBeGreaterThan(boosterLoss * 2);
  });

  it('the vacuum engine is the more efficient one', () => {
    expect(exhaustVelocity(VACUUM)).toBeGreaterThan(exhaustVelocity(BOOSTER));
  });

  it('the booster is the one with thrust', () => {
    expect(BOOSTER.thrustSea!).toBeGreaterThan(VACUUM.thrustSea! * 3);
  });

  it('exhaust velocity is the inverse of burn rate and fuel density', () => {
    expect(exhaustVelocity(BOOSTER)).toBeCloseTo(1 / (BOOSTER.burnRate! * FUEL_DENSITY), 6);
    expect(exhaustVelocity({ ...BOOSTER, burnRate: undefined }))
      .toBeCloseTo(1 / (DEFAULT_BURN_RATE * FUEL_DENSITY), 6);
  });
});

describe('the ascent is long enough to fly', () => {
  // A stage's burn time is roughly its delta-v over its acceleration. The old
  // tuning gave 3.4 s per tank at 34 g, which is less time than a gravity turn
  // takes — the reason orbit was unreachable.
  const burnSeconds = (engine: PartDef, tanks: number) =>
    ((TANK.fuel ?? 0) * tanks) / ((engine.thrust ?? 0) * (engine.burnRate ?? DEFAULT_BURN_RATE));

  it('a first stage burns for more than eight seconds', () => {
    expect(burnSeconds(BOOSTER, 3)).toBeGreaterThan(8);
  });

  it('an upper stage burns for more than eight seconds', () => {
    expect(burnSeconds(VACUUM, 1)).toBeGreaterThan(8);
  });

  it('keeps peak acceleration sane on the intended stack', () => {
    const g = (G * PLANET.mass) / (PLANET.radius * PLANET.radius);
    // Worst moment of each stage: tanks dry, still under full thrust.
    const upperDry = POD.dryMass + VACUUM.dryMass + TANK.dryMass;
    const lowerDry = stageWet(VACUUM, 1, POD.dryMass, false)
      + BOOSTER.dryMass + TANK.dryMass * 3 + DECOUPLER.dryMass;
    expect((VACUUM.thrust ?? 0) / upperDry / g).toBeLessThan(6);
    expect((BOOSTER.thrust ?? 0) / lowerDry / g).toBeLessThan(6);
    // The old tuning peaked at 34 g here, which is what made the ascent a
    // reflex test rather than a flying problem.
    expect((BOOSTER.thrust ?? 0) / lowerDry / g).toBeLessThan(3);
  });
});

describe('the design puzzle discriminates', () => {
  // Roughly what a stable low orbit costs once gravity and drag losses are
  // paid. Below this a design fails; the correct one should clear it.
  const TO_ORBIT = 350;

  it('the intended two-stage reaches orbit and lifts off', () => {
    const upper = stageDv(VACUUM, 1, POD.dryMass, false);
    const upperWet = stageWet(VACUUM, 1, POD.dryMass, false);
    const lower = stageDv(BOOSTER, 3, upperWet, true);
    const wet = stageWet(BOOSTER, 3, upperWet, true);

    expect(upper + lower).toBeGreaterThan(TO_ORBIT);
    expect(liftoffTwr(BOOSTER, wet)).toBeGreaterThan(1.1);
  });

  it('no single stage both has the delta-v and can leave the pad', () => {
    // Stacking tanks onto the efficient engine does eventually buy the delta-v
    // — but that rocket is far too heavy for the thrust it has. Staging is the
    // only way to satisfy both constraints at once, which is the whole point.
    for (const engine of [BOOSTER, VACUUM])
      for (const tanks of [1, 2, 3, 4, 5, 6]) {
        const dv = stageDv(engine, tanks, POD.dryMass, false);
        const twr = liftoffTwr(engine, stageWet(engine, tanks, POD.dryMass, false));
        expect(dv > TO_ORBIT && twr > 1, `${engine.id} × ${tanks} tanks`).toBe(false);
      }
  });

  it('a vacuum engine cannot lift its own rocket off the pad', () => {
    const wet = stageWet(VACUUM, 1, POD.dryMass, false);
    expect(liftoffTwr(VACUUM, wet)).toBeLessThan(1);
  });

  it('putting the vacuum engine on the first stage strands it on the pad', () => {
    const upperWet = stageWet(BOOSTER, 1, POD.dryMass, false);
    const wet = stageWet(VACUUM, 3, upperWet, true);
    expect(liftoffTwr(VACUUM, wet)).toBeLessThan(1);
  });

  it('boosters on both stages fall short — the upper stage wants efficiency', () => {
    const upperWet = stageWet(BOOSTER, 1, POD.dryMass, false);
    const total = stageDv(BOOSTER, 1, POD.dryMass, false)
      + stageDv(BOOSTER, 3, upperWet, true);
    expect(total).toBeLessThan(TO_ORBIT);
  });
});
