// src/ui/main-menu.ts
/**
 * Main menu overlay — shown during INIT state over the 3D crash scene.
 * Boot-screen styling: a MISSION OPS panel of DSKY keys, plus an always-visible
 * FLIGHT PROCEDURES card so the controls are legible before launch rather than
 * only from the in-game hints overlay.
 */
import { Panel, DskyKey } from './components';

/** Key/action pairs. Every entry here is a binding that actually exists. */
const BUILD_CONTROLS: ReadonlyArray<readonly [string, string]> = [
  ['LMB', 'place / select part'],
  ['RMB-drag', 'orbit view'],
  ['WHEEL', 'zoom'],
  ['Q / E', 'rotate part'],
  ['DEL', 'remove part'],
  ['ESC', 'cancel / pause'],
  ['H', 'toggle hints'],
];

const FLY_CONTROLS: ReadonlyArray<readonly [string, string]> = [
  ['SHIFT / CTRL', 'throttle ± '],
  ['Z / X', 'full / cut'],
  ['SPACE', 'stage'],
  ['W S A D', 'pitch / yaw'],
  ['Q / E', 'roll'],
  ['T', 'stability assist'],
  ['F hold', 'override SAS'],
  ['CAPS', 'precision mode'],
  ['M', 'orbit map'],
  ['ESC', 'pause / settings'],
  ['F1', 'revert to VAB'],
];

export class MainMenu {
  private root: HTMLElement;
  private startBtn: HTMLButtonElement;

  /** Opens the settings overlay. Wired in main.ts. */
  onSettings: () => void = () => {};

  constructor(onStart: () => void) {
    this.root = document.createElement('div');
    this.root.id = 'main-menu';

    const card = new Panel('MISSION OPS');
    card.el.classList.add('title-card');

    const title = document.createElement('h1');
    title.className = 'menu-title';
    title.textContent = 'PROJECT ORBITAL FROGS';

    const subtitle = document.createElement('p');
    subtitle.className = 'menu-subtitle';
    subtitle.textContent = 'A MINIATURE SPACE PROGRAM';

    const rule = document.createElement('hr');
    rule.className = 'menu-rule';

    const startBtn = new DskyKey('ENTER', 'to VAB', onStart);
    startBtn.el.classList.add('menu-btn--primary');
    startBtn.el.id = 'menu-start';
    this.startBtn = startBtn.el;
    const settingsBtn = new DskyKey('SETTINGS', 'theme, motion', () => this.onSettings());
    settingsBtn.el.classList.add('menu-btn--ghost');
    settingsBtn.el.id = 'menu-settings';
    const quitBtn = new DskyKey('QUIT', 'exit', () => window.close());
    quitBtn.el.classList.add('menu-btn--ghost');
    quitBtn.el.id = 'menu-quit';

    const btnRow = document.createElement('div');
    btnRow.className = 'menu-buttons';
    btnRow.append(startBtn.el, settingsBtn.el, quitBtn.el);

    card.el.append(title, subtitle, rule, btnRow);

    // Critical #3: controls reference, always visible on the title screen.
    const controls = new Panel('FLIGHT PROCEDURES');
    controls.el.classList.add('controls-card');
    controls.el.appendChild(buildControlsTable());

    const ver = document.createElement('div');
    ver.className = 'menu-version';
    ver.textContent = `REL ${__APP_VERSION__} · BUILD ${__BUILD_SHA__}`;

    this.root.append(card.el, controls.el, ver);
    this.hide();
  }

  show(): void {
    this.root.style.display = 'flex';
    // Land the caret on the primary action so the title screen is reachable
    // with the keyboard alone — Tab then cycles ENTER → SETTINGS → QUIT.
    this.startBtn.focus();
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  get element(): HTMLElement {
    return this.root;
  }
}

function buildControlsTable(): HTMLDivElement {
  const cols = document.createElement('div');
  cols.className = 'controls-cols';
  cols.append(
    buildControlsColumn('BUILD', BUILD_CONTROLS),
    buildControlsColumn('FLY', FLY_CONTROLS),
  );
  return cols;
}

function buildControlsColumn(
  heading: string,
  rows: ReadonlyArray<readonly [string, string]>,
): HTMLDivElement {
  const col = document.createElement('div');
  col.className = 'controls-col';
  const h = document.createElement('h4');
  h.textContent = heading;
  col.appendChild(h);
  for (const [k, action] of rows) {
    const row = document.createElement('div');
    row.className = 'controls-row';
    const keyEl = document.createElement('span');
    keyEl.className = 'controls-key';
    keyEl.textContent = k;
    const actEl = document.createElement('span');
    actEl.className = 'controls-act';
    actEl.textContent = action;
    row.append(keyEl, actEl);
    col.appendChild(row);
  }
  return col;
}
