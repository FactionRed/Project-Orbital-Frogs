// src/ui/components/banner.ts
// Centered mission event. `terminal` banners stay up until something hides
// them — a crash must not scroll away while the player is reading it.
export type BannerTone = 'success' | 'info' | 'alarm';

const AUTO_HIDE_MS = 4000;

export class Banner {
  readonly el: HTMLDivElement;
  private readonly headlineEl: HTMLDivElement;
  private readonly detailEl: HTMLDivElement;
  private hideTimer = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'banner';
    this.headlineEl = document.createElement('div');
    this.headlineEl.className = 'banner__headline';
    this.detailEl = document.createElement('div');
    this.detailEl.className = 'banner__detail';
    this.el.append(this.headlineEl, this.detailEl);
  }

  show(headline: string, tone: BannerTone, detail = '', terminal = false): void {
    this.headlineEl.textContent = headline;
    this.detailEl.textContent = detail;
    this.el.dataset.tone = tone;
    this.el.style.display = 'block';
    window.clearTimeout(this.hideTimer);
    if (!terminal) {
      this.hideTimer = window.setTimeout(() => { this.el.style.display = 'none'; }, AUTO_HIDE_MS);
    }
  }

  hide(): void {
    this.el.style.display = 'none';
    window.clearTimeout(this.hideTimer);
  }
}
