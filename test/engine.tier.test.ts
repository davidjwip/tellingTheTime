import { describe, expect, it } from 'vitest';

import { buildTierQueue, REQUEUE_GAP, REVIEW_SHARE, seededRng } from '../src/engine';
import { LEVELS } from '../src/levels';

import type { TierBank } from '../src/engine';
import type { Level } from '../src/types';

const level = (id: string): Level => {
  const found = LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`no level ${id}`);
  return found;
};

/**
 * Tier 2's three playable levels, plus the whole of tier 0 as revision.
 *
 * Tier 1 has nothing playable today, so using it as the lower bank would test the fallback rather
 * than the rule AC-54 actually asks for.
 */
const bank = (): TierBank => ({
  tier: 2,
  levels: ['t2.1', 't2.2', 't2.4'].map(level),
  review: ['t0.1', 't0.2', 't0.3', 't0.4'].map(level),
});

const levelIds = (levels: readonly Level[]): Set<string> => new Set(levels.map((l) => l.id));

describe('drawing a round from a whole tier', () => {
  it('draws from every playable level in the bank', () => {
    const tier = bank();
    const queue = buildTierQueue(tier, 60, seededRng(21));
    const seen = new Set(queue.map((item) => item.levelId));

    for (const chosen of tier.levels) {
      expect(seen.has(chosen.id), `${chosen.id} never appeared`).toBe(true);
    }
  });

  it('gives two seeds different first-five orders', () => {
    const firstFive = (seed: number): string[] =>
      buildTierQueue(bank(), 5, seededRng(seed))
        .slice(0, 5)
        .map((item) => item.key);

    expect(firstFive(1)).not.toEqual(firstFive(2));
  });

  it('keeps every item at least REQUEUE_GAP places apart from its own key', () => {
    const queue = buildTierQueue(bank(), 60, seededRng(9));

    for (let i = REQUEUE_GAP; i < queue.length; i += 1) {
      const recent = queue.slice(i - REQUEUE_GAP, i).map((item) => item.key);
      expect(recent, `position ${i}`).not.toContain(queue[i]?.key);
    }
  });
});

describe('revision from a lower tier', () => {
  it('takes one item in four, rounded, from the review bank', () => {
    const tier = bank();
    const count = 40;
    const queue = buildTierQueue(tier, count, seededRng(11));
    const reviewIds = levelIds(tier.review);
    const review = queue.filter((item) => item.levelId !== undefined && reviewIds.has(item.levelId));

    expect(review).toHaveLength(Math.round(count * REVIEW_SHARE));
    for (const item of review) {
      expect(reviewIds.has(item.levelId ?? '')).toBe(true);
    }
  });

  it('never opens on a revision item', () => {
    const tier = bank();
    const reviewIds = levelIds(tier.review);

    for (let seed = 1; seed <= 20; seed += 1) {
      const [first] = buildTierQueue(tier, 10, seededRng(seed));
      expect(first?.levelId, `seed ${seed}`).toBeDefined();
      expect(reviewIds.has(first?.levelId ?? ''), `seed ${seed}`).toBe(false);
    }
  });

  it('fills the queue wholly from the chosen tier when there is no revision bank', () => {
    const tier: TierBank = { ...bank(), review: [] };
    const queue = buildTierQueue(tier, 20, seededRng(5));
    const mainIds = levelIds(tier.levels);
    const reviewIds = levelIds(tier.review);

    expect(queue).toHaveLength(20);
    for (const item of queue) {
      expect(item.levelId).toBeDefined();
      expect(mainIds.has(item.levelId ?? '')).toBe(true);
      expect(reviewIds.has(item.levelId ?? '')).toBe(false);
    }
  });
});
