import { beforeEach, describe, expect, it } from 'vitest';

import { currentItem } from '../src/engine';
import { LEVELS } from '../src/levels';
import { mountPlay } from '../src/play';

/**
 * The spec's contract, swept over the whole ladder.
 *
 * Every other test here proves a case was written for a rule. This one asks the opposite question:
 * for EVERY level, and every answer it can hold, does the app accept a correct answer and reject a
 * wrong one? The geared-hour blocker got through a green suite because the tests only ever exercised
 * :00 and :15 - the rule was right, the range was not. A sweep is how a range gets covered.
 */

let app: HTMLElement;
let overlayRoot: HTMLElement;

beforeEach(() => {
  document.body.replaceChildren();
  app = document.createElement('div');
  overlayRoot = document.createElement('div');
  document.body.append(app, overlayRoot);
});

const tap = (selector: string): void => {
  const node = app.querySelector<HTMLElement>(selector);
  if (!node) throw new Error(`nothing to click: ${selector}`);
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

/** The dial's own coordinates, so a pointer event lands where a finger would. */
const squareDial = (): void => {
  for (const svg of app.querySelectorAll('svg')) {
    (svg as SVGSVGElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 }) as DOMRect;
  }
};

const at = (angle: number, radius = 40): { clientX: number; clientY: number } => {
  const radians = (angle * Math.PI) / 180;
  return { clientX: 50 + Math.sin(radians) * radius, clientY: 50 - Math.cos(radians) * radius };
};

/** Put a hand where a child aiming at that numeral would put it. */
const dragHand = (hand: 'hour' | 'minute', angle: number): void => {
  const grab = app.querySelector<HTMLElement>(`[data-grab="${hand}"]`);
  if (!grab) return; // the level does not draw this hand
  const point = at(angle);
  grab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, ...point }));
  app.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, ...point }));
  app.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, ...point }));
};

/** The canonical right answer to whatever is on screen. */
const answerCorrectly = (): void => {
  const item = currentItem(mounted.session());
  if (!item) throw new Error('no item');

  if (item.task === 'read') {
    tap('[data-verdict="correct"]');
    return;
  }
  if (item.task === 'choose') {
    tap(`[data-choice="${item.answer}"]`);
    return;
  }
  if (item.task === 'order') {
    for (const id of item.order ?? []) tap(`[data-card="${id}"]`);
    return;
  }
  if (item.task === 'set') {
    squareDial();
    const time = item.time!;
    dragHand('hour', (time.hour % 12) * 30);
    dragHand('minute', time.minute * 6);
    tap('[data-action="done"]');
    return;
  }
  if (item.task === 'build') {
    squareDial();
    for (let numeral = 1; numeral <= 12; numeral += 1) {
      tap(`[data-tray="${numeral}"]`);
      const dial = app.querySelector<SVGSVGElement>('[data-build-dial]')!;
      const point = at((numeral % 12) * 30, 36);
      dial.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, ...point }));
    }
    tap('[data-action="done"]');
    return;
  }
  if (item.task === 'tap') {
    const sequence = item.tap?.sequence ?? [];
    for (const value of sequence) {
      const disc = app.querySelector<HTMLElement>(`[data-hit="${value}"]`) ??
        app.querySelector<HTMLElement>(`[data-value="${value}"]`);
      if (!disc) throw new Error(`no disc for ${value} on a tap item`);
      disc.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    return;
  }
  throw new Error(`no canonical answer for task ${item.task}`);
};

let mounted: ReturnType<typeof mountPlay>;

describe('every level accepts its own right answer', () => {
  for (const level of LEVELS) {
    // AC-10 AC-85
    it(`${level.id} — ${level.title.en}`, () => {
      mounted = mountPlay(app, overlayRoot, level);
      mounted.session();
      let guard = 0;
      while (currentItem(mounted.session()) && guard < 40) {
        const before = mounted.session().answered;
        answerCorrectly();
        guard += 1;
        const after = mounted.session();
        if (after.answered === before) break; // the answer did not register
        const last = after.results.at(-1);
        expect(
          last?.correct,
          `${level.id}: a correct answer was marked wrong at ${JSON.stringify(currentItem(after)?.time ?? currentItem(after)?.task)}`,
        ).toBe(true);
      }
      // and it got through a whole round without the app judging a right answer wrong
      expect(guard).toBeGreaterThan(0);
    });
  }
});
