import { describe, expect, it } from 'vitest';

import { promptFor, renderCelebration, renderPlay, renderSummary } from '../src/app';
import { createSession, currentItem, recordVerdict } from '../src/engine';
import { LEVELS } from '../src/levels';
import { seededRng } from '../src/engine';

import type { Session } from '../src/engine';
import type { Level } from '../src/types';

const level = (id: string): Level => {
  const found = LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`no level ${id}`);
  return found;
};

const session = (id: string, seed = 3): Session => createSession(level(id), seededRng(seed));
const answerRight = (s: Session, n: number): Session => {
  let next = s;
  for (let i = 0; i < n; i += 1) next = recordVerdict(next, true);
  return next;
};

describe('the screen a child sees', () => {
  it('keeps the reference app\'s skeleton: header, problem area, padding, progress, footer', () => {
    const screen = renderPlay(level('t2.2'), session('t2.2'));
    expect(screen.className).toBe('container');
    expect(screen.querySelector('header')).not.toBeNull();
    expect(screen.querySelector('.problem-area')).not.toBeNull();
    expect(screen.querySelector('.pad-container')).not.toBeNull();
    expect(screen.querySelector('.progress-area')).not.toBeNull();
    expect(screen.querySelector('footer')).not.toBeNull();
  });

  it('shows the level so an adult knows where they are', () => {
    const screen = renderPlay(level('t2.2'), session('t2.2'));
    expect(screen.dataset.level).toBe('t2.2');
    expect(screen.querySelector('.instructions')?.textContent).toContain("O'clock: all twelve");
  });

  it('offers the reference header controls', () => {
    const screen = renderPlay(level('t2.2'), session('t2.2'));
    const actions = [...screen.querySelectorAll('.header-actions [data-action]')].map((n) =>
      n.getAttribute('data-action'),
    );
    expect(actions).toEqual(['level', 'sound', 'profile']);
    expect(screen.querySelectorAll('[data-locale]')).toHaveLength(2);
  });

  it('marks the current language on the toggle', () => {
    const english = renderPlay(level('t2.2'), session('t2.2'));
    expect(english.querySelector('[data-locale="en"]')?.classList.contains('operator-active')).toBe(true);

    const cantonese = renderPlay(level('t2.2'), session('t2.2'), { locale: 'yue' });
    expect(cantonese.querySelector('[data-locale="yue"]')?.classList.contains('operator-active')).toBe(true);
    expect(cantonese.querySelector('[data-locale="en"]')?.classList.contains('operator-active')).toBe(false);
  });

  it('speaks the task as a prompt, because the child cannot read one', () => {
    const item = { task: 'read' as const, key: 'k' };
    expect(promptFor(item, 'read')).toBe('What time is it?');
    expect(promptFor(item, 'set')).toBe('Make this time');
    expect(promptFor(item, 'choose')).toBe('Which one?');
    expect(promptFor(item, 'tap')).toBe('Have a go');
  });

  it('draws the dial in the cream frame', () => {
    const screen = renderPlay(level('t2.2'), session('t2.2'));
    const frame = screen.querySelector('.clock-frame');
    expect(frame?.querySelector('svg[data-face]')).not.toBeNull();
    expect(frame?.querySelector('svg')?.getAttribute('class')).toBe('clock-face');
  });

  it('shows no minute hand on an hour-only level, all the way up at screen level', () => {
    const screen = renderPlay(level('t2.2'), session('t2.2'));
    expect(screen.querySelector('[data-hand="hour"]')).not.toBeNull();
    expect(screen.querySelector('[data-hand="minute"]')).toBeNull();
  });

  it('marks every task with the adult\'s two verdicts', () => {
    const read = renderPlay(level('t2.2'), session('t2.2'));
    expect(read.querySelectorAll('[data-verdict]')).toHaveLength(2);
    expect(read.querySelector('[data-verdict="correct"]')?.textContent).toContain('Got it');
    expect(read.querySelector('[data-verdict="wrong"]')?.textContent).toContain('Not yet');

    // a setting question is marked by the adult too: a "Done" button recorded "correct" without
    // anyone looking, and did it on a dial that had just displayed the answer
    const set = renderPlay(level('t2.2'), answerRight(session('t2.2'), 6));
    expect(set.querySelectorAll('[data-verdict]')).toHaveLength(2);
    expect(set.querySelector('[data-verdict="done"]')).toBeNull();
  });

  it('asks only reading questions, because setting has no screen yet', () => {
    const screen = renderPlay(level('t2.2'), session('t2.2'));
    const asked = [...LEVELS].length; // keep the import honest
    expect(asked).toBeGreaterThan(0);

    // every item in a shuffled round is a read, and a read always shows a dial with a time on it
    let walk = session('t2.2');
    for (let i = 0; i < 6; i += 1) {
      expect(currentItem(walk)?.task).toBe('read');
      expect(currentItem(walk)?.time).toBeDefined();
      walk = recordVerdict(walk, true);
    }
    expect(screen.querySelector('[data-hand="hour"]')).not.toBeNull();
  });

  it('shows the last verdict until the next one', () => {
    expect(renderPlay(level('t2.2'), session('t2.2'), { lastVerdict: 'correct' }).querySelector('#feedback')?.textContent)
      .toBe('✓ Got it!');
    expect(renderPlay(level('t2.2'), session('t2.2'), { lastVerdict: 'wrong' }).querySelector('#feedback')?.textContent)
      .toContain('Not yet');
    expect(renderPlay(level('t2.2'), session('t2.2')).querySelector('#feedback')?.textContent).toBe('');
  });

  it('hides the streak at zero and shows it once there is one', () => {
    expect(renderPlay(level('t2.2'), session('t2.2')).querySelector('.streak-area')).toBeNull();

    const warmed = answerRight(session('t2.2'), 2);
    const streak = renderPlay(level('t2.2'), warmed).querySelector('.streak-area');
    expect(streak?.textContent).toContain('2 in a row');
    expect(streak?.textContent).toContain('Best: 2');
  });

  it('shows a ten-step track, two rows of five, filling with right answers', () => {
    const screen = renderPlay(level('t2.2'), answerRight(session('t2.2'), 3));
    expect(screen.querySelectorAll('.step')).toHaveLength(10);
    expect(screen.querySelectorAll('.goal-steps')).toHaveLength(2);
    expect(screen.querySelectorAll('.step.filled')).toHaveLength(3);
  });

  it('shows the party at the end of the track but keeps it hidden until earned', () => {
    const screen = renderPlay(level('t2.2'), session('t2.2'));
    expect(screen.querySelector('.goal-end')?.textContent).toBe('🎉');
    expect(screen.querySelector('.mascot')).toBeNull(); // rides only once there is a streak
  });

  it('never shows a score, a percentage or a count of mistakes', () => {
    const screen = renderPlay(level('t2.2'), answerRight(session('t2.2'), 4));
    const text = screen.textContent ?? '';
    expect(text).not.toContain('%');
    expect(text).not.toMatch(/score/i);
    expect(text).not.toMatch(/wrong/i);
    expect(text).toContain('Right: 4 of 10');
  });

  it('carries the footer credit', () => {
    const screen = renderPlay(level('t2.2'), session('t2.2'));
    expect(screen.querySelector('footer')?.textContent).toBe(
      '© 2026 David Ip. Created for George and Teddy Ip.',
    );
  });

  it('renders the dial on a tap level, which has no time of its own', () => {
    const screen = renderPlay(level('t1.3'), session('t1.3'));
    expect(screen.querySelector('svg[data-face]')).not.toBeNull();
    expect(screen.querySelectorAll('[data-minute-label]')).toHaveLength(12);
  });

  it('renders a level with no answerable questions instead of throwing', () => {
    // every faceless level in the ladder now has a screen, so use an order step whose content has
    // no order table: it is filtered out of the round, leaving a zero-item session that must not
    // crash and says there is nothing to ask
    const unaskable: Level = {
      ...level('t0.1'),
      id: 'test-unaskable',
      content: { kind: 'clock' },
      round: [{ task: 'order', items: 4 }],
    };
    const screen = renderPlay(unaskable, createSession(unaskable, seededRng(3)));
    expect(screen.querySelector('svg')).toBeNull();
    expect(screen.querySelector('.prompt')?.textContent).toBe('Done');
  });
});

