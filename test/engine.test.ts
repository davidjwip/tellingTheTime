import { describe, expect, it } from 'vitest';

import {
  buildQueue,
  createSession,
  currentItem,
  endSession,
  firstPassCorrect,
  GOAL_CORRECT,
  isCleared,
  isFinished,
  recordVerdict,
  REQUEUE_GAP,
  seededRng,
  summarise,
  trackComplete,
  trackProgress,
} from '../src/engine';
import { LEVELS } from '../src/levels';

import type { Session } from '../src/engine';
import type { Level } from '../src/types';

const level = (id: string): Level => {
  const found = LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`no level ${id}`);
  return found;
};

const answerRight = (session: Session, count: number): Session => {
  let next = session;
  for (let i = 0; i < count; i += 1) next = recordVerdict(next, true);
  return next;
};

describe('building questions', () => {
  it('is deterministic for a seed, so a failing round can be replayed', () => {
    expect(buildQueue(level('t2.2'), seededRng(7))).toEqual(buildQueue(level('t2.2'), seededRng(7)));
  });

  it('gives a different round for a different seed', () => {
    const a = buildQueue(level('t2.2'), seededRng(1)).map((i) => i.time);
    const b = buildQueue(level('t2.2'), seededRng(2)).map((i) => i.time);
    expect(a).not.toEqual(b);
  });

  it('asks only the questions the app can present: six reads, not the four sets', () => {
    const queue = buildQueue(level('t2.2'), seededRng(3));
    expect(queue.map((i) => i.task)).toEqual(['read', 'read', 'read', 'read', 'read', 'read']);
  });

  it('asks nothing on a level whose every question needs a screen that does not exist', () => {
    expect(buildQueue(level('t0.1'), seededRng(3))).toEqual([]);
  });

  it('never shows the same time within two positions (AC-09)', () => {
    const queue = buildQueue(level('t2.2'), seededRng(21));
    for (let i = 2; i < queue.length; i += 1) {
      expect(queue[i]?.time).not.toEqual(queue[i - 2]?.time);
    }
  });

  it('falls back to a repeat when a level has fewer times than the window', () => {
    const twoTimes: Level = {
      ...level('t2.1'),
      id: 'test-two',
      hours: [3, 6],
      minutes: [0],
      round: [{ task: 'read', items: 6 }],
    };
    const queue = buildQueue(twoTimes, seededRng(1));
    for (let i = 1; i < queue.length; i += 1) {
      expect(queue[i]?.time).not.toEqual(queue[i - 1]?.time);
    }
  });
});

describe('the round is a goal, not a length', () => {
  it('ends when ten right answers have been given', () => {
    const session = answerRight(createSession(level('t2.2'), seededRng(4)), GOAL_CORRECT);
    expect(isFinished(session)).toBe(true);
    expect(trackComplete(session)).toBe(true);
    expect(isCleared(session)).toBe(true);
  });

  it('does not end at nine', () => {
    const session = answerRight(createSession(level('t2.2'), seededRng(4)), GOAL_CORRECT - 1);
    expect(isFinished(session)).toBe(false);
    expect(trackComplete(session)).toBe(false);
  });

  it('keeps producing questions once the planned six have been used', () => {
    // six planned questions, but ten right answers are needed: four more are drawn as needed
    const session = answerRight(createSession(level('t2.2'), seededRng(4)), GOAL_CORRECT);
    expect(session.answered).toBe(GOAL_CORRECT);
    expect(session.queue.length).toBeGreaterThan(6);
    expect(session.queue.filter((i) => i.extra === true).length).toBeGreaterThan(0);
  });

  it('fills the track with right answers, and never past the goal', () => {
    const session = answerRight(createSession(level('t2.2'), seededRng(4)), 4);
    expect(trackProgress(session)).toBe(4);
    expect(trackProgress(answerRight(session, 12))).toBe(GOAL_CORRECT);
  });

  it('does not count a miss as progress', () => {
    const session = recordVerdict(createSession(level('t2.2'), seededRng(4)), false);
    expect(trackProgress(session)).toBe(0);
    expect(isFinished(session)).toBe(false);
  });
});

