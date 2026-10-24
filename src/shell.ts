/**
 * The app's wiring, out of main.ts.
 *
 * `main.ts` was excluded from coverage as "glue" and produced two production bugs in one day: a tap
 * inside a round rebuilt the round, and the language toggle did the same. Neither was glue — both
 * were decisions about what a click means, and nothing tested them.
 *
 * This module is that logic, taking its DOM and its storage as arguments so a test can drive the
 * whole app without a browser. main.ts is now three lines and a side effect.
 */

import { mountPlay } from './play';
import { mountTierPlay } from './play';
import {
  bankForTier,
  firstPlayable,
  levelFromClick,
  renderInstructions,
  renderPicker,
  resolveStartLevel,
  shelve,
} from './picker';
import { loadProgress, markCleared, rememberLevel, saveProgress, setName } from './progress';

import type { Mounted } from './play';
import type { Progress, Store } from './progress';
import type { Speaker } from './audio';
import type { Level } from './types';

export interface ShellDeps {
  app: HTMLElement;
  overlayRoot: HTMLElement;
  store: Store;
  levels: readonly Level[];
  speaker?: Speaker;
}

export interface Shell {
  /** Render the first screen: the level named in the URL, the remembered one, or the shelf. */
  start: (requested: string | null) => void;
  progress: () => Progress;
  /** The level on screen, for tests and for the badge write-back. */
  currentLevel: () => Level | null;
}

/** How long a finger rests on a tier before its exercises are shown. Long enough not to fire on a tap. */
export const LONG_PRESS_MS = 400;
/** A finger that moves further than this is scrolling, not pressing. */
export const MOVE_TOLERANCE_PX = 10;
/** How long the bubble stays readable after the finger lifts. */
export const TIP_LINGER_MS = 5000;

