import { describe, expect, it } from 'vitest';
import { validateScore } from './scoring';

describe('validateScore (first-to-3, win by 2)', () => {
  it('accepts straight wins', () => {
    expect(validateScore(3, 0).ok).toBe(true);
    expect(validateScore(3, 1).ok).toBe(true);
  });

  it('rejects 3–2 (must win by 2 once tied at 2–2)', () => {
    expect(validateScore(3, 2).ok).toBe(false);
  });

  it('accepts deuce wins by exactly 2', () => {
    expect(validateScore(4, 2).ok).toBe(true);
    expect(validateScore(5, 3).ok).toBe(true);
    expect(validateScore(7, 5).ok).toBe(true);
  });

  it('rejects deuce wins by more or less than 2', () => {
    expect(validateScore(5, 2).ok).toBe(false);
    expect(validateScore(4, 3).ok).toBe(false);
  });

  it('rejects invalid inputs', () => {
    expect(validateScore(2, 0).ok).toBe(false);
    expect(validateScore(3, 3).ok).toBe(false);
    expect(validateScore(0, 0).ok).toBe(false);
    expect(validateScore(-1, 3).ok).toBe(false);
    expect(validateScore(3.5, 1).ok).toBe(false);
  });
});
