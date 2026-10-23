/**
 * The level set and its eight integrity rules (specs/v1.md §4.5).
 *
 * Two layers:
 *   1. `parseLevelsFile` — shape. A validator that dies with `TypeError: cannot read properties of
 *      undefined` on a malformed file tells the author nothing. Shape problems become violations
 *      attributed to the rule that owns the field, so every failure has a rule number and a level id.
 *   2. `validateLevels` — the eight rules, over data already known to be well-formed.
 *
 * The rules are pure functions over data so they can be tested against deliberately broken fixtures:
 * a validator that has only ever seen valid data is decoration.
 */

import levelsJson from './levels.json';

import type { Face, Level, RepKey, RoundStep, Task, Violation } from './types';

/** Content kinds drawn without a clock face at all. */
export const FACELESS_KINDS = ['dayCards', 'dayStrip', 'durationPair', 'weekTiles'] as const;
type FacelessKind = (typeof FACELESS_KINDS)[number];

/** Face fields only T5/T6 may set. */
const RESERVED_FACE_FIELDS = ['minuteMarks', 'pastToShade', 'showDigital'] as const;

/** Counts fixed by specs/v1.md §4.4, not left to the author's memory. */
const REQUIRED_COUNTS: Record<string, { field: string; value: number }> = {
  dayCards: { field: 'count', value: 3 },
  weekTiles: { field: 'count', value: 7 },
  buildFace: { field: 'numerals', value: 12 },
  fivesRing: { field: 'to', value: 60 },
};

const TASKS: readonly Task[] = ['order', 'choose', 'read', 'set', 'build', 'tap'];

/**
 * Reveal order ranks the NUMBER OF HANDS on the face, not whether the minute hand moves.
 * The first version of this ranked hour < parked < both, which conflated the two: a legitimate
 * hour → parked → both sequence looked like two reveals, and both → parked looked like a
 * re-conceal (review of PR #3, M2). With hand counts, "at most one reveal per tier" is a
 * consequence of monotonicity rather than a separate clause needing its own counter.
 */
const HAND_COUNT: Record<RepKey, number> = {
  none: 0,
  numerals: 0,
  'numerals+labels': 0,
  build: 0,
  hour: 1,
  parked: 2,
  both: 2,
};

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);
const isFaceless = (kind: string): kind is FacelessKind =>
  (FACELESS_KINDS as readonly string[]).includes(kind);

export interface ValidateOptions {
  /**
   * Known audio keys. When omitted, rule 7 is SKIPPED rather than approximated with a regex —
   * a stub that looks like a check is worse than an honest gap (review of PR #3, minor).
   */
  audioKeys?: ReadonlySet<string>;
}

