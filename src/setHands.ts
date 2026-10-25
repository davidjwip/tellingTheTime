/**
 * Setting the clock: where a finger points, and whether the child got there.
 *
 * The interaction is direct manipulation, so the arithmetic lives here rather than in the event handler:
 * a pointer is a position, a position is an angle, and an angle is a hand. Keeping that chain pure is
 * what lets it be tested without a real dial or a real finger.
 */

import { hourAngle } from './clock';

/** AC-14: a hand within this many degrees of the target counts. */
export const SET_TOLERANCE_DEGREES = 3;
export const DEGREES_PER_MINUTE = 6;
export const DEGREES_PER_HOUR = 30;

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where a pointer sits on the dial's 100-unit viewBox, whatever size the dial is drawn at. */
export function toDialPoint(client: Point, rect: Rect): Point {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: ((client.x - rect.left) / rect.width) * 100,
    y: ((client.y - rect.top) / rect.height) * 100,
  };
}

/** The angle of a point around the dial centre, clockwise from 12 o'clock. */
export function dialAngle(point: Point, centre: Point = { x: 50, y: 50 }): number {
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

/** The smaller distance between two angles, in degrees. 359° and 1° are 2° apart. */
export function angleGap(a: number, b: number): number {
  const gap = Math.abs(a - b) % 360;
  return gap > 180 ? 360 - gap : gap;
}

/** The minute a finger is closest to, on the grid this level allows. */
export function snapMinute(angle: number, allowed: readonly number[]): number {
  if (allowed.length === 0) return 0; // a level with no minutes is a validator error, not a runtime case
  let best = allowed[0]!;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const minute of allowed) {
    const gap = angleGap(angle, (minute * DEGREES_PER_MINUTE) % 360);
    if (gap < bestGap) {
      bestGap = gap;
      best = minute;
    }
  }
  return best;
}

/** The numeral a finger on the hour hand is closest to. */
export function snapHour(angle: number): number {
  const hour = Math.round((angle % 360) / DEGREES_PER_HOUR) % 12;
  return hour === 0 ? 12 : hour;
}

/**
 * Where the hour hand sits once the child lets go: geared to the minutes (AC-15). Dragging it anywhere
 * inside the 3 o'clock sector on a half-past level settles it at exactly halfway between 3 and 4.
 */
export function settledHourAngle(hour: number, minute: number): number {
  return hourAngle(hour, minute);
}

export interface Placement {
  hour: number;
  minute: number;
}

/**
 * Whether the child made the time. `hands` is what the level draws: at o'clock the minute hand is not on
 * the dial, so the child is not judged on a hand he cannot see.
 */
export function judgePlacement(
  target: Placement,
  placed: Placement,
  hands: 'hour' | 'both' = 'both',
): boolean {
  if (placed.hour !== target.hour) return false;
  return hands === 'hour' ? true : placed.minute === target.minute;
}

/**
 * AC-14's tolerance, for a level that allows a minute no grid can snap to. Every level today snaps to
 * its own five-minute grid first, so this is the rule the next rung will need rather than dead code:
 * it is tested, and the tests are what keep it honest.
 */
export function withinTolerance(placedAngle: number, targetAngle: number): boolean {
  return angleGap(placedAngle, targetAngle) <= SET_TOLERANCE_DEGREES;
}
