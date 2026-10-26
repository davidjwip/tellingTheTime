import { describe, expect, it } from 'vitest';

import { hourAngle, minuteAngle } from '../src/clock';

/**
 * Acceptance criteria from specs/v1.md §10.
 *
 * AC-01, AC-02, AC-03 and AC-05 — the clock geometry invariant. These come before any rendering: if
 * the hour hand is ever snapped to a numeral, or the minute hand is off by a factor, every screen
 * built on top is wrong in a way that looks plausible.
 *
 * AC-04 (an hour-only face renders no minute hand) is a renderer criterion and is not testable
 * until the SVG face exists; it is not claimed here.
 */

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Smallest angular distance from `deg` to any of the twelve numerals (0° = the 12). */
function distanceToNearestNumeral(deg: number): number {
  const norm = ((deg % 360) + 360) % 360;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 12; i += 1) {
    const d = Math.abs(norm - i * 30);
    best = Math.min(best, d, 360 - d);
  }
  return best;
}

describe('AC-01 — hour hand is halfway between numerals at half past', () => {
  // AC-1 AC-5
  it('puts the hour hand at 105° and the minute hand at 180° for 3:30', () => {
    expect(hourAngle(3, 30)).toBeCloseTo(105, 2);
    expect(minuteAngle(30)).toBeCloseTo(180, 2);
  });
});

describe('AC-02 — half past twelve puts the hour hand past the 12', () => {
  // AC-2
  it('is 15° at 12:30, i.e. already past the 12 and not on it', () => {
    expect(hourAngle(12, 30)).toBeCloseTo(15, 2);
    expect(hourAngle(12, 30)).toBeGreaterThan(hourAngle(12, 0));
  });
});

describe('AC-03 — the hour angle is continuous, never snapped', () => {
  // Deliberately NOT a restatement of the formula. A test whose expected value is the
  // implementation with the constants inlined can never fail, so it proves nothing (flagged in
  // review of PR #2). These assert properties a geared hand must satisfy and a snapped or
  // mis-scaled one cannot.
  // AC-3
  it('is continuous across every hour boundary, wrapping at 360°', () => {
    for (let h = 0; h < 12; h += 1) {
      const lastMinuteOfHour = hourAngle(h, 59);
      const topOfNextHour = hourAngle(h + 1, 0);
      expect((lastMinuteOfHour + 0.5) % 360).toBeCloseTo(topOfNextHour % 360, 6);
    }
  });

  it('lands half a degree short of the 12 at 11:59, and on it at 12:00', () => {
    expect(hourAngle(11, 59)).toBeCloseTo(359.5, 6);
    expect(hourAngle(12, 0)).toBeCloseTo(0, 6);
    expect(hourAngle(23, 59)).toBeCloseTo(359.5, 6);
  });

  // AC-3
  it('advances exactly half a degree per minute', () => {
    for (let m = 0; m < 59; m += 1) {
      expect(hourAngle(7, m + 1) - hourAngle(7, m)).toBeCloseTo(0.5, 6);
    }
  });

  // AC-5
  it('is never within 0.4° of a numeral except on the hour', () => {
    for (let h = 0; h < 12; h += 1) {
      expect(distanceToNearestNumeral(hourAngle(h, 0))).toBeCloseTo(0, 6);
      for (let m = 1; m < 60; m += 1) {
        expect(distanceToNearestNumeral(hourAngle(h, m))).toBeGreaterThan(0.4);
      }
    }
  });
});

describe('AC-05 — half past never leaves the hour hand on a numeral', () => {
  it.each(HOURS)('sits 15° clear of the nearest numeral at half past %i', (h: number) => {
    const deg = hourAngle(h, 30);
    expect(distanceToNearestNumeral(deg)).toBeCloseTo(15, 2);
    expect(distanceToNearestNumeral(deg)).toBeGreaterThan(2);
  });
});

describe('AC-03 (reference values) — the angles published in the spec', () => {
  it('matches the table in specs/v1.md §4.3', () => {
    expect(hourAngle(3, 0)).toBeCloseTo(90, 6);
    expect(hourAngle(9, 45)).toBeCloseTo(292.5, 6);
    expect(hourAngle(1, 5)).toBeCloseTo(32.5, 6);
  });

  it('accepts 24-hour input and wraps it', () => {
    expect(hourAngle(15, 30)).toBeCloseTo(hourAngle(3, 30), 6);
    expect(hourAngle(0, 0)).toBeCloseTo(hourAngle(12, 0), 6);
  });

  it('turns the minute hand a full circle in 60 minutes', () => {
    expect(minuteAngle(0)).toBe(0);
    expect(minuteAngle(15)).toBe(90);
    expect(minuteAngle(59)).toBeCloseTo(354, 6);
  });
});