/** Shape check. Returns only the levels that are safe to run rules over, plus every shape violation. */
export function parseLevelsFile(raw: unknown): { levels: Level[]; violations: Violation[] } {
  const violations: Violation[] = [];
  const levels: Level[] = [];
  const fail = (rule: number, levelId: string, message: string) =>
    violations.push({ rule, levelId, message });

  const file: Record<string, unknown> = isObject(raw) ? raw : {};
  const rawLevels = Array.isArray(file.levels) ? file.levels : [];
  if (rawLevels.length === 0) fail(1, '<file>', 'no levels array found');

  rawLevels.forEach((entry, index) => {
    if (!isObject(entry)) {
      fail(1, `#${index}`, 'level is not an object');
      return;
    }
    const id = typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : `#${index}`;
    let ok = true;
    const bad = (rule: number, message: string) => {
      fail(rule, id, message);
      ok = false;
    };

    // rule 1 — identity
    if (typeof entry.id !== 'string' || entry.id.length === 0) bad(1, 'missing id');
    if (!isInt(entry.tier) || entry.tier < 0 || entry.tier > 6) bad(1, 'tier must be an integer 0–6');

    // rule 2 — the round
    if (!Array.isArray(entry.round) || entry.round.length === 0) {
      bad(2, 'round missing or empty');
    } else {
      entry.round.forEach((step: unknown, j: number) => {
        if (
          !isObject(step) ||
          !TASKS.includes(step.task as Task) ||
          !isInt(step.items) ||
          (step.items as number) < 1
        ) {
          bad(2, `round[${j}] must be {task: ${TASKS.join('|')}, items: integer ≥ 1}`);
        }
      });
    }

    // rule 4 — every time value in the file
    if (entry.minutes !== undefined && !Array.isArray(entry.minutes)) {
      bad(4, 'minutes must be an array when present');
    }
    if (!isObject(entry.badge) || !Array.isArray(entry.badge.time)) {
      bad(4, 'badge.time must be [hour, minute]');
    } else {
      const [hour, minute] = entry.badge.time as unknown[];
      if (!isInt(hour) || hour < 1 || hour > 12) bad(4, `badge hour ${String(hour)} outside 1–12`);
      if (!isInt(minute) || minute < 0 || minute > 59) {
        bad(4, `badge minute ${String(minute)} outside 0–59`);
      }
    }

    // rule 5 — content shape
    if (!isObject(entry.content) || typeof entry.content.kind !== 'string') {
      bad(5, 'content.kind missing');
    }

    // rule 6 — face presence, judgeable from shape alone
    const kind = isObject(entry.content) && typeof entry.content.kind === 'string' ? entry.content.kind : '';
    if (isFaceless(kind) && entry.face !== undefined) bad(6, 'faceless content must not declare a face');
    if (!isFaceless(kind) && !isObject(entry.face)) bad(6, 'a level that draws a face must declare one');

    // rule 8 — the declaration
    if (!isObject(entry.knobs) || typeof entry.knobs.rep !== 'string' || typeof entry.knobs.task !== 'string') {
      bad(8, 'knobs {rep, task} missing — a level with no declaration cannot be checked');
    }

    if (ok) levels.push(entry as unknown as Level);
  });

  return { levels, violations };
}

/**
 * The only entry point a caller should use: shape, then rules, in one list of violations.
 * `validateLevels` alone cannot see a face declared on faceless content — that is caught while
 * parsing — so exposing the two halves separately invites a caller to check half the rules.
 */
export function checkLevelsFile(raw: unknown, options: ValidateOptions = {}): Violation[] {
  const { levels, violations } = parseLevelsFile(raw);
  return [...violations, ...validateLevels(levels, options)];
}

export const PARSED = parseLevelsFile(levelsJson as unknown);
export const LEVELS: Level[] = PARSED.levels;

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
  const face: Face | undefined = level.face;
  if (!face) return 'none';
  if (face.hands === 'none') return face.minuteLabels ? 'numerals+labels' : 'numerals';
  if (face.hands === 'hour') return 'hour';
  return face.minuteHandParked ? 'parked' : 'both';
}

/** Every time a clock level can present, in play order. */
export function clockTimes(level: Level): Array<{ hour: number; minute: number }> {
  if (level.content.kind !== 'clock') return [];
  const hours = level.hours ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const minutes = level.minutes ?? [];
  const out: Array<{ hour: number; minute: number }> = [];
  for (const hour of hours) for (const minute of minutes) out.push({ hour, minute });
  return out;
}

