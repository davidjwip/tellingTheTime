/**
 * The play screen — the reference app's DOM skeleton with the clock where the equation was.
 *
 * Every region keeps the maths app's class name so the two look like the same object
 * (specs/design-parity.md §4). Functions return elements rather than taking a framework, so a test
 * can ask the DOM what is on screen, and so a test can serialise it to a file for a human to look at
 * (test/artefacts.ts).
 */

import { renderChoose } from './choose';
import { renderFace } from './clockFace';
import { el, feedbackArea } from './dom';
import { currentItem, trackProgress } from './engine';
import { renderOrder } from './order';

import type { Session, Item } from './engine';
import type { Level, Task } from './types';

export interface PlayOptions {
  mascot?: string;
  locale?: 'en' | 'yue';
  /** Where "Change level" goes. Injected so the action can be tested without navigating. */
  onChangeLevel?: (level: Level) => void;
  /** What the adult just said, so the feedback line can show it. */
  lastVerdict?: 'correct' | 'wrong';
  /** The cards already tapped into an order row, in tap order. */
  placed?: string[];
  /** Told once, when the round ends, so a clear can be remembered. */
  onRoundEnd?: (cleared: boolean) => void;
}

/** What the adult says out loud, in the child's language. Audio lands with the phrase files. */
export function promptFor(item: Item, task: Task): string {
  if (task === 'read') return 'What time is it?';
  if (task === 'set') return 'Make this time';
  if (task === 'choose') return 'Which one?';
  if (task === 'tap') return 'Tap them in order';
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
  const english = (options.locale ?? 'en') === 'en';
  const cantonese = options.locale === 'yue';
  en.classList.toggle('operator-active', english);
  yue.classList.toggle('operator-active', cantonese);
  // A segmented setting has to announce which half is chosen, not just look tinted.
  en.setAttribute('aria-pressed', String(english));
  yue.setAttribute('aria-pressed', String(cantonese));
  toggle.append(en, yue);
  actions.append(toggle);

  // Sound and profile have no screen yet. They are disabled rather than inert: a button that looks
  // pressable and does nothing teaches a child that the app is unresponsive (and is a lie to the adult).
  const sound = el('button', 'action-btn small mute-btn', '🔊');
  sound.dataset.action = 'sound';
  sound.disabled = true;
  sound.title = 'Sound arrives with the recordings';
  actions.append(sound);

  const profile = el('button', 'action-btn small', '👤');
  profile.dataset.action = 'profile';
  profile.disabled = true;
  profile.title = 'Names and badges arrive with the picker';
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
  // The track is the goal, not the number of questions: ten steps, two rows of five, filling as he
  // gets them right however many tries it takes.
  for (let rowStart = 1; rowStart <= session.goal; rowStart += 5) {
    const row = el('div', 'goal-steps');
    for (let step = rowStart; step < rowStart + 5 && step <= session.goal; step += 1) {
      const cell = el('div', 'step', String(step));
      if (step <= filled) cell.classList.add('filled');
      row.append(cell);
    }
    wrapper.append(row);
  }
  track.append(wrapper);
  track.append(el('div', 'goal-end', '🎉'));
  area.append(track);

  // The reference shows "Problems Solved: X / Total". Here there is no failure count anywhere
  // (specs/design-parity.md §4.5): the track shows what he has got right, and nothing counts what
  // he has not.
  area.append(
    el('p', undefined, `Right: ${session.correct} of ${session.goal} · Best streak: ${session.bestStreak}`),
  );
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
  // A choice and an order are both checkable, so the app marks them. There is no pad on either
  // screen on purpose: a ✓/✗ pair would ask the adult to re-mark something the app already knows.
  const choosing = item?.answer !== undefined;
  const ordering = item?.order !== undefined;
  const tapping = item?.tap !== undefined;

  if (tapping && item) {
    panel.append(el('div', 'prompt', promptFor(item, item.task)));
    const frame = el('div', 'clock-frame tap-frame');
    if (level.face) frame.append(renderFace(item.time ?? { hour: 12, minute: 0 }, level.face));
    panel.append(frame);
    panel.append(
      el('p', 'tap-hint', `Tap ${item.tap?.sequence[0]} to ${item.tap?.sequence[item.tap.sequence.length - 1]}, one at a time`),
    );
  } else if (ordering && item) {
    panel.append(renderOrder(item, options.placed ?? [], options.lastVerdict));
  } else if (choosing && item) {
    panel.append(renderChoose(item, options.lastVerdict));
  } else {
    panel.append(el('div', 'prompt', item ? promptFor(item, item.task) : 'Done'));

    const frame = el('div', 'clock-frame');
    if (level.face) {
      // The dial belongs to the level, never to the task: a level with a face shows one even when its
      // item carries no time of its own, or the ladder renders empty boxes.
      //
      // There is no set-task branch here any more. With set steps filtered out of every round there is
      // no way to reach one, and untested code that cannot run is the thing this project keeps
      // finding. Drawing a set task properly needs hand-dragging, and that branch returns with it.
      const face = renderFace(item?.time ?? { hour: 12, minute: 0 }, level.face);
      face.setAttribute('class', 'clock-face');
      frame.append(face);
    }
    panel.append(frame);

    // AC-42: the last verdict stays on screen until the next one, for the adult as much as the child
    panel.append(feedbackArea(options.lastVerdict));
  }
  main.append(panel);

  if (!choosing && !ordering) {
    const padContainer = el('div', 'pad-container');
    // Every task is marked by the adult who watched (B6). A "Done" button that recorded "correct"
    // was marking the child's effort as success without anyone looking — and on a set task it was
    // confirming an answer the dial had just displayed.
    const pad = el('div', 'pad');
    const yes = el('button', 'touchpad-btn pad-btn pad-yes', '✓ Got it');
    yes.dataset.verdict = 'correct';
    const no = el('button', 'touchpad-btn pad-btn pad-no', '✗ Not yet');
    no.dataset.verdict = 'wrong';
    pad.append(yes, no);
    padContainer.append(pad);
    main.append(padContainer);
  }
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

  // An early finish is not a failure, so it does not get a consolation heading
  container.append(el('h1', undefined, cleared ? 'Level cleared!' : 'Nice work today!'));
  // No score, no percentage, and no word for "failed" (specs/design-parity.md §4.5).
  container.append(
    el(
      'p',
      'instructions',
      `${session.correct} of ${session.goal} right · best streak ${session.bestStreak}`,
    ),
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
  content.append(el('p', undefined, `You got ${session.goal} right!`));
  content.append(el('div', undefined, '🎊🎈⏰'));

  const close = el('button', 'celebration-close-btn', 'Keep Playing!');
  close.dataset.action = 'close-celebration';
  content.append(close);

  overlay.append(content);
  return overlay;
}