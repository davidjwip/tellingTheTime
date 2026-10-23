/**
 * The two pre-clock `choose` levels: cards, not a dial.
 *
 * A choice is checkable, unlike a read question, so the app marks it. The card tables live here
 * rather than in levels.json because they are content the child sees, and the level file names only
 * the kind. Keeping them in one place means the emoji, the word and the correct card cannot drift
 * apart between the question table and the screen.
 */

import type { Item } from './engine';
import type { Content } from './types';

export interface Card {
  id: string;
  emoji: string;
  word: string;
}

export interface Choice {
  cards: Card[];
  answer: string;
}

const DAY_CARDS: Card[] = [
  { id: 'yesterday', emoji: '⬅️', word: 'Yesterday' },
  { id: 'today', emoji: '☀️', word: 'Today' },
  { id: 'tomorrow', emoji: '➡️', word: 'Tomorrow' },
];

const DAY_ORDER = DAY_CARDS.map((card) => card.id);

interface DurationPair {
  cards: [Card, Card];
  answer: string;
}

const DURATION_PAIRS: DurationPair[] = [
  {
    cards: [
      { id: 'bath', emoji: '🛁', word: 'A bath' },
      { id: 'nap', emoji: '😴', word: 'A nap' },
    ],
    answer: 'nap',
  },
  {
    cards: [
      { id: 'brushing-teeth', emoji: '🪥', word: 'Brushing teeth' },
      { id: 'cartoon', emoji: '📺', word: 'A cartoon' },
    ],
    answer: 'cartoon',
  },
  {
    cards: [
      { id: 'blink', emoji: '👁️', word: 'A blink' },
      { id: 'song', emoji: '🎵', word: 'A song' },
    ],
    answer: 'song',
  },
  {
    cards: [
      { id: 'snack', emoji: '🍎', word: 'A snack' },
      { id: 'night-sleep', emoji: '🛏️', word: "A night's sleep" },
    ],
    answer: 'night-sleep',
  },
  {
    cards: [
      { id: 'bus-ride', emoji: '🚌', word: 'A bus ride' },
      { id: 'socks', emoji: '🧦', word: 'Putting on socks' },
    ],
    answer: 'bus-ride',
  },
  {
    cards: [
      { id: 'rice', emoji: '🍚', word: 'Eating rice' },
      { id: 'teeth', emoji: '🦷', word: 'Brushing teeth' },
    ],
    answer: 'rice',
  },
];

const DURATION_ORDER = DURATION_PAIRS.map((pair) => pair.answer);

/**
 * The next question in a fixed cycle.
 *
 * The previous answer is passed in rather than remembered in a module variable: the round owns the
 * no-repeat window, exactly as it does for clock times, so two sessions cannot tread on each other.
 * An unknown previous starts at the beginning instead of throwing.
 */
function nextIndex(previous: string | undefined, order: readonly string[]): number {
  const at = previous === undefined ? -1 : order.indexOf(previous);
  return (at + 1) % order.length;
}

/** The cards for one choose item, or undefined when this content has no card table. */
export function chooseFor(content: Content, previous?: string): Choice | undefined {
  if (content.kind === 'dayStrip') {
    return {
      cards: DAY_CARDS.map((card) => ({ ...card })),
      answer: DAY_ORDER[nextIndex(previous, DAY_ORDER)] as string,
    };
  }

  if (content.kind === 'durationPair') {
    const pair = DURATION_PAIRS[nextIndex(previous, DURATION_ORDER)]!;
    return {
      cards: pair.cards.map((card) => ({ ...card })) as Card[],
      answer: pair.answer,
    };
  }

  return undefined;
}

function questionFor(item: Item): string {
  const answer = item.answer;
  if (answer !== undefined && DAY_ORDER.includes(answer)) {
    const word = DAY_CARDS.find((card) => card.id === answer)!.word;
    return `Which one is ${word.toLowerCase()}?`;
  }
  return 'Which took longer?';
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * The choose screen: prompt, cards, feedback.
 *
 * The visible card is the emoji with its word underneath. The accessible name is the word on its
 * own, so a screen reader does not announce an emoji the child is expected to recognise by sight.
 */
export function renderChoose(item: Item, lastVerdict?: 'correct' | 'wrong'): HTMLElement {
  const wrapper = el('div', 'choose');
  wrapper.append(el('div', 'prompt', questionFor(item)));

  const cards = el('div', 'choice-cards');
  for (const card of item.cards ?? []) {
    const button = el('button', 'choice-card');
    button.type = 'button';
    button.dataset.choice = card.id;
    button.setAttribute('aria-label', card.word);

    const emoji = el('span', 'choice-emoji', card.emoji);
    emoji.setAttribute('aria-hidden', 'true');
    button.append(emoji, el('span', 'choice-word', card.word));
    cards.append(button);
  }
  wrapper.append(cards);

  const feedbackArea = el('div', 'feedback-area');
  const feedback = el('div');
  feedback.id = 'feedback';
  // The last verdict stays put until the next one, as on every other task.
  if (lastVerdict === 'correct') feedback.textContent = '✓ Got it!';
  if (lastVerdict === 'wrong') feedback.textContent = 'Not yet — have another go';
  feedbackArea.append(feedback);
  wrapper.append(feedbackArea);

  return wrapper;
}
