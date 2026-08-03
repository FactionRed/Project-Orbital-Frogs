// src/ui/hold-panel.ts
import type { HoldMode } from '../flight/flight-controller';
import { DskyKey } from './components';

/**
 * Bottom-center attitude-hold key panel. Each key sets a hold mode on the
 * active FlightController; clicking the active mode again turns it off.
 *
 * The keys are worded, not glyph-only: the old ● ⊘ ▲ ▼ ◉ ◎ set was
 * unreadable to anyone who hadn't already played KSP.
 */
const MODES: ReadonlyArray<{ mode: HoldMode; word: string; hint: string }> = [
  { mode: 'prograde', word: 'PRO', hint: 'prograde' },
  { mode: 'retrograde', word: 'RET', hint: 'retrograde' },
  { mode: 'normal', word: 'NRM', hint: 'normal +' },
  { mode: 'antinormal', word: 'ANTI', hint: 'normal −' },
  { mode: 'radialout', word: 'RAD+', hint: 'radial out' },
  { mode: 'radialin', word: 'RAD−', hint: 'radial in' },
];

export class HoldPanel {
  private root: HTMLElement;
  private keys = new Map<HoldMode, DskyKey>();
  /** Called when the user picks a mode (or toggles it off). */
  onSelect: (mode: HoldMode) => void = () => {};
  private active: HoldMode = 'off';

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'hold-panel';
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', 'Attitude hold');
    document.body.appendChild(this.root);

    for (const { mode, word, hint } of MODES) {
      const key = new DskyKey(word, hint, () => {
        // Toggle: clicking the active mode turns it off.
        this.onSelect(this.active === mode ? 'off' : mode);
      });
      key.el.title = hint;
      this.keys.set(mode, key);
      this.root.appendChild(key.el);
    }
  }

  show(): void {
    this.root.style.display = 'flex';
  }
  hide(): void {
    this.root.style.display = 'none';
  }

  /** Reflect the current mode (highlight the active key). */
  setActive(mode: HoldMode): void {
    this.active = mode;
    for (const [m, key] of this.keys) key.setActive(m === mode);
  }
}
