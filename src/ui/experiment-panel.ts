// src/ui/experiment-panel.ts
import type { FlightController } from '../flight/flight-controller';
import { getPartDef } from '../entities/parts-catalog';
import type { ScienceState } from '../game/science';
import { experimentKey, isExperimentCompleted, completeExperiment } from '../game/science';
import { getBiome, getSituation, canRunExperiment, experimentBaseValue } from '../game/biomes';
import { ATMOSPHERE } from '../physics/constants';

/**
 * Experiment panel — shown during flight when the ship has science instruments.
 * Displays available experiments (based on situation + instruments equipped),
 * lets the player run them, and shows science earned.
 *
 * "Run" stores the result in the pod. Science is awarded on recovery or
 * transmission (handled by win-states / flight-controller).
 *
 * For simplicity in this prototype, running an experiment immediately awards
 * science (no transmit/recover distinction yet).
 */
export class ExperimentPanel {
  private root: HTMLElement;
  private list: HTMLElement;
  private sciState: ScienceState;
  private onScienceUpdate: (state: ScienceState) => void;

  constructor(sciState: ScienceState, onScienceUpdate: (state: ScienceState) => void) {
    this.sciState = sciState;
    this.onScienceUpdate = onScienceUpdate;

    this.root = document.createElement('div');
    this.root.id = 'experiment-panel';
    this.root.innerHTML = `
      <div class="exp-header">🔬 Science</div>
      <div id="exp-list"></div>
    `;
    document.body.appendChild(this.root);
    this.list = this.root.querySelector('#exp-list')!;
    this.hide();
  }

  private lastListKey = '';

  /** Called each physics step during flight. */
  update(flight: FlightController): void {
    const root = flight.ship.rootBody;
    const dom = flight.dominantBodyFor(root.position);
    const domPos = dom.position;
    const dx = root.position.x - domPos.x;
    const dy = root.position.y - domPos.y;
    const dz = root.position.z - domPos.z;
    const dist = Math.hypot(dx, dy, dz);
    const alt = dist - dom.data.radius;

    // Find equipped science instruments.
    const instruments: string[] = [];
    for (const sb of flight.ship.shipBodies) {
      for (const meta of sb.parts.values()) {
        const def = getPartDef(meta.partId);
        if (def.kind === 'thermometer' || def.kind === 'barometer' || def.kind === 'gravity_scanner') {
          if (!instruments.includes(def.kind)) instruments.push(def.kind);
        }
      }
    }

    if (instruments.length === 0) {
      this.hide();
      return;
    }

    // Determine situation.
    const atmHeight = dom.data.kind === 'planet' ? ATMOSPHERE.height : 0;
    const situation = getSituation(alt, atmHeight);
    const hasAtmosphere = atmHeight > 0;

    // Determine biome (only meaningful when landed).
    let biome = 'N/A';
    if (situation === 'landed' && dist > 0) {
      const nx = dx / dist, ny = dy / dist, nz = dz / dist;
      const surfaceR = dom.terrainRadiusAt(nx, ny, nz);
      const displacement = surfaceR - dom.data.radius;
      // For moon, compute direction from moon to planet for near/far side.
      let planetDirX = 0, planetDirY = 0, planetDirZ = 0;
      if (dom !== flight.planet) {
        const pdx = flight.planet.position.x - dom.position.x;
        const pdy = flight.planet.position.y - dom.position.y;
        const pdz = flight.planet.position.z - dom.position.z;
        const plen = Math.hypot(pdx, pdy, pdz);
        if (plen > 0) { planetDirX = pdx/plen; planetDirY = pdy/plen; planetDirZ = pdz/plen; }
      }
      const biomeInfo = getBiome(nx, ny, nz, displacement, dom.data.kind ?? 'planet', planetDirX, planetDirY, planetDirZ);
      biome = biomeInfo.name;
    }

    // Build a cache key — only rebuild DOM if something changed.
    const listKey = `${instruments.join(',')}:${dom.data.name}:${biome}:${situation}:${this.sciState.completedExperiments.length}`;
    if (listKey === this.lastListKey) {
      // Nothing changed — keep current DOM, just ensure visibility.
      this.show();
      return;
    }
    this.lastListKey = listKey;

    // Build experiment list.
    this.list.innerHTML = '';

    for (const kind of instruments) {
      const canRun = canRunExperiment(kind, situation, alt, hasAtmosphere);
      const baseValue = experimentBaseValue(kind);
      const key = experimentKey(kind, dom.data.name, biome, situation);
      const completed = isExperimentCompleted(this.sciState, key);

      const instDef = getPartDef(kind);
      const item = document.createElement('div');
      item.className = 'exp-item';
      if (!canRun) {
        item.classList.add('exp-disabled');
      } else if (completed) {
        item.classList.add('exp-done');
      }

      const status = !canRun ? '🔒' : completed ? '✓' : '▶';
      const valueText = completed ? `+${Math.round(baseValue * 0.2)}` : `+${baseValue}`;

      item.innerHTML = `
        <span class="exp-name">${instDef?.name ?? kind}</span>
        <span class="exp-detail">${biome} · ${situation}</span>
        <span class="exp-value">${valueText}</span>
        <button class="exp-btn" data-kind="${kind}" ${!canRun ? 'disabled' : ''}>${status}</button>
      `;

      const btn = item.querySelector('.exp-btn')!;
      btn.addEventListener('click', () => {
        if (!canRun) return;
        const result = completeExperiment(this.sciState, key, baseValue);
        this.sciState = result.state;
        this.onScienceUpdate(this.sciState);
        this.lastListKey = ''; // force rebuild next frame
      });

      this.list.appendChild(item);
    }

    // Show panel if ship has instruments, regardless of runnable state.
    this.show();
  }

  updateScienceState(state: ScienceState): void {
    this.sciState = state;
  }

  show(): void { this.root.style.display = 'block'; }
  hide(): void { this.root.style.display = 'none'; }
}
