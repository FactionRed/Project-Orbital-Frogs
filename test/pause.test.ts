import { describe, it, expect } from 'vitest';
import { StateMachine } from '../src/core/state-machine';

describe('StateMachine PAUSED + return-to-menu', () => {
  it('starts in INIT', () => {
    expect(new StateMachine().current).toBe('INIT');
  });

  it('BUILD → PAUSED → BUILD round-trip', () => {
    const m = new StateMachine();
    m.transition('BUILD');
    m.transition('PAUSED');
    expect(m.current).toBe('PAUSED');
    m.transition('BUILD');
    expect(m.current).toBe('BUILD');
  });

  it('FLIGHT → PAUSED → FLIGHT round-trip', () => {
    const m = new StateMachine();
    m.transition('BUILD');
    m.transition('FLIGHT');
    m.transition('PAUSED');
    expect(m.current).toBe('PAUSED');
    m.transition('FLIGHT');
    expect(m.current).toBe('FLIGHT');
  });

  it('remembers which state paused, so RESUME can return there', () => {
    const m = new StateMachine();
    m.transition('BUILD');
    m.transition('FLIGHT');
    m.transition('PAUSED');
    expect(m.pausedFrom).toBe('FLIGHT');
    m.transition(m.pausedFrom!);
    expect(m.current).toBe('FLIGHT');
  });

  it('BUILD → INIT (quit to menu)', () => {
    const m = new StateMachine();
    m.transition('BUILD');
    m.transition('INIT');
    expect(m.current).toBe('INIT');
  });

  it('FLIGHT → INIT (quit to menu)', () => {
    const m = new StateMachine();
    m.transition('BUILD');
    m.transition('FLIGHT');
    m.transition('INIT');
    expect(m.current).toBe('INIT');
  });

  it('PAUSED → INIT (quit to menu from the pause overlay)', () => {
    const m = new StateMachine();
    m.transition('BUILD');
    m.transition('PAUSED');
    m.transition('INIT');
    expect(m.current).toBe('INIT');
  });

  it('PAUSED cannot be reached from INIT', () => {
    const m = new StateMachine();
    expect(() => m.transition('PAUSED')).toThrow();
    expect(m.current).toBe('INIT');
  });

  it('INIT cannot jump straight to FLIGHT', () => {
    const m = new StateMachine();
    expect(() => m.transition('FLIGHT')).toThrow();
    expect(m.current).toBe('INIT');
  });

  it('PAUSED → PAUSED is a no-op (no listener fire)', () => {
    const m = new StateMachine();
    m.transition('BUILD');
    m.transition('PAUSED');
    let fires = 0;
    m.onTransition(() => fires++);
    m.transition('PAUSED');
    expect(fires).toBe(0);
  });

  it('preserves the existing FLIGHT ↔ MAP and FLIGHT ↔ BUILD paths', () => {
    const m = new StateMachine();
    m.transition('BUILD');
    m.transition('FLIGHT');
    m.transition('MAP');
    expect(m.current).toBe('MAP');
    m.transition('FLIGHT');
    m.transition('BUILD');
    expect(m.current).toBe('BUILD');
  });

  it('notifies listeners with from and to', () => {
    const m = new StateMachine();
    const seen: string[] = [];
    m.onTransition((from, to) => seen.push(`${from}→${to}`));
    m.transition('BUILD');
    m.transition('PAUSED');
    expect(seen).toEqual(['INIT→BUILD', 'BUILD→PAUSED']);
  });
});
