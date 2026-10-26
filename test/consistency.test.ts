import { beforeEach, describe, expect, it } from 'vitest';

import { choiceFor, wrapChoiceFor } from '../src/choose';
import { currentItem, seededRng } from '../src/engine';
import { idealAngle, judgeBuild } from '../src/build';
import { LEVELS } from '../src/levels';
import { mountPlay } from '../src/play';
import { judgePlacement, snapHour, snapMinute } from '../src/setHands';

import type { Level } from '../src/types';

/**
 * Two questions the rest of the suite never asked.
 *
 * 1. THE DOMAIN. For every level and every answer it can hold, is a correct answer accepted? This part
 *    is exhaustive and instant, because it calls the same judging functions the screens call.
 * 2. THE WIRING. Do the screens actually pass the child's answer to those functions? This part plays
 *    real rounds through the real screens. It is repeated over fixed seeds, not exhaustive, and it
 *    does not pretend otherwise — a minute that no seed draws cannot fail here, which is exactly why
 *    part 1 exists.
 *
 * The geared-hour blocker is the reason both parts exist. The judge was right for the placement it was
 * given; the screen handed it the geared angle instead. A domain sweep alone would have passed.
 */

let app: HTMLElement;
let overlayRoot: HTMLElement;
/** The element the current round was mounted into. The app gives each mount a fresh host, so a test
 *  that reuses one stacks the previous round's listeners on top of the new one. */
let surface: HTMLElement;

beforeEach(() => {
  document.body.replaceChildren();
  app = document.createElement('div');
  overlayRoot = document.createElement('div');
  document.body.append(app, overlayRoot);
});

const click = (selector: string): void => {
  const node = surface.querySelector<HTMLElement>(selector);
  if (!node) throw new Error(`nothing to click: ${selector}`);
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

const squareDial = (): void => {
  for (const svg of surface.querySelectorAll('svg')) {
    (svg as SVGSVGElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 }) as DOMRect;
  }
};

const at = (angle: number, radius = 40): { clientX: number; clientY: number } => {
  const radians = (angle * Math.PI) / 180;
  return { clientX: 50 + Math.sin(radians) * radius, clientY: 50 - Math.cos(radians) * radius };
};

const dragHand = (hand: 'hour' | 'minute', angle: number): void => {
  const grab = surface.querySelector<HTMLElement>(`[data-grab="${hand}"]`);
  if (!grab) return; // the level does not draw this hand
  const point = at(angle);
  grab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, ...point }));
  surface.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, ...point }));
  surface.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, ...point }));
};

let mounted: ReturnType<typeof mountPlay>;

const answerCorrectly = (): void => {
  const item = currentItem(mounted.session());
  if (!item) throw new Error('no item');

  if (item.task === 'read') return click('[data-verdict="correct"]');
  if (item.task === 'choose') return click(`[data-choice="${item.answer}"]`);
  if (item.task === 'order') {
    for (const id of item.order ?? []) click(`[data-card="${id}"]`);
    return;
  }
  if (item.task === 'set') {
    squareDial();
    const time = item.time!;
    dragHand('hour', (time.hour % 12) * 30);
    dragHand('minute', time.minute * 6);
    return click('[data-action="done"]');
  }
  if (item.task === 'build') {
    squareDial();
    for (let numeral = 1; numeral <= 12; numeral += 1) {
      click(`[data-tray="${numeral}"]`);
      const dial = surface.querySelector<SVGSVGElement>('[data-build-dial]')!;
      dial.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, ...at((numeral % 12) * 30, 36) }),
      );
    }
    return click('[data-action="done"]');
  }
  if (item.task === 'tap') {
    for (const value of item.tap?.sequence ?? []) {
      const disc =
        surface.querySelector<HTMLElement>(`[data-hit="${value}"]`) ??
        surface.querySelector<HTMLElement>(`[data-value="${value}"]`);
      if (!disc) throw new Error(`no disc for ${value} on a tap item`);
      disc.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    return;
  }
  throw new Error(`no canonical answer for task ${item.task}`);
};