describe('the choose screen', () => {
  it('draws one card button per choice instead of a clock face', () => {
    const s = session('t0.2');
    const item = currentItem(s);
    const screen = renderPlay(level('t0.2'), s);

    expect(screen.querySelector('.clock-frame')).toBeNull();
    expect(screen.querySelector('svg[data-face]')).toBeNull();
    expect(screen.querySelectorAll('[data-choice]')).toHaveLength(3);

    for (const card of item?.cards ?? []) {
      const button = screen.querySelector<HTMLButtonElement>(`[data-choice="${card.id}"]`);
      expect(button?.textContent).toContain(card.emoji);
      expect(button?.textContent).toContain(card.word);
      expect(button?.getAttribute('aria-label')).toBe(card.word);
    }
  });

  it('asks the specific day question', () => {
    const s = session('t0.2');
    const item = currentItem(s);
    const word = item?.cards?.find((card) => card.id === item.answer)?.word.toLowerCase();
    const screen = renderPlay(level('t0.2'), s);
    expect(screen.querySelector('.prompt')?.textContent).toBe(`Which one is ${word}?`);
  });

  it('draws a duration pair and asks which took longer', () => {
    const s = session('t0.3');
    const screen = renderPlay(level('t0.3'), s);
    expect(screen.querySelectorAll('[data-choice]')).toHaveLength(2);
    expect(screen.querySelector('.prompt')?.textContent).toBe('Which took longer?');
  });

  it('has no adult pad: the tap is the answer and the app marks it', () => {
    const screen = renderPlay(level('t0.2'), session('t0.2'));
    expect(screen.querySelector('.pad-container')).toBeNull();
    expect(screen.querySelectorAll('[data-verdict]')).toHaveLength(0);
  });

  it('still shows the last verdict, and still asks reading questions with a pad', () => {
    const choose = renderPlay(level('t0.2'), session('t0.2'), { lastVerdict: 'wrong' });
    expect(choose.querySelector('#feedback')?.textContent).toContain('Not yet');

    const read = renderPlay(level('t2.2'), session('t2.2'));
    expect(read.querySelectorAll('[data-verdict]')).toHaveLength(2);
  });
});

