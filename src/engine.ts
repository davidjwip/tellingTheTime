/**
 * Round state machine — the play screen's brain, with no DOM in sight.
 *
 * THE ROUND IS A GOAL, NOT A LENGTH. It ends when the child has ten right answers, or when the
 * adult ends it. Misses are not failures and are not counted against anything. This replaced a
 * fixed queue of questions, which made a struggling child "fail" a level they were still learning.
 *
 * Consequences, all deliberate:
 *   - questions keep coming until the goal is met
 *   - there is no maximum number of attempts on an item: needing four goes at a dial is normal
 *   - the track shows ten steps and fills with right answers, so it always fills
 *   - the adult can end the round at any point, and the summary never says the child failed
 */

import { chooseFor } from './choose';
import { clockTimes } from './levels';

import type { Card, Choice } from './choose';
import type { Content, Level, Task } from './types';

export interface ClockTime {
  hour: number;
  minute: number;
}

/** One thing the child is shown. What `time` means depends on the task. */
export interface Item {
  task: Task;
  /** Present for read/set on a clock level. */
  time?: ClockTime;
  /** The choices for a `choose` item, emoji and word included. */
  cards?: Card[];
  /** Id of the card that answers a `choose` item. Its presence is what makes a screen a choose one. */
  answer?: string;
  /** Position in the original round plan, so a re-queued item is recognisable. */
  key: string;
  /** True on the second and later showing of an item the child missed. */
  retry?: boolean;
  /** Drawn once the planned questions have run out and the child is still going. */
  extra?: boolean;
}

export interface Verdict {
  item: Item;
  correct: boolean;
}

export interface Session {
  levelId: string;
  queue: Item[];
  answered: number;
  results: Verdict[];
  streak: number;
  bestStreak: number;
  /** How many right answers end the round. */
  goal: number;
  /** Right answers so far, however many attempts each took. */
  correct: number;
  /** Draws one more question from the same level, sharing the no-repeat window. */
  makeItem: () => Item;
}

export type Rng = () => number;

/**
 * The task kinds the app can actually present today.
 *
 * `set`, `tap`, `order` and `build` still need a screen. Asking a four-year-old a question he cannot
 * answer is worse than asking fewer, so those steps are dropped until their screens land — and the
 * level data keeps them, so nothing is retyped when they do.
 *
 * `choose` is supported, but only for the content kinds with a card table. `canPresent` makes that
 * second check, so a clock-choice level does not appear playable with no cards to show.
 */
export const SUPPORTED_TASKS: ReadonlySet<Task> = new Set<Task>(['read', 'choose']);

/** Right answers needed to finish a round. */
export const GOAL_CORRECT = 10;

/** How many items must sit between a miss and its return. */
export const REQUEUE_GAP = 3;

/** How far back the no-repeat rule reaches. */
export const NO_REPEAT_WINDOW = 2;

/** Small deterministic PRNG so a test can ask for "the same round" twice. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: Rng, from: readonly T[]): T {
  const index = Math.floor(rng() * from.length) % from.length;
  return from[index] as T;
}

const sameTime = (a: ClockTime | undefined, b: ClockTime | undefined): boolean =>
  a !== undefined && b !== undefined && a.hour === b.hour && a.minute === b.minute;

/** Whether a level's data gives this task something it can actually put on screen. */
export function canPresent(level: Level, task: Task): boolean {
  if (!SUPPORTED_TASKS.has(task)) return false;
  if (task === 'choose') return chooseFor(level.content) !== undefined;
  return true;
}

/**
 * A time drawer that remembers what it has just produced.
 *
 * It has to be ONE drawer per session, not one per queue build. The review found why: extra
 * questions were drawn by calling buildQueue afresh, which started the no-repeat window from
 * nothing, so the rule protected the first six planned questions and nothing after them — a probe
 * of 200 rounds produced the same dial three times running.
 */
export interface Drawer {
  nextTime: () => ClockTime | undefined;
  nextChoice: (content: Content) => Choice | undefined;
}