/** What the child was shown: the item's own time, or both dials of a clock choice. */
const shownTimes = (time: { hour: number; minute: number } | undefined, dials?: readonly { hour: number; minute: number }[]): string[] => {
  if (time) return [`${time.hour}:${time.minute}`];
  return (dials ?? []).map((dial) => `${dial.hour}:${dial.minute}`);
};

const clockTimes = (level: Level): string[] => {
  if (level.content.kind !== 'clock') return [];
  const out: string[] = [];
  for (const hour of level.hours ?? []) {
    for (const minute of level.minutes ?? []) out.push(`${hour}:${minute}`);
  }
  return out;
};

/** Play whole rounds, answering everything correctly. Returns what was shown and what was rejected. */
const playRounds = (level: Level, rounds: number): { seen: Set<string>; wrong: string[] } => {
  const seen = new Set<string>();
  const wrong: string[] = [];

  for (let seed = 1; seed <= rounds; seed += 1) {
    surface = document.createElement('div');
    app.replaceChildren(surface);
    overlayRoot.replaceChildren();
    mounted = mountPlay(surface, overlayRoot, level, { rng: seededRng(seed) });
    let guard = 0;
    while (currentItem(mounted.session()) && guard < 40) {
      const item = currentItem(mounted.session());
      if (!item) break;
      shownTimes(item.time, item.dials).forEach((time) => seen.add(time));
      const before = mounted.session().answered;
      answerCorrectly();
      guard += 1;
      if (mounted.session().answered === before) break;
      if (mounted.session().results.at(-1)?.correct !== true) {
        wrong.push(`${level.id}: ${item.time ? `${item.time.hour}:${item.time.minute}` : item.task}`);
      }
    }
  }
  return { seen, wrong };
};

describe('every level accepts its own right answer, over its whole domain', () => {
  for (const level of LEVELS) {
    // AC-10 AC-85
    it(`${level.id} — ${level.title.en}`, () => {
      const wrong: string[] = [];

      if (level.content.kind === 'clock') {
        const hands = level.face?.hands === 'both' ? 'both' : 'hour';
        for (const hour of level.hours ?? []) {
          for (const minute of level.minutes ?? []) {
            const target = { hour, minute };
            const placed = {
              hour: snapHour(idealAngle(hour)),
              minute: snapMinute(minute * 6, level.minutes ?? [0]),
            };
            if (level.round.some((step) => step.task === 'set')) {
              if (!judgePlacement(target, placed, hands)) {
                wrong.push(`${level.id}: ${hour}:${minute} judged wrong when set correctly`);
              }
            }
            // a choice needs two minutes to choose between, which is AC-77's own rule
            const asksChoice = (level.minutes ?? []).length >= 2;
            if (asksChoice && level.round.some((step) => step.task === 'choose')) {
              const choice = choiceFor(level);
              if (!choice) {
                wrong.push(`${level.id}: ${hour}:${minute} cannot be asked`);
              } else if (!choice.dials || choice.dials.length !== 2) {
                wrong.push(`${level.id}: ${hour}:${minute} was offered as ${choice.dials?.length ?? 0} dials`);
              } else if (!choice.dials.some((dial) => `${dial.hour}:${dial.minute}` === choice.answer)) {
                wrong.push(`${level.id}: ${hour}:${minute} — the answer is not one of the dials`);
              }
            }
          }
        }
      }

      if (level.content.kind === 'buildFace') {
        const perfect = Array.from({ length: 12 }, (_, index) => ({
          numeral: index + 1,
          angle: idealAngle(index + 1),
        }));
        if (!judgeBuild(perfect).pass) wrong.push(`${level.id}: a perfect face was judged not built`);
      }

      // the wiring: real rounds, real screens, fixed seeds
      const rounds = 6;
      const wiring = playRounds(level, rounds);
      wrong.push(...wiring.wrong);

      expect(wrong, `the app rejected correct answers:\n${wrong.join('\n')}`).toEqual([]);

      // and where the whole domain fits in a few rounds, it must actually have been played
      const domain = clockTimes(level);
      if (domain.length > 0 && domain.length <= 12) {
        const missed = domain.filter((time) => !wiring.seen.has(time));
        expect(missed, `${level.id}: ${rounds} rounds never showed ${missed.join(', ')}`).toEqual([]);
      }
    });
  }
});
