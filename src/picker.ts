/**
 * The level shelf.
 *
 * The level data asks for six kinds of question and the app can only present one of them so far
 * (`read`). Rather than hide that behind a half-working screen, the shelf computes what is actually
 * playable from the data: a level survives if at least MIN_ITEMS questions can be asked after the
 * ones with no UI are dropped, and the rest say what they are waiting for. That makes the shelf a
 * to-do list rather than a lie.
 */

import { SUPPORTED_TASKS } from './engine';

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
  order: 'needs dragging cards',
  build: 'needs building the face',
};

const TIERS: Array<[number, string]> = [
  [0, 'Before the clock'],
  [1, 'Numbers and the dial'],
  [2, "O'clock"],
  [3, 'Half past'],
  [4, 'Quarter past and to'],
];

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
      .filter((step) => SUPPORTED_TASKS.has(step.task))
      .reduce((sum, step) => sum + step.items, 0);

    const unbuilt = level.round.find((step) => !SUPPORTED_TASKS.has(step.task));
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

export function renderPicker(shelved: readonly Shelved[], progress: Progress): HTMLElement {
  const container = el('div', 'container picker');

  container.append(el('h1', undefined, 'What time is it?'));
  container.append(el('p', 'instructions', 'Choose a level'));

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
    if (levels.length === 0) continue;

    const section = el('section', 'tier');
    section.dataset.tier = String(tier);
    section.append(el('h2', undefined, title));

    const grid = el('div', 'level-grid');
    for (const s of levels) {
      const button = el('button', 'level-btn');
      button.dataset.level = s.level.id;
      if (s.cleared) button.dataset.cleared = 'true';
      button.disabled = !s.available;

      button.append(el('span', 'level-name', s.level.title.en));
      const note = s.cleared ? '✓' : s.available ? `${s.items} questions` : s.reason ?? '';
      button.append(el('span', 'level-note', note));
      grid.append(button);
    }

    section.append(grid);
    container.append(section);
  }

  const actions = el('div', 'header-actions');
  const start = el('button', 'action-btn', 'Start');
  start.dataset.action = 'start';
  actions.append(start);
  container.append(actions);

  const foot = el('footer');
  foot.append(el('p', undefined, '© 2026 David Ip. Created for George and Teddy Ip.'));
  container.append(foot);

  return container;
}

