// src/ui/main-menu.ts
/**
 * Main menu overlay — shown during INIT state over the 3D crash scene.
 * Displays the game title and a "Start" button that transitions to the VAB.
 */
export class MainMenu {
  private root: HTMLElement;

  constructor(onStart: () => void) {
    this.root = document.createElement('div');
    this.root.id = 'main-menu';
    this.root.innerHTML = `
      <div class="menu-content">
        <h1 class="menu-title">Project Orbital Frogs</h1>
        <p class="menu-subtitle">A miniature space program</p>
        <button class="menu-btn menu-btn--primary" id="menu-start">Enter VAB ▶</button>
        <button class="menu-btn menu-btn--ghost" id="menu-quit">Quit</button>
        <p class="menu-version">v0.3.0</p>
      </div>
    `;
    this.root.querySelector('#menu-start')!.addEventListener('click', onStart);
    this.root.querySelector('#menu-quit')!.addEventListener('click', () => window.close());
    this.hide();
  }

  show(): void {
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  get element(): HTMLElement {
    return this.root;
  }
}