export function makeDrawer(level: Level, rng: Rng): Drawer {
  const times = clockTimes(level);
  const recent: ClockTime[] = [];
  // The draw order is not the display order once a missed item is re-inserted, so the queue is
  // repaired as well. This only remembers what was last drawn, like the clock window above.
  let previousChoice: string | undefined;

  return {
    nextTime: () => {
      const notRecent = times.filter((t) => !recent.some((r) => sameTime(t, r)));
      const notPrevious = times.filter((t) => !sameTime(t, recent[recent.length - 1]));
      // a level with fewer times than the window cannot honour it, so fall back rather than loop
      const pool = notRecent.length > 0 ? notRecent : notPrevious.length > 0 ? notPrevious : times;

      const chosen = pick(rng, pool);
      recent.push(chosen);
      if (recent.length > NO_REPEAT_WINDOW) recent.shift();
      return chosen;
    },
    nextChoice: (content) => {
      const choice = chooseFor(content, previousChoice);
      if (choice) previousChoice = choice.answer;
      return choice;
    },
  };
}

function itemFor(
  step: Task,
  time: ClockTime | undefined,
  key: string,
  extra?: boolean,
  choice?: Choice,
): Item {
  const item: Item = { task: step, key };
  if (time) item.time = time;
  if (extra) item.extra = true;
  if (choice) {
    item.cards = choice.cards;
    item.answer = choice.answer;
  }
  return item;
}

/**
 * Build the planned questions for one round.
 *
 * Round steps are honoured in order (reading before setting). Pass a drawer to share the no-repeat
 * window with questions drawn later.
 */
export function buildQueue(level: Level, rng: Rng = Math.random, drawer?: Drawer): Item[] {
  const draw = drawer ?? makeDrawer(level, rng);
  const queue: Item[] = [];

  level.round.forEach((step, stepIndex) => {
    if (!canPresent(level, step.task)) return; // no screen for it yet
    for (let i = 0; i < step.items; i += 1) {
      if (step.task === 'choose') {
        const choice = draw.nextChoice(level.content);
        if (!choice) continue;
        const key = `${step.task}:${choice.answer}:${stepIndex}.${i}`;
        queue.push(itemFor(step.task, undefined, key, undefined, choice));
        continue;
      }

      const time = step.task === 'read' || step.task === 'set' ? draw.nextTime() : undefined;
      const key = time
        ? `${step.task}:${time.hour}:${time.minute}:${stepIndex}.${i}`
        : `${step.task}:${stepIndex}.${i}`;
      queue.push(itemFor(step.task, time, key));
    }
  });

  return queue;
}

/**
 * Enforce the no-repeat rule over the queue as it will actually be shown.
 *
 * The drawer protects the order times were DRAWN, which is not the order they appear once a missed
 * item is re-inserted: the insertion shifts everything after it and can create a clash between two
 * neighbours that were fine apart. Checking the queue itself is the only way to keep the promise.
 */
function choiceKey(item: Item | undefined): string | undefined {
  if (!item?.cards || item.answer === undefined) return undefined;
  const cards = item.cards.map((card) => card.id).sort().join(',');
  return `${item.answer}:${cards}`;
}

function sameQuestion(a: Item | undefined, b: Item | undefined): boolean {
  if (!a || !b) return false;
  if (sameTime(a.time, b.time)) return true;
  const key = choiceKey(a);
  return key !== undefined && key === choiceKey(b);
}

function repairNeighbours(queue: Item[], makeItem: () => Item): void {
  for (let i = 1; i < queue.length; i += 1) {
    let guard = 0;
    while (
      guard < 12 &&
      (sameQuestion(queue[i], queue[i - 1]) ||
        (i >= 2 && sameQuestion(queue[i], queue[i - 2])))
    ) {
      queue[i] = makeItem();
      guard += 1;
    }
  }
}