describe('the end of a round', () => {
  it('says cleared when it is, and good try when it is not', () => {
    const cleared = renderSummary(answerRight(session('t2.2'), 5), true);
    expect(cleared.querySelector('h1')?.textContent).toBe('Level cleared!');
    expect(cleared.querySelector('.instructions')?.textContent).toContain('5 of 10 right');

    const notCleared = renderSummary(answerRight(session('t2.2'), 5), false);
    expect(notCleared.querySelector('h1')?.textContent).toBe('Nice work today!');
  });

  it('offers another round or another level, and nothing else', () => {
    const summary = renderSummary(session('t2.2'), false);
    const actions = [...summary.querySelectorAll('[data-action]')].map((n) => n.getAttribute('data-action'));
    expect(actions).toEqual(['again', 'change-level']);
  });
});

describe('the celebration', () => {
  it('has the reference overlay with the count interpolated', () => {
    const overlay = renderCelebration(answerRight(session('t2.2'), 10));
    expect(overlay.dataset.celebration).toBe('true');
    expect(overlay.querySelector('.celebration-title')?.textContent).toContain('Amazing Job');
    expect(overlay.textContent).toContain('You got 10 right!');
    expect(overlay.querySelector('[data-action="close-celebration"]')).not.toBeNull();
  });
});