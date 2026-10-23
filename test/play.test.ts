import { beforeEach, describe, expect, it } from 'vitest';

import { currentItem, isFinished, REQUEUE_GAP } from '../src/engine';
import { LEVELS } from '../src/levels';
import { mountPlay } from '../src/play';

import type { Mounted } from '../src/play';
import type { Level } from '../src/types';

const level = (id: string): Level => {
  const found = LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`no level ${id}`);
  return found;
};

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

function tap(selector: string): void {
  const target = document.querySelector(selector);
  if (!target) throw new Error(`nothing to tap: ${selector}`);
  (target as HTMLElement).click();
}

function mount(id: string): Mounted {
  return mountPlay(app, overlayRoot, level(id));
}

/**
 * Answer the item on screen correctly, whichever pad it offers.
 *
 * t2.2 asks six reading questions and then four setting ones, and the pad changes with the task —
 * so a test that taps "correct" ten times runs out of buttons at item seven.
 */
function answerRight(): void {
  const correct = app.querySelector<HTMLElement>('[data-verdict="correct"]');
  if (correct) {
    correct.click();
    return;
  }
  const done = app.querySelector<HTMLElement>('[data-verdict="done"]');
  if (done) {
    done.click();
    return;
  }
  throw new Error('no way to answer the item on screen');
}

