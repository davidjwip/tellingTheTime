import { describe, expect, it } from 'vitest';

import { buildQueue, seededRng } from '../src/engine';
import { LEVELS } from '../src/levels';
import { orderFor, renderOrder } from '../src/order';

import type { Card } from '../src/order';
import type { Item } from '../src/engine';
import type { Content, Level } from '../src/types';

/**
 * The contract these tests set: an `order` item carries its correct id sequence in `order`, not in
 * `answer`. `answer` stays the single-card id that `choose` compares against, so the screen switch
 * cannot confuse seven weekday ids with the id of one card.
 */
type OrderItem = Item & { order?: string[] };

const orderOf = (item: Item | undefined): string[] | undefined => (item as OrderItem | undefined)?.order;

const DAY_CONTENT: Content = { kind: 'dayCards', count: 3 };
const WEEK_CONTENT: Content = { kind: 'weekTiles', count: 7 };

const DAY_CARDS: Card[] = [
  { id: 'morning', emoji: '🌅', word: 'Morning' },
  { id: 'afternoon', emoji: '☀️', word: 'Afternoon' },
  { id: 'night', emoji: '🌙', word: 'Night' },
];
const DAY_ORDER = ['morning', 'afternoon', 'night'];

/** t0.4 shows the day NUMBER above the word: the number is what makes the puzzle countable. */
const WEEK_CARDS: Card[] = [
  { id: 'monday', number: 1, word: 'Monday' },
  { id: 'tuesday', number: 2, word: 'Tuesday' },
  { id: 'wednesday', number: 3, word: 'Wednesday' },
  { id: 'thursday', number: 4, word: 'Thursday' },
  { id: 'friday', number: 5, word: 'Friday' },
  { id: 'saturday', number: 6, word: 'Saturday' },
  { id: 'sunday', number: 7, word: 'Sunday' },
];
const WEEK_ORDER = WEEK_CARDS.map((card) => card.id);

const level = (id: string): Level => {
  const found = LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`no level ${id}`);
  return found;
};

const ids = (order: ReturnType<typeof orderFor>): string[] | undefined =>
  order?.cards.map((card) => card.id);

/**
 * `previous` is the shuffle shown last, as card ids in the order the child saw them. The rule is
 * about the shuffle, not the answer: the answer sequence never changes.
 */
const walk = (
  content: Content,
  count: number,
  rng: () => number = seededRng(1),
): Array<ReturnType<typeof orderFor>> => {
  const orders: Array<ReturnType<typeof orderFor>> = [];
  let previous: string[] | undefined;
  for (let i = 0; i < count; i += 1) {
    const order = orderFor(content, previous, rng);
    orders.push(order);
    previous = ids(order);
  }
  return orders;
};

describe('what to put in the pool', () => {
  it('draws all three day cards with their emoji and word, and knows the correct day order', () => {
    const order = orderFor(DAY_CONTENT, undefined, seededRng(1));
    expect(order?.cards).toHaveLength(3);
    for (const card of DAY_CARDS) {
      expect(order?.cards).toContainEqual(card);
    }
    expect(order?.answer).toEqual(DAY_ORDER);
  });

  it('draws all seven week days with their numbers and words, and no emoji invented for them', () => {
    const order = orderFor(WEEK_CONTENT, undefined, seededRng(1));
    expect(order?.cards).toHaveLength(7);
    expect(order?.cards).toEqual(expect.arrayContaining(WEEK_CARDS));
    for (const card of order?.cards ?? []) {
      expect(card.number).toBeGreaterThanOrEqual(1);
      expect(card.number).toBeLessThanOrEqual(7);
      expect(card.emoji ?? '').toBe('');
    }
    expect(order?.answer).toEqual(WEEK_ORDER);
  });

  it('shuffles the cards from the rng rather than using one fixed order', () => {
    const dayShuffles = new Set(
      Array.from({ length: 30 }, (_, i) => ids(orderFor(DAY_CONTENT, undefined, seededRng(i + 1)))?.join(',')),
    );
    expect(dayShuffles.size).toBeGreaterThan(1);

    const weekShuffles = new Set(
      Array.from({ length: 10 }, (_, i) => ids(orderFor(WEEK_CONTENT, undefined, seededRng(i + 1)))?.join(',')),
    );
    expect(weekShuffles.size).toBeGreaterThan(1);
  });

  it('never deals the cards already in the correct order', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      expect(ids(orderFor(DAY_CONTENT, undefined, seededRng(seed)))).not.toEqual(DAY_ORDER);
      expect(ids(orderFor(WEEK_CONTENT, undefined, seededRng(seed)))).not.toEqual(WEEK_ORDER);
    }
  });

  it('never shows the same shuffle twice in a row', () => {
    for (const content of [DAY_CONTENT, WEEK_CONTENT]) {
      const orders = walk(content, 25, seededRng(1));
      for (let i = 1; i < orders.length; i += 1) {
        expect(ids(orders[i])).not.toEqual(ids(orders[i - 1]));
      }
    }
  });

  it('uses the previous shuffle to reject a repeat when the rng replays the same sequence', () => {
    const first = orderFor(DAY_CONTENT, undefined, seededRng(7));
    if (!first) throw new Error('no day cards');
    // a fresh copy of the same rng would deal the same shuffle again if `previous` were ignored
    const repeated = orderFor(DAY_CONTENT, ids(first), seededRng(7));
    expect(ids(repeated)).not.toEqual(ids(first));
  });

  it('has no ordering for content without an order table', () => {
    expect(orderFor({ kind: 'wrap' })).toBeUndefined();
    expect(orderFor({ kind: 'clock' })).toBeUndefined();
    expect(orderFor({ kind: 'dayStrip' })).toBeUndefined();
    expect(orderFor({ kind: 'durationPair' })).toBeUndefined();
  });
});

