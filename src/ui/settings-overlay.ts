// src/ui/settings-overlay.ts
import { Panel, DskyKey, Toggle } from './components';
import {
  currentTheme, applyTheme, reducedMotionEnabled, setReducedMotionOverride,
} from './theme';

/**
 * Pause / settings overlay. Esc opens it from BUILD or FLIGHT; while it is up
 * the physics step is skipped, so a paused flight really is frozen.
 *
 * QUIT TO MENU throws away the current vessel, so it asks first.
 */
export class SettingsOverlay {
  readonly el: HTMLDivElement;
  onResume: () => void = () => {};
  onQuitToMenu: () => void = () => {};

  private readonly themeToggle: Toggle;
  private readonly motionToggle: Toggle;
  private readonly confirm: HTMLDivElement;
  private readonly quitKey: DskyKey;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'settings-overlay';
    this.el.style.display = 'none';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', 'System config');

    const backdrop = document.createElement('div');
    backdrop.className = 'overlay-backdrop';
    this.el.appendChild(backdrop);

    const panel = new Panel('SYSTEM CONFIG');

    this.themeToggle = new Toggle('VINTAGE CRT', currentTheme() === 'vintage', (checked) => {
      applyTheme(checked ? 'vintage' : 'modern');
    });
    this.motionToggle = new Toggle('ON', reducedMotionEnabled(), (checked) => {
      setReducedMotionOverride(checked ? 'on' : 'off');
      // Re-apply so the CSS variables recompute against the new preference.
      applyTheme(currentTheme());
    });
    panel.el.append(
      configRow('DISPLAY', this.themeToggle.el),
      configRow('REDUCED MOTION', this.motionToggle.el),
    );

    const btnRow = document.createElement('div');
    btnRow.className = 'overlay-buttons';
    this.quitKey = new DskyKey('QUIT', 'to menu', () => this.askQuitConfirm());
    btnRow.append(
      new DskyKey('RESUME', 'Esc', () => this.onResume()).el,
      this.quitKey.el,
    );
    panel.el.appendChild(btnRow);

    // Inline confirm strip, hidden until QUIT is pressed.
    this.confirm = document.createElement('div');
    this.confirm.className = 'overlay-confirm';
    this.confirm.style.display = 'none';
    const question = document.createElement('span');
    question.className = 'overlay-confirm__text';
    question.textContent = 'End this flight and return to the menu?';
    const yes = new DskyKey('YES', 'discard', () => {
      this.hideConfirm();
      this.onQuitToMenu();
    });
    const no = new DskyKey('NO', 'stay', () => this.hideConfirm());
    this.confirm.append(question, yes.el, no.el);
    panel.el.appendChild(this.confirm);

    this.el.appendChild(panel.el);
    document.body.appendChild(this.el);
  }

  get visible(): boolean {
    return this.el.style.display !== 'none';
  }

  show(): void {
    // Reflect the live settings each time it opens — devtools or another
    // surface may have changed them since.
    this.themeToggle.setChecked(currentTheme() === 'vintage');
    this.motionToggle.setChecked(reducedMotionEnabled());
    this.hideConfirm();
    this.el.style.display = 'flex';
    // Focus the panel so Tab starts inside the dialog, not behind it.
    (this.el.querySelector('.dsky-key') as HTMLElement | null)?.focus();
  }

  hide(): void {
    this.el.style.display = 'none';
    this.hideConfirm();
  }

  private askQuitConfirm(): void {
    this.confirm.style.display = 'flex';
    this.quitKey.setActive(true);
    (this.confirm.querySelector('.dsky-key') as HTMLElement | null)?.focus();
  }

  private hideConfirm(): void {
    this.confirm.style.display = 'none';
    this.quitKey.setActive(false);
  }
}

function configRow(label: string, control: HTMLElement): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'config-row';
  const labelEl = document.createElement('span');
  labelEl.className = 'config-row__label';
  labelEl.textContent = label;
  row.append(labelEl, control);
  return row;
}
