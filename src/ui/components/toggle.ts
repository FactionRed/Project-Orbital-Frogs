// src/ui/components/toggle.ts
// Checkbox styled as a panel switch. The <input> stays in the DOM (hidden by
// CSS, not removed) so keyboard focus and screen readers still work.
export class Toggle {
  readonly el: HTMLLabelElement;
  readonly input: HTMLInputElement;

  constructor(label: string, checked = false, onChange?: (checked: boolean) => void) {
    this.el = document.createElement('label');
    this.el.className = 'toggle';

    this.input = document.createElement('input');
    this.input.type = 'checkbox';
    this.input.checked = checked;

    const track = document.createElement('span');
    track.className = 'toggle__track';
    const thumb = document.createElement('span');
    thumb.className = 'toggle__thumb';
    track.appendChild(thumb);

    const labelEl = document.createElement('span');
    labelEl.className = 'toggle__label';
    labelEl.textContent = label;

    this.el.append(this.input, track, labelEl);
    if (onChange) this.input.addEventListener('change', () => onChange(this.input.checked));
  }

  /** Set the visual state without firing onChange. */
  setChecked(checked: boolean): void {
    this.input.checked = checked;
  }
}
