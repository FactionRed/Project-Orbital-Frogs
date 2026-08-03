// src/ui/components/readout.ts
// Labelled instrument value: LABEL  <big value>  unit. The state drives a
// leading status glyph and (for alarm) the value color — see components.css.
export type ReadoutState = 'nominal' | 'caution' | 'alarm';

export class Readout {
  readonly el: HTMLDivElement;
  private readonly valueEl: HTMLSpanElement;

  constructor(label: string, unit = '') {
    this.el = document.createElement('div');
    this.el.className = 'readout';
    this.el.dataset.state = 'nominal';

    const labelEl = document.createElement('span');
    labelEl.className = 'readout__label';
    labelEl.textContent = label;

    this.valueEl = document.createElement('span');
    this.valueEl.className = 'readout__value';

    const unitEl = document.createElement('span');
    unitEl.className = 'readout__unit';
    unitEl.textContent = unit;

    this.el.append(labelEl, this.valueEl, unitEl);
  }

  setValue(v: string | number): void {
    this.valueEl.textContent = String(v);
  }

  setState(s: ReadoutState): void {
    this.el.dataset.state = s;
  }
}
