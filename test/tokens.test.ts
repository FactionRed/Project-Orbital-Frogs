import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcStyles = join(here, '..', 'src', 'styles');

// Token names that MUST be defined in both themes.
const REQUIRED_COLOR_TOKENS = [
  '--ink', '--ink-dim', '--ink-faint', '--amber', '--warn', '--green', '--red',
  '--cyan', '--phosphor-bg', '--panel-bg', '--panel-border', '--grid-line',
];

function readStyle(name: string): string {
  return readFileSync(join(srcStyles, name), 'utf8');
}

describe('tokens.css', () => {
  it('defines every required color token in both themes', () => {
    const css = readStyle('tokens.css');
    const modernBlock = css.match(/\[data-theme='modern'\]\s*\{([^}]*)\}/s);
    const vintageBlock = css.match(/\[data-theme='vintage'\]\s*\{([^}]*)\}/s);
    expect(modernBlock, 'modern theme block exists').not.toBeNull();
    expect(vintageBlock, 'vintage theme block exists').not.toBeNull();
    for (const tok of REQUIRED_COLOR_TOKENS) {
      expect(modernBlock![1], `${tok} missing in modern`).toContain(tok);
      expect(vintageBlock![1], `${tok} missing in vintage`).toContain(tok);
    }
  });

  it('defines CRT effect flags on :root', () => {
    const css = readStyle('tokens.css');
    expect(css).toContain('--crt-scanlines');
    expect(css).toContain('--crt-bloom');
    expect(css).toContain('--crt-flicker');
  });

  it('respects prefers-reduced-motion by forcing CRT effects off', () => {
    const css = readStyle('tokens.css');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('--crt-flicker: 0');
    expect(css).toContain('--crt-scanlines: 0');
  });
});

describe('no hardcoded colors outside tokens.css', () => {
  // Only tokens.css may contain hex / rgb literals. Everything else must go
  // through var(--...) so a theme swap is a one-file change.
  const otherCssFiles = readdirSync(srcStyles, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.css') && e.name !== 'tokens.css')
    .map(e => e.name);
  const screenDir = join(srcStyles, 'screens');
  const screenFiles = readdirSync(screenDir).filter(f => f.endsWith('.css'));

  for (const f of otherCssFiles) {
    it(`${f} has no hex or rgb colors`, () => {
      const css = readStyle(f);
      expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(css).not.toMatch(/\brgba?\(/);
    });
  }

  for (const f of screenFiles) {
    it(`screens/${f} has no hex or rgb colors`, () => {
      const css = readFileSync(join(screenDir, f), 'utf8');
      expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(css).not.toMatch(/\brgba?\(/);
    });
  }
});
