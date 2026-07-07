// src/game/biomes.ts

/**
 * Biome detection — determines which biome the ship is in based on its
 * position relative to a celestial body. Uses the terrain displacement
 * value (from the same noise function as the visual mesh) to classify
 * terrain type, plus angular position for polar/equatorial distinction.
 *
 * Biomes are simplified compared to KSP (4-5 per body instead of 10+).
 * The biome + situation + instrument determines what science experiments
 * can be run.
 */

export type Situation = 'landed' | 'flying-low' | 'flying-high' | 'space-low' | 'space-high';

export interface BiomeInfo {
  name: string;
  /** Display-friendly description. */
  desc: string;
}

/**
 * Determine the biome at a given position on a celestial body.
 *
 * @param dirX,dirY,dirZ — unit direction from body center to ship
 * @param displacement — terrain displacement at this point (meters, from terrainRadiusAt - radius).
 *                       Positive = above base radius (highlands), negative = below (lowlands/ocean).
 * @param kind — 'planet' or 'moon'
 * @returns biome name
 */
export function getBiome(
  dirX: number, dirY: number, dirZ: number,
  displacement: number,
  kind: 'planet' | 'moon',
  planetDirX = 0, planetDirY = 0, planetDirZ = 0,
): BiomeInfo {
  if (kind === 'planet') {
    // Polar regions (near north or south pole).
    const absY = Math.abs(dirY);
    if (absY > 0.9) {
      return { name: 'Polar', desc: 'Frozen polar region' };
    }

    // Ocean (displacement well below base radius).
    if (displacement < -30) {
      return { name: 'Ocean', desc: 'Open ocean' };
    }

    // Lowlands (slightly below or at base radius).
    if (displacement < 20) {
      return { name: 'Lowlands', desc: 'Flat lowland plains' };
    }

    // Highlands (well above base radius).
    return { name: 'Highlands', desc: 'Elevated mountainous terrain' };
  }

  // Moon biomes — simpler.
  const absY = Math.abs(dirY);
  if (absY > 0.85) {
    return { name: 'Lunar Poles', desc: 'Frozen polar craters' };
  }

  // Near side (facing the planet) vs far side.
  // Use the direction from moon center to planet center (planetDir).
  // If the ship's direction from moon center aligns with planetDir, it's near side.
  const dot = dirX * planetDirX + dirY * planetDirY + dirZ * planetDirZ;
  if (dot > 0) {
    return { name: 'Near Side', desc: 'The face that sees the planet' };
  }
  return { name: 'Far Side', desc: 'The hidden face' };
}

/**
 * Determine the flight situation based on altitude and atmosphere.
 *
 * @param alt — altitude above surface (meters)
 * @param atmHeight — atmosphere height (0 if no atmosphere)
 */
export function getSituation(alt: number, atmHeight: number): Situation {
  if (alt <= 5) return 'landed'; // on surface (5m tolerance for collision offset)
  if (atmHeight > 0 && alt < atmHeight * 0.3) return 'flying-low';
  if (atmHeight > 0 && alt < atmHeight) return 'flying-high';
  if (alt < 50000) return 'space-low';
  return 'space-high';
}

/**
 * Check if an instrument can be used in the current situation.
 */
export function canRunExperiment(
  instrumentKind: string,
  situation: Situation,
  alt: number,
  hasAtmosphere: boolean,
): boolean {
  switch (instrumentKind) {
    case 'thermometer':
      // Works landed or in atmosphere.
      return situation === 'landed' || (hasAtmosphere && alt < 5000);
    case 'barometer':
      // Atmosphere only.
      return hasAtmosphere && alt >= 0 && alt < 5000;
    case 'gravity_scanner':
      // Landed only.
      return situation === 'landed';
    default:
      return false;
  }
}

/** Base science value per instrument. */
export function experimentBaseValue(instrumentKind: string): number {
  switch (instrumentKind) {
    case 'thermometer': return 5;
    case 'barometer': return 8;
    case 'gravity_scanner': return 12;
    default: return 0;
  }
}
