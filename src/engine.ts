/**
 * Round state machine — the play screen's brain, with no DOM in sight.
 *
 * THE ROUND IS A GOAL, NOT A LENGTH. It ends when the child has ten right answers, or when the
 * adult calls it. Misses are not failures and are not counted against anything: a four-year-old who
 * has never seen a clock will miss most of the first round, and that is the right way to start
 * learning rather than a problem to bound. This replaced a fixed queue of questions, which made a
 * struggling child "fail" a level they were still learning.
 *
 * Consequences, all deliberate:
 *   - the queue keeps producing questions until the goal is met
 *   - there is no maximum number of attempts on an item: needing four goes at a dial is normal
 *   - the track always fills, however long it takes, because it counts right answers
 *   - the adult can end the round whenever they judge it is time, and the summary never says the
 *     child failed
 */

import { clockTimes } from './levels';

import type { Level, Task } from './types';

export interface ClockTime {
  hour: number;
  minute: number;
}

/** One thing the child is shown. What `time` means depends on the task. */
export interface Item {
  task: Task;
  /** Present for read/set/choose on a clock level. */
  time?: ClockTime;
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
  /** Questions built so far; grows as the round needs more. */
  queue: Item[];
  /** How many items have been answered. */
  answered: number;
  results: Verdict[];
  streak: number;
  bestStreak: number;
  /** How many right answers end the round. */
  goal: number;
  /** Right answers so far, however many attempts each took. */
  correct: number;
  /** The adult ended the round before the goal. */
  ended: boolean;
  /** Draws one more question from the same level. */
  makeItem: () => Item;
}

export type Rng = () => number;

/**
 * The task kinds the app can actually present today.
 *
 * `set`, `tap`, `choose`, `order` and `build` all need a screen that does not exist yet. Asking a
 * four-year-old a question he cannot answer is worse than asking fewer, so those steps are dropped
 * until their screens land — and the level data keeps them, so nothing is retyped when they do.
 */
export const SUPPORTED_TASKS: ReadonlySet<Task> = new Set<Task>(['read']);

/** Right answers needed to finish a round. */
export const GOAL_CORRECT = 10;

/** How many items must sit between a miss and its return. */
export const REQUEUE_GAP = 3;

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

/**
 * Build the questions for one round.
 *
 * Round steps are honoured in order (reading before setting), and clock times are drawn without
 * repeating within two positions — a child who sees 3:00, 3:15, 3:00 learns to echo rather than read.
 */
export function buildQueue(level: Level, rng: Rng = Math.random): Item[] {
  const times = clockTimes(level);
  const queue: Item[] = [];

  const recent: ClockTime[] = [];
  const same = (a: ClockTime | undefined, b: ClockTime | undefined): boolean =>
    a !== undefined && b !== undefined && a.hour === b.hour && a.minute === b.minute;

  const nextTime = (): ClockTime | undefined => {
    const notRecent = times.filter((t) => !recent.some((r) => same(t, r)));
    const notPrevious = times.filter((t) => !same(t, recent[recent.length - 1]));
    // a level with fewer times than the window cannot honour it, so fall back rather than loop
    const pool = notRecent.length > 0 ? notRecent : notPrevious.length > 0 ? notPrevious : times;

    const chosen = pick(rng, pool);
    recent.push(chosen);
    if (recent.length > 2) recent.shift();
    return chosen;
  };

  level.round.forEach((step, stepIndex) => {
    if (!SUPPORTED_TASKS.has(step.task)) return; // no screen for it yet
    for (let i = 0; i < step.items; i += 1) {
      const time =
        step.task === 'read' || step.task === 'set' || step.task === 'choose' ? nextTime() : undefined;
      const key = time
        ? `${step.task}:${time.hour}:${time.minute}:${stepIndex}.${i}`
        : `${step.task}:${stepIndex}.${i}`;
      const item: Item = { task: step.task, key };
      if (time) item.time = time;
      queue.push(item);
    }
  });

  return queue;
}

/** Keep at least one question ahead of the child, until the goal is met. */
function ensureNext(session: Session): void {
  if (session.correct >= session.goal) return;
  while (session.queue.length <= session.answered) session.queue.push(session.makeItem());
}

export function createSession(level: Level, rng: Rng = Math.random): Session {
  const queue = buildQueue(level, rng);

  let extras = 0;
  const makeItem = (): Item => {
    // The planned questions have run out but the child is still going: ask the same level again.
    // A level with no answerable questions cannot get here — the shelf will not offer it — but a
    // placeholder beats a crash if it ever does.
    // A level with no answerable questions never reaches here: the shelf does not offer it and
    // createSession leaves its queue empty, so there is no round to extend.
    const drawn = buildQueue(level, rng)[0]!;
    extras += 1;
    return { ...drawn, key: `${drawn.key}~more${extras}`, extra: true };
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
    ended: false,
    makeItem,
  };

  // nothing to ask: leave the queue empty rather than inventing questions for a level with no screen
  if (queue.length > 0) ensureNext(session);
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

/** The round is over: the goal was reached, or the adult called it. */
export function isFinished(session: Session): boolean {
  return session.ended || trackComplete(session);
}

/** Right answers given on the first showing of each item — the honest "how did it go" figure. */
export function firstPassCorrect(session: Session): number {
  return session.results.filter((r) => r.correct && r.item.retry !== true).length;
}

/**
 * Record a verdict and return the next session.
 *
 * A wrong answer re-enters the queue a few places later, so the child meets the same dial again
 * rather than being moved past it. There is no cap on attempts: needing another go is the normal
 * case at four, and the round ends on ten right answers rather than by running out of questions.
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
    const at = answered + REQUEUE_GAP;

    // extend with more of the same level so the missed dial does not come straight back
    const padded = [...queue];
    while (padded.length < at) padded.push(session.makeItem());

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

  ensureNext(next);
  return next;
}

/** The adult decides the round is over — a level beyond the child, or a tired evening. */
export function endSession(session: Session): Session {
  return { ...session, ended: true };
}

export interface Summary {
  correct: number;
  goal: number;
  firstPass: number;
  reachedGoal: boolean;
  endedEarly: boolean;
  bestStreak: number;
}

export function summarise(session: Session): Summary {
  return {
    correct: session.correct,
    goal: session.goal,
    firstPass: firstPassCorrect(session),
    reachedGoal: trackComplete(session),
    endedEarly: session.ended && !trackComplete(session),
    bestStreak: session.bestStreak,
  };
}