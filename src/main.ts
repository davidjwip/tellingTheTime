/**
 * Bootstrap only: pick a level from the URL, hand the DOM to mountPlay.
 *
 * Everything with a branch in it lives in play.ts so it can be tested; this file is excluded from
 * the coverage gate for the same reason scripts/ is — it is glue with nothing to assert.
 */

import './styles.css';

import { LEVELS } from './levels';
import { mountPlay } from './play';

const requested = new URLSearchParams(window.location.search).get('level');
const level = LEVELS.find((l) => l.id === requested) ?? LEVELS.find((l) => l.id === 't2.2') ?? LEVELS[0]!;

mountPlay(document.getElementById('app')!, document.getElementById('overlay-root')!, level);
