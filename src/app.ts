/**
 * The play screen — the reference app's DOM skeleton with the clock where the equation was.
 *
 * Every region keeps the maths app's class name so the two look like the same object
 * (specs/design-parity.md §4). Functions return elements rather than taking a framework, so a test
 * can ask the DOM what is on screen, and so a test can serialise it to a file for a human to look at
 * (test/artefacts.ts).
 */

import { renderFace } from './clockFace';
import { correctCount, currentItem, trackProgress } from './engine';

import type { Session, Item } from './engine';
import type { Level, Task } from './types';

export interface PlayOptions {
  mascot?: string;
  locale?: 'en' | 'yue';
  /** Where "Change level" goes. Injected so the action can be tested without navigating. */
  onChangeLevel?: (level: Level) => void;
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

/** What the adult says out loud, in the child's language. Audio lands with the phrase files. */
export function promptFor(item: Item, task: Task): string {
  if (task === 'read') return 'What time is it?';
  if (task === 'set') return 'Make this time';
  if (task === 'choose') return 'Which one?';
  return 'Have a go';
}

function header(level: Level, options: PlayOptions): HTMLElement {
  const head = el('header');

  const title = el('h1', undefined, 'What time is it?');
  head.append(title);
  head.append(el('p', 'instructions', `${level.id} · ${level.title.en}`));

  const actions = el('div', 'header-actions');

  const levelButton = el('button', 'action-btn small', '🔢 Level');
  levelButton.dataset.action = 'level';
  actions.append(levelButton);

  const toggle = el('div', 'operator-toggle');
  const en = el('button', 'action-btn small', 'EN');
  const yue = el('button', 'action-btn small', '粵');
  en.dataset.locale = 'en';
  yue.dataset.locale = 'yue';
  en.classList.toggle('operator-active', (options.locale ?? 'en') === 'en');
  yue.classList.toggle('operator-active', options.locale === 'yue');
  toggle.append(en, yue);
  actions.append(toggle);

  const sound = el('button', 'action-btn small mute-btn', '🔊');
  sound.dataset.action = 'sound';
  actions.append(sound);

  const profile = el('button', 'action-btn small', '👤');
  profile.dataset.action = 'profile';
  actions.append(profile);

  head.append(actions);
  return head;
}

function goalTrack(session: Session, mascot: string): HTMLElement {
  const area = el('div', 'progress-area');
  area.append(el('h2', undefined, 'Path to the Party! 🎉'));

  const track = el('div', 'goal-track');
  if (session.streak > 0) track.append(el('div', 'mascot', mascot));

  const wrapper = el('div', 'goal-steps-wrapper');
  const filled = trackProgress(session);
  // N steps in rows of five: a 10-item round reproduces the reference exactly (two rows of 5).
  for (let rowStart = 1; rowStart <= session.total; rowStart += 5) {
    const row = el('div', 'goal-steps');
    for (let step = rowStart; step < rowStart + 5 && step <= session.total; step += 1) {
      const cell = el('div', 'step', String(step));
      if (step <= filled) cell.classList.add('filled');
      row.append(cell);
    }
    wrapper.append(row);
  }
  track.append(wrapper);
  track.append(el('div', 'goal-end', '🎉'));
  area.append(track);

  // The reference shows "Problems Solved: X / Total". Here there is no denominator to read as a
  // score, and no failure count (specs/design-parity.md §4.5).
  area.append(el('p', undefined, `Times read: ${correctCount(session)} · Best streak: ${session.bestStreak}`));
  return area;
}

/** The whole play screen for one moment in a session. */
export function renderPlay(level: Level, session: Session, options: PlayOptions = {}): HTMLElement {
  const container = el('div', 'container');
  container.dataset.level = level.id;

  container.append(header(level, options));

  const main = el('main');
  const panel = el('div', 'problem-area');

  const item = currentItem(session);
  panel.append(el('div', 'prompt', item ? promptFor(item, item.task) : 'Done'));

  const frame = el('div', 'clock-frame');
  if (level.face) {
    // A tap level shows the dial but carries no time of its own: the child is counting round it.
    // The face depends on the level, never on the task, or half the ladder renders an empty box.
    const face = renderFace(item?.time ?? { hour: 12, minute: 0 }, level.face);
    face.setAttribute('class', 'clock-face');
    frame.append(face);
  }
  panel.append(frame);

  const feedbackArea = el('div', 'feedback-area');
  const feedback = el('div');
  feedback.id = 'feedback';
  feedbackArea.append(feedback);
  panel.append(feedbackArea);
  main.append(panel);

  const padContainer = el('div', 'pad-container');
  const pad = el('div', 'pad');
  if (item?.task === 'read') {
    const yes = el('button', 'touchpad-btn pad-btn pad-yes', '✓ Got it');
    yes.dataset.verdict = 'correct';
    const no = el('button', 'touchpad-btn pad-btn pad-no', '✗ Not yet');
    no.dataset.verdict = 'wrong';
    pad.append(yes, no);
  } else {
    const done = el('button', 'touchpad-btn pad-btn', 'Done');
    done.dataset.verdict = 'done';
    pad.append(done);
  }
  padContainer.append(pad);
  main.append(padContainer);
  container.append(main);

  if (session.streak > 0) {
    const streak = el('div', 'streak-area');
    streak.append(el('span', 'streak-fire', '🔥'));
    streak.append(el('span', 'streak-count', `${session.streak} in a row`));
    if (session.bestStreak > 1) streak.append(el('span', 'streak-best', `Best: ${session.bestStreak}`));
    container.append(streak);
  }

  container.append(goalTrack(session, options.mascot ?? '🦊'));

  const foot = el('footer');
  foot.append(el('p', undefined, '© 2026 David Ip. Created for George and Teddy Ip.'));
  container.append(foot);

  return container;
}

/** End of round: what happened, and the two ways out. No percentage, no grade. */
export function renderSummary(session: Session, cleared: boolean): HTMLElement {
  const container = el('div', 'container summary');
  container.dataset.level = session.levelId;

  container.append(el('h1', undefined, cleared ? 'Level cleared!' : 'Good try!'));
  container.append(
    el('p', 'instructions', `${correctCount(session)} of ${session.total} · best streak ${session.bestStreak}`),
  );

  const actions = el('div', 'header-actions');
  const again = el('button', 'action-btn', 'Again');
  again.dataset.action = 'again';
  const change = el('button', 'action-btn', 'Change level');
  change.dataset.action = 'change-level';
  actions.append(again, change);
  container.append(actions);

  return container;
}

/** The celebration overlay: the reference's, with the copy changed and N interpolated. */
export function renderCelebration(session: Session): HTMLElement {
  const overlay = el('div', 'celebration-overlay');
  overlay.dataset.celebration = 'true';

  const content = el('div', 'celebration-content');
  content.append(el('div', 'celebration-title', '🎉 Amazing Job! 🎉'));
  content.append(el('p', undefined, `You read all ${session.total} times!`));
  content.append(el('div', undefined, '🎊🎈⏰'));

  const close = el('button', 'celebration-close-btn', 'Keep Playing!');
  close.dataset.action = 'close-celebration';
  content.append(close);

  overlay.append(content);
  return overlay;
}
