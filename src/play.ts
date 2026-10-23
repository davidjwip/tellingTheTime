/**
 * The wiring: verdict taps in, screens out.
 *
 * Kept out of main.ts so it can be tested. The interesting behaviour of this app is not the layout,
 * it is what a tap does — a correct answer advances the track, a full track celebrates, "Again"
 * starts a fresh round — and behaviour that only exists inside a module side effect is behaviour
 * nobody tests.
 */

import { renderCelebration, renderPlay, renderSummary } from './app';
import { promptKeyFor } from './audio';
import {
  createSession,
  currentItem,
  isCleared,
  isFinished,
  recordVerdict,
  trackComplete,
} from './engine';

import type { Rng, Session } from './engine';
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
  let session = createSession(level, options.rng);
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
  let placed: string[] = [];

  const speakPrompt = (): void => {
    const item = currentItem(session);
    if (!item || item.key === spoken) return;
    spoken = item.key;
    void options.speaker?.say(promptKeyFor(item));
  };

  const draw = (speak = true): void => {
    const finished = isFinished(session) && !celebrating;
    if (finished && !reported) {
      reported = true;
      if (isCleared(session)) options.onRoundEnd?.(true);
    }
    app.replaceChildren(
      finished
        ? renderSummary(session, isCleared(session))
        : renderPlay(level, session, {
            ...options,
            ...(lastVerdict ? { lastVerdict } : {}),
            placed,
            locale,
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
    const target = event.target as HTMLElement | null;
    const action = target?.closest<HTMLElement>('[data-action]')?.dataset.action;

    if (action === 'again') {
      session = createSession(level, options.rng);
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

    // An order card fills the next slot, and a placed card goes back to the pool. The row is checked
    // only when it is full, so a half-built answer records nothing.
    const card = target?.closest<HTMLElement>('[data-card]')?.dataset.card;
    if (card !== undefined) {
      // Block only a BOUNCE: the same spot, moments later. A blanket time lock would swallow an
      // honest fast tap on a different card, which a four-year-old does constantly.
      const point = { x: (event as MouseEvent).clientX ?? 0, y: (event as MouseEvent).clientY ?? 0 };
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
    const choice = target?.closest<HTMLElement>('[data-choice]')?.dataset.choice;
    if (choice !== undefined) {
      // A double tap used to answer the next question: the first tap re-renders the screen under
      // the second one. Ignore a repeat tap on the card just chosen until the child has had time to
      // see the change. A tap on a different card is a fresh answer, not a bounce.
      if (choiceLocked && choice === lastChoiceId) return;
      const item = currentItem(session);
      if (item?.answer !== undefined) {
        choiceLocked = true;
        lastChoiceId = choice;
        setTimeout(() => {
          choiceLocked = false;
        }, CHOICE_TAP_GUARD_MS);
        onVerdict(choice === item.answer ? 'correct' : 'wrong');
      }
      return;
    }

    onVerdict(target?.closest<HTMLElement>('[data-verdict]')?.dataset.verdict);
  });

  // Named, because the overlay is shared by every round and outlives each of them: an inline
  // handler here cannot be removed, so every level opened left another listener behind.
  const onOverlayClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('[data-action="close-celebration"]')) return;
    celebrating = false;
    draw();
  };
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