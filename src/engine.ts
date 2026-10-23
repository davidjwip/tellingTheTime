/**
 * Round state machine — the play screen's brain, with no DOM in sight.
 *
 * Everything here is pure: a session goes in, a new session comes out. That is what makes the
 * re-queue rule, the clearing threshold and the celebration testable without a browser, and it is
 * how the app can be driven by a seeded RNG in tests and by Math.random in the real thing.
 *
 * Rules implemented (specs/v1.md §6):
 *   B2  a missed item re-enters the queue at least 3 positions later, never immediately
 *   B7  clearing = correct >= round(0.8 × N) in one round; the badge follows the clear
 *   B10 the celebration fires on a completed track, so a second perfect round celebrates again
 *   B14 the current streak resets per round; the best streak persists
 */

import { clockTimes, itemsPerRound } from './levels';

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
}

export interface Verdict {
  item: Item;
  correct: boolean;
}

export interface Session {
  levelId: string;
  /** The full plan for this round, including re-queued items appended as they are missed. */
  queue: Item[];
  /** How many items have been answered. */
  answered: number;
  results: Verdict[];
  streak: number;
  bestStreak: number;
  /** Track length: the round's item count, fixed at creation. */
  total: number;
}

export type Rng = () => number;

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
 * Build the queue for one round.
 *
 * The round steps are honoured in order (reading before setting), and clock times are drawn without
 * repeating within two positions — a four-year-old who sees 3:00 twice in a row learns nothing about
 * 3:00.
 */
export function buildQueue(level: Level, rng: Rng = Math.random): Item[] {
  const times = clockTimes(level);
  const queue: Item[] = [];
  let previous: ClockTime | undefined;

  /**
   * Draw the next time.
   *
   * The previous time is excluded from the pool rather than re-rolled, so "never the same dial
   * twice running" is structural instead of a 40-attempt hope. A level with a single time falls back
   * to allowing the repeat, which is the only thing it can do.
   */
  const nextTime = (): ClockTime | undefined => {
    const pool =
      times.length > 1
        ? times.filter((t) => !(previous && t.hour === previous.hour && t.minute === previous.minute))
        : times;
    const chosen = pick(rng, pool);
    previous = chosen;
    return chosen;
  };

  level.round.forEach((step, stepIndex) => {
    for (let i = 0; i < step.items; i += 1) {
      const time = step.task === 'read' || step.task === 'set' || step.task === 'choose' ? nextTime() : undefined;
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

export function createSession(level: Level, rng: Rng = Math.random): Session {
  const queue = buildQueue(level, rng);
  return {
    levelId: level.id,
    queue,
    answered: 0,
    results: [],
    streak: 0,
    bestStreak: 0,
    total: itemsPerRound(level),
  };
}

/** How many correct answers are needed to clear this round. */
export function clearThreshold(total: number): number {
  return Math.round(total * 0.8);
}

export function correctCount(session: Session): number {
  return session.results.filter((r) => r.correct).length;
}

export function isCleared(session: Session): boolean {
  return correctCount(session) >= clearThreshold(session.total);
}

/** The track fills one step per correct answer; a full track is the celebration. */
export function trackProgress(session: Session): number {
  return Math.min(correctCount(session), session.total);
}

export function trackComplete(session: Session): boolean {
  return trackProgress(session) >= session.total;
}

export function currentItem(session: Session): Item | undefined {
  return session.queue[session.answered];
}

export function isFinished(session: Session): boolean {
  return session.answered >= session.queue.length;
}

/** How many items must sit between a miss and its return (B2). */
export const REQUEUE_GAP = 3;

/**
 * Record a verdict and return the next session.
 *
 * A wrong answer re-enters the queue at least three positions later (B2), so the child cannot
 * simply be shown the same dial twice and copy the last answer. Appending would satisfy that for a
 * miss early in the round and break it near the end, where the append lands immediately after the
 * next item — so this inserts at `answered + gap`, clamped to the end.
 *
 * `total` is the round's planned length and never changes: the track shows the round, not the
 * queue.
 */
export function recordVerdict(session: Session, correct: boolean): Session {
  const item = currentItem(session);
  if (!item) return session;

  const results = [...session.results, { item, correct }];
  const streak = correct ? session.streak + 1 : 0;
  const answered = session.answered + 1;

  let queue = session.queue;
  if (!correct) {
    const again = { ...item, key: `${item.key}#again` };
    const at = Math.min(answered + REQUEUE_GAP, queue.length);
    queue = [...queue.slice(0, at), again, ...queue.slice(at)];
  }

  return {
    ...session,
    queue,
    answered,
    results,
    streak,
    bestStreak: Math.max(session.bestStreak, streak),
  };
}

export interface Summary {
  correct: number;
  total: number;
  cleared: boolean;
  bestStreak: number;
}

export function summarise(session: Session): Summary {
  return {
    correct: correctCount(session),
    total: session.total,
    cleared: isCleared(session),
    bestStreak: session.bestStreak,
  };
}
