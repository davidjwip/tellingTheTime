/**
 * Clock geometry — the invariant from specs/v1.md §4.3.
 *
 * Two hands, two units, and one rule that must never be broken: **the hour hand is geared.** It
 * creeps continuously with the minutes; it is never snapped to a numeral. A snapped hour hand
 * teaches the central misconception this whole app exists to avoid — that at half past the hand
 * should sit *on* a number rather than halfway between two.
 *
 * Angles are in degrees clockwise from the 12 o'clock position, because that is how an SVG face is
 * drawn: 0° is up, 90° is the 3, 180° is the 6.
 *
 * Contract: `hour` is an integer 0–23 (24-hour input wraps at 12), `minute` an integer 0–59. The
 * functions do not clamp — an out-of-range value extrapolates rather than throwing, so the caller
 * owns the range. The level data and the renderer both derive their values from validated levels,
 * which is where the guarantee is enforced.
 */

const DEGREES_PER_MINUTE = 6; // the minute hand: 360° / 60
const DEGREES_PER_HOUR = 30; // a numeral per hour: 360° / 12
const DEGREES_CREEP_PER_MINUTE = 0.5; // the hour hand's share of one minute: 30° / 60

/** Angle of the minute hand. `minute` is 0–59. */
export function minuteAngle(minute: number): number {
  return minute * DEGREES_PER_MINUTE;
}

/**
 * Angle of the hour hand. `hour` may be 0–23 (24-hour input wraps); `minute` is 0–59.
 *
 * 3:30 → 105°, exactly halfway between the 3 (90°) and the 4 (120°).
 * 12:30 → 15°, already past the 12 — which is why half past twelve reads as *twelve*, not one.
 */
export function hourAngle(hour: number, minute: number): number {
  return (hour % 12) * DEGREES_PER_HOUR + minute * DEGREES_CREEP_PER_MINUTE;
}
