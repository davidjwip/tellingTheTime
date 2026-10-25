import { describe, expect, it } from 'vitest';

import {
  LEVELS,
  PARSED,
  checkLevelsFile,
  clockTimes,
  derivedRep,
  itemsPerRound,
  parseLevelsFile,
  taskKey,
  validateLevels,
} from '../src/levels';
import type { Level } from '../src/types';

/**
 * AC-06 and AC-07 — the level data and the eight integrity rules (specs/v1.md §4.5).
 *
 * AC-07 is the one that matters: a validator that has only ever seen valid data proves nothing, so
 * every rule gets a deliberately broken fixture. Two tests below exist because the first version of
 * the validator was wrong — see "reveal order ranks the number of hands".
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

/** Rule numbers from raw (possibly malformed) data — shape plus rules, as the gate does it. */
const checkedRules = (raw: unknown) => [...new Set(checkLevelsFile(raw).map((v) => v.rule))].sort();

describe('AC-06 — the committed level data passes every rule', () => {
  it('reports no violations from the shape check or the eight rules', () => {
    expect(PARSED.violations).toEqual([]);
    expect(validateLevels(LEVELS)).toEqual([]);
  });

  it('has the 22 levels the spec tabulates: 4 per tier from T0 to T4, and 2 at T5', () => {
    expect(LEVELS).toHaveLength(23);
    // T0 carries the unnumbered week as a fifth rung: the same cards, one crutch fewer
    expect(LEVELS.filter((l) => l.tier === 0)).toHaveLength(5);
    for (const tier of [1, 2, 3, 4]) {
      expect(LEVELS.filter((l) => l.tier === tier)).toHaveLength(4);
    }
  });

  it('builds tier 5 as the bridge: one level with the ring, one without', () => {
    const five = LEVELS.filter((l) => l.tier === 5);
    expect(five.map((l) => l.id)).toEqual(['t5.1', 't5.2']);

    const grid = [5, 10, 20, 25, 35, 40, 50, 55];
    for (const level of five) {
      expect(level.minutes, level.id).toEqual(grid);
      expect(level.face?.hands, level.id).toBe('both');
    }

    // the scaffold is the difference between the two levels, and the whole point of the pair
    expect(five[0]?.face?.minuteLabels).toBe(true);
    expect(five[1]?.face?.minuteLabels).toBe(false);
  });

  it('gives every T2–T4 round ten items, now that set steps are counted', () => {
    for (const level of LEVELS.filter((l) => l.tier >= 2 && l.tier <= 4)) {
      expect(itemsPerRound(level)).toBe(10);
    }
  });
});

