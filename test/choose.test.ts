import { describe, expect, it } from 'vitest';

import { chooseFor, renderChoose } from '../src/choose';
import { buildQueue, createSession, seededRng } from '../src/engine';
import { LEVELS } from '../src/levels';

import type { Card } from '../src/choose';
import type { Item } from '../src/engine';
import type { Content, Level } from '../src/types';

const DAY_STRIP: Content = { kind: 'dayStrip' };
const DURATION_PAIR: Content = { kind: 'durationPair' };

const level = (id: string): Level => {
  const found = LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`no level ${id}`);
  return found;
};

const scripted = (...values: number[]): (() => number) => {
  let at = 0;
  return () => values[at++] ?? 0;
};

const dayCards: Card[] = [
  { id: 'yesterday', emoji: '⬅️', word: 'Yesterday' },
  { id: 'today', emoji: '☀️', word: 'Today' },
  { id: 'tomorrow', emoji: '➡️', word: 'Tomorrow' },
];

const durationTable: Array<{ cards: [Card, Card]; answer: string }> = [
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

const walk = (
  content: Content,
  count: number,
  rng: () => number = seededRng(1),
): Array<ReturnType<typeof chooseFor>> => {
  const choices: Array<ReturnType<typeof chooseFor>> = [];
  let previous: string | undefined;
  for (let i = 0; i < count; i += 1) {
    const choice = chooseFor(content, previous, rng);
    choices.push(choice);
    previous = choice?.answer;
  }
  return choices;
};

describe('what to put on the cards', () => {
  it('shows all three day cards, in the fixed order', () => {
    const choice = chooseFor(DAY_STRIP);
    expect(choice?.cards).toEqual(dayCards);
    expect(choice?.answer).toBe('yesterday');
  });

  it('asks each of yesterday, today and tomorrow in turn without repeating', () => {
    const answers = walk(DAY_STRIP, 6).map((choice) => choice?.answer);
    expect(answers).toEqual(['yesterday', 'today', 'tomorrow', 'yesterday', 'today', 'tomorrow']);
  });

  it('uses exactly the duration pairs and their longer card from the table', () => {
    const choices = walk(DURATION_PAIR, durationTable.length * 3, seededRng(5));
    for (const choice of choices) {
      const drawn = (choice?.cards ?? []).map((card) => card.id).sort().join(',');
      const pair = durationTable.find(
        (entry) => entry.cards.map((card) => card.id).sort().join(',') === drawn,
      );
      expect(pair, 'every drawn choice uses a pair from the table').toBeDefined();
      expect(choice?.answer).toBe(pair?.answer);
    }
  });

  it('cycles duration pairs without ever asking the same one twice in a row', () => {
    const choices = walk(DURATION_PAIR, durationTable.length * 3, seededRng(1));
    for (let i = 1; i < choices.length; i += 1) {
      expect(choices[i]?.answer).not.toBe(choices[i - 1]?.answer);
    }
  });

  it('swaps the two cards per item, leaving the answer id alone', () => {
    const same = chooseFor(DURATION_PAIR, undefined, scripted(0, 0.1));
    const swapped = chooseFor(DURATION_PAIR, undefined, scripted(0, 0.9));

    expect(same?.cards.map((card) => card.id)).toEqual(['bath', 'nap']);
    expect(same?.answer).toBe('nap');
    expect(swapped?.cards.map((card) => card.id)).toEqual(['nap', 'bath']);
    expect(swapped?.answer).toBe('nap');
  });

  it('puts the answer on the left at least once and on the right at least once in a seeded round', () => {
    const session = createSession(level('t0.3'), seededRng(1));
    const positions = session.queue.map((item) =>
      item.cards?.findIndex((card) => card.id === item.answer),
    );

    expect(positions).toContain(0);
    expect(positions).toContain(1);
  });

  it('draws the pair sequence from the round seed, not from a fixed cycle', () => {
    const first = (seed: number) => buildQueue(level('t0.3'), seededRng(seed))[0];

    expect(first(1)).toEqual(first(1));
    expect(first(1)?.answer).not.toBe(first(2)?.answer);
  });

  it('carries the question with the choice instead of inferring it from the answer', () => {
    expect(chooseFor(DAY_STRIP, undefined, seededRng(1))?.question).toBe('Which one is yesterday?');
    expect(chooseFor(DURATION_PAIR, undefined, seededRng(1))?.question).toBe('Which took longer?');
  });

  it('has no chooser for content whose cards were not specified', () => {
    expect(chooseFor({ kind: 'wrap' })).toBeUndefined();
    expect(chooseFor({ kind: 'clock' })).toBeUndefined();
  });
});

describe('the choose screen', () => {
  const item = (overrides: Partial<Item> = {}): Item => ({
    task: 'choose',
    key: 'choose:test',
    cards: dayCards,
    answer: 'today',
    question: 'Which one is today?',
    ...overrides,
  });

  it('asks the day question that belongs to the answer card', () => {
    const screen = renderChoose(item());
    expect(screen.querySelector('.prompt')?.textContent).toBe('Which one is today?');
  });

  it('uses the question handed to it, even when the answer is a day word', () => {
    const screen = renderChoose(item({ question: 'Which one comes after lunch?' }));
    expect(screen.querySelector('.prompt')?.textContent).toBe('Which one comes after lunch?');
  });

  it('always asks which took longer for a duration pair', () => {
    const first = durationTable[0];
    if (!first) throw new Error('the duration table is empty');
    const screen = renderChoose(
      item({ cards: [...first.cards], answer: first.answer, question: 'Which took longer?' }),
    );
    expect(screen.querySelector('.prompt')?.textContent).toBe('Which took longer?');
  });

  it('draws one button per card, carrying the card id and its emoji and word', () => {
    const screen = renderChoose(item());
    const buttons = [...screen.querySelectorAll<HTMLButtonElement>('[data-choice]')];
    expect(buttons).toHaveLength(3);

    for (const card of dayCards) {
      const button = screen.querySelector<HTMLButtonElement>(`[data-choice="${card.id}"]`);
      expect(button).not.toBeNull();
      expect(button?.tagName).toBe('BUTTON');
      expect(button?.textContent).toContain(card.emoji);
      expect(button?.textContent).toContain(card.word);
    }
  });

  it('names each card by its word, not by the emoji alone', () => {
    const screen = renderChoose(item());
    for (const card of dayCards) {
      const button = screen.querySelector<HTMLButtonElement>(`[data-choice="${card.id}"]`);
      expect(button?.getAttribute('aria-label')).toBe(card.word);
    }
  });

  it('draws no cards when the item has none, rather than throwing', () => {
    const screen = renderChoose({ task: 'choose', key: 'choose:no-cards' });
    expect(screen.querySelectorAll('[data-choice]')).toHaveLength(0);
    expect(screen.querySelector('.prompt')?.textContent).toBe('');
  });

  it('keeps the last verdict in #feedback, as every other screen does', () => {
    expect(renderChoose(item(), 'correct').querySelector('#feedback')?.textContent).toBe('✓ Got it!');
    expect(renderChoose(item(), 'wrong').querySelector('#feedback')?.textContent).toContain('Not yet');
    expect(renderChoose(item()).querySelector('#feedback')?.textContent).toBe('');
  });
});
