import { describe, expect, it } from 'vitest';

import { chooseFor, renderChoose } from '../src/choose';

import type { Card } from '../src/choose';
import type { Item } from '../src/engine';
import type { Content } from '../src/types';

const DAY_STRIP: Content = { kind: 'dayStrip' };
const DURATION_PAIR: Content = { kind: 'durationPair' };

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

const walk = (content: Content, count: number): Array<ReturnType<typeof chooseFor>> => {
  const choices: Array<ReturnType<typeof chooseFor>> = [];
  let previous: string | undefined;
  for (let i = 0; i < count; i += 1) {
    const choice = chooseFor(content, previous);
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
    const choices = walk(DURATION_PAIR, durationTable.length);
    choices.forEach((choice, index) => {
      expect(choice?.cards).toEqual(durationTable[index]?.cards);
      expect(choice?.answer).toBe(durationTable[index]?.answer);
    });
  });

  it('cycles duration pairs without ever asking the same one twice in a row', () => {
    const choices = walk(DURATION_PAIR, durationTable.length * 3);
    for (let i = 1; i < choices.length; i += 1) {
      expect(choices[i]?.answer).not.toBe(choices[i - 1]?.answer);
    }
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
    ...overrides,
  });

  it('asks the day question that belongs to the answer card', () => {
    const screen = renderChoose(item());
    expect(screen.querySelector('.prompt')?.textContent).toBe('Which one is today?');
  });

  it('always asks which took longer for a duration pair', () => {
    const screen = renderChoose(
      item({ cards: durationTable[0]?.cards, answer: durationTable[0]?.answer }),
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

  it('keeps the last verdict in #feedback, as every other screen does', () => {
    expect(renderChoose(item(), 'correct').querySelector('#feedback')?.textContent).toBe('✓ Got it!');
    expect(renderChoose(item(), 'wrong').querySelector('#feedback')?.textContent).toContain('Not yet');
    expect(renderChoose(item()).querySelector('#feedback')?.textContent).toBe('');
  });
});
