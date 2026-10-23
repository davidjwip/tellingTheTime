/**
 * The wiring: verdict taps in, screens out.
 *
 * Kept out of main.ts so it can be tested. The interesting behaviour of this app is not the layout,
 * it is what a tap does — a correct answer advances the track, a full track celebrates, "Again"
 * starts a fresh round — and behaviour that only exists inside a module side effect is behaviour
 * nobody tests.
 */

import { renderCelebration, renderPlay, renderSummary } from './app';
import { createSession, isCleared, isFinished, recordVerdict, trackComplete } from './engine';

import type { Session } from './engine';
import type { PlayOptions } from './app';
import type { Level } from './types';

export interface Mounted {
  session(): Session;
  celebrating(): boolean;
}

export function mountPlay(
  app: HTMLElement,
  overlayRoot: HTMLElement,
  level: Level,
  options: PlayOptions = {},
): Mounted {
  let session = createSession(level);
  let celebrating = false;
  let reported = false;

  const draw = (): void => {
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
    if (trackComplete(session)) celebrating = true;
    draw();
  };

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
