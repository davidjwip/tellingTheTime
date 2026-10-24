import { describe, expect, it } from 'vitest';

import {
  buildQueue,
  createSession,
  currentItem,
  firstPassCorrect,
  GOAL_CORRECT,
  isCleared,
  isFinished,
  recordVerdict,
  REQUEUE_GAP,
  sameQuestion,
  seededRng,
  SUPPORTED_TASKS,
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
    expect(buildQueue(level('t1.4'), seededRng(3))).toEqual([]);
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

describe('choose questions carry their cards and answer', () => {
  it('presents choose as a task the app can show', () => {
    expect(SUPPORTED_TASKS.has('choose')).toBe(true);
  });

  it('builds six day-strip questions with all three cards each', () => {
    const queue = buildQueue(level('t0.2'), seededRng(3));
    expect(queue).toHaveLength(6);
    for (const item of queue) {
      expect(item.task).toBe('choose');
      expect(item.cards).toHaveLength(3);
      expect(item.cards?.some((card) => card.id === item.answer)).toBe(true);
    }
  });

  it('builds eight duration questions with two cards each', () => {
    const queue = buildQueue(level('t0.3'), seededRng(3));
    expect(queue).toHaveLength(8);
    for (const item of queue) {
      expect(item.task).toBe('choose');
      expect(item.cards).toHaveLength(2);
      expect(item.cards?.some((card) => card.id === item.answer)).toBe(true);
    }
  });

  it('never asks the same choice twice in a row, including the extra questions', () => {
    for (const id of ['t0.2', 't0.3']) {
      let session = createSession(level(id), seededRng(11));
      const answers: Array<string | undefined> = [];
      while (!isFinished(session)) {
        const item = currentItem(session);
        expect(item?.cards).toBeDefined();
        answers.push(item?.answer);
        session = recordVerdict(session, true);
      }
      for (let i = 1; i < answers.length; i += 1) {
        expect(answers[i], `${id} position ${i}`).not.toBe(answers[i - 1]);
      }
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

describe('the no-repeat rule covers the whole round, not just the planned questions', () => {
  it('holds through the extra questions drawn after the plan runs out', () => {
    // the review found extras restarting the window from scratch, so 3:00 could appear three times
    // running once the planned six were used up
    for (let seed = 1; seed <= 40; seed += 1) {
      let session = createSession(level('t2.2'), seededRng(seed));
      const shown: Array<{ hour: number; minute: number } | undefined> = [];

      while (!isFinished(session)) {
        const item = currentItem(session);
        if (item?.time) shown.push(item.time);
        session = recordVerdict(session, true);
      }

      for (let i = 2; i < shown.length; i += 1) {
        expect(shown[i], `seed ${seed}, position ${i}`).not.toEqual(shown[i - 1]);
        expect(shown[i], `seed ${seed}, position ${i}`).not.toEqual(shown[i - 2]);
      }
    }
  });

  it('gives up gracefully when a level has only one time to show', () => {
    // every draw is the same dial, so the repair loop can never fix the clash: it must stop
    const oneTime: Level = {
      ...level('t2.1'),
      id: 'test-one',
      hours: [3],
      minutes: [0],
      round: [{ task: 'read', items: 4 }],
    };
    const session = createSession(oneTime, seededRng(1));
    expect(session.queue.length).toBeGreaterThan(0);
    expect(session.queue.every((item) => item.time?.hour === 3)).toBe(true);
  });

  it('does not put a re-shown dial next to an identical neighbour', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      let session = createSession(level('t2.2'), seededRng(seed));
      for (let i = 0; i < 30 && !isFinished(session); i += 1) {
        session = recordVerdict(session, i % 3 === 0 ? false : true);
      }
      const times = session.queue.map((item) => item.time).filter(Boolean);
      for (let i = 1; i < times.length; i += 1) {
        expect(times[i], `seed ${seed}`).not.toEqual(times[i - 1]);
      }
    }
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

describe('never the same question twice in a row', () => {
  it('holds for every level the app can play, over 200 seeds of the planned queue', () => {
    const offenders: string[] = [];
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 200; seed += 1) {
        const queue = buildQueue(level, seededRng(seed));
        for (let i = 1; i < queue.length; i += 1) {
          if (sameQuestion(queue[i], queue[i - 1])) offenders.push(`${level.id} seed ${seed} at ${i}`);
        }
      }
    }
    expect(offenders.slice(0, 5)).toEqual([]);
  });

  it('holds while a round is played, where misses are requeued and extras are drawn', () => {
    const offenders: string[] = [];
    for (const level of LEVELS) {
      for (let seed = 1; seed <= 60; seed += 1) {
        let session = createSession(level, seededRng(seed));
        for (let step = 0; step < 30; step += 1) {
          const queue = session.queue;
          for (let i = session.answered + 1; i < queue.length; i += 1) {
            if (sameQuestion(queue[i], queue[i - 1])) {
              offenders.push(`${level.id} seed ${seed} at ${i}`);
            }
          }
          session = recordVerdict(session, step % 5 !== 4); // mostly right, an occasional miss
        }
      }
    }
    expect(offenders.slice(0, 5)).toEqual([]);
  });

  it('detects a match at all, or the property tests above prove nothing', () => {
    const queue = buildQueue(level('t2.2'), seededRng(9));
    const first = queue[0];
    if (!first) throw new Error('no items');
    expect(sameQuestion(first, { ...first })).toBe(true);
    expect(sameQuestion(first, queue[1])).toBe(false);
  });

  it('alternates a lap of the dial, so two laps in a row are different questions', () => {
    const queue = buildQueue(level('t1.1'), seededRng(2));
    expect(queue[0]?.tap?.sequence).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(queue[1]?.tap?.sequence).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(sameQuestion(queue[0], queue[1])).toBe(false);
  });
});

describe('a level whose questions are a lap of the dial', () => {
  it('builds one lap per planned item, carrying the sequence and the ring', () => {
    const queue = buildQueue(level('t1.1'), seededRng(5));
    expect(queue).toHaveLength(4);
    for (const item of queue) {
      expect(item.task).toBe('tap');
      expect(item.tap?.target).toBe('numerals');
      expect(item.tap?.sequence).toHaveLength(12);
    }
  });

  it('counts in fives on the label ring', () => {
    const queue = buildQueue(level('t1.3'), seededRng(5));
    expect(queue[0]?.tap?.target).toBe('labels');
    expect(queue[0]?.tap?.sequence).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]);
  });
});

describe('a level with nothing to ask', () => {
  it('has no questions, and answering one changes nothing', () => {
    const session = createSession(level('t1.4'), seededRng(1)); // build the face: no screen yet
    expect(session.queue).toEqual([]);
    expect(currentItem(session)).toBeUndefined();
    expect(recordVerdict(session, true)).toBe(session);
    expect(isFinished(session)).toBe(false); // not finished, just unaskable
    expect(trackProgress(session)).toBe(0);
  });
});

describe('finishing without a clean end', () => {
  it('has no early-finish control: closing the page is the adult\'s exit', () => {
    // Dave: "I can just close the webpage - we don't need to complete cleanly". So there is no
    // endSession in the engine and no Finish button in the UI; the round ends at the goal.
    const session = answerRight(createSession(level('t2.2'), seededRng(2)), 3);
    expect(isFinished(session)).toBe(false);
    expect(Object.keys(session)).not.toContain('ended');
  });

  it('reports a reached goal', () => {
    const session = answerRight(createSession(level('t2.2'), seededRng(2)), GOAL_CORRECT);
    expect(summarise(session)).toEqual({
      correct: GOAL_CORRECT,
      goal: GOAL_CORRECT,
      firstPass: GOAL_CORRECT,
      reachedGoal: true,
      bestStreak: GOAL_CORRECT,
    });
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

