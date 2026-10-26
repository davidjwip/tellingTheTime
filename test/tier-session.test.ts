import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildTierQueue,
  createTierSession,
  currentItem,
  GOAL_CORRECT,
  isCleared,
  recordVerdict,
  seededRng,
} from '../src/engine';
import { LEVELS } from '../src/levels';
import { mountTierPlay } from '../src/play';

import type { TierBank } from '../src/engine';
import type { Level } from '../src/types';

const level = (id: string): Level => {
  const found = LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`no level ${id}`);
  return found;
};

const bank = (): TierBank => ({
  tier: 2,
  levels: ['t2.1', 't2.2', 't2.4'].map(level),
  review: ['t0.1', 't0.2', 't0.3', 't0.4'].map(level),
});

describe('a tier session', () => {
  // AC-53
  it('plans ten items and opens on the chosen tier, not on revision', () => {
    const tier = bank();
    const session = createTierSession(tier, seededRng(7));
    const reviewIds = new Set(tier.review.map((l) => l.id));

    expect(session.levelId).toBe('tier-2');
    expect(session.goal).toBe(GOAL_CORRECT);
    expect(session.queue.length).toBeGreaterThanOrEqual(GOAL_CORRECT);
    expect(reviewIds.has(session.queue[0]?.levelId ?? '')).toBe(false);
    expect(session.queue.some((item) => reviewIds.has(item.levelId ?? ''))).toBe(true);
  });

  it('keeps drawing from the same bank when a miss needs another item', () => {
    let session = createTierSession(bank(), seededRng(7));
    for (let i = 0; i < 10; i += 1) session = recordVerdict(session, false);

    expect(session.queue.length).toBeGreaterThan(GOAL_CORRECT);
    expect(session.queue.every((item) => item.levelId !== undefined)).toBe(true);

    for (let i = 0; i < GOAL_CORRECT; i += 1) session = recordVerdict(session, true);
    expect(isCleared(session)).toBe(true);
  });

  it('has nothing to ask when the bank has no playable level', () => {
    const session = createTierSession({ tier: 2, levels: [], review: [] });
    expect(session.queue).toEqual([]);
    expect(currentItem(session)).toBeUndefined();
    expect(session.makeItem()).toBeDefined();
  });

  it('keeps drawing revision beyond the planned order items', () => {
    const tier: TierBank = { tier: 2, levels: [level('t2.4')], review: [level('t0.1')] };
    expect(buildTierQueue(tier, 60, seededRng(3))).toHaveLength(60);
  });

  it('keeps drawing revision beyond the planned choose items', () => {
    const tier: TierBank = { tier: 2, levels: [level('t2.4')], review: [level('t0.2')] };
    expect(buildTierQueue(tier, 60, seededRng(3))).toHaveLength(60);
  });
});

describe('playing a tier', () => {
  let app: HTMLElement;
  let overlayRoot: HTMLElement;

  beforeEach(() => {
    document.body.replaceChildren();
    app = document.createElement('div');
    overlayRoot = document.createElement('div');
    app.id = 'app';
    overlayRoot.id = 'overlay-root';
    document.body.append(app, overlayRoot);
  });

  it('mounts the tier round with the first item drawn from its own level', () => {
    const mounted = mountTierPlay(app, overlayRoot, bank(), { rng: seededRng(7) });
    const first = mounted.session().queue[0];

    expect(mounted.session().levelId).toBe('tier-2');
    expect(first?.levelId).toBeDefined();
    expect(app.querySelector('.container')?.getAttribute('data-level')).toBe(first?.levelId);
  });

  it('refuses a bank with nothing playable', () => {
    expect(() => mountTierPlay(app, overlayRoot, { tier: 2, levels: [], review: [] })).toThrow();
  });
});
