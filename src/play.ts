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

import type { Session } from './engine';
import type { PlayOptions } from './app';
import type { Speaker } from './audio';
import type { Level } from './types';

export interface Mounted {
  session(): Session;
  celebrating(): boolean;
}

/** Play options plus the voice. Optional so a test needs no audio hardware. */
export interface MountOptions extends PlayOptions {
  speaker?: Speaker;
}

export function mountPlay(
  app: HTMLElement,
  overlayRoot: HTMLElement,
  level: Level,
  options: MountOptions = {},
): Mounted {
  let session = createSession(level);
  let celebrating = false;
  let reported = false;
  let spoken: string | undefined;

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
      options.onRoundEnd?.(isCleared(session));
    }
    app.replaceChildren(
      finished
        ? renderSummary(session, isCleared(session))
        : renderPlay(level, session, lastVerdict ? { ...options, lastVerdict } : options),
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
      session = createSession(level);
      celebrating = false;
      reported = false;
      draw();
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

    // A card tap is already the answer. Compare it with the item the app built, so the verdict is
    // recorded by the same path as an adult's tap and a miss still returns three places later.
    const choice = target?.closest<HTMLElement>('[data-choice]')?.dataset.choice;
    if (choice !== undefined) {
      const item = currentItem(session);
      if (item?.answer !== undefined) onVerdict(choice === item.answer ? 'correct' : 'wrong');
      return;
    }

    onVerdict(target?.closest<HTMLElement>('[data-verdict]')?.dataset.verdict);
  });

  overlayRoot.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('[data-action="close-celebration"]')) return;
    celebrating = false;
    draw();
  });

  draw();

  return { session: () => session, celebrating: () => celebrating };
}