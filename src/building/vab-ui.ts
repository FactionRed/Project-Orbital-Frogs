// src/building/vab-ui.ts
import { PARTS_CATALOG } from '../entities/parts-catalog';
import { isPartUnlocked } from '../game/tech-tree';
import type { ScienceState } from '../game/science';

export interface VabUiCallbacks {
  onSelectPart: (partId: string | null) => void;
  onDeleteSelected: () => void;
  onRotateSelected: (degrees: number) => void;
  onClear: () => void;
  onLaunch: () => void;
}

export class VabUi {
  private root: HTMLElement;
  private launchBtn: HTMLButtonElement;
  private sciState: ScienceState | null = null;
  onReadyChange: (canLaunch: boolean) => void = () => {};

  constructor(cbs: VabUiCallbacks) {
    this.root = document.createElement('div');
    this.root.id = 'vab-ui';
    this.root.innerHTML = `
      <div class="panel">
        <h2>Parts</h2>
        <div id="palette"></div>
      </div>
      <div class="panel actions">
        <button id="rotate-q">Rotate -90°</button>
        <button id="rotate-e">Rotate +90°</button>
        <button id="delete">Delete (Del)</button>
        <button id="clear">Clear All</button>
        <button id="launch" disabled>Launch ▶</button>
      </div>
    `;
    document.body.appendChild(this.root);

    const palette = this.root.querySelector('#palette')!;
    palette.innerHTML = '';
    for (const p of PARTS_CATALOG) {
      const unlocked = !this.sciState || isPartUnlocked(p.id, this.sciState.unlockedNodes);
      const btn = document.createElement('button');
      btn.className = 'part-btn';
      if (!unlocked) btn.classList.add('part-locked');
      btn.dataset.partId = p.id;
      btn.title = p.desc;
      btn.disabled = !unlocked;
      btn.innerHTML = `<span class="swatch" style="background:#${p.color
        .toString(16)
        .padStart(6, '0')}"></span>${p.name}${unlocked ? '' : ' 🔒'}<br><small>${p.dryMass}t${
        p.fuel ? ` · ${p.fuel} fuel` : ''
      }${p.thrust ? ` · ${p.thrust}kN` : ''} · ${p.desc}</small>`;
      if (unlocked) btn.addEventListener('click', () => cbs.onSelectPart(p.id));
      palette.appendChild(btn);
    }

    this.root.querySelector('#rotate-q')!.addEventListener('click', () => cbs.onRotateSelected(-90));
    this.root.querySelector('#rotate-e')!.addEventListener('click', () => cbs.onRotateSelected(90));
    this.root.querySelector('#delete')!.addEventListener('click', () => cbs.onDeleteSelected());
    this.root.querySelector('#clear')!.addEventListener('click', () => cbs.onClear());
    this.launchBtn = this.root.querySelector('#launch') as HTMLButtonElement;
    this.launchBtn.addEventListener('click', () => cbs.onLaunch());

    this.onReadyChange = (ready) => {
      this.launchBtn.disabled = !ready;
    };
  }

  /** Update which parts are unlocked (called when science state changes). */
  updateScienceState(state: ScienceState): void {
    this.sciState = state;
  }

  show(): void {
    this.root.style.display = 'flex';
  }
  hide(): void {
    this.root.style.display = 'none';
  }
}
