import { beforeEach, describe, expect, it, vi } from 'vitest';

import { currentItem, isFinished, REQUEUE_GAP } from '../src/engine';
import { LEVELS } from '../src/levels';
import { mountPlay, mountTierPlay } from '../src/play';

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

let tapCount = 0;

/**
 * Tap something. Each synthetic tap gets its own coordinates, because the order screens ignore a
 * second tap at the same point within 350ms (a bounce); a real finger on a different card is not a
 * bounce, and neither is this.
 */
function tap(selector: string): void {
  const target = document.querySelector(selector);
  if (!target) throw new Error(`nothing to tap: ${selector}`);
  tapCount += 1;
  target.dispatchEvent(
    new MouseEvent('click', { bubbles: true, clientX: 20 + (tapCount % 7) * 120, clientY: 200 + (tapCount % 5) * 90 }),
  );
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
    mountPlay(app, overlayRoot, level('t1.4'), { speaker });
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

  it('changes language without throwing away the round', () => {
    const mounted = mountPlay(app, overlayRoot, level('t0.1'));
    const firstCard = app.querySelector('[data-card]') as HTMLElement;
    firstCard.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 300 }));
    expect(app.querySelectorAll('.order-slot [data-card]')).toHaveLength(1);

    const before = mounted.session();
    mounted.setLocale('yue');

    // the same round, the same placed card: changing voice must not restart the exercise
    expect(app.querySelectorAll('.order-slot [data-card]')).toHaveLength(1);
    expect(mounted.session()).toBe(before);
  });

  it('says the time on the clock when the speaker button is pressed', () => {
    const said: string[] = [];
    const speaker = {
      say: (key: string | undefined) => {
        if (key) said.push(key);
        return Promise.resolve();
      },
      isMuted: () => false,
      setMuted: () => undefined,
    } as unknown as import('../src/audio').Speaker;

    const mounted = mountPlay(app, overlayRoot, level('t2.4'), { speaker });
    said.length = 0; // ignore whatever the screen said on arrival
    tap('[data-action="say"]');
    // the level exists to teach how this time is said, so the button says the time itself
    const onScreen = currentItem(mounted.session());
    expect(said).toHaveLength(1);
    expect(said[0]).toMatch(/^oclock-\d+$/);
    expect(said[0]).not.toBe('prompt-read');
    // and it names the time the child is looking at, not some other one
    expect(onScreen?.time?.minute).toBe(0);
  });

  it('keeps the tapped values marked when the screen is redrawn', () => {
    const mounted = mountPlay(app, overlayRoot, level('t1.1'));
    tap('[data-numeral="1"]');
    tap('[data-numeral="2"]');

    mounted.setLocale('zh'); // a redraw that is not a new question

    expect(app.querySelector('[data-numeral="1"]')?.getAttribute('data-done')).toBe('true');
    expect(app.querySelector('[data-numeral="2"]')?.getAttribute('data-done')).toBe('true');
    expect(app.querySelector('[data-numeral="3"]')?.getAttribute('data-done')).toBeNull();
  });

  it('has no speaker button where there is no question to repeat', () => {
    const said: string[] = [];
    const speaker = {
      say: (key: string | undefined) => {
        if (key) said.push(key);
        return Promise.resolve();
      },
      isMuted: () => false,
      setMuted: () => undefined,
    } as unknown as import('../src/audio').Speaker;

    mountPlay(app, overlayRoot, level('t0.2'), { speaker }); // a choose screen: nothing to read out
    // the button is absent rather than present and inert, which this codebase calls a lie
    expect(app.querySelector('[data-action="say"]')).toBeNull();
    said.length = 0;
    expect(said).toEqual([]);
  });

  it('tells the caller once when the round is finished, and only once', () => {
    let endings = 0;
    mountPlay(app, overlayRoot, level('t2.4'), { onRoundEnd: () => (endings += 1) });
    for (let i = 0; i < 10; i += 1) tap('[data-verdict="correct"]');
    expect(endings).toBe(1);
  });

  it('ignores an order card when the row is already full', () => {
    mountPlay(app, overlayRoot, level('t0.1'));
    // fill the row with the first three cards offered, then try a fourth
    const cards = [...app.querySelectorAll<HTMLElement>('[data-card]')].slice(0, 4);
    for (const card of cards.slice(0, 3)) {
      card.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 40, clientY: 300 }));
    }
    const spare = app.querySelector<HTMLElement>('[data-card]');
    spare?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 400, clientY: 500 }));
    // nothing thrown, and the row still holds exactly the three that were placed
    expect(app.querySelectorAll('.order-slot [data-card]').length).toBeLessThanOrEqual(3);
  });

  it('stops listening to the overlay once disposed', () => {
    const mounted = mountPlay(app, overlayRoot, level('t2.4'));
    for (let i = 0; i < 10; i += 1) tap('[data-verdict="correct"]');
    expect(mounted.celebrating()).toBe(true);

    mounted.dispose();
    tap('[data-action="close-celebration"]');

    // nothing happened: the overlay keeps its content and the round still thinks it is celebrating
    expect(overlayRoot.children.length).toBeGreaterThan(0);
    expect(mounted.celebrating()).toBe(true);
  });

  it('marks the chosen language as pressed, and keeps the round and its placed cards', () => {
    const mounted = mountPlay(app, overlayRoot, level('t0.1'));
    const localeButton = (locale: 'en' | 'yue'): HTMLButtonElement | null =>
      app.querySelector<HTMLButtonElement>(`[data-locale="${locale}"]`);

    expect(localeButton('en')?.getAttribute('aria-pressed')).toBe('true');
    expect(localeButton('en')?.classList.contains('operator-active')).toBe(true);
    expect(localeButton('yue')?.getAttribute('aria-pressed')).toBe('false');
    expect(localeButton('yue')?.classList.contains('operator-active')).toBe(false);

    const firstCard = app.querySelector('[data-card]') as HTMLElement;
    firstCard.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 300 }));
    expect(app.querySelectorAll('.order-slot [data-card]')).toHaveLength(1);
    const before = mounted.session();

    mounted.setLocale('yue');

    expect(localeButton('yue')?.getAttribute('aria-pressed')).toBe('true');
    expect(localeButton('yue')?.classList.contains('operator-active')).toBe(true);
    expect(localeButton('en')?.getAttribute('aria-pressed')).toBe('false');
    expect(localeButton('en')?.classList.contains('operator-active')).toBe(false);
    expect(mounted.session()).toBe(before);
    expect(app.querySelectorAll('.order-slot [data-card]')).toHaveLength(1);
  });

  it('leaves for the shelf from the Level button, which used to be inert', () => {
    const asked: string[] = [];
    mountPlay(app, overlayRoot, level('t2.2'), { onChangeLevel: (l) => asked.push(l.id) });
    tap('[data-action="level"]');
    expect(asked).toEqual(['t2.2']);
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

  it('ignores a second card tap in the same breath, then accepts one after the pause', () => {
    vi.useFakeTimers();
    try {
      const mounted = mount('t0.2');
      const first = currentItem(mounted.session());
      if (!first?.answer) throw new Error('no choose answer');

      tap(`[data-choice="${first.answer}"]`);
      expect(mounted.session().answered).toBe(1);

      tap(`[data-choice="${first.answer}"]`);
      expect(mounted.session().answered).toBe(1);

      vi.advanceTimersByTime(349);
      tap(`[data-choice="${first.answer}"]`);
      expect(mounted.session().answered).toBe(1);

      vi.advanceTimersByTime(1);
      tap(`[data-choice="${first.answer}"]`);
      expect(mounted.session().answered).toBe(2);
    } finally {
      vi.useRealTimers();
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
    // a tap screen says nothing when it appears: there is no prompt that carries information
    expect(said).toEqual([]);

    const item = currentItem(mounted.session());
    if (!item?.answer) throw new Error('no choose answer');
    tap(`[data-choice="${item.answer}"]`);
    expect(said).toEqual(['praise-1']);
  });
});

describe('a round with no sound at all', () => {
  it('plays through to the celebration without a speaker', () => {
    // no speaker is passed, so every `options.speaker?.say` takes its silent path
    mountPlay(app, overlayRoot, level('t2.4'));
    for (let i = 0; i < 10; i += 1) tap('[data-verdict="correct"]');
    // the party appears (its text is in the overlay) even with nothing to play
    expect(overlayRoot.textContent).not.toBe('');
    tap('[data-action="close-celebration"]');
    expect(app.querySelector('.container')).not.toBeNull();
  });

  it('takes a miss quietly too', () => {
    mountPlay(app, overlayRoot, level('t2.4'));
    tap('[data-verdict="wrong"]');
    expect(app.querySelector('[data-verdict="correct"]')).not.toBeNull();
  });
});

describe('a tier round that asks the child to make a time', () => {
  const squareDial = (): void => {
    const svg = app.querySelector('svg') as SVGSVGElement | null;
    if (!svg) throw new Error('no dial');
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 }) as DOMRect;
  };

  it('uses the source level of each item, not the tier it came from', () => {
    // a tier 2 bank: every level in it draws the hour hand, and one of them asks for a set
    const bank = {
      tier: 2,
      levels: [LEVELS.find((l) => l.id === 't2.3')!],
      review: [] as (typeof LEVELS)[number][],
    };
    const mounted = mountTierPlay(app, overlayRoot, bank);
    squareDial();

    let guard = 0;
    while (currentItem(mounted.session())?.task !== 'set' && guard < 20) {
      tap('[data-verdict="correct"]');
      guard += 1;
    }
    expect(currentItem(mounted.session())?.task).toBe('set');
    // the face is drawn from the item's own level (t2.3 draws one hand), so there is one grab target
    expect(app.querySelectorAll('[data-grab]')).toHaveLength(1);
    expect(app.querySelector('[data-action="done"]')).not.toBeNull();
  });
});

