/**
 * Bootstrap: pick a level, show the shelf, remember what happened.
 *
 * Excluded from the coverage gate for the same reason scripts/ is: it is glue. Everything with a
 * branch worth asserting lives in picker.ts, progress.ts and play.ts, which are tested directly.
 */

import './styles.css';

import { Speaker } from './audio';
import { isCleared } from './engine';
import { LEVELS } from './levels';
import { mountPlay } from './play';
import { loadProgress, markCleared, rememberLevel, saveProgress, setName } from './progress';
import { levelFromClick, renderPicker, resolveStartLevel, shelve } from './picker';

import type { Level } from './types';

const app = document.getElementById('app')!;
const overlayRoot = document.getElementById('overlay-root')!;
const store = window.localStorage;

let progress = loadProgress(store);
/** The level currently on screen, so a language change can redraw it. */
let currentLevel: Level | null = null;

// One speaker for the app's life: the clips are pre-recorded, so this only ever picks a file.
const speaker = new Speaker(
  (url) => {
    const element = new Audio(url);
    return {
      play: () => element.play(),
      pause: () => element.pause(),
      onEnded: (callback) => element.addEventListener('ended', callback),
    };
  },
  progress.locale,
);

function showPicker(): void {
  currentLevel = null;
  app.replaceChildren(renderPicker(shelve(LEVELS, progress), progress));
  overlayRoot.replaceChildren();
}

function play(level: Level): void {
  currentLevel = level;
  progress = rememberLevel(progress, level.id);
  saveProgress(store, progress);

  // mountPlay attaches its listeners to the host element, so replacing the host disposes them
  const host = document.createElement('div');
  app.replaceChildren(host);

  mountPlay(host, overlayRoot, level, {
    speaker,
    locale: progress.locale,
    onChangeLevel: () => showPicker(),
    onRoundEnd: (cleared) => {
      if (!cleared) return;
      progress = markCleared(progress, level.id);
      saveProgress(store, progress);
    },
  });
}

app.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;

  // The toggle was enabled and inert for a whole PR. Either it works or it is disabled; a control
  // that looks pressable and does nothing is a lie to the adult holding the tablet.
  const locale = target?.closest<HTMLElement>('[data-locale]')?.dataset.locale;
  if (locale === 'en' || locale === 'yue') {
    progress = { ...progress, locale };
    saveProgress(store, progress);
    speaker.setLocale(locale);
    if (currentLevel) play(currentLevel);
    else showPicker();
    return;
  }

  const chosen = levelFromClick(target);
  if (chosen) {
    const level = LEVELS.find((l) => l.id === chosen);
    if (level) play(level);
    return;
  }

  if (target?.closest('[data-action="start"]')) {
    const remembered = LEVELS.find((l) => l.id === progress.lastLevel);
    const firstPlayable = LEVELS.find((l) => shelve([l], progress)[0]?.available);
    const next = remembered ?? firstPlayable;
    if (next) play(next);
  }
});

app.addEventListener('input', (event) => {
  const target = event.target as HTMLInputElement | null;
  if (target?.name !== 'name') return;
  progress = setName(progress, target.value);
  saveProgress(store, progress);
});

// Both `?level=` and the remembered level are untrusted: either can name a level the shelf would
// not offer, and starting one used to begin a round of nothing. resolveStartLevel is tested.
const initial = resolveStartLevel(
  LEVELS,
  progress,
  new URLSearchParams(window.location.search).get('level'),
);

if (initial) play(initial);
else showPicker();