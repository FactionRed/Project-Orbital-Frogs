import { describe, it, expect } from 'vitest';
import { isCrashImpact, IMPACT_CRASH_THRESHOLD } from '../src/flight/crash-detection';

describe('isCrashImpact', () => {
  it('returns true at exactly the threshold', () => {
    expect(isCrashImpact(IMPACT_CRASH_THRESHOLD)).toBe(true);
    expect(IMPACT_CRASH_THRESHOLD).toBe(30);
  });

  it('returns true above the threshold', () => {
    expect(isCrashImpact(2000)).toBe(true);
  });

  it('returns false below the threshold (soft landing)', () => {
    expect(isCrashImpact(29.9)).toBe(false);
    expect(isCrashImpact(0)).toBe(false);
  });

  it('treats a never-recorded impact (-1) as not-a-crash', () => {
    expect(isCrashImpact(-1)).toBe(false);
  });

  it('treats NaN and Infinity as not-a-crash (defensive)', () => {
    expect(isCrashImpact(NaN)).toBe(false);
    expect(isCrashImpact(Infinity)).toBe(false);
  });
});