describe('order items in a round', () => {
  it('gives every t0.1 item its shuffled cards and the correct sequence', () => {
    const queue = buildQueue(level('t0.1'), seededRng(1));
    expect(queue).toHaveLength(6);
    for (const item of queue) {
      expect(item.task).toBe('order');
      expect(item.cards).toHaveLength(3);
      expect(orderOf(item)).toEqual(DAY_ORDER);
      expect(item.cards?.map((card) => card.id)).not.toEqual(DAY_ORDER);
    }
  });

  it('gives every t0.4 item all seven numbered days and the correct sequence', () => {
    const queue = buildQueue(level('t0.4'), seededRng(1));
    expect(queue).toHaveLength(4);
    for (const item of queue) {
      expect(item.task).toBe('order');
      expect(item.cards).toHaveLength(7);
      expect(item.cards).toEqual(expect.arrayContaining(WEEK_CARDS));
      expect(orderOf(item)).toEqual(WEEK_ORDER);
      expect(item.cards?.map((card) => card.id)).not.toEqual(WEEK_ORDER);
    }
  });

  it('never deals the same shuffle twice in a row within a round', () => {
    const queue = buildQueue(level('t0.1'), seededRng(1));
    for (let i = 1; i < queue.length; i += 1) {
      expect(queue[i]?.cards?.map((card) => card.id)).not.toEqual(
        queue[i - 1]?.cards?.map((card) => card.id),
      );
    }
  });
});

describe('the order screen', () => {
  const item = (overrides: Partial<OrderItem> = {}): Item =>
    ({
      task: 'order',
      key: 'order:test',
      cards: DAY_CARDS,
      order: DAY_ORDER,
      ...overrides,
    }) as OrderItem;

  it('draws every card into the pool and an empty slot for each answer', () => {
    const screen = renderOrder(item(), []);
    expect(screen.querySelectorAll('[data-card]')).toHaveLength(3);
    expect(screen.querySelectorAll('[data-slot]')).toHaveLength(3);
    expect(screen.querySelectorAll('[data-slot] [data-card]')).toHaveLength(0);
  });

  it('puts placed cards into the slots in tap order, leaving the rest in the pool', () => {
    const screen = renderOrder(item(), ['night', 'morning']);
    const slots = [...screen.querySelectorAll('[data-slot]')];

    expect(slots).toHaveLength(3);
    expect(slots[0]?.querySelector('[data-card]')?.getAttribute('data-card')).toBe('night');
    expect(slots[1]?.querySelector('[data-card]')?.getAttribute('data-card')).toBe('morning');
    expect(slots[2]?.querySelector('[data-card]')).toBeNull();

    const afternoon = screen.querySelector('[data-card="afternoon"]');
    expect(afternoon).not.toBeNull();
    expect(afternoon?.closest('[data-slot]')).toBeNull();
  });

  it('draws each card as a button carrying its id, emoji and word', () => {
    const screen = renderOrder(item(), []);
    for (const card of DAY_CARDS) {
      const button = screen.querySelector<HTMLButtonElement>(`[data-card="${card.id}"]`);
      expect(button).not.toBeNull();
      expect(button?.tagName).toBe('BUTTON');
      expect(button?.textContent).toContain(card.emoji);
      expect(button?.textContent).toContain(card.word);
    }
  });

  it('shows every week tile as its number above its word, with no emoji', () => {
    const screen = renderOrder(
      item({ cards: WEEK_CARDS, order: WEEK_ORDER }),
      [],
    );

    expect(screen.querySelectorAll('[data-card]')).toHaveLength(7);
    for (const card of WEEK_CARDS) {
      const button = screen.querySelector(`[data-card="${card.id}"]`);
      const text = button?.textContent ?? '';
      expect(text).toContain(String(card.number));
      expect(text).toContain(card.word);
      // the eye must meet the number first: it is the part the child can already count
      expect(text.indexOf(String(card.number))).toBeLessThan(text.indexOf(card.word));
    }
  });

  it('keeps the last verdict in #feedback, as every other screen does', () => {
    expect(renderOrder(item(), [], 'correct').querySelector('#feedback')?.textContent).toBe(
      '✓ Got it!',
    );
    expect(renderOrder(item(), [], 'wrong').querySelector('#feedback')?.textContent).toContain(
      'Not yet',
    );
    expect(renderOrder(item(), []).querySelector('#feedback')?.textContent).toBe('');
  });

  it('draws no tick or cross pad of its own', () => {
    expect(renderOrder(item(), []).querySelector('[data-verdict]')).toBeNull();
  });
});
