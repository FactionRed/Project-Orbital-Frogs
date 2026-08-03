// src/ui/components/panel.ts
// Bezelled container. A `label` renders as a notch on the top border via the
// [data-label] rule in components.css.
export class Panel {
  readonly el: HTMLDivElement;

  constructor(label?: string, variant: 'bezel' | 'flat' = 'bezel') {
    this.el = document.createElement('div');
    this.el.className = 'panel';
    this.el.dataset.variant = variant;
    if (label) this.el.dataset.label = label;
  }
}
