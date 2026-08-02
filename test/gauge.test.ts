// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Gauge } from '../src/ui/components/gauge';

function fillWidth(g: Gauge): number {
  const rect = g.el.querySelector('rect[data-fill]')!;
  return Number(rect.getAttribute('width'));
}

describe('Gauge component', () => {
  it('bar gauge renders with data-kind=bar', () => {
    const g = new Gauge('bar');
    expect(g.el.dataset.kind).toBe('bar');
    expect(g.el.classList.contains('gauge')).toBe(true);
  });

  it('setFraction maps 0..1 onto the full track width', () => {
    const g = new Gauge('bar');
    g.setFraction(0.5, '50%');
    expect(g.el.querySelector('.gauge__value')!.textContent).toBe('50%');
    expect(fillWidth(g)).toBe(50);
  });

  it('setFraction clamps out-of-range input', () => {
    const g = new Gauge('bar');
    g.setFraction(2, '200%');
    expect(fillWidth(g)).toBe(100);
    g.setFraction(-1, '-100%');
    expect(fillWidth(g)).toBe(0);
  });

  it('setThreshold recolors the fill via data-threshold', () => {
    const g = new Gauge('bar');
    g.setThreshold('caution');
    expect(g.el.dataset.threshold).toBe('caution');
    expect(g.el.querySelector('rect[data-fill]')!.getAttribute('fill')).toBe('var(--warn)');
  });
});
