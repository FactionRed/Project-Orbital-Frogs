// src/ui/components/toast.ts
// Transient top-of-screen advisory. `durationMs = 0` keeps it up until the
// caller hides it, which is how the per-frame flight prompts drive it.
export type ToastTone = 'info' | 'caution' | 'alarm';

export class Toast {
  readonly el: HTMLDivElement;
  private hideTimer = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'toast';
    this.el.style.display = 'none';
  }

  show(text: string, tone: ToastTone = 'info', durationMs = 4000): void {
    // Skip the DOM write when nothing changed — update() calls this every frame.
    if (this.el.textContent !== text) this.el.textContent = text;
    this.el.dataset.tone = tone;
    this.el.style.display = 'block';
    window.clearTimeout(this.hideTimer);
    if (durationMs > 0) {
      this.hideTimer = window.setTimeout(() => { this.el.style.display = 'none'; }, durationMs);
    }
  }

  hide(): void {
    this.el.style.display = 'none';
    window.clearTimeout(this.hideTimer);
  }
}
