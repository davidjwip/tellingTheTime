/**
 * Level data types — the shape `src/levels.json` must have.
 *
 * These are compile-time shapes only. Everything that makes a level *valid* (ordering, distinctness,
 * the declared-knob rule) is a runtime rule in `levels.ts`, because no type system can express
 * "the read steps come before the set steps" over an array of objects.
 */

export type Task = 'order' | 'choose' | 'read' | 'set' | 'build' | 'tap';

/** What the level presents. `clock` means times come from `hours`/`minutes`. */
export type Content =
  | { kind: 'dayCards'; count: number }
  | { kind: 'dayStrip' }
  | { kind: 'durationPair' }
  | { kind: 'weekTiles'; count: number; numbered?: boolean }
  | { kind: 'numberOrder'; from: number; to: number }
  | { kind: 'wrap' }
  | { kind: 'fivesRing'; to: number }
  | { kind: 'buildFace'; numerals: number }
  | { kind: 'clock' };

export interface RoundStep {
  /** What one item *is* depends on the task: one time for read/set, one full ordering for order,
   *  one complete lap for tap, one complete face for build. See specs/v1.md §4.2. */
  task: Task;
  items: number;
}

export interface Face {
  hands: 'none' | 'hour' | 'both';
  /** Drawn at 12 and never moves (t2.4). */
  minuteHandParked: boolean;
  numerals: boolean;
  /** Reserved: T5+ only. */
  minuteMarks: boolean;
  /** The 5 / 10 / 15 … ring. */
  minuteLabels: boolean;
  /** Reserved: T5+ only. */
  pastToShade: boolean;
  /** Reserved: T6 only. */
  showDigital: boolean;
}

/** Canonical representation keys — what the face actually reveals, for the declared-knob rule. */
export type RepKey = 'none' | 'numerals' | 'numerals+labels' | 'build' | 'hour' | 'parked' | 'both';

export interface Level {
  id: string;
  tier: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  title: { en: string; yue?: string };
  round: RoundStep[];
  content: Content;
  /** Clock levels only; always multiples of 5 in v1. */
  minutes?: number[];
  /** Optional subset; defaults to 1–12. */
  hours?: number[];
  /** Present whenever the level draws a face — including T1, which draws numerals with no hands. */
  face?: Face;
  preview?: 'quarterTurn';
  badge: { time: [number, number] };
  /** The declared triple the validator checks against the config. */
  knobs: { rep: RepKey; task: string };
}

export interface LevelsFile {
  version: number;
  levels: Level[];
}

/** One broken rule, named by rule number and level id so the fix is obvious. */
export interface Violation {
  rule: number;
  levelId: string;
  message: string;
}
