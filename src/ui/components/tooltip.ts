// src/ui/components/tooltip.ts
// Hover explainer, positioned above its host. The text is pulled at hover time
// so a caller can explain live state (e.g. why LAUNCH is disabled right now).
export class Tooltip {
  readonly el: HTMLDivElement;
  private host: HTMLElement | null = null;
  private readonly onEnter = () => this.showForHost();
  private readonly onLeave = () => this.hide();

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'tooltip';
    this.el.style.display = 'none';
  }

  /** Attach to a host element; shows on mouseenter/focus, hides on leave/blur. */
  attach(host: HTMLElement, getText: () => string): void {
    this.detach();
    this.host = host;
    this.getText = getText;
    host.addEventListener('mouseenter', this.onEnter);
    host.addEventListener('focus', this.onEnter);
    host.addEventListener('mouseleave', this.onLeave);
    host.addEventListener('blur', this.onLeave);
  }

  detach(): void {
    if (this.host) {
      this.host.removeEventListener('mouseenter', this.onEnter);
      this.host.removeEventListener('focus', this.onEnter);
      this.host.removeEventListener('mouseleave', this.onLeave);
      this.host.removeEventListener('blur', this.onLeave);
    }
    this.host = null;
    this.hide();
  }

  hide(): void {
    this.el.style.display = 'none';
    delete this.el.dataset.visible;
  }

  private getText: () => string = () => '';

  private showForHost(): void {
    if (!this.host) return;
    const text = this.getText();
    if (!text) return; // nothing to explain — stay out of the way
    this.el.textContent = text;
    this.el.style.display = 'block';
    this.el.dataset.visible = '';
    // .tooltip is position:fixed, so viewport coords from the rect apply
    // directly; CSS translateX(-50%) centers it on the host.
    const r = this.host.getBoundingClientRect();
    this.el.style.left = `${r.left + r.width / 2}px`;
    this.el.style.top = `${r.top - this.el.offsetHeight - 6}px`;
  }
}
