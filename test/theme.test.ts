// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyTheme, currentTheme, toggleTheme, reducedMotionEnabled, setReducedMotionOverride,
} from '../src/ui/theme';

beforeEach(() => {
  localStorage.clear();
  for (const el of [document.documentElement, document.body]) {
    el.removeAttribute('data-theme');
    el.removeAttribute('data-reduced-motion');
  }
});

describe('theme module', () => {
  it('defaults to modern when nothing is stored', () => {
    expect(currentTheme()).toBe('modern');
  });

  it('applyTheme sets data-theme on <html> and <body> and persists', () => {
    applyTheme('vintage');
    expect(document.documentElement.getAttribute('data-theme')).toBe('vintage');
    expect(document.body.getAttribute('data-theme')).toBe('vintage');
    expect(localStorage.getItem('orbital-theme')).toBe('vintage');
    expect(currentTheme()).toBe('vintage');
  });

  it('toggleTheme flips between vintage and modern', () => {
    applyTheme('modern');
    expect(toggleTheme()).toBe('vintage');
    expect(toggleTheme()).toBe('modern');
  });

  it('reducedMotionEnabled respects explicit override on', () => {
    setReducedMotionOverride('on');
    expect(reducedMotionEnabled()).toBe(true);
  });

  it('reducedMotionEnabled respects explicit override off even if OS pref set', () => {
    setReducedMotionOverride('off');
    expect(reducedMotionEnabled()).toBe(false);
  });

  it('setReducedMotionOverride("auto") clears the override', () => {
    setReducedMotionOverride('on');
    setReducedMotionOverride('auto');
    expect(localStorage.getItem('orbital-reduced-motion-override')).toBeNull();
  });

  it('mirrors the override onto data-reduced-motion so CSS can honour it', () => {
    // A media query cannot be overridden from JS. Without this attribute the
    // settings toggle is inert on a machine whose OS asks for reduced motion.
    setReducedMotionOverride('on');
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('on');
    expect(document.body.getAttribute('data-reduced-motion')).toBe('on');

    setReducedMotionOverride('off');
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('off');
    expect(document.body.getAttribute('data-reduced-motion')).toBe('off');

    // 'auto' hands control back to the media query.
    setReducedMotionOverride('auto');
    expect(document.documentElement.hasAttribute('data-reduced-motion')).toBe(false);
    expect(document.body.hasAttribute('data-reduced-motion')).toBe(false);
  });

  it('applyTheme carries the reduced-motion attribute through a theme change', () => {
    setReducedMotionOverride('on');
    applyTheme('vintage');
    expect(document.body.getAttribute('data-reduced-motion')).toBe('on');
    expect(document.body.getAttribute('data-theme')).toBe('vintage');
  });

  it('falls back to the OS preference when no override is stored', () => {
    // jsdom implements matchMedia but always reports matches:false, so the
    // effective answer with no override is "motion allowed".
    expect(reducedMotionEnabled()).toBe(false);
  });
});