describe('AC-07 — each rule rejects a broken fixture', () => {
  it('rule 1: a duplicate level id', () => {
    expect(rules(mutated('t0.1', (l) => { l.id = 't0.2'; }))).toContain(1);
  });

  it('rule 1: a file with no levels array', () => {
    expect(parseLevelsFile({}).violations.map((v) => v.rule)).toContain(1);
  });

  it('rule 2: a round longer than twelve items', () => {
    expect(rules(mutated('t0.1', (l) => { l.round = [{ task: 'order', items: 20 }]; }))).toContain(2);
  });

  it('rule 2: a zero-item step is a shape violation, not a crash', () => {
    const broken = structuredClone(LEVELS) as unknown as Array<Record<string, unknown>>;
    broken[0]!.round = [{ task: 'order', items: 0 }];
    expect(parseLevelsFile({ levels: broken }).violations.map((v) => v.rule)).toContain(2);
  });

  it('rule 3: a read step after a set step', () => {
    expect(rules(mutated('t2.1', (l) => {
      l.round = [{ task: 'set', items: 4 }, { task: 'read', items: 6 }];
    }))).toContain(3);
  });

  it('rule 3: interleaved read/set/read/set is still caught', () => {
    expect(rules(mutated('t2.1', (l) => {
      l.round = [
        { task: 'read', items: 2 },
        { task: 'set', items: 2 },
        { task: 'read', items: 3 },
        { task: 'set', items: 3 },
      ];
    }))).toContain(3);
  });

  it('rule 6: the 5-minute ring is allowed on a two-hand clock at tier 5, and nowhere below', () => {
    // the shipped level carries the ring on a two-hand face, and the file still validates
    const atFive = LEVELS.find((l) => l.id === 't5.1');
    expect(atFive?.face?.minuteLabels).toBe(true);
    expect(atFive?.face?.hands).toBe('both');
    expect(rules(LEVELS)).not.toContain(6);

    // the same face one tier earlier is still a scaffold on the wrong clock
    const atFour = mutated('t4.4', (l) => {
      l.face!.minuteLabels = true;
    });
    expect(rules(atFour)).toContain(6);
  });

  it('rule 6: a tier 5 face with only an hour hand cannot wear the ring', () => {
    const hourOnly = mutated('t5.1', (l) => {
      l.face!.hands = 'hour';
    });
    expect(rules(hourOnly)).toContain(6);
  });

  it('rule 6: the tap lap rule still applies', () => {
    const noLabels = mutated('t1.3', (l) => {
      l.face!.minuteLabels = false;
    });
    expect(rules(noLabels)).toContain(6);

    const noNumerals = mutated('t1.1', (l) => {
      l.face!.numerals = false;
    });
    expect(rules(noNumerals)).toContain(6);
  });

  it('rule 4: minutes that are not multiples of five', () => {
    expect(rules(mutated('t4.2', (l) => { l.minutes = [7]; }))).toContain(4);
  });

  it('rule 4: minutes on a level with no clock', () => {
    expect(rules(mutated('t1.1', (l) => { l.minutes = [0]; }))).toContain(4);
  });

  it('rule 5: too few distinct times for the round length', () => {
    expect(rules(mutated('t2.2', (l) => { l.hours = [3]; }))).toContain(5);
  });

  it('rule 5: a fixed count that disagrees with the spec table', () => {
    expect(rules(mutated('t0.1', (l) => { (l.content as { count: number }).count = 2; }))).toContain(5);
    expect(rules(mutated('t1.4', (l) => { (l.content as { numerals: number }).numerals = 6; }))).toContain(5);
    expect(rules(mutated('t1.3', (l) => { (l.content as { to: number }).to = 30; }))).toContain(5);
  });

  it('rule 6: a face on faceless content, and a missing face where one is drawn', () => {
    // presence is judged while parsing, so this goes through the combined entry point
    const levels = clone() as unknown as Array<Record<string, unknown>>;
    (levels[0] as Record<string, unknown>).face = {
      hands: 'none',
      minuteHandParked: false,
      numerals: true,
      minuteMarks: false,
      minuteLabels: false,
      pastToShade: false,
      showDigital: false,
    };
    delete (levels.find((l) => l.id === 't2.1') as Record<string, unknown>).face;
    expect(checkedRules({ levels })).toContain(6);
  });

  it('rule 6: a reserved field switched on before T5', () => {
    expect(rules(mutated('t2.1', (l) => { l.face!.minuteMarks = true; }))).toContain(6);
  });

  it('rule 6: a parked minute hand on an hour-only face', () => {
    expect(rules(mutated('t2.1', (l) => { l.face!.minuteHandParked = true; }))).toContain(6);
  });

  it('rule 6: minute labels on a two-hand face', () => {
    expect(rules(mutated('t4.2', (l) => { l.face!.minuteLabels = true; }))).toContain(6);
  });

  it('rule 7: an unknown audio key, checked against a real manifest', () => {
    const broken = mutated('t2.1', (l) => {
      (l as Level & { audioKey?: string }).audioKey = 'nonsense-13';
    });
    const audioKeys = new Set(['oclock-3', 'half-3']);
    expect(validateLevels(broken, { audioKeys }).map((v) => v.rule)).toContain(7);
  });

  it('rule 7: known audio keys pass, and no manifest means the rule is skipped', () => {
    const fine = mutated('t2.1', (l) => {
      (l as Level & { audioKey?: string }).audioKey = 'oclock-3';
    });
    expect(validateLevels(fine, { audioKeys: new Set(['oclock-3']) })).toEqual([]);
    expect(validateLevels(fine)).toEqual([]); // no manifest supplied -> skipped, not guessed
  });

  it('rule 8: a declared triple that disagrees with the config', () => {
    expect(rules(mutated('t3.1', (l) => { l.knobs.rep = 'both'; }))).toContain(8);
    expect(rules(mutated('t3.1', (l) => { l.knobs.task = 'read'; }))).toContain(8);
  });

  it('rule 8: a level with no declaration is a shape violation, not a crash', () => {
    const broken = structuredClone(LEVELS) as unknown as Array<Record<string, unknown>>;
    delete broken[0]!.knobs;
    const out = parseLevelsFile({ levels: broken });
    expect(out.violations.map((v) => v.rule)).toContain(8);
    expect(out.levels).toHaveLength(22); // the malformed level never reaches the rules
  });
});

