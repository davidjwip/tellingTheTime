/**
 * The wiring: verdict taps in, screens out.
 *
 * Kept out of main.ts so it can be tested. The interesting behaviour of this app is not the layout,
 * it is what a tap does — a correct answer advances the track, a full track celebrates, "Again"
 * starts a fresh round — and behaviour that only exists inside a module side effect is behaviour
 * nobody tests.
 */

import { renderCelebration, renderPlay, renderSummary } from './app';
import { chronoKeyFor, promptKeyFor } from './audio';
import { dialAngle, judgePlacement, settledHourAngle, snapHour, snapMinute, toDialPoint } from './setHands';
import { lapValue, startLap, tapValue } from './tap';

import type { Point } from './setHands';

import type { Lap } from './tap';
import {
  createSession,
  createTierSession,
  currentItem,
  isCleared,
  isFinished,
  recordVerdict,
  trackComplete,
} from './engine';

import type { ClockTime, Item, Rng, Session, TierBank } from './engine';
import type { PlayOptions } from './app';
import type { Locale, Speaker } from './audio';
import type { Level } from './types';

export interface Mounted {
  session(): Session;
  celebrating(): boolean;
  /** Change language in place. Remounting to do it threw away the round and the placed cards. */
  setLocale(locale: Locale): void;
  /** Remove the overlay listener; the overlay does not go with the round. */
  dispose: () => void;
}

/** Play options plus the voice. Optional so a test needs no audio hardware. */
export interface MountOptions extends PlayOptions {
  speaker?: Speaker;
  /** The session's RNG, so a caller can replay a seeded round. Defaults to a fresh random round. */
  rng?: Rng;
}

/** How long a card tap is ignored after one has just been recorded. */
export const CHOICE_TAP_GUARD_MS = 350;

export function mountPlay(
  app: HTMLElement,
  overlayRoot: HTMLElement,
  level: Level,
  options: MountOptions = {},
): Mounted {
  return mountRound(app, overlayRoot, level, () => createSession(level, options.rng), options);
}

/** A tier round: one session drawn across the bank, each item shown with its own level's face. */
export function mountTierPlay(
  app: HTMLElement,
  overlayRoot: HTMLElement,
  bank: TierBank,
  options: MountOptions = {},
): Mounted {
  const display = bank.levels[0] ?? bank.review[0];
  if (!display) throw new Error('a tier bank needs a playable level');
  const levels = [...bank.levels, ...bank.review];
  return mountRound(
    app,
    overlayRoot,
    display,
    () => createTierSession(bank, options.rng),
    options,
    levels,
  );
}

