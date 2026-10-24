/**
 * Tapping the dial.
 *
 * Two of the ladder's levels ask a child to touch a clock face rather than answer beside it: tap 1 to
 * 12, and count round in fives. Both are one lap of the dial, and the interesting part is the order -
 * a wrong touch must not advance the lap, and a lap over the 5-minute ring must not accept a tap on
 * the hour numerals, or the exercise teaches the wrong thing.
 */

import type { Content } from './types';

export interface TapSpec {
  /** The values to touch, in order. */
  sequence: number[];
  /** Which ring answers the lap: the hour numerals, or the 5/10/.../60 labels. */
  target: 'numerals' | 'labels';
}

export function tapSpec(content: Content): TapSpec | null {
  if (content.kind === 'numberOrder') {
    const sequence: number[] = [];
    for (let value = content.from; value <= content.to; value += 1) sequence.push(value);
    return { sequence, target: 'numerals' };
  }
  if (content.kind === 'fivesRing') {
    const sequence: number[] = [];
    for (let value = 5; value <= content.to; value += 5) sequence.push(value);
    return { sequence, target: 'labels' };
  }
  return null;
}

export interface Lap {
  sequence: readonly number[];
  done: readonly number[];
}

export function startLap(sequence: readonly number[]): Lap {
  return { sequence, done: [] };
}

/** The value the child should touch next, or undefined once the lap is finished. */
export function lapValue(lap: Lap): number | undefined {
  return lap.sequence[lap.done.length];
}

export interface TapResult {
  lap: Lap;
  correct: boolean;
  complete: boolean;
}

/**
 * One touch. A wrong value leaves the lap exactly as it was: the child has not failed, he has simply
 * not found the next number yet, and a ✗ for that would be a lie about a four-year-old.
 */
export function tapValue(lap: Lap, value: number): TapResult {
  if (value !== lapValue(lap)) return { lap, correct: false, complete: false };
  const done = [...lap.done, value];
  return {
    lap: { sequence: lap.sequence, done },
    correct: true,
    complete: done.length === lap.sequence.length,
  };
}
