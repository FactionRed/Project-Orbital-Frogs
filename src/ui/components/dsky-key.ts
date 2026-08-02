// src/ui/components/dsky-key.ts
// Apollo DSKY-style key: a WORD with a small hint line underneath, so no
// control is glyph-only. `setActive` marks a latched mode, `setEnabled`
// gates the click.
export class DskyKey {
  readonly el: HTMLButtonElement;
  private readonly wordEl: HTMLSpanElement;
  private readonly hintEl: HTMLSpanElement;

  constructor(word: string, hint = '', onClick?: () => void) {
    this.el = document.createElement('button');
    this.el.className = 'dsky-key';
    this.el.type = 'button';

    this.wordEl = document.createElement('span');
    this.wordEl.className = 'dsky-key__word';
    this.wordEl.textContent = word;

    this.hintEl = document.createElement('span');
    this.hintEl.className = 'dsky-key__hint';
    this.hintEl.textContent = hint;

    this.el.append(this.wordEl, this.hintEl);
    if (onClick) this.el.addEventListener('click', onClick);
  }

  setWord(word: string): void { this.wordEl.textContent = word; }
  setHint(hint: string): void { this.hintEl.textContent = hint; }

  setActive(active: boolean): void {
    if (active) this.el.dataset.active = '';
    else delete this.el.dataset.active;
  }

  setEnabled(enabled: boolean): void {
    this.el.disabled = !enabled;
  }
}
