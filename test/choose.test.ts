import { describe, expect, it } from 'vitest';

import { chronoKeyFor } from '../src/audio';
import { chooseFor, choiceFor, renderChoose, WORDS, wrapChoiceFor } from '../src/choose';
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

describe('choosing between two clocks', () => {
  it('draws both faces when the item carries dials', () => {
    const choice = choiceFor(LEVELS.find((l) => l.id === 't3.1')!)!;
    const item = { task: 'choose', dials: choice.dials, answer: choice.answer, question: choice.question } as Item;
    const screen = renderChoose(item, undefined, LEVELS.find((l) => l.id === 't3.1')!.face);
    expect(screen.querySelectorAll('[data-choice]')).toHaveLength(2);
    expect(screen.querySelectorAll('svg')).toHaveLength(2);
    // the words are in the prompt, not on the dials
    expect(screen.querySelector('.prompt')?.textContent).toBe(choice.question);
  });

  const byId = (id: string) => LEVELS.find((l) => l.id === id)!;

  // AC-11 AC-75
  it('shows two faces of the same hour, differing only in the minutes', () => {
    const choice = choiceFor(byId('t3.1'));
    expect(choice).toBeDefined();
    expect(choice!.dials).toHaveLength(2);
    const [a, b] = choice!.dials! as [{ hour: number; minute: number }, { hour: number; minute: number }];
    expect(a.hour).toBe(b.hour);
    expect(new Set([a.minute, b.minute])).toEqual(new Set([0, 30]));
  });

  it('asks the time in words, never in digits', () => {
    const choice = choiceFor(byId('t3.1'))!;
    expect(choice.question).toMatch(/^Which one is .+\?$/);
    expect(choice.question).not.toMatch(/[0-9]/);
    // and the answer is the dial that matches what the question asked
    const answerTime = choice.dials!.find((dial) => `${dial.hour}:${dial.minute}` === choice.answer)!;
    expect([0, 30]).toContain(answerTime.minute);
    expect(answerTime.minute === 30).toBe(choice.question.includes('half past'));
  });

  it('names a quarter-to by the hour after it', () => {
    // 3:45 is "quarter to four" - the hour said out loud is the one it is heading towards
    for (let tries = 0; tries < 40; tries += 1) {
      const choice = choiceFor(byId('t4.1'))!;
      const answer = choice.dials!.find((dial) => `${dial.hour}:${dial.minute}` === choice.answer)!;
      if (answer.minute !== 45) continue;
      const next = (answer.hour % 12) + 1;
      expect(choice.question).toContain(WORDS[next]);
      return;
    }
    throw new Error('never drew a quarter to');
  });

  // AC-81
  it('says the question out loud, because a child who cannot read it must still be asked', () => {
    const choice = choiceFor(LEVELS.find((l) => l.id === 't3.1')!)!;
    expect(choice.say).toMatch(/^(oclock|qpast|half|qto)-[0-9]+$/);
    // and the words on screen say the same time as the clip
    const answer = choice.dials!.find((dial) => `${dial.hour}:${dial.minute}` === choice.answer)!;
    expect(choice.say).toBe(chronoKeyFor(answer));
  });

  it('always builds a choice, however stubborn the previous answer', () => {
    // hours [3], minutes [0, 30]: with a previous of 3:0 half the draws collide, and the loop must
    // still hand the caller a choice rather than an undefined the engine's `!` would trust
    const fixed = { ...LEVELS.find((l) => l.id === 't3.1')!, hours: [3] };
    for (let draw = 0; draw < 40; draw += 1) {
      const choice = choiceFor(fixed, '3:0');
      expect(choice, `draw ${draw}`).toBeDefined();
      expect(choice!.answer).not.toBe('3:0');
    }
  });

  it('refuses a level with only one allowed minute, and the five-minute grid', () => {
    expect(choiceFor(byId('t3.2'))).toBeUndefined();
    expect(choiceFor(byId('t5.1'))).toBeUndefined();
  });
});

describe('what comes after twelve', () => {
  const byId = (id: string) => LEVELS.find((l) => l.id === id)!;

  // AC-82
  it('offers the next hour on the clock and the hour before it', () => {
    for (let draw = 0; draw < 30; draw += 1) {
      const choice = wrapChoiceFor(byId('t1.2'))!;
      expect(choice.numbers).toHaveLength(2);
      const options = choice.numbers!.map(Number);
      const answer = Number(choice.answer);
      const from = Number(/after-(\d+)/.exec(choice.say ?? '')?.[1]);
      expect(from).toBeGreaterThanOrEqual(1);
      expect(from).toBeLessThanOrEqual(12);

      // the clock's answer, not arithmetic's
      expect(answer).toBe((from % 12) + 1);
      expect(options).toContain(answer);
      const other = options.find((option: number) => option !== answer)!;
      if (from === 12) {
        expect(other).toBe(13); // thirteen is the sensible-looking wrong answer, and it is wrong
      } else {
        expect(other).toBe(from === 1 ? 12 : from - 1); // the hour before, not after
      }
    }
  });

  it('asks the question out loud, and never repeats the last answer', () => {
    const first = wrapChoiceFor(byId('t1.2'))!;
    expect(first.question).toBe(`After ${WORDS[Number(first.say!.split('-')[1])]} comes…?`);
    for (let draw = 0; draw < 20; draw += 1) {
      const next = wrapChoiceFor(byId('t1.2'), first.answer)!;
      expect(next.answer).not.toBe(first.answer);
    }
  });

  // AC-83
  it('draws the numerals as buttons, and marks the hour the question starts from', () => {
    const choice = wrapChoiceFor(byId('t1.2'))!;
    const item = {
      task: 'choose',
      numbers: choice.numbers,
      answer: choice.answer,
      question: choice.question,
      from: choice.from,
    } as Item;
    const screen = renderChoose(item, undefined, byId('t1.2').face);
    expect(screen.querySelectorAll('[data-choice]')).toHaveLength(2);
    expect(screen.querySelectorAll('svg')).toHaveLength(1);
    expect(screen.querySelector(`[data-from="${choice.from}"]`)).not.toBeNull();
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