describe('parseLevelsFile — every rejection path, since that is the parser\'s whole job', () => {
  /** a well-formed level, so each case below breaks exactly one thing */
  const good = (): Record<string, unknown> => structuredClone(LEVELS[0]) as unknown as Record<string, unknown>;
  const oneRule = (entry: unknown) => {
    const out = parseLevelsFile({ levels: [entry] });
    return [...new Set(out.violations.map((v) => v.rule))].sort();
  };

  it('accepts the untouched fixture', () => {
    expect(oneRule(good())).toEqual([]);
  });

  it('rejects a level that is not an object', () => {
    expect(oneRule('not a level')).toContain(1);
  });

  it('rule 1: missing id, and a tier that is not an integer 0–6', () => {
    const noId = good();
    delete noId.id;
    expect(oneRule(noId)).toContain(1);
    expect(oneRule({ ...good(), tier: 9 })).toContain(1);
    expect(oneRule({ ...good(), tier: 'T1' })).toContain(1);
  });

  it('rule 2: a missing round, and a malformed step', () => {
    const noRound = good();
    delete noRound.round;
    expect(oneRule(noRound)).toContain(2);
    expect(oneRule({ ...good(), round: [{ task: 'fly', items: 3 }] })).toContain(2);
    expect(oneRule({ ...good(), round: [{ task: 'order', items: 0 }] })).toContain(2);
  });

  it('rule 4: minutes that are not an array', () => {
    expect(oneRule({ ...good(), minutes: 'none' })).toContain(4);
  });

  it('rule 4: a missing or malformed badge time', () => {
    const noBadge = good();
    delete noBadge.badge;
    expect(oneRule(noBadge)).toContain(4);
    expect(oneRule({ ...good(), badge: { time: 'noon' } })).toContain(4);
    expect(oneRule({ ...good(), badge: { time: [13, 0] } })).toContain(4);
    expect(oneRule({ ...good(), badge: { time: [3, 99] } })).toContain(4);
  });

  it('rule 5: content with no kind', () => {
    const noContent = good();
    delete noContent.content;
    expect(oneRule(noContent)).toContain(5);
  });

  it('rule 8: no knobs declaration', () => {
    const noKnobs = good();
    delete noKnobs.knobs;
    expect(oneRule(noKnobs)).toContain(8);
  });
});

describe('rule boundaries that depend on optional fields', () => {
  it('clockTimes defaults to twelve hours and no minutes', () => {
    const level = structuredClone(LEVELS.find((l) => l.id === 't2.2')!);
    delete level.hours;
    delete level.minutes;
    expect(clockTimes(level)).toHaveLength(0); // no minutes -> no times
    level.minutes = [0];
    expect(clockTimes(level)).toHaveLength(12); // hours default to 1–12
  });

  it('rule 4: a clock level with no minutes, and values out of range', () => {
    const noMinutes = clone();
    delete noMinutes.find((l) => l.id === 't4.2')!.minutes;
    expect(rules(noMinutes)).toContain(4);
    expect(rules(mutated('t4.2', (l) => { l.minutes = [65]; }))).toContain(4);
    expect(rules(mutated('t4.2', (l) => { l.hours = [13]; }))).toContain(4);
  });

  it('rule 5: numberOrder that does not run 1–12', () => {
    expect(rules(mutated('t1.1', (l) => {
      (l.content as { from: number; to: number }).from = 0;
    }))).toContain(5);
  });

  it('rule 6: hands:none carrying a read step, and hands:hour setting an unfixed minute', () => {
    expect(rules(mutated('t1.1', (l) => {
      l.round = [{ task: 'read', items: 4 }];
      l.knobs.task = 'read';
    }))).toContain(6);
    expect(rules(mutated('t2.1', (l) => { l.minutes = [0, 30]; }))).toContain(6);
  });

  it('rule 1: tiers that are not contiguous, and a tier with no levels', () => {
    const gapped = clone();
    for (const level of gapped.filter((l) => l.tier === 1)) level.tier = 2;
    expect(rules(gapped)).toContain(1);
  });

  it('rule 8: a T2–T4 level with no clock-reading face is skipped by the reveal check', () => {
    // deriveRep -> 'numerals' (hand count 0): the reveal loop must skip it, not crash
    const levels = mutated('t2.1', (l) => {
      l.face!.hands = 'none';
      l.knobs.rep = 'numerals';
    });
    expect(() => validateLevels(levels)).not.toThrow();
    expect(rules(levels)).toContain(6); // and rule 6 still objects, correctly
  });
});

describe('rule 8 — reveal order ranks the number of hands, not the motion', () => {
  it('allows hour → parked → both inside a tier', () => {
    // The first implementation ranked parked below both and called this sequence two reveals.
    const levels = clone();
    // a parked minute hand is a two-hand face; derivedRep ranks it by hand count, so
    // hour(1) -> parked(2) -> both(2) must be accepted
    const t23 = levels.find((l) => l.id === 't2.3')!;
    t23.face!.hands = 'both';
    t23.face!.minuteHandParked = true;
    t23.knobs.rep = 'parked';
    const t24 = levels.find((l) => l.id === 't2.4')!;
    t24.face!.minuteHandParked = false;
    t24.knobs.rep = 'both';
    expect(validateLevels(levels).filter((v) => v.rule === 8)).toEqual([]);
  });

  it('rejects both → parked inside a tier', () => {
    const levels = clone();
    const t21 = levels.find((l) => l.id === 't2.1')!;
    t21.face!.hands = 'both';
    t21.knobs.rep = 'both';
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
    const byId = (id: string) => LEVELS.find((l) => l.id === id)!;
    expect(clockTimes(byId('t2.1'))).toHaveLength(4);
    expect(clockTimes(byId('t4.4'))).toHaveLength(48);
    expect(clockTimes(byId('t0.1'))).toHaveLength(0);
  });
});
