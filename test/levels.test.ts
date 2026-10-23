import { describe, expect, it } from 'vitest';

import { LEVELS, clockTimes, derivedRep, itemsPerRound, taskKey, validateLevels } from '../src/levels';
import type { Level } from '../src/types';

/**
 * AC-06 and AC-07 — the level data and the eight integrity rules (specs/v1.md §4.5).
 *
 * AC-07 is the one that matters: a validator that has only ever seen valid data proves nothing, so
 * every rule gets a deliberately broken fixture here.
 */

function clone(): Level[] {
  return structuredClone(LEVELS);
}

function mutated(id: string, change: (level: Level) => void): Level[] {
  const levels = clone();
  const level = levels.find((l) => l.id === id);
  if (!level) throw new Error(`fixture level ${id} not found`);
  change(level);
  return levels;
}

const rules = (levels: Level[]) => [...new Set(validateLevels(levels).map((v) => v.rule))].sort();

describe('AC-06 — the committed level data passes every rule', () => {
  it('reports no violations', () => {
    expect(validateLevels(LEVELS)).toEqual([]);
  });

  it('has the 20 levels the spec tabulates, 4 per tier from T0 to T4', () => {
    expect(LEVELS).toHaveLength(20);
    for (const tier of [0, 1, 2, 3, 4]) {
      expect(LEVELS.filter((l) => l.tier === tier)).toHaveLength(4);
    }
  });

  it('gives every T2–T4 round ten items, as the spec promises', () => {
    const clock = LEVELS.filter((l) => l.tier >= 2 && l.tier <= 4);
    for (const level of clock) expect(itemsPerRound(level)).toBe(10);
  });
});

describe('AC-07 — each of the eight rules rejects a broken fixture', () => {
  it('rule 1: duplicate id / missing tier', () => {
    expect(rules(mutated('t0.1', (l) => { l.id = 't0.2'; }))).toContain(1);
  });

  it('rule 2: round length outside [3, 12]', () => {
    expect(rules(mutated('t0.1', (l) => { l.round = [{ task: 'order', items: 20 }]; }))).toContain(2);
  });

  it('rule 3: a read step after a set step', () => {
    expect(
      rules(mutated('t2.1', (l) => { l.round = [{ task: 'set', items: 4 }, { task: 'read', items: 6 }]; })),
    ).toContain(3);
  });

  it('rule 4: minutes that are not multiples of five', () => {
    expect(rules(mutated('t4.2', (l) => { l.minutes = [7]; }))).toContain(4);
  });

  it('rule 5: too few distinct times for the round length', () => {
    expect(rules(mutated('t2.2', (l) => { l.hours = [3]; }))).toContain(5);
  });

  it('rule 6: a faceless level declaring a face, or a face on content that has none', () => {
    expect(rules(mutated('t0.1', (l) => {
      l.face = { hands: 'none', minuteHandParked: false, numerals: true, minuteMarks: false, minuteLabels: false, pastToShade: false, showDigital: false };
    }))).toContain(6);
    expect(rules(mutated('t2.1', (l) => { delete l.face; }))).toContain(6);
  });

  it('rule 7: an audio key with no phrase behind it', () => {
    expect(rules(mutated('t2.1', (l) => { (l as Level & { audioKey?: string }).audioKey = 'nonsense-13'; }))).toContain(7);
  });

  it('rule 8: a declared triple that disagrees with the config', () => {
    expect(rules(mutated('t3.1', (l) => { l.knobs.rep = 'both'; }))).toContain(8);
    expect(rules(mutated('t3.1', (l) => { l.knobs.task = 'read'; }))).toContain(8);
  });

  it('rule 8: the face re-concealed inside a tier', () => {
    // reveal the face at t2.1, then hour-only again at t2.2 — a regression the rule forbids
    const levels = mutated('t2.1', (l) => {
      l.face!.hands = 'both';
      l.knobs.rep = 'both';
    });
    const violations = validateLevels(levels).filter((v) => v.rule === 8);
    expect(violations.some((v) => v.message.includes('re-concealed'))).toBe(true);
  });
});

describe('the derivations the rules depend on', () => {
  it('derives the representation key from the face, never from the declaration', () => {
    const byId = (id: string) => LEVELS.find((l) => l.id === id)!;
    expect(derivedRep(byId('t0.1'))).toBe('none');
    expect(derivedRep(byId('t1.1'))).toBe('numerals');
    expect(derivedRep(byId('t1.3'))).toBe('numerals+labels');
    expect(derivedRep(byId('t1.4'))).toBe('build');
    expect(derivedRep(byId('t2.1'))).toBe('hour');
    expect(derivedRep(byId('t2.4'))).toBe('parked');
    expect(derivedRep(byId('t4.2'))).toBe('both');
  });

  it('derives the task key from the round order', () => {
    const byId = (id: string) => LEVELS.find((l) => l.id === id)!;
    expect(taskKey(byId('t2.1'))).toBe('read+set');
    expect(taskKey(byId('t3.2'))).toBe('choose+read');
    expect(taskKey(byId('t0.1'))).toBe('order');
  });

  it('enumerates the times a clock level can present', () => {
    const t21 = LEVELS.find((l) => l.id === 't2.1')!;
    expect(clockTimes(t21)).toHaveLength(4); // four anchor hours at :00
    const t44 = LEVELS.find((l) => l.id === 't4.4')!;
    expect(clockTimes(t44)).toHaveLength(48); // 12 hours × 4 quarters
    expect(clockTimes(LEVELS.find((l) => l.id === 't0.1')!)).toHaveLength(0);
  });
});
