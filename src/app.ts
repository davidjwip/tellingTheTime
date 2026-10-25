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

import type { Locale } from './audio';

export interface PlayOptions {
  mascot?: string;
  locale?: Locale;
  /** Values the child has already tapped in the current lap, so a redraw keeps them marked. */
  done?: readonly number[];
  /** The value the child should touch next, so the dial can hint at it. */
  next?: number;
  /** True when the item has a spoken question, so the repeat button is honest. */
  canSay?: boolean;
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
  for (const [code, label] of [['en', 'EN'], ['yue', '粵'], ['zh', '中']] as const) {
    const button = el('button', 'action-btn small', label);
    button.dataset.locale = code;
    const chosen = (options.locale ?? 'en') === code;
    if (chosen) button.classList.add('operator-active');
    // A segmented setting has to announce which part is chosen, not just look tinted.
    button.setAttribute('aria-pressed', String(chosen));
    toggle.append(button);
  }

  // Repeating the question is only possible where there is a question. On a tap, choose or order
  // screen there is nothing to say, and a button that is present but inert is a lie - the same rule
  // this file states two lines below about the placeholder controls.
  if (options.canSay) {
    const sayButton = el('button', 'action-btn small', '🔊 Say the time');
    sayButton.dataset.action = 'say';
    sayButton.setAttribute('aria-label', 'Say the time on the clock');
    actions.append(toggle, sayButton);
  } else {
    actions.append(toggle);
  }

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
/**
 * Radius of an invisible tap target, in the face's 100-unit viewBox.
 *
 * Set by the neighbours, not by taste: hour numerals sit 18.6 units apart on a ring of radius 36 and
 * the 5-minute labels 22.3 apart at radius 43, so 9 is the largest disc whose centre still belongs to
 * its own number. Dave's fingers missed at 7 on a phone; at 7 the target was 36px on a 375px screen.
 */
export const TAP_DISC_RADIUS = 9;

export function renderPlay(level: Level, session: Session, options: PlayOptions = {}): HTMLElement {
  const container = el('div', 'container');
  container.dataset.level = level.id;


  const main = el('main');
  const panel = el('div', 'problem-area');

  const item = currentItem(session);
  container.append(header(level, { ...options, canSay: item?.task === 'read' }));
  // A choice and an order are both checkable, so the app marks them. There is no pad on either
  // screen on purpose: a ✓/✗ pair would ask the adult to re-mark something the app already knows.
  const choosing = item?.answer !== undefined;
  const ordering = item?.order !== undefined;
  const tapping = item?.tap !== undefined;
  const setting = item?.task === 'set';

  if (setting && item && level.face) {
    panel.append(el('div', 'prompt', promptFor(item, item.task)));
    const frame = el('div', 'clock-frame set-frame');
    // Both hands start at twelve: the child has to move them, so nothing is right by accident.
    frame.append(renderFace({ hour: 12, minute: 0 }, level.face));

    // A hand is a 4px line; a finger needs a stroke it can catch anywhere along its length.
    for (const hand of Array.from(frame.querySelectorAll<SVGLineElement>('[data-hand]'))) {
      const grab = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      for (const attribute of ['x1', 'y1', 'x2', 'y2', 'transform']) {
        const value = hand.getAttribute(attribute);
        if (value !== null) grab.setAttribute(attribute, value);
      }
      grab.setAttribute('stroke', 'transparent');
      grab.setAttribute('stroke-width', '16');
      grab.setAttribute('stroke-linecap', 'round');
      grab.setAttribute('data-grab', hand.getAttribute('data-hand') ?? '');
      grab.setAttribute('data-angle', hand.getAttribute('transform')?.match(/rotate\(([-\d.]+)/)?.[1] ?? '0');
      frame.append(grab);
    }
    panel.append(frame);

    const done = el('button', 'action-btn primary', 'Done') as HTMLButtonElement;
    done.dataset.action = 'done';
    done.dataset.ready = 'false';
    // disabled until a hand has moved: an enabled control that does nothing is the pattern this
    // project has removed twice, and here it would also record a free verdict at 12:00
    done.disabled = true;
    panel.append(done);
  } else if (tapping && item) {
    panel.append(el('div', 'prompt', promptFor(item, item.task)));
    const frame = el('div', 'clock-frame tap-frame');
    if (level.face) frame.append(renderFace(item.time ?? { hour: 12, minute: 0 }, level.face));
    // Only the ring the lap is asking about. Marking both turned the hour numerals 5 and 10 green
    // during a fives lap, which is a mark the child never earned on a ring he is not being asked about.
    const lapRing = item.tap?.target === 'numerals' ? '[data-numeral]' : '[data-minute-label="true"]';
    for (const node of frame.querySelectorAll<HTMLElement>(lapRing)) {
      const value = Number(node.dataset.value ?? node.dataset.numeral ?? node.textContent?.trim());
      if ((options.done ?? []).includes(value)) node.dataset.done = 'true';
    }

    // A numeral is about 27px on an iPad and a minute label about 11px: neither is a finger target.
    // These transparent discs are the real controls, sized for a thumb, over the glyphs.
    const svg = frame.querySelector('svg');
    if (svg && item.tap) {
      const ring = item.tap.target === 'numerals' ? '[data-numeral]' : '[data-minute-label="true"]';
      for (const glyph of frame.querySelectorAll<SVGElement>(ring)) {
        const value = Number(glyph.dataset.value ?? glyph.textContent?.trim());
        const disc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        disc.setAttribute('cx', glyph.getAttribute('x') ?? '0');
        disc.setAttribute('cy', glyph.getAttribute('y') ?? '0');
        // The largest disc that still owns its own glyph: neighbours on the numeral ring are
        // 2*36*sin(15 degrees) = 18.6 units apart, so 9 leaves a sliver between them and no
        // overlaps at the centres. On a 375px phone that is a 47px target, not the 36px it was.
        disc.setAttribute('r', String(TAP_DISC_RADIUS));
        disc.setAttribute('class', 'tap-disc');
        disc.setAttribute('data-hit', String(value));
        disc.setAttribute('data-ring', item.tap.target);
        if (value === options.next) disc.setAttribute('data-next', 'true');
        if ((options.done ?? []).includes(value)) disc.setAttribute('data-done', 'true');
        svg.append(disc);
      }
    }
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
      // A wrong answer on a tier 5 clock brings the ring back for that question only: the scaffold
      // fades in when it is needed rather than being present or absent for the whole level.
      const peek =
        level.tier === 5 && !level.face?.minuteLabels && options.lastVerdict === 'wrong';
      const faceConfig = peek ? { ...level.face!, minuteLabels: true } : level.face!;
      const face = renderFace(item?.time ?? { hour: 12, minute: 0 }, faceConfig);
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