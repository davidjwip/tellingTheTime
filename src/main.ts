/**
 * Bootstrap: hand the DOM to the shell.
 *
 * Every decision lives in shell.ts, where a test can drive it. This file is three lines because the
 * last time it held a decision — "a click on data-level means open that level" — it rebuilt the
 * round on every tap and wiped the child's work.
 */

import './styles.css';

import { Speaker } from './audio';
import { LEVELS } from './levels';
import { createShell } from './shell';

const speaker = new Speaker(
  (url) => {
    const element = new Audio(url);
    return {
      play: () => element.play(),
      pause: () => element.pause(),
      onEnded: (callback) => element.addEventListener('ended', callback),
    };
  },
);

createShell({
  app: document.getElementById('app')!,
  overlayRoot: document.getElementById('overlay-root')!,
  store: window.localStorage,
  levels: LEVELS,
  speaker,
}).start(new URLSearchParams(window.location.search).get('level'));