describe('what a tap does', () => {
  it('draws the play screen on mount', () => {
    mount('t2.2');
    expect(app.querySelector('.container')).not.toBeNull();
    expect(app.querySelector('svg[data-face]')).not.toBeNull();
    expect(overlayRoot.children).toHaveLength(0);
  });

  it('advances the track on a correct verdict and does not on a miss', () => {
    mount('t2.2');
    expect(app.querySelectorAll('.step.filled')).toHaveLength(0);

    tap('[data-verdict="correct"]');
    expect(app.querySelectorAll('.step.filled')).toHaveLength(1);

    tap('[data-verdict="wrong"]');
    expect(app.querySelectorAll('.step.filled')).toHaveLength(1);

    tap('[data-verdict="correct"]');
    expect(app.querySelectorAll('.step.filled')).toHaveLength(2);
  });

  it('moves to the next item after a verdict', () => {
    const mounted = mount('t2.2');
    const before = mounted.session().answered;
    tap('[data-verdict="correct"]');
    expect(mounted.session().answered).toBe(before + 1);
  });

  it('never offers a verdict that marks itself correct', () => {
    const mounted = mount('t2.2');
    for (let i = 0; i < 3; i += 1) answerRight();

    // no "Done" button anywhere: the only two verdicts are the adult's
    expect(app.querySelector('[data-verdict="done"]')).toBeNull();
    tap('[data-verdict="wrong"]');
    expect(mounted.session().results.at(-1)?.correct).toBe(false);
  });

  it('celebrates a full track, and closes back to the round', () => {
    mount('t2.2');
    for (let i = 0; i < 9; i += 1) answerRight();
    expect(overlayRoot.querySelector('[data-celebration]')).toBeNull();

    answerRight(); // the tenth fills the track
    // the overlay is mounted into its own root, above the screen, so it can outlive a re-render
    const overlay = overlayRoot.querySelector('[data-celebration]');
    expect(overlay).not.toBeNull();
    expect(overlay?.classList.contains('visible')).toBe(true);
    expect(app.querySelector('[data-celebration]')).toBeNull();

    tap('[data-action="close-celebration"]');
    expect(overlayRoot.querySelector('[data-celebration]')).toBeNull();
  });

  it('does not celebrate a cleared-but-incomplete round', () => {
    const mounted = mount('t2.2');
    for (let i = 0; i < 9; i += 1) answerRight();
    expect(app.querySelector('[data-celebration]')).toBeNull();
    expect(mounted.celebrating()).toBe(false);
  });

  it('ends on the summary once the queue is exhausted', () => {
    const mounted = mount('t2.2');
    while (!isFinished(mounted.session())) {
      answerRight();
    }
    tap('[data-action="close-celebration"]');

    expect(app.querySelector('.summary')).not.toBeNull();
    expect(app.querySelector('h1')?.textContent).toBe('Level cleared!');
  });

  it('starts a fresh round on Again', () => {
    const mounted = mount('t2.2');
    answerRight();
    answerRight();
    expect(mounted.session().answered).toBe(2);

    for (let i = 0; i < 8; i += 1) answerRight();
    tap('[data-action="close-celebration"]');

    tap('[data-action="again"]');
    expect(mounted.session().answered).toBe(0);
    expect(app.querySelectorAll('.step.filled')).toHaveLength(0);
  });

  it('asks where to go when the adult wants another level', () => {
    const asked: string[] = [];
    mountPlay(app, overlayRoot, level('t2.2'), { onChangeLevel: (l) => asked.push(l.id) });
    for (let i = 0; i < 10; i += 1) answerRight();
    tap('[data-action="close-celebration"]');
    tap('[data-action="change-level"]');
    expect(asked).toEqual(['t2.2']);
  });

  it('falls back to navigating by URL when nothing else is wired', () => {
    mount('t2.2');
    for (let i = 0; i < 10; i += 1) answerRight();
    tap('[data-action="close-celebration"]');
    tap('[data-action="change-level"]');
    expect(window.location.search).toContain('level=t2.2');
  });

  it('says the question when the face changes, and the verdict after a tap', () => {
    const said: string[] = [];
    const speaker = {
      say: (key: string | undefined) => {
        if (key) said.push(key);
      },
      isMuted: () => false,
      setMuted: () => undefined,
    } as unknown as import('../src/audio').Speaker;

    mountPlay(app, overlayRoot, level('t2.2'), { speaker });
    expect(said).toEqual(['prompt-read']); // the first question, once

    answerRight();
    expect(said).toEqual(['prompt-read', 'praise-1', 'prompt-read']);
    // the prompt is said once per face, not on every re-render
    expect(said.filter((k) => k === 'prompt-read')).toHaveLength(2);
  });

  it('says the nudge after a miss, not praise', () => {
    const said: string[] = [];
    const speaker = {
      say: (key: string | undefined) => {
        if (key) said.push(key);
      },
      isMuted: () => false,
      setMuted: () => undefined,
    } as unknown as import('../src/audio').Speaker;

    mountPlay(app, overlayRoot, level('t2.2'), { speaker });
    tap('[data-verdict="wrong"]');
    expect(said).toEqual(['prompt-read', 'encourage', 'prompt-read']);
  });

  it('says nothing when there is no question to ask', () => {
    const said: string[] = [];
    const speaker = {
      say: (key: string | undefined) => {
        if (key) said.push(key);
      },
      isMuted: () => false,
      setMuted: () => undefined,
    } as unknown as import('../src/audio').Speaker;

    // a level whose every task needs a screen that does not exist yet: nothing to show, nothing to say
    mountPlay(app, overlayRoot, level('t0.1'), { speaker });
    expect(said).toEqual([]);
  });

  it('lets the child hear the verdict before asking the next question', () => {
    // the first version said the praise and then the next prompt in the same tick, and `say`
    // interrupts whatever is playing - so "well done" was never audible at all
    const said: string[] = [];
    const pending: Array<() => void> = [];

    const speaker = {
      say: (key: string | undefined) => {
        if (key) said.push(key);
        return new Promise<void>((resolve) => pending.push(resolve));
      },
      isMuted: () => false,
      setMuted: () => undefined,
      setLocale: () => undefined,
      getLocale: () => 'en' as const,
    } as unknown as import('../src/audio').Speaker;

    mountPlay(app, overlayRoot, level('t2.2'), { speaker });
    expect(said).toEqual(['prompt-read']); // the question, still being asked

    pending[0]?.(); // that clip ends
    answerRight();
    expect(said).toEqual(['prompt-read', 'praise-1']); // the verdict, and no second question yet
    expect(said).toHaveLength(2);

    pending[1]?.(); // the praise ends
    return Promise.resolve().then(() => {
      expect(said.filter((k) => k === 'prompt-read')).toHaveLength(2); // now the next question
    });
  });

  it('asks the question again on the first touch, because iOS blocks audio until then', () => {
    const said: string[] = [];
    const speaker = {
      say: (key: string | undefined) => {
        if (key) said.push(key);
        return Promise.resolve();
      },
      isMuted: () => false,
      setMuted: () => undefined,
      setLocale: () => undefined,
      getLocale: () => 'en' as const,
    } as unknown as import('../src/audio').Speaker;

    mountPlay(app, overlayRoot, level('t2.2'), { speaker });
    expect(said).toEqual(['prompt-read']);

    // the first attempt was swallowed by the browser; the first touch makes it audible
    app.dispatchEvent(new Event('pointerdown'));
    expect(said).toEqual(['prompt-read', 'prompt-read']);

    // and only once: a second touch must not repeat it
    app.dispatchEvent(new Event('pointerdown'));
    expect(said).toHaveLength(2);
  });

  it('ignores a tap that is not a verdict or an action', () => {
    const mounted = mount('t2.2');
    const heading = app.querySelector('h1') as HTMLElement;
    heading.click();
    expect(mounted.session().answered).toBe(0);
  });
});

