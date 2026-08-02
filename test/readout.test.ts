// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Readout } from '../src/ui/components/readout';

describe('Readout component', () => {
  it('renders label, value, and unit', () => {
    const r = new Readout('ALT', 'm');
    r.setValue('1349');
    expect(r.el.querySelector('.readout__label')!.textContent).toBe('ALT');
    expect(r.el.querySelector('.readout__value')!.textContent).toBe('1349');
    expect(r.el.querySelector('.readout__unit')!.textContent).toBe('m');
  });

  it('default state is nominal', () => {
    const r = new Readout('VEL');
    expect(r.el.dataset.state).toBe('nominal');
  });

  it('setState updates data-state', () => {
    const r = new Readout('Q');
    r.setState('alarm');
    expect(r.el.dataset.state).toBe('alarm');
  });

  it('has class readout', () => {
    const r = new Readout('X');
    expect(r.el.classList.contains('readout')).toBe(true);
  });

  it('coerces numeric values to text', () => {
    const r = new Readout('ALT', 'm');
    r.setValue(0);
    expect(r.el.querySelector('.readout__value')!.textContent).toBe('0');
  });
});