describe('making the time by hand', () => {
  // happy-dom has no layout, so the dial is given a 100x100 box at the origin: the viewBox units then
  // map straight onto client coordinates and a test can aim at 12 o'clock and 3 o'clock precisely.
  const squareDial = (): void => {
    const svg = app.querySelector('svg') as SVGSVGElement | null;
    if (!svg) throw new Error('no dial');
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 }) as DOMRect;
  };

  const drag = (hand: 'hour' | 'minute', x: number, y: number): void => {
    const grab = app.querySelector(`[data-grab="${hand}"]`) as HTMLElement | null;
    if (!grab) throw new Error(`no ${hand} hand`);
    grab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 50 }));
    grab.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));
    grab.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y }));
  };

  /** The o'clock levels open with reads; the adult marks those until a set item arrives. */
  const advanceToSet = (mounted: ReturnType<typeof mountPlay>): void => {
    let guard = 0;
    while (currentItem(mounted.session())?.task !== 'set' && guard < 20) {
      tap('[data-verdict="correct"]');
      guard += 1;
    }
    squareDial();
  };

  it('offers Done only once the drawn hand has been moved', () => {
    const mounted = mountPlay(app, overlayRoot, level('t2.3'));
    advanceToSet(mounted);
    // a whole-hour level draws the hour hand alone, so that is the only hand to move
    expect(app.querySelector('[data-grab="minute"]')).toBeNull();
    expect(app.querySelector('[data-action="done"]')?.getAttribute('data-ready')).toBe('false');

    drag('hour', 90, 50);
    expect(app.querySelector('[data-action="done"]')?.getAttribute('data-ready')).toBe('true');
  });

  it('marks it right when the hand matches the hour asked for', () => {
    const mounted = mountPlay(app, overlayRoot, level('t2.3'));
    advanceToSet(mounted);
    const target = currentItem(mounted.session())?.time;
    if (!target) throw new Error('no target');

    const hourPoint = { x: 50 + Math.sin((target.hour % 12) * (Math.PI / 6)) * 40, y: 50 - Math.cos((target.hour % 12) * (Math.PI / 6)) * 40 };
    drag('hour', hourPoint.x, hourPoint.y);
    tap('[data-action="done"]');

    expect(mounted.session().results.at(-1)?.correct).toBe(true);
  });

  it('moves both hands where the level draws both, and judges both', () => {
    const mounted = mountPlay(app, overlayRoot, level('t4.2')); // quarter past: both hands, minutes [15]
    advanceToSet(mounted);
    const target = currentItem(mounted.session())?.time;
    if (!target) throw new Error('no target');

    // the minute hand to the 3 (fifteen minutes), the hour hand into the hour's sector
    drag('minute', 90, 50);
    const hourPoint = {
      x: 50 + Math.sin((target.hour % 12) * (Math.PI / 6)) * 40,
      y: 50 - Math.cos((target.hour % 12) * (Math.PI / 6)) * 40,
    };
    drag('hour', hourPoint.x, hourPoint.y);
    tap('[data-action="done"]');

    expect(mounted.session().results.at(-1)?.correct).toBe(true);
  });

  it('ignores pointer movement when no hand is held', () => {
    const mounted = mountPlay(app, overlayRoot, level('t4.2'));
    squareDial();
    app.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 90, clientY: 50 }));
    app.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 90, clientY: 50 }));
    expect(mounted.session().answered).toBe(0);
  });

  it('ignores a finger on a hand during a reading question', () => {
    const mounted = mountPlay(app, overlayRoot, level('t4.2')); // opens with reads
    squareDial();
    const before = app.querySelector('[data-hand="hour"]')?.getAttribute('transform');
    const grab = app.querySelector('[data-grab="hour"]');
    grab?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 90, clientY: 50 }));
    grab?.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 90, clientY: 50 }));
    grab?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 90, clientY: 50 }));

    expect(app.querySelector('[data-hand="hour"]')?.getAttribute('transform')).toBe(before);
    expect(mounted.session().answered).toBe(0);
  });

  it('marks a wrong placement as a miss, which returns later', () => {
    const mounted = mountPlay(app, overlayRoot, level('t2.3'));
    advanceToSet(mounted);
    const target = currentItem(mounted.session())?.time;
    if (!target) throw new Error('no target');

    const wrongHour = target.hour === 6 ? 12 : 6;
    const point = { x: 50 + Math.sin((wrongHour % 12) * (Math.PI / 6)) * 40, y: 50 - Math.cos((wrongHour % 12) * (Math.PI / 6)) * 40 };
    drag('hour', point.x, point.y);
    tap('[data-action="done"]');

    expect(mounted.session().results.at(-1)?.correct).toBe(false);
    // and the item is queued to come back, exactly as a missed read question is
    const keys = mounted.session().queue.map((item) => item.key);
    expect(keys.some((key) => key.endsWith('#again'))).toBe(true);
  });
});