/** Keep at least one question ahead of the child, until the goal is met. */
function ensureNext(session: Session): void {
  if (session.correct >= session.goal) return;
  while (session.queue.length <= session.answered) session.queue.push(session.makeItem());
}

export function createSession(level: Level, rng: Rng = Math.random): Session {
  const drawer = makeDrawer(level, rng);
  const queue = buildQueue(level, rng, drawer);

  const step = level.round.find((s) => canPresent(level, s.task))?.task ?? 'read';
  let extras = 0;

  const makeItem = (): Item => {
    // One question, drawn through the SAME drawer, so the no-repeat window spans the whole round
    // rather than restarting each time the planned questions run out.
    extras += 1;
    if (step === 'choose') {
      const choice = drawer.nextChoice(level.content);
      if (choice) return itemFor(step, undefined, `${step}:extra:${extras}`, true, choice);
    }
    const time = step === 'read' || step === 'set' ? drawer.nextTime() : undefined;
    return itemFor(step, time, `${step}:extra:${extras}`, true);
  };

  const session: Session = {
    levelId: level.id,
    queue,
    answered: 0,
    results: [],
    streak: 0,
    bestStreak: 0,
    goal: GOAL_CORRECT,
    correct: 0,
    makeItem,
  };

  // nothing to ask: leave the queue empty rather than inventing questions for a level with no screen
  if (queue.length > 0) {
    repairNeighbours(session.queue, session.makeItem);
    ensureNext(session);
  }
  return session;
}

export function currentItem(session: Session): Item | undefined {
  return session.queue[session.answered];
}

export function trackProgress(session: Session): number {
  return Math.min(session.correct, session.goal);
}

export function trackComplete(session: Session): boolean {
  return session.correct >= session.goal;
}

/** Clearing a level is reaching the goal — the same thing the child sees on the track. */
export function isCleared(session: Session): boolean {
  return trackComplete(session);
}

/**
 * The round is over when the goal is reached.
 *
 * There is no "end early" control: the adult closes the page, which is what they would do with any
 * toy. A finish button nobody presses is a button that has to be explained.
 */
export function isFinished(session: Session): boolean {
  return trackComplete(session);
}

/** Right answers given on the first showing of each item. */
export function firstPassCorrect(session: Session): number {
  return session.results.filter((r) => r.correct && r.item.retry !== true).length;
}

/**
 * Record a verdict and return the next session.
 *
 * A wrong answer re-enters the queue a few places later, so the child meets the same dial again
 * rather than being moved past it. There is no cap on attempts, and the round ends on ten right
 * answers rather than by running out of questions.
 */
export function recordVerdict(session: Session, correct: boolean): Session {
  if (isFinished(session)) return session;
  const item = currentItem(session);
  if (!item) return session;

  const results = [...session.results, { item, correct }];
  const streak = correct ? session.streak + 1 : 0;
  const answered = session.answered + 1;
  const right = session.correct + (correct ? 1 : 0);

  let queue = session.queue;
  if (!correct) {
    const again = { ...item, key: `${item.key}#again`, retry: true };
    const padded = [...queue];
    let at = answered + REQUEUE_GAP;
    while (padded.length < at) padded.push(session.makeItem());

    while (padded.length <= at) padded.push(session.makeItem());

    queue = [...padded.slice(0, at), again, ...padded.slice(at)];
  }

  const next: Session = {
    ...session,
    queue,
    answered,
    results,
    streak,
    bestStreak: Math.max(session.bestStreak, streak),
    correct: right,
  };

  repairNeighbours(next.queue, next.makeItem);
  ensureNext(next);
  return next;
}

export interface Summary {
  correct: number;
  goal: number;
  firstPass: number;
  reachedGoal: boolean;
  bestStreak: number;
}

export function summarise(session: Session): Summary {
  return {
    correct: session.correct,
    goal: session.goal,
    firstPass: firstPassCorrect(session),
    reachedGoal: trackComplete(session),
    bestStreak: session.bestStreak,
  };
}