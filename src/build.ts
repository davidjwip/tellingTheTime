/** Building a clock face: where each numeral belongs, and whether the result is a face.
 *
 * Pure on purpose. The drag itself is a finger on a dial; the arithmetic that decides what counts
 * as built is here, where it can be tested without a dial or a finger.
 */

/** How far a numeral may sit from its own place and still count. B6. */
export const BUILD_TOLERANCE_DEGREES = 12;

/** How many numerals must be right for the build to pass. B6. */
export const BUILD_PASS_COUNT = 10;

export interface Placement {
  numeral: number;
  /** Where on the dial the child put it, in degrees clockwise from the top. */
  angle: number;
}

/** Twelve at the top, then clockwise: 1 at 30, 3 at 90, 6 at 180. */
export function idealAngle(numeral: number): number {
  return (numeral % 12) * 30;
}

/** The short way round: 354 and 0 are six degrees apart, not 354. */
function gap(a: number, b: number): number {
  const raw = Math.abs(((a - b) % 360 + 360) % 360);
  return raw > 180 ? 360 - raw : raw;
}

export interface BuildResult {
  /** How many numerals are on the face at all. */
  placed: number;
  /** How many are within tolerance of their own place. */
  good: number;
  /** Whether the face counts as built. */
  pass: boolean;
}

export function judgeBuild(placements: readonly Placement[]): BuildResult {
  const good = placements.filter(
    (placement) => gap(placement.angle, idealAngle(placement.numeral)) <= BUILD_TOLERANCE_DEGREES,
  ).length;
  return { placed: placements.length, good, pass: good >= BUILD_PASS_COUNT };
}