describe('tapping the dial', () => {
  const label = (value: string): HTMLElement | undefined =>
    [...app.querySelectorAll<HTMLElement>('[data-minute-label="true"]')].find(
      (node) => node.textContent === value,
    );

  it('gives every value a thumb-sized target over the glyph', () => {
    mountPlay(app, overlayRoot, level('t1.1'));
    const discs = [...app.querySelectorAll<SVGElement>('[data-hit]')];
    expect(discs).toHaveLength(12);
    // a numeral glyph is about 27px on an iPad; the disc is what a finger actually hits
    for (const disc of discs) expect(Number(disc.getAttribute('r'))).toBeGreaterThanOrEqual(5);
    expect(discs.map((d) => d.dataset.hit)).toContain('7');
  });

  it('sizes each target for a finger, and no bigger than its neighbours allow', () => {
    mountPlay(app, overlayRoot, level('t1.1'));
    const discs = [...app.querySelectorAll<SVGElement>('[data-hit]')];
    const radii = discs.map((disc) => Number(disc.getAttribute('r')));
    expect(Math.min(...radii)).toBeGreaterThanOrEqual(9);

    // numeral neighbours are 2*36*sin(15deg) apart; a disc wider than half that would swallow its
    // neighbour's centre and make the ring untappable in the wrong direction
    const spacing = 2 * 36 * Math.sin(Math.PI / 12);
    expect(Math.max(...radii) * 2).toBeLessThan(spacing);
  });

  it('answers from the disc, not only from the glyph', () => {
    mountPlay(app, overlayRoot, level('t1.1'));
    const disc = app.querySelector<SVGElement>('[data-hit="1"]');
    disc?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(app.querySelector('[data-numeral="1"]')?.getAttribute('data-done')).toBe('true');
  });

  it('hints at the next value, and the hint moves as the lap goes on', () => {
    mountPlay(app, overlayRoot, level('t1.1'));
    expect(app.querySelector('[data-hit="1"]')?.getAttribute('data-next')).toBe('true');
    expect(app.querySelector('[data-hit="2"]')?.getAttribute('data-next')).toBeNull();

    tap('[data-hit="1"]');
    expect(app.querySelector('[data-hit="2"]')?.getAttribute('data-next')).toBe('true');
    expect(app.querySelector('[data-hit="1"]')?.getAttribute('data-next')).toBeNull();
  });

  it('takes one number at a time, and a stray tap does not skip ahead', () => {
    mountPlay(app, overlayRoot, level('t1.1'));
    tap('[data-numeral="7"]'); // not the next number: nothing happens
    expect(app.querySelector('[data-numeral="7"]')?.getAttribute('data-done')).toBeNull();

    tap('[data-numeral="1"]');
    expect(app.querySelector('[data-numeral="1"]')?.getAttribute('data-done')).toBe('true');
    expect(app.querySelector('[data-numeral="2"]')?.getAttribute('data-done')).toBeNull();
  });

  it('moves to the next question once the lap is finished', () => {
    const mounted = mountPlay(app, overlayRoot, level('t1.1'));
    const before = currentItem(mounted.session())?.key;
    for (let value = 1; value <= 12; value += 1) tap(`[data-numeral="${value}"]`);
    expect(currentItem(mounted.session())?.key).not.toBe(before);
  });

  it('ignores the hour numerals during a fives lap', () => {
    mountPlay(app, overlayRoot, level('t1.3'));
    tap('[data-numeral="12"]'); // wrong ring: the lap is over the 5-minute labels
    expect(label('5')?.getAttribute('data-done')).toBeNull();

    tap('[data-minute-label="true"]'); // the first label is 60, not the next value
    expect(label('60')?.getAttribute('data-done')).toBeNull();
  });

  it('counts round in fives when the right labels are tapped', () => {
    const mounted = mountPlay(app, overlayRoot, level('t1.3'));
    const before = currentItem(mounted.session())?.key;
    for (let value = 5; value <= 60; value += 5) {
      // an SVG text node has no .click() in this DOM, so dispatch the event the app listens for
      label(String(value))?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    expect(currentItem(mounted.session())?.key).not.toBe(before);
  });
});

describe('ordering the cards', () => {
  const DAY_ORDER = ['morning', 'afternoon', 'night'];
  const WEEK_ORDER = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];
  const WEEK_WORDS = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  function tapOrder(cardIds: string[]): void {
    for (const id of cardIds) tap(`[data-card="${id}"]`);
  }

  const slotIds = (): Array<string | null> =>
    [...app.querySelectorAll('[data-slot]')].map((slot) =>
      slot.querySelector('[data-card]')?.getAttribute('data-card') ?? null,
    );

  it('draws every card into the pool, an empty slot for each, and no pad', () => {
    const mounted = mount('t0.1');
    const item = currentItem(mounted.session());

    expect(item?.task).toBe('order');
    expect(item?.cards?.map((card) => card.id)).not.toEqual(DAY_ORDER);
    expect(app.querySelectorAll('[data-card]')).toHaveLength(3);
    expect(app.querySelectorAll('[data-slot]')).toHaveLength(3);
    expect(app.querySelectorAll('[data-slot] [data-card]')).toHaveLength(0);
    expect(app.querySelectorAll('[data-verdict]')).toHaveLength(0);
  });

  it('fills slots from the pool as cards are tapped, and returns a placed card to the pool', () => {
    mount('t0.1');

    tap('[data-card="morning"]');
    expect(slotIds()).toEqual(['morning', null, null]);

    tap('[data-card="afternoon"]');
    expect(slotIds()).toEqual(['morning', 'afternoon', null]);

    tap('[data-card="afternoon"]'); // undo the last placement
    expect(slotIds()).toEqual(['morning', null, null]);
    expect(app.querySelector('[data-card="afternoon"]')).not.toBeNull();
    expect(app.querySelector('[data-slot] [data-card="afternoon"]')).toBeNull();
  });

  it('records nothing until the row is full', () => {
    const mounted = mount('t0.1');

    tap('[data-card="morning"]');
    tap('[data-card="afternoon"]');

    expect(mounted.session().answered).toBe(0);
    expect(mounted.session().results).toHaveLength(0);
    expect(app.querySelectorAll('.step.filled')).toHaveLength(0);
  });

  it('records a correct verdict and fills a step when the row is completed in order', () => {
    const mounted = mount('t0.1');

    for (const id of DAY_ORDER) {
      expect(app.querySelectorAll('[data-verdict]')).toHaveLength(0);
      tap(`[data-card="${id}"]`);
    }

    expect(mounted.session().results.at(-1)?.correct).toBe(true);
    expect(app.querySelectorAll('.step.filled')).toHaveLength(1);
    expect(app.querySelectorAll('[data-verdict]')).toHaveLength(0);
  });

  it('records a miss on a wrong row and brings the same cards back three places later', () => {
    const mounted = mount('t0.1');
    const item = currentItem(mounted.session());
    if (!item?.cards) throw new Error('no order cards');

    tapOrder(['night', 'afternoon', 'morning']);

    expect(mounted.session().results.at(-1)?.correct).toBe(false);
    expect(app.querySelectorAll('.step.filled')).toHaveLength(0);

    const after = mounted.session();
    const later = after.queue[after.answered + REQUEUE_GAP];
    expect(later?.retry).toBe(true);
    expect(later?.cards?.map((card) => card.id)).toEqual(item.cards.map((card) => card.id));
  });

  it('never deals the same shuffle twice in a row through a round', () => {
    const mounted = mount('t0.1');
    const shuffles: string[] = [];

    for (let i = 0; i < 9; i += 1) {
      const item = currentItem(mounted.session());
      if (!item?.cards) throw new Error('no order cards');
      shuffles.push(item.cards.map((card) => card.id).join(','));
      tapOrder(DAY_ORDER);
    }

    for (let i = 1; i < shuffles.length; i += 1) {
      expect(shuffles[i]).not.toBe(shuffles[i - 1]);
    }
  });

  it('plays the week tiles too, with seven numbered words and seven slots', () => {
    const mounted = mount('t0.4');

    expect(app.querySelectorAll('[data-card]')).toHaveLength(7);
    expect(app.querySelectorAll('[data-slot]')).toHaveLength(7);
    for (const [index, word] of WEEK_WORDS.entries()) {
      const card = app.querySelector(`[data-card="${WEEK_ORDER[index]}"]`);
      const text = card?.textContent ?? '';
      expect(text).toContain(String(index + 1));
      expect(text).toContain(word);
      expect(text.indexOf(String(index + 1))).toBeLessThan(text.indexOf(word));
    }

    tapOrder(WEEK_ORDER);

    expect(mounted.session().results.at(-1)?.correct).toBe(true);
    expect(app.querySelectorAll('.step.filled')).toHaveLength(1);
  });

  it('says the tap prompt and the verdict, just as the choose screens do', () => {
    const said: string[] = [];
    const speaker = {
      say: (key: string | undefined) => {
        if (key) said.push(key);
      },
      isMuted: () => false,
      setMuted: () => undefined,
    } as unknown as import('../src/audio').Speaker;

    mountPlay(app, overlayRoot, level('t0.1'), { speaker });
    expect(said).toEqual([]);

    tapOrder(DAY_ORDER);
    expect(said).toEqual(['praise-1']);
  });
});