export function createShell(deps: ShellDeps): Shell {
  const { app, overlayRoot, store, levels, speaker } = deps;
  let progress = loadProgress(store);
  let currentLevel: Level | null = null;
  let mounted: Mounted | null = null;

  const showPicker = (): void => {
    currentLevel = null;
    mounted?.dispose();
    mounted = null;
    app.replaceChildren(renderPicker(shelve(levels, progress), progress));
    overlayRoot.replaceChildren();
  };

  /**
   * The badge lands on whatever door the shelf is showing: a single level, or the tier door a tier
   * round was opened from. One function for both, so the two paths cannot drift apart.
   */
  const noteCleared = (): void => {
    // a round cannot be mounted without a level, so this is safe rather than defensive
    progress = markCleared(progress, currentLevel!.id);
    saveProgress(store, progress);
  };

  /**
   * A tier door: the round is drawn from the whole tier, with lower tiers mixed in as revision.
   */
  const playTier = (tier: number): void => {
    const bank = bankForTier(levels, progress, tier);
    if (!bank) return;

    // bankForTier returns null rather than an empty bank, so the first level is guaranteed
    const entry = bank.levels[0]!;
    currentLevel = entry;
    progress = rememberLevel(progress, entry.id);
    saveProgress(store, progress);

    mounted?.dispose();
    const host = document.createElement('div');
    app.replaceChildren(host);

    mounted = mountTierPlay(host, overlayRoot, bank, {
      ...(speaker ? { speaker } : {}),
      locale: progress.locale,
      onChangeLevel: () => showPicker(),
      onRoundEnd: noteCleared,
    });
  };

  const play = (level: Level): void => {
    currentLevel = level;
    progress = rememberLevel(progress, level.id);
    saveProgress(store, progress);

    // Host listeners die with the host, but the overlay listener does not: the overlay is shared
    // and outlives every round, so it is removed explicitly. Otherwise each level open leaves a
    // handler behind that answers clicks on the next round's celebration.
    mounted?.dispose();
    const host = document.createElement('div');
    app.replaceChildren(host);

    mounted = mountPlay(host, overlayRoot, level, {
      ...(speaker ? { speaker } : {}),
      locale: progress.locale,
      onChangeLevel: () => showPicker(),
      onRoundEnd: noteCleared,
    });
  };

  let instructionsOpener: HTMLElement | null = null;

  const openInstructions = (opener: HTMLElement | null): void => {
    instructionsOpener = opener;
    overlayRoot.replaceChildren(renderInstructions(progress.locale));
    // the panel must take focus, or a keyboard user stays behind a modal dialog
    overlayRoot.querySelector<HTMLElement>('[data-action="close-instructions"]')?.focus();
  };

  const closeInstructions = (): void => {
    if (!overlayRoot.querySelector('[data-panel="instructions"]')) return;
    overlayRoot.replaceChildren();
    instructionsOpener?.focus();
    instructionsOpener = null;
  };

  // The panel lives in the overlay, which is outside #app, so its Close button needs its own listener.
  overlayRoot.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-action="close-instructions"]')) {
      closeInstructions();
      return;
    }
    // The panel's sample buttons read a time out in whichever register is chosen.
    const sample = target?.closest<HTMLElement>('[data-say]')?.dataset.say;
    if (sample) void speaker?.say(sample);
  });

  // Escape closes the panel: an adult who opened it by accident should not have to hunt for the button.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeInstructions();
  });

  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let pressOrigin: { x: number; y: number } | null = null;
  const cancelPress = (): void => {
    if (pressTimer !== undefined) clearTimeout(pressTimer);
    pressTimer = undefined;
    pressOrigin = null;
  };

  const clearTips = (): void => {
    for (const tipped of Array.from(app.querySelectorAll<HTMLElement>('[data-tip]'))) {
      delete tipped.dataset.tip;
    }
  };

  // A title attribute never opens on an iPad, so the exercises come out on a long press instead.
  app.addEventListener('pointerdown', (event) => {
    const door = (event.target as HTMLElement | null)?.closest<HTMLElement>('.picker [data-tier-entry]');
    if (!door) return;
    cancelPress();
    pressOrigin = { x: event.clientX, y: event.clientY };
    pressTimer = setTimeout(() => {
      door.dataset.tip = 'true';
    }, LONG_PRESS_MS);
  });

  // A press that becomes a scroll is not a long press, and must not leave a bubble behind.
  app.addEventListener('pointermove', (event) => {
    if (!pressOrigin) return;
    const moved = Math.abs(event.clientX - pressOrigin.x) + Math.abs(event.clientY - pressOrigin.y);
    if (moved > MOVE_TOLERANCE_PX) cancelPress();
  });

  const endPress = (): void => {
    cancelPress();
    // the bubble stays while the finger is down and for a moment after, so it can be read
    if (app.querySelector('[data-tip]')) {
      setTimeout(() => {
        if (!app.querySelector('[data-tip]')?.getAttribute('data-tip-held')) clearTips();
      }, TIP_LINGER_MS);
    }
  };
  app.addEventListener('pointerup', endPress);
  app.addEventListener('pointercancel', endPress);
  app.addEventListener('pointerleave', endPress, true);

  app.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;

    if (target?.closest('[data-action="instructions"]')) {
      openInstructions(target.closest<HTMLElement>('[data-action="instructions"]'));
      return;
    }

    // Scoped to the shelf: the play screen's container also carries data-level, and a bare
    // closest() there turned every tap inside a round into "open this level again".
    // A tier door and a specific level both carry data-level, so the door is checked first.
    const door = target?.closest<HTMLElement>('.picker [data-tier-entry]');
    const doorTier = door?.closest<HTMLElement>('[data-tier]')?.dataset.tier;
    if (door?.dataset.tip === 'true') {
      // The press that revealed the tooltip must not also start the round; a second tap will.
      delete door.dataset.tip;
      return;
    }

    // anywhere else on the screen: the bubble has done its job
    clearTips();

    if (door && doorTier !== undefined) {
      playTier(Number(doorTier));
      return;
    }

    const chosen = levelFromClick(target);
    if (chosen) {
      const level = levels.find((candidate) => candidate.id === chosen);
      if (level) play(level);
      return;
    }

    const locale = target?.closest<HTMLElement>('[data-locale]')?.dataset.locale;
    if (locale === 'en' || locale === 'yue' || locale === 'zh') {
      progress = { ...progress, locale };
      saveProgress(store, progress);
      if (mounted) mounted.setLocale(locale);
      else showPicker();
      return;
    }

    if (target?.closest('[data-action="start"]')) {
      // One decision, in one place: this used to repeat resolveStartLevel without its availability
      // guard, so Start could open a level the shelf refuses to offer.
      const next = resolveStartLevel(levels, progress, null) ?? firstPlayable(levels, progress);
      if (next) play(next);
    }
  });

  app.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement | null;
    if (target?.name !== 'name') return;
    progress = setName(progress, target.value);
    saveProgress(store, progress);
  });

  return {
    start: (requested) => {
      const first = resolveStartLevel(levels, progress, requested);
      if (first) play(first);
      else showPicker();
    },
    progress: () => progress,
    currentLevel: () => currentLevel,
  };
}
