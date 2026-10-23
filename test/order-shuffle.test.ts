import { describe, expect, it } from 'vitest';

import { orderFor } from '../src/order';

const lcg = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
};

/**
 * The reviewer named the existing shuffle test as one that would pass against a biased shuffle — it
 * only checked "not already solved". This one checks the distribution, because a dealer that always
 * puts Monday first is not solved, but it is still learnable by position.
 */
describe('the week shuffle is a shuffle, not a reordering', () => {
  it('puts every day first at least once across 210 deals', () => {
    const firsts = new Map<string, number>();
    for (let seed = 1; seed <= 210; seed += 1) {
      const dealt = orderFor({ kind: 'weekTiles' } as never, undefined, lcg(seed));
      const first = dealt?.cards[0]?.id;
      if (first) firsts.set(first, (firsts.get(first) ?? 0) + 1);
    }
    expect(firsts.size).toBe(7);
    for (const [, count] of firsts) expect(count).toBeGreaterThan(5);
  });

  it('never deals the same week twice running within a level', () => {
    let previous: string[] | undefined;
    for (let seed = 1; seed <= 50; seed += 1) {
      const dealt = orderFor({ kind: 'weekTiles' } as never, previous, lcg(seed));
      const ids = dealt?.cards.map((card) => card.id) ?? [];
      expect(ids.join(',')).not.toBe((previous ?? []).join(','));
      previous = ids;
    }
  });
});
