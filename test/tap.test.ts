import { describe, expect, it } from 'vitest';

import { lapValue, startLap, tapSpec, tapValue } from '../src/tap';

describe('what a lap asks for', () => {
  it('counts 1 to 12 on the hour numerals', () => {
    const spec = tapSpec({ kind: 'numberOrder', from: 1, to: 12 });
    expect(spec?.target).toBe('numerals');
    expect(spec?.sequence).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('counts round in fives on the minute ring', () => {
    const spec = tapSpec({ kind: 'fivesRing', to: 60 });
    expect(spec?.target).toBe('labels');
    expect(spec?.sequence).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]);
  });

  it('has no lap for content that is not a dial', () => {
    expect(tapSpec({ kind: 'clock' })).toBeNull();
    expect(tapSpec({ kind: 'wrap' })).toBeNull();
  });
});

describe('tapping one lap', () => {
  const sequence = [1, 2, 3];

  it('asks for the next value, and finishes on the last', () => {
    let lap = startLap(sequence);
    expect(lapValue(lap)).toBe(1);

    const first = tapValue(lap, 1);
    expect(first.correct).toBe(true);
    expect(first.complete).toBe(false);
    lap = first.lap;
    expect(lapValue(lap)).toBe(2);

    lap = tapValue(lap, 2).lap;
    const last = tapValue(lap, 3);
    expect(last.correct).toBe(true);
    expect(last.complete).toBe(true);
  });

  it('leaves the lap untouched on a wrong value', () => {
    const lap = startLap(sequence);
    const wrong = tapValue(lap, 7);
    expect(wrong.correct).toBe(false);
    expect(wrong.complete).toBe(false);
    expect(wrong.lap.done).toEqual([]);
    expect(lapValue(wrong.lap)).toBe(1);
  });

  it('does not accept the next value twice', () => {
    const lap = tapValue(startLap(sequence), 1).lap;
    const again = tapValue(lap, 1);
    expect(again.correct).toBe(false);
    expect(again.lap.done).toEqual([1]);
  });
});
