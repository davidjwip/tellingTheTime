/**
 * The level set and its eight integrity rules (specs/v1.md §4.5).
 *
 * The rules are pure functions over data so they can be tested against deliberately broken fixtures
 * — a validator that only ever sees good data is decoration.
 */

import levelsJson from './levels.json';

import type { Level, LevelsFile, RepKey, RoundStep, Task, Violation } from './types';
import { FACELESS_KINDS } from './types';

export const LEVELS: Level[] = (levelsJson as LevelsFile).levels;

/** Round length is derived, never stored. */
export function itemsPerRound(level: Level): number {
  return level.round.reduce((n, step) => n + step.items, 0);
}

export function taskKey(level: Level): string {
  return level.round.map((step: RoundStep) => step.task).join('+');
}

/** What the face actually reveals, derived from the config — never trusted from `knobs`. */
export function derivedRep(level: Level): RepKey {
  if (level.content.kind === 'buildFace') return 'build';
  const face = level.face;
  if (!face) return 'none';
  if (face.hands === 'none') return face.minuteLabels ? 'numerals+labels' : 'numerals';
  if (face.hands === 'hour') return 'hour';
  return face.minuteHandParked ? 'parked' : 'both';
}

/** Every clock level, in play order, for the reveal-order rules. */
export function clockTimes(level: Level): Array<{ hour: number; minute: number }> {
  if (level.content.kind !== 'clock') return [];
  const hours = level.hours ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const minutes = level.minutes ?? [];
  const out: Array<{ hour: number; minute: number }> = [];
  for (const hour of hours) for (const minute of minutes) out.push({ hour, minute });
  return out;
}

const TASKS: readonly Task[] = ['order', 'choose', 'read', 'set', 'build', 'tap'];
const REP_RANK: Partial<Record<RepKey, number>> = { hour: 1, parked: 2, both: 3 };

/** Rules 1–8. Returns every violation found, not just the first. */
export function validateLevels(levels: readonly Level[] = LEVELS): Violation[] {
  const v: Violation[] = [];
  const fail = (rule: number, levelId: string, message: string) => v.push({ rule, levelId, message });

  // ---- rule 1: ids unique; tiers contiguous from 0; every tier 0–4 populated ----
  const seen = new Set<string>();
  for (const level of levels) {
    if (seen.has(level.id)) fail(1, level.id, 'duplicate level id');
    seen.add(level.id);
  }
  const tiers = [...new Set(levels.map((l) => l.tier))].sort((a, b) => a - b);
  tiers.forEach((tier, i) => {
    if (tier !== i) fail(1, 'tier ' + tier, `tiers must be contiguous from 0; found ${tiers.join(',')}`);
  });
  for (const tier of [0, 1, 2, 3, 4] as const) {
    if (!levels.some((l) => l.tier === tier)) fail(1, 'tier ' + tier, 'tier has no levels');
  }

  for (const level of levels) {
    // ---- rule 2: round length in [3, 12] ----
    const items = itemsPerRound(level);
    if (!Number.isInteger(items) || items < 3 || items > 12) {
      fail(2, level.id, `round length ${items} outside [3, 12]`);
    }
    for (const step of level.round) {
      if (!TASKS.includes(step.task)) fail(2, level.id, `unknown task ${String(step.task)}`);
    }

    // ---- rule 3: every read step precedes every set step ----
    const taskOrder = level.round.map((s) => s.task);
    const lastRead = taskOrder.lastIndexOf('read');
    const firstSet = taskOrder.indexOf('set');
    if (lastRead !== -1 && firstSet !== -1 && lastRead > firstSet) {
      fail(3, level.id, 'a read step comes after a set step; reading must come first');
    }

    // ---- rule 4: minutes are multiples of 5 and non-empty on clock levels ----
    if (level.content.kind === 'clock') {
      const minutes = level.minutes ?? [];
      if (minutes.length === 0) fail(4, level.id, 'clock level has no minutes');
      for (const m of minutes) {
        if (m % 5 !== 0) fail(4, level.id, `minute ${m} is not a multiple of 5 in v1`);
        if (m < 0 || m > 59) fail(4, level.id, `minute ${m} outside 0–59`);
      }
      for (const h of level.hours ?? []) {
        if (!Number.isInteger(h) || h < 1 || h > 12) fail(4, level.id, `hour ${h} outside 1–12`);
      }
    }

    // ---- rule 5: distinct content, per kind ----
    const kind = level.content.kind;
    if (kind === 'clock') {
      const distinct = clockTimes(level).length;
      const needed = Math.min(4, items);
      if (distinct < needed) {
        fail(5, level.id, `only ${distinct} distinct times for a ${items}-item round (needs ${needed})`);
      }
    } else if (kind === 'dayStrip') {
      // three positions by construction (yesterday / today / tomorrow) — always ≥2, nothing to check
    } else if (kind === 'durationPair') {
      if (itemsPerRound(level) < 2) fail(5, level.id, 'needs ≥2 distinct event pairs');
    } else if (FACELESS_KINDS.includes(kind as (typeof FACELESS_KINDS)[number]) && !('count' in level.content)) {
      fail(5, level.id, 'faceless content must declare a count');
    }

    // ---- rule 6: content/face consistency ----
    const faceless = FACELESS_KINDS.includes(kind as (typeof FACELESS_KINDS)[number]);
    if (faceless && level.face) fail(6, level.id, 'faceless content must not declare a face');
    if (!faceless && !level.face) fail(6, level.id, 'a level that draws a face must declare one');
    if (level.face) {
      const hands = level.face.hands;
      const hasRead = taskOrder.includes('read');
      const hasSet = taskOrder.includes('set');
      if (hands === 'none' && (hasRead || hasSet)) {
        fail(6, level.id, 'hands:none cannot carry read or set steps');
      }
      if (hands === 'hour' && hasSet) {
        const fixedMinute = (level.minutes ?? []).length === 1;
        if (!fixedMinute) {
          fail(6, level.id, 'hands:hour set step needs a fixed minute (nothing for the minute hand to show)');
        }
      }
    }

    // ---- rule 7: audio keys resolve (vacuously true until levels declare any) ----
    const declared = (level as Level & { audioKey?: string }).audioKey;
    if (declared !== undefined && !/^(oclock|half|qpast|qto)-([1-9]|1[0-2])$/.test(declared)) {
      fail(7, level.id, `audio key ${declared} has no phrase in data/phrases-yue.csv`);
    }

    // ---- rule 8: declared knobs ----
    // (i) the declaration must match the config
    const rep = derivedRep(level);
    if (level.knobs.rep !== rep) {
      fail(8, level.id, `declared rep ${level.knobs.rep} but the config derives ${rep}`);
    }
    if (level.knobs.task !== taskKey(level)) {
      fail(8, level.id, `declared task ${level.knobs.task} but the round is ${taskKey(level)}`);
    }
  }

  // ---- rule 8 (ii) and (iii): reveal order inside T2–T4 ----
  for (const tier of [2, 3, 4] as const) {
    const inTier = levels.filter((l) => l.tier === tier);
    let reveals = 0;
    let previous: number | undefined;
    for (const level of inTier) {
      const rank = REP_RANK[derivedRep(level)];
      if (rank === undefined) continue;
      if (previous !== undefined) {
        if (rank < previous) {
          fail(8, level.id, 'the face is re-concealed within a tier; it may only be revealed');
        }
        if (rank > previous) reveals += 1;
      }
      previous = rank;
    }
    if (reveals > 1) {
      fail(8, 'tier ' + tier, `the face is revealed ${reveals} times within the tier; at most once`);
    }
  }

  return v;
}
