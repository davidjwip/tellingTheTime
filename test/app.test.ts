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

  it('states the target for a setting question and keeps it off the dial', () => {
    const asked = answerRight(session('t2.2'), 6); // the seventh item is a set
    const target = currentItem(asked)?.time;
    expect(target).toBeDefined();

    const screen = renderPlay(level('t2.2'), asked);
    const shown = screen.querySelector('[data-target]')?.textContent;
    expect(shown).toBe(`${target!.hour}:${String(target!.minute).padStart(2, '0')}`);

    // NO hands at all: parking the dial at 12:00 looked neutral and drew the answer whenever the
    // target was twelve o'clock, which is legal on t2.1-t2.3
    expect(screen.querySelector('[data-hand]')).toBeNull();
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

  it('fills one goal step per correct answer, ten steps in two rows of five', () => {
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
    expect(text).toContain('Times read: 4');
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

  it('renders without a face on a faceless level instead of throwing', () => {
    const faceless = LEVELS.find((l) => l.face === undefined);
    expect(faceless, 'the ladder should contain a pre-clock level').toBeDefined();
    const screen = renderPlay(faceless!, session(faceless!.id));
    expect(screen.querySelector('svg')).toBeNull();
    expect(screen.querySelector('.prompt')?.textContent).toBe('Have a go');
  });
});

describe('the end of a round', () => {
  it('says cleared when it is, and good try when it is not', () => {
    const cleared = renderSummary(answerRight(session('t2.2'), 9), true);
    expect(cleared.querySelector('h1')?.textContent).toBe('Level cleared!');
    expect(cleared.querySelector('.instructions')?.textContent).toContain('9 of 10');

    const notCleared = renderSummary(answerRight(session('t2.2'), 5), false);
    expect(notCleared.querySelector('h1')?.textContent).toBe('Good try!');
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
    expect(overlay.textContent).toContain('all 10 times');
    expect(overlay.querySelector('[data-action="close-celebration"]')).not.toBeNull();
  });
});