function mountRound(
  app: HTMLElement,
  overlayRoot: HTMLElement,
  level: Level,
  makeSession: () => Session,
  options: MountOptions,
  levels?: readonly Level[],
): Mounted {
  let session = makeSession();
  let celebrating = false;
  let reported = false;
  let spoken: string | undefined;
  let locale: Locale = options.locale ?? 'en';
  // A tap on an order card re-renders the pool, so a bounce lands on a DIFFERENT card and can
  // place one the child never chose - or fill the row and record a verdict he did not give.
  let orderLockUntil = 0;
  let orderLockAt = { x: 0, y: 0 };
  let choiceLocked = false;
  let lastChoiceId: string | undefined;
  let choiceLockAt = { x: 0, y: 0 };
  let placed: string[] = [];
  /** The lap in progress and the item it belongs to, so a new question starts a fresh dial. */
  let lap: Lap | undefined;
  let lapKey: string | undefined;
  /** Which hand a finger is holding, and where the two hands currently point. */
  let grabbing: 'hour' | 'minute' | null = null;
  /** Where the hands are drawn — the hour hand geared to the minutes, as a clock works. */
  let setAngles = { hour: 0, minute: 0 };
  /** What the child actually chose. Judging must read this, never the geared angle: at half past the
   *  geared hour sits between two numerals and rounds to the next one, which made every half-past and
   *  quarter-to item unwinnable. */
  let setChosen = { hour: 12, minute: 0 };
  let setMoved = { hour: false, minute: false };
  let setKey: string | undefined;
  let activePointer: number | null = null;
  let doneLockUntil = 0;

  const speakPrompt = (): void => {
    const item = currentItem(session);
    if (!item || item.key === spoken) return;
    spoken = item.key;
    void options.speaker?.say(promptKeyFor(item));
  };

  /** A new set item starts with both hands at twelve and nothing moved. */
  const syncSet = (): void => {
    const item = currentItem(session);
    if (item?.task !== 'set' || item.key === setKey) return;
    setKey = item.key;
    setAngles = { hour: 0, minute: 0 };
    setChosen = { hour: 12, minute: 0 };
    setMoved = { hour: false, minute: false };
    grabbing = null;
    activePointer = null;
  };

  const pointOf = (event: PointerEvent | MouseEvent): Point => ({ x: event.clientX, y: event.clientY });

  const pointerAngle = (event: PointerEvent | MouseEvent): number => {
    // the dial is on screen for every tap and set item; the cast says so once instead of guarding
    // a case that cannot happen and can therefore never be tested
    const rect = (app.querySelector('svg') as SVGSVGElement).getBoundingClientRect();
    return dialAngle(toDialPoint(pointOf(event), rect));
  };

  const paintHand = (hand: 'hour' | 'minute', angle: number): void => {
    for (const node of Array.from(app.querySelectorAll(`[data-hand="${hand}"], [data-grab="${hand}"]`))) {
      node.setAttribute('transform', `rotate(${angle} 50 50)`);
    }
  };

  /** The level an item came from: its own level in a tier round, the mounted one otherwise. */
  const activeLevel = (): Level =>
    levels?.find((l) => l.id === currentItem(session)?.levelId) ?? level;

  const setHandsDrawn = (): 'hour' | 'both' =>
    activeLevel().face?.hands === 'both' ? 'both' : 'hour';

  const allowedMinutes = (): readonly number[] => activeLevel().minutes ?? [0];

  const setReady = (): void => {
    const done = app.querySelector<HTMLButtonElement>('[data-action="done"]');
    if (!done) return;
    const drawn = setHandsDrawn();
    const ready = drawn === 'both' ? setMoved.hour && setMoved.minute : setMoved.hour;
    // a real disabled control, not an attribute nothing reads: pressing Done before moving anything
    // used to record a free verdict at 12:00
    done.disabled = !ready;
    done.dataset.ready = String(ready);
  };

  const syncLap = (): void => {
    const item = currentItem(session);
    if (!item?.tap) {
      lap = undefined;
      lapKey = undefined;
      return;
    }
    if (item.key === lapKey) return;
    lapKey = item.key;
    lap = startLap(item.tap.sequence);
  };

  const draw = (speak = true): void => {
    syncLap();
    syncSet();
    const finished = isFinished(session) && !celebrating;
    // In a tier round the item's own level decides the face; a single-level round always shows its
    // own level. `levels` is absent for mountPlay, so `??` keeps that path unchanged.
    const shown = levels?.find((candidate) => candidate.id === currentItem(session)?.levelId) ?? level;
    app.replaceChildren(
      finished
        ? renderSummary(session, isCleared(session))
        : renderPlay(shown, session, {
            ...options,
            ...(lastVerdict ? { lastVerdict } : {}),
            placed,
            locale,
            done: lap?.done ?? [],
            ...(lap ? { next: lapValue(lap) ?? 0 } : {}),
          }),
    );

    // The question is said once per face, and only when the caller wants it — after a verdict the
    // next face appears immediately but its question waits for the praise to finish being heard.
    if (speak) speakPrompt();

    overlayRoot.replaceChildren();
    if (!celebrating) return;
    const overlay = renderCelebration(session);
    overlay.classList.add('visible');
    overlayRoot.append(overlay);
  };

  let lastVerdict: 'correct' | 'wrong' | undefined;

  const onVerdict = (verdict: string | undefined): void => {
    if (verdict !== 'correct' && verdict !== 'wrong') return;

    lastVerdict = verdict;
    session = recordVerdict(session, verdict === 'correct');

    if (trackComplete(session)) {
      // The badge is earned here, not when the child dismisses the party: closing the tab on the
      // celebration used to lose it.
      if (!reported) {
        reported = true;
        options.onRoundEnd?.(true);
      }
      celebrating = true;
      draw(false); // the party appears at once; the fanfare is not cut off by a question
      void options.speaker?.say('celebrate');
      return;
    }

    draw(false); // the next face is on screen immediately…
    const spokenVerdict = options.speaker?.say(verdict === 'correct' ? 'praise-1' : 'encourage');

    // …but its question is asked only after the child has HEARD the verdict. Without this, `say`
    // interrupted the praise in the same tick and "well done" was never audible at all.
    if (spokenVerdict) void spokenVerdict.then(() => speakPrompt());
    else speakPrompt();
  };

  // iOS refuses audio until the child has touched something, so the very first question is
  // swallowed. Re-ask it on the first touch: same question, said once, at the moment it can be heard.
  app.addEventListener('pointerdown', () => {
    spoken = undefined;
    speakPrompt();
  }, { once: true });

  app.addEventListener('click', (event) => {
    // A click that reaches this listener always has a target; unwrapping once removes a dozen
    // optional chains that can never take their null path and therefore can never be tested.
    // a listener only fires for events that have a target, so this cast is the honest type
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;

    if (action === 'again') {
      session = makeSession();
      celebrating = false;
      reported = false;
      choiceLocked = false;
      lastChoiceId = undefined;
      placed = [];
      draw();
      return;
    }

    // The header's Level button belongs to the play screen, so it has to do something: go back to
    // the shelf. It was enabled and inert, which this codebase calls a lie.
    if (action === 'done') {
      const button = target.closest<HTMLButtonElement>('[data-action="done"]');
      if (!button || button.disabled) return;
      // the verdict re-renders the screen, so a second tap within the guard lands on the NEXT item's
      // Done and answers a question the child has never seen
      if (Date.now() < doneLockUntil) return;
      doneLockUntil = Date.now() + CHOICE_TAP_GUARD_MS;

      const item = currentItem(session) as Item & { time: ClockTime };
      // the hands the child chose, not the angles they are drawn at: at half past the geared hour
      // sits between two numerals and would round up to the next hour
      const correct = judgePlacement(
        { hour: item.time.hour, minute: item.time.minute },
        setChosen,
        setHandsDrawn(),
      );
      onVerdict(correct ? 'correct' : 'wrong');
      return;
    }

    if (action === 'say') {
      // The time on the clock, not the question: the level exists to teach how this time is said,
      // and repeating "What time is it?" teaches nothing. The question is still spoken on arrival.
      const item = currentItem(session);
      const key = (item?.time ? chronoKeyFor(item.time) : undefined) ?? (item ? promptKeyFor(item) : undefined);
      if (key) void options.speaker?.say(key);
      return;
    }

    if (action === 'level') {
      options.onChangeLevel?.(level);
      return;
    }

    if (action === 'change-level') {
      // the shelf of levels lands next; until then the default walks to the same rung by URL
      const go = options.onChangeLevel ?? ((next: Level) => {
        window.location.search = `?level=${next.id}`;
      });
      go(level);
      return;
    }

    // A tap lap: the child touches the dial itself. A touch on the wrong ring is not a wrong answer,
    // it is a mis-aimed finger, so it does nothing at all.
    const tapItem = currentItem(session);
    if (tapItem?.tap) {
      // A disc is the target and a glyph is the mark; they are siblings, not nested, so the value has
      // to be read from the thing that was hit rather than from an ancestor.
      const direct = target?.getAttribute('data-hit');
      const disc = direct != null ? target : target.closest<HTMLElement>('[data-hit]');
      const ring = tapItem.tap.target;
      const glyphOnRing = target.closest<HTMLElement>(
        ring === 'numerals' ? '[data-numeral]' : '[data-minute-label="true"]',
      );
      const raw =
        direct ??
        glyphOnRing?.getAttribute('data-value') ??
        glyphOnRing?.textContent ??
        '';
      if (disc == null && glyphOnRing == null) return;

      const value = Number(raw);
      const result = tapValue(lap ?? startLap(tapItem.tap.sequence), value);
      if (!result.correct) return;

      lap = result.lap;
      if (result.complete) {
        lap = undefined;
        lapKey = undefined;
        onVerdict('correct');
        return;
      }

      // Redraw rather than patching the DOM: the marks and the "next" hint both come from the lap,
      // so the model and the screen cannot disagree.
      draw(false);
      return;
    }

    // An order card fills the next slot, and a placed card goes back to the pool. The row is checked
    // only when it is full, so a half-built answer records nothing.
    const card = target.closest<HTMLElement>('[data-card]')?.dataset.card;
    if (card !== undefined) {
      // Block only a BOUNCE: the same spot, moments later. A blanket time lock would swallow an
      // honest fast tap on a different card, which a four-year-old does constantly.
      const point = { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
      const bounced =
        Date.now() < orderLockUntil &&
        Math.abs(point.x - orderLockAt.x) < 48 &&
        Math.abs(point.y - orderLockAt.y) < 48;
      if (bounced) return;
      const item = currentItem(session);
      const expected = item?.order;
      if (!item || !expected) return;

      if (placed.includes(card)) {
        placed = placed.filter((id) => id !== card);
      } else if (placed.length < expected.length) {
        placed = [...placed, card];
      } else {
        /* v8 ignore next 2 -- a full row is checked the moment it fills, so nothing can reach this */
        return;
      }

      orderLockUntil = Date.now() + CHOICE_TAP_GUARD_MS;
      orderLockAt = point;

      if (placed.length < expected.length) {
        draw(false);
        return;
      }

      const correct = placed.every((id, index) => id === expected[index]);
      placed = [];
      onVerdict(correct ? 'correct' : 'wrong');
      return;
    }

    // A choice tap is already the answer. Compare it with the item the app built, so the verdict is
    // recorded by the same path as an adult's tap and a miss still returns three places later.
    const choice = target.closest<HTMLElement>('[data-choice]')?.dataset.choice;
    if (choice !== undefined) {
      // A double tap used to answer the next question: the first tap re-renders the screen under
      // the second one. Ignore a repeat tap on the card just chosen until the child has had time to
      // see the change. A tap on a different card is a fresh answer, not a bounce.
      // Two dials sit in the same two places, so an identity check alone lets a bounce answer the
      // OTHER one. The order guard already learned this; a tap in the same spot is a bounce.
      const point = { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
      const bounced =
        choiceLocked &&
        (choice === lastChoiceId ||
          (Math.abs(point.x - choiceLockAt.x) < 48 && Math.abs(point.y - choiceLockAt.y) < 48));
      if (bounced) return;
      const item = currentItem(session);
      if (item?.answer !== undefined) {
        choiceLocked = true;
        lastChoiceId = choice;
        choiceLockAt = { x: point.x, y: point.y };
        setTimeout(() => {
          choiceLocked = false;
        }, CHOICE_TAP_GUARD_MS);
        onVerdict(choice === item.answer ? 'correct' : 'wrong');
      }
      return;
    }

    onVerdict(target.closest<HTMLElement>('[data-verdict]')?.dataset.verdict);
  });

  // Named, because the overlay is shared by every round and outlives each of them: an inline
  // handler here cannot be removed, so every level opened left another listener behind.
  const onOverlayClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-action="close-celebration"]')) return;
    celebrating = false;
    draw();
  };
  app.addEventListener('pointerdown', (event) => {
    // one finger at a time: a second one landing mid-drag must not steal the hand
    if (activePointer !== null) return;
    const target = event.target as HTMLElement;
    const grab = target.closest<HTMLElement>('[data-grab]');
    if (!grab || currentItem(session)?.task !== 'set') return;
    grabbing = grab.dataset.grab === 'hour' ? 'hour' : 'minute';
    activePointer = event.pointerId;
    grab.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  // iOS can cancel a gesture at any moment; without this the hand stays held and follows the next
  // unrelated touch
  app.addEventListener('pointercancel', () => {
    grabbing = null;
    activePointer = null;
  });

  app.addEventListener('pointermove', (event) => {
    if (!grabbing || event.pointerId !== activePointer || currentItem(session)?.task !== 'set') return;
    const angle = pointerAngle(event);
    const hand = grabbing;
    setAngles = { ...setAngles, [hand]: angle };
    setMoved = { ...setMoved, [hand]: true };
    paintHand(hand, angle);
    setReady();
  });

  app.addEventListener('pointerup', (event) => {
    if (!grabbing || event.pointerId !== activePointer) return;
    const hand = grabbing;
    grabbing = null;
    activePointer = null;
    const allowed = allowedMinutes();

    if (hand === 'minute') {
      // the minute hand settles on the grid this level asks for
      const minute = snapMinute(setAngles.minute, allowed);
      setChosen = { ...setChosen, minute };
      setAngles = { ...setAngles, minute: (minute * 6) % 360 };
      paintHand('minute', setAngles.minute);
      // and the hour hand follows, so the clock keeps telling the truth while it is being set
      setAngles = { ...setAngles, hour: settledHourAngle(setChosen.hour, minute) };
      paintHand('hour', setAngles.hour);
    } else {
      const hour = snapHour(setAngles.hour);
      setChosen = { ...setChosen, hour };
      setAngles = { ...setAngles, hour: settledHourAngle(hour, setChosen.minute) };
      paintHand('hour', setAngles.hour);
    }
    setReady();
  });

  overlayRoot.addEventListener('click', onOverlayClick);

  draw();

  return {
    session: () => session,
    celebrating: () => celebrating,
    dispose: () => overlayRoot.removeEventListener('click', onOverlayClick),
    setLocale: (next: Locale) => {
      locale = next;
      options.speaker?.setLocale(next);
      draw(false);
    },
  };
}