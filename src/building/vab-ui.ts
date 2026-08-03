// src/building/vab-ui.ts
import { PARTS_CATALOG } from '../entities/parts-catalog';
import { launchReadiness, launchBlockerText } from '../entities/ship';
import type { ShipDesign } from '../entities/ship';
import { Panel, DskyKey, Tooltip } from '../ui/components';

export interface VabUiCallbacks {
  onSelectPart: (partId: string | null) => void;
  onDeleteSelected: () => void;
  onRotateSelected: (degrees: number) => void;
  onClear: () => void;
  onLaunch: () => void;
}

export class VabUi {
  private root: HTMLElement;
  private launchKey: DskyKey;
  private statusLine: HTMLElement;
  private launchTooltip: Tooltip;
  private design: ShipDesign | null = null;
  private lastStatus = '';

  constructor(cbs: VabUiCallbacks) {
    this.root = document.createElement('div');
    this.root.id = 'vab-ui';

    // --- Parts catalog ---
    const catalog = new Panel('PARTS CATALOG');
    const partList = document.createElement('div');
    partList.className = 'part-list';
    for (const p of PARTS_CATALOG) {
      const stats = [
        `${p.dryMass}t`,
        p.fuel ? `${p.fuel} fuel` : '',
        p.thrust ? `${p.thrust}kN` : '',
      ].filter(Boolean).join(' · ');
      const key = new DskyKey(p.name.toUpperCase(), stats, () => cbs.onSelectPart(p.id));
      key.el.classList.add('part-key');
      key.el.dataset.partId = p.id;
      key.el.title = p.desc;
      partList.appendChild(key.el);
    }
    catalog.el.appendChild(partList);

    // --- Telemetry stub (vessel stats are a deferred feature; spec §5.2) ---
    const telemetry = new Panel('TELEMETRY');
    telemetry.el.classList.add('telemetry-stub');
    const pending = document.createElement('div');
    pending.className = 'telemetry-pending';
    pending.textContent = 'TELEMETRY PENDING — vessel stats in a later release';
    telemetry.el.appendChild(pending);

    // --- Actions ---
    const actions = new Panel('ACTIONS');
    this.statusLine = document.createElement('div');
    this.statusLine.className = 'readiness-status';
    this.statusLine.setAttribute('role', 'status');
    actions.el.appendChild(this.statusLine);

    const actionsRow = document.createElement('div');
    actionsRow.className = 'actions-row';
    actionsRow.append(
      new DskyKey('ROT −90', 'Q', () => cbs.onRotateSelected(-90)).el,
      new DskyKey('ROT +90', 'E', () => cbs.onRotateSelected(90)).el,
      new DskyKey('DELETE', 'Del', () => cbs.onDeleteSelected()).el,
      new DskyKey('CLEAR', 'all', () => cbs.onClear()).el,
    );

    this.launchKey = new DskyKey('LAUNCH', 'to flight', () => cbs.onLaunch());
    this.launchKey.el.id = 'launch';
    this.launchKey.setEnabled(false);
    actionsRow.appendChild(this.launchKey.el);
    actions.el.appendChild(actionsRow);

    // Critical #2: hovering the disabled key says what the design still needs.
    // A disabled button swallows pointer events, so the tooltip listens on a
    // wrapper around it instead.
    const launchHover = document.createElement('span');
    launchHover.className = 'launch-hover';
    this.launchKey.el.replaceWith(launchHover);
    launchHover.appendChild(this.launchKey.el);
    this.launchTooltip = new Tooltip();
    document.body.appendChild(this.launchTooltip.el);
    this.launchTooltip.attach(launchHover, () => this.blockerText());

    this.root.append(catalog.el, telemetry.el, actions.el);
    document.body.appendChild(this.root);
    this.renderReadiness();
  }

  /**
   * Point the UI at the live design so it can explain readiness, then refresh.
   * Called on every VAB frame and after each placement.
   */
  setDesign(design: ShipDesign): void {
    this.design = design;
    this.renderReadiness();
  }

  /** Retained for callers that only know the boolean. */
  onReadyChange: (canLaunch: boolean) => void = (ready) => {
    this.launchKey.setEnabled(ready);
  };

  show(): void {
    this.root.style.display = 'flex';
    this.renderReadiness();
  }
  hide(): void {
    this.root.style.display = 'none';
    this.launchTooltip.hide();
  }

  private blockerText(): string {
    return this.design ? launchBlockerText(this.design) : '';
  }

  private renderReadiness(): void {
    if (!this.design) return;
    const r = launchReadiness(this.design);
    const text = r.ok ? '● READY' : `○ NOT READY — ${this.blockerText()}`;
    // setDesign runs every VAB frame; skip the DOM write when nothing moved.
    if (text === this.lastStatus) return;
    this.lastStatus = text;
    this.launchKey.setEnabled(r.ok);
    this.statusLine.textContent = text;
    this.statusLine.dataset.state = r.ok ? 'nominal' : 'caution';
  }
}