describe('misses are not failures', () => {
  it('keeps going however many misses there are, and still ends on ten right', () => {
    let session = createSession(level('t2.2'), seededRng(9));
    for (let i = 0; i < 40; i += 1) session = recordVerdict(session, false);
    expect(isFinished(session)).toBe(false); // still playing, not failed

    session = answerRight(session, GOAL_CORRECT);
    expect(isFinished(session)).toBe(true);
    expect(session.results.filter((r) => !r.correct)).toHaveLength(40);
  });

  it('brings a missed item back three places later, not next', () => {
    const session = createSession(level('t2.2'), seededRng(9));
    const missed = currentItem(session);
    const after = recordVerdict(session, false);

    const next = after.queue.slice(after.answered, after.answered + REQUEUE_GAP).map((i) => i.key);
    expect(next).not.toContain(`${missed?.key}#again`);
    expect(after.queue[after.answered + REQUEUE_GAP]?.key).toBe(`${missed?.key}#again`);
  });

  it('lets the same item come back as often as it is missed', () => {
    // no cap: needing four goes at a dial is normal at four years old
    let session = createSession(level('t2.2'), seededRng(9));
    const key = currentItem(session)?.key;

    let showings = 0;
    let guard = 0;
    while (guard < 80) {
      if (currentItem(session)?.key.startsWith(`${key}#again`)) showings += 1;
      session = recordVerdict(session, false);
      guard += 1;
      if (showings >= 3) break;
    }
    expect(showings).toBeGreaterThanOrEqual(3);
  });

  it('marks a re-showing as a retry, so first-pass figures stay honest', () => {
    let session = createSession(level('t2.2'), seededRng(9));
    session = recordVerdict(session, false); // miss item 1
    session = answerRight(session, REQUEUE_GAP); // three different items
    const retried = currentItem(session);
    expect(retried?.retry).toBe(true);

    session = recordVerdict(session, true);
    // ten right answers, one of them on a second showing
    expect(firstPassCorrect(session)).toBe(REQUEUE_GAP);
    expect(session.correct).toBe(REQUEUE_GAP + 1);
  });
});

describe('a level with nothing to ask', () => {
  it('has no questions, and answering one changes nothing', () => {
    const session = createSession(level('t0.1'), seededRng(1)); // order cards: no screen yet
    expect(session.queue).toEqual([]);
    expect(currentItem(session)).toBeUndefined();
    expect(recordVerdict(session, true)).toBe(session);
    expect(isFinished(session)).toBe(false); // not finished, just unaskable
    expect(trackProgress(session)).toBe(0);
  });
});

describe('the adult can call it', () => {
  it('ends the round without the goal, and says so without calling it a failure', () => {
    const session = endSession(answerRight(createSession(level('t2.2'), seededRng(2)), 3));
    expect(isFinished(session)).toBe(true);

    const summary = summarise(session);
    expect(summary).toEqual({
      correct: 3,
      goal: GOAL_CORRECT,
      firstPass: 3,
      reachedGoal: false,
      endedEarly: true,
      bestStreak: 3,
    });
  });

  it('reports a reached goal as reached, not as an early finish', () => {
    const session = answerRight(createSession(level('t2.2'), seededRng(2)), GOAL_CORRECT);
    const summary = summarise(session);
    expect(summary.reachedGoal).toBe(true);
    expect(summary.endedEarly).toBe(false);
    expect(summary.correct).toBe(GOAL_CORRECT);
  });

  it('counts a streak honestly, resets it on a miss, and keeps the best', () => {
    let session = answerRight(createSession(level('t2.2'), seededRng(2)), 4);
    expect(session.streak).toBe(4);
    session = recordVerdict(session, false);
    expect(session.streak).toBe(0);
    session = answerRight(session, 2);
    expect(session.bestStreak).toBe(4);
    expect(session.streak).toBe(2);
  });

  it('ignores a verdict once the round is over', () => {
    const done = answerRight(createSession(level('t2.2'), seededRng(6)), GOAL_CORRECT);
    expect(recordVerdict(done, true)).toBe(done);
  });
});