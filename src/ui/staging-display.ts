// src/ui/staging-display.ts
import type { FlightController } from '../flight/flight-controller';
import { Panel } from './components';

/**
 * KSP-style staging list shown on the left side during flight.
 * Shows each stage with its engine/tank count and highlights the active stage.
 * Slots reuse the .dsky-key look so the panel reads as part of the same
 * instrument set, but they are indicators — pointer-events are off in CSS.
 */
export class StagingDisplay {
  private root: HTMLElement;
  private list: HTMLElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'staging-panel';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Staging');

    const panel = new Panel('STAGING');
    this.list = document.createElement('div');
    this.list.className = 'stage-list';
    panel.el.appendChild(this.list);
    this.root.appendChild(panel.el);
    document.body.appendChild(this.root);
  }

  /** Rebuild the panel from the flight's stage list. Call once on launch. */
  build(flight: FlightController): void {
    this.list.replaceChildren();
    const stages = flight.getStages();
    if (stages.length === 0) return;
    // Stages are ordered bottom-up (stage 0 fires first). Display top-down so
    // the current/next stage is at the top — reverse the iteration.
    for (let i = stages.length - 1; i >= 0; i--) {
      const st = stages[i];
      const slot = document.createElement('div');
      slot.className = 'dsky-key stage-slot';
      if (i === flight.currentStageIndex) slot.dataset.active = '';

      const parts: string[] = [];
      if (st.engineUids.length) parts.push(`${st.engineUids.length}× engine`);
      if (st.tankUids.length) parts.push(`${st.tankUids.length}× tank`);
      if (st.decouplerUid) parts.push('decoupler');
      if (parts.length === 0) parts.push('empty');

      const word = document.createElement('span');
      word.className = 'dsky-key__word';
      word.textContent = `STAGE ${i}`;
      const hint = document.createElement('span');
      hint.className = 'dsky-key__hint';
      hint.textContent = parts.join(' · ');
      slot.append(word, hint);
      this.list.appendChild(slot);
    }
  }

  /** Update the active-stage highlight. Call each frame. */
  update(flight: FlightController): void {
    const slots = this.list.children;
    for (let i = 0; i < slots.length; i++) {
      // Slot DOM order is top-down (reversed from stage array). The active
      // stage in the array is currentStageIndex. Map: array idx = slots.length-1-i.
      const arrayIdx = slots.length - 1 - i;
      const slot = slots[i] as HTMLElement;
      if (arrayIdx === flight.currentStageIndex) slot.dataset.active = '';
      else delete slot.dataset.active;
    }
  }

  show(): void {
    this.root.style.display = 'block';
  }

  hide(): void {
    this.root.style.display = 'none';
  }
}
