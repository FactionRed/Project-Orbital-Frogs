// src/ui/theme.ts
export type Theme = 'vintage' | 'modern';

const STORAGE_KEY = 'orbital-theme';
const REDUCED_MOTION_OVERRIDE_KEY = 'orbital-reduced-motion-override';

function systemReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Effective reduced-motion: OS pref unless the user has explicitly overridden. */
export function reducedMotionEnabled(): boolean {
  const override = localStorage.getItem(REDUCED_MOTION_OVERRIDE_KEY);
  if (override === 'on') return true;
  if (override === 'off') return false;
  return systemReducedMotion();
}

/** The user's chosen theme (defaults to Modern on first load). */
export function currentTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'vintage' ? 'vintage' : 'modern';
}

/** Apply a theme to <html data-theme="..."> + <body data-theme="..."> (body for the ::before). */
export function applyTheme(theme: Theme): void {
  const t: Theme = theme === 'vintage' ? 'vintage' : 'modern';
  document.documentElement.setAttribute('data-theme', t);
  document.body.setAttribute('data-theme', t);
  localStorage.setItem(STORAGE_KEY, t);
}

/** Toggle between vintage and modern. Returns the new theme. */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'vintage' ? 'modern' : 'vintage';
  applyTheme(next);
  return next;
}

/** Force reduced-motion on or off (user override in settings). */
export function setReducedMotionOverride(state: 'on' | 'off' | 'auto'): void {
  if (state === 'auto') localStorage.removeItem(REDUCED_MOTION_OVERRIDE_KEY);
  else localStorage.setItem(REDUCED_MOTION_OVERRIDE_KEY, state);
}

/** Boot: read stored theme (default Modern), apply, listen for OS pref changes. */
export function initTheme(): void {
  applyTheme(currentTheme());
  if (typeof window.matchMedia === 'function') {
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
      // Re-apply so CSS variables recompute if no explicit override.
      applyTheme(currentTheme());
    });
  }
}