/** Rules 1–8. Returns every violation found, not just the first. */
export function validateLevels(levels: readonly Level[] = LEVELS, options: ValidateOptions = {}): Violation[] {
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
    if (tier !== i) fail(1, `tier ${tier}`, `tiers must be contiguous from 0; found ${tiers.join(',')}`);
  });
  for (const tier of [0, 1, 2, 3, 4] as const) {
    if (!levels.some((l) => l.tier === tier)) fail(1, `tier ${tier}`, 'tier has no levels');
  }

  for (const level of levels) {
    const items = itemsPerRound(level);

    // ---- rule 2: round length in [3, 12] ----
    if (!Number.isInteger(items) || items < 3 || items > 12) {
      fail(2, level.id, `round length ${items} outside [3, 12]`);
    }

    // ---- rule 3: every read step precedes every set step ----
    const taskOrder = level.round.map((s) => s.task);
    const lastRead = taskOrder.lastIndexOf('read');
    const firstSet = taskOrder.indexOf('set');
    if (lastRead !== -1 && firstSet !== -1 && lastRead > firstSet) {
      fail(3, level.id, 'a read step comes after a set step; reading must come first');
    }

    // ---- rule 4: time values, and only clock levels carry them ----
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
    } else if (level.minutes !== undefined || level.hours !== undefined) {
      fail(4, level.id, 'only clock levels may declare minutes or hours');
    }

    // ---- rule 5: distinct content, per kind, with the counts §4.4 fixes ----
    const kind = level.content.kind;
    if (kind === 'clock') {
      const distinct = clockTimes(level).length;
      const needed = Math.min(4, items);
      if (distinct < needed) {
        fail(5, level.id, `only ${distinct} distinct times for a ${items}-item round (needs ${needed})`);
      }
    } else {
      const required = REQUIRED_COUNTS[kind];
      if (required) {
        const actual = (level.content as unknown as Record<string, unknown>)[required.field];
        if (actual !== required.value) {
          fail(5, level.id, `${kind}.${required.field} must be ${required.value}, found ${String(actual)}`);
        }
      }
      if (kind === 'numberOrder') {
        const c = level.content as Extract<Level['content'], { kind: 'numberOrder' }>;
        if (c.from !== 1 || c.to !== 12) fail(5, level.id, 'numberOrder must run 1–12');
      }
      if (kind === 'durationPair' && items < 2) {
        fail(5, level.id, `durationPair needs ≥2 distinct event pairs; round has ${items} items`);
      }
      if (kind === 'dayStrip' && items < 2) {
        fail(5, level.id, `choose level needs ≥2 distinct option-sets; round has ${items} items`);
      }
    }

    // ---- rule 6: content ↔ face consistency ----
    const face = level.face;
    if (face) {
      const hands = face.hands;
      if (hands === 'none' && (taskOrder.includes('read') || taskOrder.includes('set'))) {
        fail(6, level.id, 'hands:none cannot carry read or set steps');
      }
      if (hands === 'hour' && taskOrder.includes('set') && (level.minutes ?? []).length !== 1) {
        fail(6, level.id, 'hands:hour set step needs a single fixed minute');
      }
      for (const field of RESERVED_FACE_FIELDS) {
        if (face[field]) fail(6, level.id, `${field} is reserved for T5+; keep it false in v1`);
      }
      if (face.minuteLabels && hands !== 'none') {
        fail(6, level.id, 'minuteLabels belongs to the numerals-only face (T1), not a two-hand face');
      }
    }

    // ---- rule 7: audio keys, checked only against a real manifest ----
    const declared = (level as Level & { audioKey?: string }).audioKey;
    if (declared !== undefined && options.audioKeys !== undefined && !options.audioKeys.has(declared)) {
      fail(7, level.id, `audio key ${declared} is not in the manifest`);
    }

    // ---- rule 8 (i): the declared triple matches the config ----
    const rep = derivedRep(level);
    if (level.knobs.rep !== rep) {
      fail(8, level.id, `declared rep ${level.knobs.rep} but the config derives ${rep}`);
    }
    if (level.knobs.task !== taskKey(level)) {
      fail(8, level.id, `declared task ${level.knobs.task} but the round is ${taskKey(level)}`);
    }
  }

  // ---- rule 8 (ii): within T2–T4 the number of hands is non-decreasing ----
  for (const tier of [2, 3, 4] as const) {
    let previous: number | undefined;
    for (const level of levels.filter((l) => l.tier === tier)) {
      const hands = HAND_COUNT[derivedRep(level)];
      if (hands === 0) continue; // not a clock-reading face
      if (previous !== undefined && hands < previous) {
        fail(8, level.id, 'the face is re-concealed within a tier; it may only be revealed');
      }
      previous = hands;
    }
  }

  return v;
}
