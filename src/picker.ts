/**
 * The level shelf.
 *
 * The level data asks for six kinds of question and the app can present `read` and, for the two
 * card levels, `choose`. Rather than hide the rest behind a half-working screen, the shelf computes
 * what is actually playable from the data: a level survives if at least MIN_ITEMS questions can be
 * asked after the ones with no UI are dropped, and the rest say what they are waiting for. That
 * makes the shelf a to-do list rather than a lie.
 */

import { canPresent } from './engine';

import type { TierBank } from './engine';

import { NAME_MAX } from './progress';

import type { Level, Task } from './types';
import type { Progress } from './progress';

/** Below this many answerable questions a level is not worth offering. */
export const MIN_ITEMS = 4;

/** What each unbuilt task needs, in the words an adult would use. */
const NEEDS: Record<Task, string> = {
  read: '',
  set: 'needs hand-dragging',
  tap: 'needs tapping the dial',
  choose: 'needs choosing between dials',
  order: 'needs ordering',
  build: 'needs building the face',
};

const TIERS: Array<[number, string]> = [
  [0, 'Before the clock'],
  [1, 'Numbers and the dial'],
  [2, "O'clock"],
  [3, 'Half past'],
  [4, 'Quarter past and to'],
];

/** Tier names, exported so tests and the instructions panel cannot drift from the shelf. */
export const TIER_TITLES: Record<number, string> = Object.fromEntries(TIERS);

/** One plain sentence per tier, for the grown-up reading the instructions. */
const TIER_BLURB: Record<number, string> = {
  0: 'Time words before any clock: the order of the day, yesterday and tomorrow, which took longer, the days of the week.',
  1: 'The numbers on the dial: tapping 1 to 12 in order, what comes after 12, counting round in fives, and building the face.',
  2: "O'clock: the four anchor times, then all twelve, then making a time with the hands.",
  3: 'Half past: spotting it, reading it, and making it — then telling o\'clock from half past.',
  4: 'Quarter past and quarter to, and all four quarters together.',
};

export interface Shelved {
  level: Level;
  /** How many questions the app can actually ask today. */
  items: number;
  available: boolean;
  reason?: string;
  cleared: boolean;
}

export function shelve(levels: readonly Level[], progress: Progress): Shelved[] {
  return levels.map((level) => {
    const items = level.round
      .filter((step) => canPresent(level, step.task))
      .reduce((sum, step) => sum + step.items, 0);

    const unbuilt = level.round.find((step) => !canPresent(level, step.task));
    const available = items >= MIN_ITEMS;

    const shelved: Shelved = {
      level,
      items,
      available,
      cleared: progress.cleared.includes(level.id),
    };
    if (!available) {
      shelved.reason = unbuilt ? NEEDS[unbuilt.task] : 'nothing to ask yet';
    }
    return shelved;
  });
}

/**
 * Which level a visit starts on.
 *
 * `?level=` and the remembered level are both untrusted input: either can name a level that is not
 * playable, which used to start a round of nothing. Resume only onto something the shelf would
 * offer, and otherwise show the shelf.
 */
export function resolveStartLevel(
  levels: readonly Level[],
  progress: Progress,
  requested: string | null,
): Level | null {
  const wanted = requested ?? progress.lastLevel;
  if (wanted === null) return null;
  const found = levels.find((level) => level.id === wanted);
  if (!found) return null;
  return shelve([found], progress)[0]?.available ? found : null;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Which level a click means, if any.
 *
 * The play screen's container ALSO carries data-level (it is the level being played), so a bare
 * `closest('[data-level]')` matched every tap inside a round: tapping a card remounted the level,
 * wiped the cards already placed and looked to the child like the page had reloaded. The selector is
 * scoped to the shelf, and this lives here rather than in main.ts so it can be tested.
 */
export function levelFromClick(target: Element | null): string | null {
  const button = target?.closest<HTMLElement>('.picker [data-level]');
  return button?.dataset.level ?? null;
}

/**
 * The first level the shelf would offer. Start uses it when the remembered level cannot be played —
 * a level can be remembered from before its screen existed, or from a newer build's level list.
 */
export function firstPlayable(levels: readonly Level[], progress: Progress): Level | null {
  return levels.find((level) => shelve([level], progress)[0]?.available) ?? null;
}

/**
 * The bank a tier door opens: every playable level in that tier, plus every playable level below it as
 * revision. The engine draws from this; it is built here because "which levels are playable" is the
 * shelf's question, not the engine's.
 */
export function bankForTier(
  levels: readonly Level[],
  progress: Progress,
  tier: number,
): TierBank | null {
  const playable = (inTier: (l: Level) => boolean): Level[] =>
    levels
      .filter((l) => inTier(l) && shelve([l], progress)[0]?.available === true)
      .map((l) => l);

  const own = playable((l) => l.tier === tier);
  if (own.length === 0) return null;
  const review = playable((l) => l.tier < tier);
  return { tier, levels: own, review };
}

/** The grown-up's page: what this is, what each tier teaches, how a round works, and where the name goes. */
export function renderInstructions(): HTMLElement {
  // The dimming layer is the element that covers the screen; the card sits inside it. Putting the
  // fixed backdrop on the card itself made the transform create a containing block, so the dim
  // covered only the card and the page stayed clickable behind a modal dialog.
  const panel = el('div', 'instructions-panel');
  panel.dataset.panel = 'instructions';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'instructions-title');

  const card = el('div', 'instructions-card');
  panel.append(card);

  const title = el('h2', undefined, 'For the grown-up');
  title.id = 'instructions-title';
  card.append(title);

  card.append(
    el(
      'p',
      undefined,
      'A clock-reading game for a child of about four: one clock face, big hands, and a handful of ' +
        'questions at a time. It starts with time words before any clock, and works up to quarter to.',
    ),
  );

  const list = el('ul', 'tier-list');
  for (const [tier, name] of TIERS) {
    const item = el('li');
    item.append(el('strong', undefined, name));
    item.append(el('span', undefined, ` — ${TIER_BLURB[tier] ?? ''}`));
    list.append(item);
  }
  card.append(el('p', undefined, 'The levels, in order:'));
  card.append(list);

  card.append(
    el(
      'p',
      undefined,
      'A round ends at ten right answers, and about one in four of the questions comes from an earlier ' +
        'level, so what was learnt last week keeps coming back. A child who misses a question sees it ' +
        'again a little later in the same round.',
    ),
  );

  card.append(
    el(
      'p',
      undefined,
      'The name on the shelf is kept on this device only. Nothing is sent anywhere, there is no account ' +
        'and no advertising.',
    ),
  );

  const close = el('button', 'action-btn primary', 'Close');
  close.dataset.action = 'close-instructions';
  card.append(close);

  return panel;
}

