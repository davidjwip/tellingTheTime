import { describe, expect, it } from 'vitest';

import {
  buildQueue,
  clearThreshold,
  correctCount,
  createSession,
  currentItem,
  firstPassCorrect,
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

const level = (id: string) => {
  const found = LEVELS.find((l) => l.id === id);
  if (!found) throw new Error(`no level ${id}`);
  return found;
};

/** Answer `count` items correctly, in order. */
function answerRight(session: Session, count: number): Session {
  let next = session;
  for (let i = 0; i < count; i += 1) next = recordVerdict(next, true);
  return next;
}

describe('building a round', () => {
  it('is deterministic for a seed, so a failing round can be replayed', () => {
    const a = buildQueue(level('t2.2'), seededRng(7));
    const b = buildQueue(level('t2.2'), seededRng(7));
    expect(a).toEqual(b);
  });

  it('gives a different round for a different seed', () => {
    const a = buildQueue(level('t2.2'), seededRng(1)).map((i) => i.time);
    const b = buildQueue(level('t2.2'), seededRng(2)).map((i) => i.time);
    expect(a).not.toEqual(b);
  });

  it('asks only the questions the app can present: the six reads, not the four sets', () => {
    const queue = buildQueue(level('t2.2'), seededRng(3));
    expect(queue.map((i) => i.task)).toEqual(['read', 'read', 'read', 'read', 'read', 'read']);
    expect(queue).toHaveLength(6);
  });

  it('asks nothing on a level whose every question needs a screen that does not exist', () => {
    expect(buildQueue(level('t0.1'), seededRng(3))).toEqual([]);
  });

  it('never shows the same time twice in a row, where the level has enough times', () => {
    const queue = buildQueue(level('t2.2'), seededRng(11)); // twelve o'clocks available
    for (let i = 1; i < queue.length; i += 1) {
      expect(queue[i]?.time).not.toEqual(queue[i - 1]?.time);
    }
  });

  it('gives faceless content items no time, and the clock levels a time', () => {
    const taps = buildQueue(level('t1.3'), seededRng(5));
    expect(taps.every((i) => i.time === undefined)).toBe(true);
    const reads = buildQueue(level('t2.2'), seededRng(5));
    expect(reads.every((i) => i.time !== undefined)).toBe(true);
  });

  it('repeats the only time a level has, rather than failing to draw', () => {
    // no shipped level is this narrow, so it is built here: one hour, one minute
    const oneHour: Level = {
      ...level('t2.1'),
      id: 'test-single',
      hours: [3],
      minutes: [0],
      round: [{ task: 'read', items: 4 }],
    };
    const queue = buildQueue(oneHour, seededRng(1));
    expect(queue).toHaveLength(4);
    expect(queue.every((i) => i.time?.hour === 3 && i.time.minute === 0)).toBe(true);
  });
});

describe('clearing a round', () => {
  it('asks for 80% correct, rounded', () => {
    expect(clearThreshold(10)).toBe(8);
    expect(clearThreshold(5)).toBe(4);
    expect(clearThreshold(3)).toBe(2);
  });

  it('does not clear on four of six, and clears on five', () => {
    const session = createSession(level('t2.2'), seededRng(4));
    expect(isCleared(answerRight(session, 4))).toBe(false);
    expect(isCleared(answerRight(session, 5))).toBe(true);
  });

  it('fills the track one step per correct answer, capped at the round length', () => {
    const session = createSession(level('t2.2'), seededRng(4));
    expect(trackProgress(session)).toBe(0);
    expect(trackProgress(answerRight(session, 3))).toBe(3);
    expect(trackProgress(answerRight(session, 6))).toBe(6);
  });

  it('celebrates only a full track, not merely a clear', () => {
    const session = createSession(level('t2.2'), seededRng(4));
    expect(trackComplete(answerRight(session, 5))).toBe(false); // cleared, but a step short
    expect(trackComplete(answerRight(session, 6))).toBe(true);
  });
});

describe('the re-queue rule (B2)', () => {
  it('puts a missed item three positions later, not next', () => {
    const session = createSession(level('t2.2'), seededRng(9));
    const missed = currentItem(session);
    const after = recordVerdict(session, false);

    const keys = after.queue.slice(after.answered, after.answered + REQUEUE_GAP).map((i) => i.key);
    expect(keys).not.toContain(`${missed?.key}#again`);
    expect(after.queue[after.answered + REQUEUE_GAP]?.key).toBe(`${missed?.key}#again`);
  });

  it('keeps the three-position gap even when the miss is the last item of the round', () => {
    // This used to clamp to the end, which put the missed dial straight back on screen - the
    // child copies the answer they have just been told was wrong. The round now extends with
    // practice from the same level so the gap holds.
    let session = answerRight(createSession(level('t2.2'), seededRng(9)), 5);
    const missed = currentItem(session);
    const after = recordVerdict(session, false);

    const next = after.queue.slice(after.answered, after.answered + REQUEUE_GAP).map((i) => i.key);
    expect(next).not.toContain(`${missed?.key}#again`);
    expect(after.queue[after.answered + REQUEUE_GAP]?.key).toBe(`${missed?.key}#again`);
  });

  it('does not re-queue practice, so missing it cannot grow the round', () => {
    let session = answerRight(createSession(level('t2.2'), seededRng(9)), 5);
    session = recordVerdict(session, false); // last item missed: practice is inserted

    const fillerAt = session.queue.findIndex((i) => i.filler === true);
    expect(fillerAt).toBeGreaterThan(-1);
    while (session.answered < fillerAt) session = recordVerdict(session, true);

    const before = session.queue.length;
    session = recordVerdict(session, false); // miss the practice
    expect(session.queue).toHaveLength(before); // no #again, no new fillers
  });

  it('shows a missed item at most twice, however often it is missed', () => {
    let session = createSession(level('t2.2'), seededRng(9));
    const first = currentItem(session);
    session = recordVerdict(session, false); // miss it: it will come back

    let appeared = 0;
    let guard = 0;
    while (!isFinished(session) && guard < 60) {
      if (currentItem(session)?.key === `${first?.key}#again`) {
        appeared += 1;
        session = recordVerdict(session, false); // miss the re-showing too
      } else {
        session = recordVerdict(session, true);
      }
      guard += 1;
    }
    expect(appeared).toBe(1); // re-shown once, never a third time
    expect(isFinished(session)).toBe(true);
  });

  it('bounds how much practice one round can invent', () => {
    // a child who answers nothing must still reach the end of the round
    let session = createSession(level('t2.2'), seededRng(9));
    let answered = 0;
    while (!isFinished(session) && answered < 200) {
      session = recordVerdict(session, false);
      answered += 1;
    }
    expect(answered).toBeLessThan(40);
    expect(session.queue.filter((i) => i.filler === true).length).toBeLessThanOrEqual(6);
  });

  it('does not let practice it invented fill a step on the track', () => {
    let session = answerRight(createSession(level('t2.2'), seededRng(9)), 5);
    session = recordVerdict(session, false); // last item missed, so a filler is inserted
    expect(session.queue.length).toBeGreaterThan(7);

    const filler = session.queue.find((i) => i.filler === true);
    expect(filler, 'a filler should have been inserted').toBeDefined();

    // answering it correctly must not advance the track beyond what the child knew first time
    const at = session.queue.indexOf(filler!);
    while (session.answered < at) session = recordVerdict(session, true);
    const before = trackProgress(session);
    session = recordVerdict(session, true);
    expect(trackProgress(session)).toBe(before);
  });

  it('grows the queue but never the round', () => {
    const session = createSession(level('t2.2'), seededRng(9));
    const after = recordVerdict(session, false);
    expect(after.queue).toHaveLength(7);
    expect(after.total).toBe(6);
  });

  it('keeps the round going until the re-queued item has been answered', () => {
    const session = answerRight(createSession(level('t2.2'), seededRng(9)), 5);
    const after = recordVerdict(session, false);
    expect(isFinished(after)).toBe(false);

    // the round has grown by practice plus the re-showing, so it ends when the queue is drained
    const remaining = after.queue.length - after.answered;
    expect(isFinished(answerRight(after, remaining))).toBe(true);
  });
});

describe('streaks', () => {
  it('counts up with correct answers and resets on a miss', () => {
    let session = answerRight(createSession(level('t2.2'), seededRng(2)), 3);
    expect(session.streak).toBe(3);
    session = recordVerdict(session, false);
    expect(session.streak).toBe(0);
  });

  it('remembers the best streak after a reset', () => {
    let session = answerRight(createSession(level('t2.2'), seededRng(2)), 4);
    session = recordVerdict(session, false);
    session = answerRight(session, 2);
    expect(session.bestStreak).toBe(4);
    expect(session.streak).toBe(2);
  });
});

describe('first attempts are what the round measures', () => {
  it('does not count a re-queued item as a step on the track', () => {
    let session = createSession(level('t2.2'), seededRng(8));
    session = recordVerdict(session, false); // missed, re-queued
    session = answerRight(session, 3);

    // four answers, three of them first-time correct: the track shows three
    expect(session.results).toHaveLength(4);
    expect(correctCount(session)).toBe(3);
    expect(trackProgress(session)).toBe(3);
  });

  it('clears on first attempts even when the re-queued item is later answered', () => {
    let session = createSession(level('t2.2'), seededRng(8));
    session = recordVerdict(session, false);
    // answer everything left correctly, including the re-showing
    session = answerRight(session, 6);
    expect(isFinished(session)).toBe(true);

    // 6 first-showing items, 5 right first time: cleared, but the track is one step short and the
    // summary says five, not six. Before this, a round with a miss reported a perfect total.
    expect(summarise(session)).toEqual({ correct: 5, total: 6, cleared: true, bestStreak: 6 });
    expect(trackComplete(session)).toBe(false);
  });

  it('can fail: three first-time misses leave the round uncleared', () => {
    let session = createSession(level('t2.2'), seededRng(8));
    for (let i = 0; i < 3; i += 1) session = recordVerdict(session, false);
    session = answerRight(session, 20); // answer everything, including every re-showing
    expect(isFinished(session)).toBe(true);
    expect(summarise(session).correct).toBe(3);
    expect(isCleared(session)).toBe(false);
  });
});

describe('no repeat within two positions (AC-09)', () => {
  it('never shows the same time within two of itself', () => {
    const queue = buildQueue(level('t2.2'), seededRng(21)); // twelve o'clocks available
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
    expect(queue).toHaveLength(6);
    // adjacent repeats are still impossible; only the distance-two rule can bend
    for (let i = 1; i < queue.length; i += 1) {
      expect(queue[i]?.time).not.toEqual(queue[i - 1]?.time);
    }
  });
});

describe('the summary', () => {
  it('reports correct, total, clear and best streak — and no score', () => {
    const session = answerRight(createSession(level('t2.2'), seededRng(6)), 5);
    expect(summarise(session)).toEqual({ correct: 5, total: 6, cleared: true, bestStreak: 5 });
    expect(Object.keys(summarise(session))).not.toContain('wrong');
  });

  it('does not clear a round with four misses', () => {
    let session = createSession(level('t2.2'), seededRng(6));
    for (let i = 0; i < 2; i += 1) session = recordVerdict(session, true);
    for (let i = 0; i < 4; i += 1) session = recordVerdict(session, false);
    expect(summarise(session).cleared).toBe(false);
  });

  it('ignores a verdict once the queue is exhausted', () => {
    const done = answerRight(createSession(level('t2.2'), seededRng(6)), 10);
    expect(isFinished(done)).toBe(true);
    expect(recordVerdict(done, true)).toBe(done);
  });
});