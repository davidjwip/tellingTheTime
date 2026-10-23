/**
 * The two pre-clock `order` levels: tap the cards into the right sequence.
 *
 * Tap-to-place rather than drag: a four-year-old's finger has no hover, and a dropped card lands
 * between two others. The child taps a card from the pool into the next slot, and taps a placed card
 * to put it back. The app marks the completed row, so there is no adult pad here either.
 */

import { el, feedbackArea } from './dom';

import type { Item, Rng } from './engine';
import type { Content } from './types';

export interface Card {
  id: string;
  emoji?: string;
  word: string;
  /** t0.4 only: the day number, printed above the word. */
  number?: number;
}

export interface Order {
  cards: Card[];
  /** The correct id sequence; never the order the cards are dealt in. */
  answer: string[];
}

const DAY_CARDS: Card[] = [
  { id: 'morning', emoji: '🌅', word: 'Morning' },
  { id: 'afternoon', emoji: '☀️', word: 'Afternoon' },
  { id: 'night', emoji: '🌙', word: 'Night' },
];

/**
 * t0.4 prints the day number above the word. The numerals make the task countable, so nobody
 * mistakes this for a test of day-name order: a child who can count to seven can solve it before he
 * knows Wednesday from Thursday. The numbers come off once the names are secure.
 */
const WEEK_CARDS: Card[] = [
  { id: 'monday', number: 1, word: 'Monday' },
  { id: 'tuesday', number: 2, word: 'Tuesday' },
  { id: 'wednesday', number: 3, word: 'Wednesday' },
  { id: 'thursday', number: 4, word: 'Thursday' },
  { id: 'friday', number: 5, word: 'Friday' },
  { id: 'saturday', number: 6, word: 'Saturday' },
  { id: 'sunday', number: 7, word: 'Sunday' },
];

const sameIds = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index]);

function shuffled<T>(from: readonly T[], rng: Rng): T[] {
  const out = [...from];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * Deal the cards in a shuffle the child has not just seen, and never in the answer's own order.
 *
 * `previous` is the last pool order shown, as card ids. It is passed in rather than remembered so
 * the round owns the no-repeat window, just as it does for clock times.
 */
function deal(table: readonly Card[], answer: readonly string[], previous: readonly string[] | undefined, rng: Rng): Card[] {
  const forbidden = (cards: readonly Card[]): boolean => {
    const ids = cards.map((card) => card.id);
    return sameIds(ids, answer) || (previous !== undefined && sameIds(ids, previous));
  };

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const cards = shuffled(table, rng);
    if (!forbidden(cards)) return cards;
  }

  // A replayed rng can keep dealing the same sequence. Rotations are all different from the answer,
  // and with at least two cards at most one of them can repeat `previous`.
  for (let shift = 1; shift < table.length; shift += 1) {
    const cards = table.map((_, index) => table[(index + shift) % table.length] as Card);
    if (!forbidden(cards)) return cards;
  }

  return shuffled(table, rng);
}

/** The cards and correct sequence for an order content kind, or undefined when it has no table. */
export function orderFor(
  content: Content,
  previous?: readonly string[],
  rng: Rng = Math.random,
): Order | undefined {
  const table =
    content.kind === 'dayCards' ? DAY_CARDS : content.kind === 'weekTiles' ? WEEK_CARDS : undefined;
  if (!table) return undefined;

  const answer = table.map((card) => card.id);
  const cards = deal(table, answer, previous, rng);
  return { cards: cards.map((card) => ({ ...card })), answer: [...answer] };
}

function renderCard(card: Card): HTMLButtonElement {
  const button = el('button', 'order-card');
  button.type = 'button';
  button.dataset.card = card.id;

  if (card.number !== undefined) {
    button.setAttribute('aria-label', `${card.number} ${card.word}`);
    button.append(el('span', 'order-number', String(card.number)));
    button.append(el('span', 'order-word', card.word));
    return button;
  }

  button.setAttribute('aria-label', card.word);
  if (card.emoji) {
    const emoji = el('span', 'order-emoji', card.emoji);
    emoji.setAttribute('aria-hidden', 'true');
    button.append(emoji);
  }
  button.append(el('span', 'order-word', card.word));
  return button;
}

/**
 * The order screen: the pool of shuffled cards, one empty slot per answer, and the feedback line.
 *
 * Placed cards live inside their slots as the same buttons, so tapping one returns it to the pool.
 */
export function renderOrder(
  item: Item,
  placed: readonly string[],
  lastVerdict?: 'correct' | 'wrong',
): HTMLElement {
  const wrapper = el('div', 'order');
  wrapper.append(el('div', 'prompt', 'Put them in order'));

  const cards = item.cards ?? [];
  const answer = item.order ?? cards.map((card) => card.id);
  const byId = new Map(cards.map((card) => [card.id, card]));

  const pool = el('div', 'order-pool');
  for (const card of cards) {
    if (!placed.includes(card.id)) pool.append(renderCard(card));
  }
  wrapper.append(pool);

  const row = el('div', 'order-row');
  for (let index = 0; index < answer.length; index += 1) {
    const slot = el('div', 'order-slot');
    slot.dataset.slot = '';
    const card = byId.get(placed[index] ?? '');
    if (card) slot.append(renderCard(card));
    row.append(slot);
  }
  wrapper.append(row);

  wrapper.append(feedbackArea(lastVerdict));
  return wrapper;
}