export function renderPicker(shelved: readonly Shelved[], progress: Progress): HTMLElement {
  const container = el('div', 'container picker');

  container.append(el('h1', undefined, 'What time is it?'));

  // One line of grown-up controls at the top: the instructions, and the language the questions are
  // read aloud in. Both are settings, so they sit together and look the same size.
  const topRow = el('div', 'header-actions');
  const help = el('button', 'action-btn small', 'Instructions');
  help.dataset.action = 'instructions';

  const toggle = el('div', 'operator-toggle');
  for (const [code, label] of [['en', 'EN'], ['yue', '粵']] as const) {
    const button = el('button', 'action-btn small', label);
    button.dataset.locale = code;
    const chosen = progress.locale === code;
    if (chosen) button.classList.add('operator-active');
    button.setAttribute('aria-pressed', String(chosen));
    toggle.append(button);
  }

  topRow.append(help, toggle);
  container.append(topRow);

  const nameRow = el('div', 'name-row');
  const label = el('label', undefined, 'Who is playing?');
  label.setAttribute('for', 'child-name');
  const input = el('input', 'name-input');
  input.id = 'child-name';
  input.name = 'name';
  input.type = 'text';
  input.maxLength = NAME_MAX;
  input.value = progress.name;
  input.autocomplete = 'off';
  nameRow.append(label, input);
  container.append(nameRow);

  for (const [tier, title] of TIERS) {
    const levels = shelved.filter((s) => s.level.tier === tier);
    const playable = levels.filter((s) => s.available);
    const first = playable[0];
    // A tier with no playable level is not a door. Tier 1 is the current example: it has levels,
    // but none of them can be asked yet.
    if (!first) continue;

    const section = el('section', 'tier');
    section.dataset.tier = String(tier);

    // The tier is one control: its name is the button. A heading above a second button reading the
    // same words is a table of contents, not a shelf.
    const grid = el('div', 'level-grid');
    const button = el('button', 'level-btn tier-entry');
    button.dataset.level = first.level.id;
    button.dataset.tierEntry = 'true';
    if (first.cleared) button.dataset.cleared = 'true';

    // The exercises stay the author's unit of work; the adult can still see them without the child
    // having to read a curriculum.
    const exercises = levels.map((s) => s.level.title.en).join(', ');
    button.title = exercises;
    button.setAttribute('aria-description', exercises);
    // Long press reads this on a touch screen; a title attribute never opens on an iPad.
    button.dataset.exercises = exercises;

    button.append(el('span', 'level-name', title));
    const note = first.cleared ? '✓' : playable.length === 1 ? '1 exercise' : `${playable.length} exercises`;
    button.append(el('span', 'level-note', note));
    grid.append(button);

    section.append(grid);
    container.append(section);
  }

  const actions = el('div', 'header-actions');
  const start = el('button', 'action-btn primary start-primary', 'Start');
  start.dataset.action = 'start';
  actions.append(start);
  container.append(actions);

  const foot = el('footer');
  foot.append(el('p', undefined, '© 2026 David Ip. Created for George and Teddy Ip.'));
  container.append(foot);

  return container;
}