describe('choosing a card', () => {
  it('records a correct verdict on the answer card, fills a step, and shows no pad', () => {
    const mounted = mount('t0.2');
    const item = currentItem(mounted.session());
    if (!item?.answer) throw new Error('no choose answer');

    expect(app.querySelectorAll('[data-verdict]')).toHaveLength(0);
    tap(`[data-choice="${item.answer}"]`);

    expect(mounted.session().results.at(-1)?.correct).toBe(true);
    expect(app.querySelectorAll('.step.filled')).toHaveLength(1);
    expect(app.querySelectorAll('[data-verdict]')).toHaveLength(0);
  });

  it('records a miss on the wrong card and brings the question back three places later', () => {
    const mounted = mount('t0.3');
    const item = currentItem(mounted.session());
    const wrong = item?.cards?.find((card) => card.id !== item.answer);
    if (!wrong) throw new Error('no wrong card to tap');

    tap(`[data-choice="${wrong.id}"]`);

    expect(mounted.session().results.at(-1)?.correct).toBe(false);
    expect(app.querySelectorAll('.step.filled')).toHaveLength(0);

    const after = mounted.session();
    expect(after.queue[after.answered + REQUEUE_GAP]?.answer).toBe(item?.answer);
    expect(after.queue[after.answered + REQUEUE_GAP]?.retry).toBe(true);
  });

  it('never shows the same choice twice in a row through a whole round', () => {
    const mounted = mount('t0.3');
    const answers: Array<string | undefined> = [];

    for (let i = 0; i < 10; i += 1) {
      const item = currentItem(mounted.session());
      answers.push(item?.answer);
      if (!item?.answer) throw new Error('choose item without an answer');
      tap(`[data-choice="${item.answer}"]`);
    }

    for (let i = 1; i < answers.length; i += 1) {
      expect(answers[i]).not.toBe(answers[i - 1]);
    }
  });

  it('says the tap prompt and the verdict, just as a read question says its own', () => {
    const said: string[] = [];
    const speaker = {
      say: (key: string | undefined) => {
        if (key) said.push(key);
      },
      isMuted: () => false,
      setMuted: () => undefined,
    } as unknown as import('../src/audio').Speaker;

    const mounted = mountPlay(app, overlayRoot, level('t0.2'), { speaker });
    expect(said).toEqual(['prompt-tap']);

    const item = currentItem(mounted.session());
    if (!item?.answer) throw new Error('no choose answer');
    tap(`[data-choice="${item.answer}"]`);
    expect(said).toEqual(['prompt-tap', 'praise-1', 'prompt-tap']);
  });
});
