// src/ui/components/gauge.ts
// Horizontal fill bar on a 0..100 viewBox, so setFraction() maps straight onto
// the rect width. The threshold recolors the fill without touching layout.
export type GaugeKind = 'bar' | 'arc';
export type GaugeThreshold = 'nominal' | 'caution' | 'alarm';

const SVG_NS = 'http://www.w3.org/2000/svg';

const THRESHOLD_FILL: Record<GaugeThreshold, string> = {
  nominal: 'var(--green)',
  caution: 'var(--warn)',
  alarm: 'var(--red)',
};

export class Gauge {
  readonly el: HTMLDivElement;
  private readonly fillRect: SVGRectElement;
  private readonly valueEl: HTMLSpanElement;

  constructor(kind: GaugeKind) {
    this.el = document.createElement('div');
    this.el.className = 'gauge';
    this.el.dataset.kind = kind;
    this.el.dataset.threshold = 'nominal';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 8');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.classList.add('gauge__svg');

    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', '100');
    bg.setAttribute('height', '8');
    bg.setAttribute('fill', 'var(--phosphor-bg)');
    bg.setAttribute('stroke', 'var(--panel-border)');

    this.fillRect = document.createElementNS(SVG_NS, 'rect');
    this.fillRect.setAttribute('data-fill', '');
    this.fillRect.setAttribute('x', '0');
    this.fillRect.setAttribute('y', '0');
    this.fillRect.setAttribute('width', '0');
    this.fillRect.setAttribute('height', '8');
    this.fillRect.setAttribute('fill', THRESHOLD_FILL.nominal);

    svg.append(bg, this.fillRect);
    this.el.appendChild(svg);

    this.valueEl = document.createElement('span');
    this.valueEl.className = 'gauge__value';
    this.el.appendChild(this.valueEl);
  }

  /** `frac` is clamped to 0..1; a non-finite value reads as empty. */
  setFraction(frac: number, label = ''): void {
    const clamped = Number.isFinite(frac) ? Math.max(0, Math.min(1, frac)) : 0;
    this.fillRect.setAttribute('width', String(clamped * 100));
    if (label) this.valueEl.textContent = label;
  }

  setThreshold(t: GaugeThreshold): void {
    this.el.dataset.threshold = t;
    this.fillRect.setAttribute('fill', THRESHOLD_FILL[t]);
  }
}
