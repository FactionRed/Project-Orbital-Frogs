// src/ui/staging-display.ts
import type { FlightController } from '../flight/flight-controller';

/**
 * KSP-style staging list shown on the left side during flight.
 * Shows each stage with its engine/tank count and highlights the active stage.
 */
export class StagingDisplay {
  private root: HTMLElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'staging-panel';
    document.body.appendChild(this.root);
  }

  /** Rebuild the panel from the flight's stage list. Call once on launch. */
  build(flight: FlightController): void {
    this.root.innerHTML = '';
    const stages = flight.getStages();
    if (stages.length === 0) return;
    // Stages are ordered bottom-up (stage 0 fires first). Display top-down so
    // the current/next stage is at the top — reverse the iteration.
    for (let i = stages.length - 1; i >= 0; i--) {
      const st = stages[i];
      const slot = document.createElement('div');
      slot.className = 'stage-slot';
      if (i === flight.currentStageIndex) slot.classList.add('active');

      const parts: string[] = [];
      if (st.engineUids.length) parts.push(`${st.engineUids.length}× engine`);
      if (st.tankUids.length) parts.push(`${st.tankUids.length}× tank`);
      if (st.decouplerUid) parts.push('decoupler');
      if (parts.length === 0) parts.push('empty');

      slot.innerHTML = `
        <span class="stage-num">${i}</span>
        <span class="stage-icon">🔥</span>
        <span class="stage-parts">${parts.map((p) => `<span>${p}</span>`).join('')}</span>
      `;
      this.root.appendChild(slot);
    }
  }

  /** Update the active-stage highlight. Call each frame. */
  update(flight: FlightController): void {
    const slots = this.root.children;
    for (let i = 0; i < slots.length; i++) {
      // Slot DOM order is top-down (reversed from stage array). The active
      // stage in the array is currentStageIndex. Map: array idx = slots.length-1-i.
      const arrayIdx = slots.length - 1 - i;
      if (arrayIdx === flight.currentStageIndex) {
        slots[i].classList.add('active');
      } else {
        slots[i].classList.remove('active');
      }
    }
  }

  show(): void {
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }
}
