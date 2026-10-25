import { describe, expect, it } from 'vitest';

import {
  angleGap,
  dialAngle,
  judgePlacement,
  settledHourAngle,
  snapHour,
  snapMinute,
  toDialPoint,
  withinTolerance,
} from '../src/setHands';

const rect = { left: 10, top: 20, width: 200, height: 200 };
const ALLOWED = [0, 15, 30, 45];

describe('where a finger is', () => {
  it('maps a screen point onto the dial whatever size it is drawn at', () => {
    // the centre of a 200px dial offset by (10,20) is the dial's (50,50)
    expect(toDialPoint({ x: 110, y: 120 }, rect)).toEqual({ x: 50, y: 50 });
    // and the top edge is 12 o'clock
    expect(toDialPoint({ x: 110, y: 20 }, rect)).toEqual({ x: 50, y: 0 });
  });

  it('reads angles clockwise from twelve', () => {
    expect(dialAngle({ x: 50, y: 10 })).toBeCloseTo(0);    // 12
    expect(dialAngle({ x: 90, y: 50 })).toBeCloseTo(90);   // 3
    expect(dialAngle({ x: 50, y: 90 })).toBeCloseTo(180);  // 6
    expect(dialAngle({ x: 10, y: 50 })).toBeCloseTo(270);  // 9
  });

  it('measures the short way round', () => {
    expect(angleGap(359, 1)).toBeCloseTo(2);
    expect(angleGap(10, 350)).toBeCloseTo(20);
    expect(angleGap(90, 90)).toBe(0);
  });
});

describe('where a hand settles', () => {
  it('snaps the minute hand to the level grid, not to the nearest degree', () => {
    expect(snapMinute(88, ALLOWED)).toBe(15);   // just shy of the 3-minute mark at 90°
    expect(snapMinute(2, ALLOWED)).toBe(0);
    expect(snapMinute(268, ALLOWED)).toBe(45);  // just shy of the 9-minute mark at 270°
    expect(snapMinute(47, ALLOWED)).toBe(15);   // between 0° and 90°, nearer 90°
  });

  it('snaps the hour hand to the numeral the finger is nearest', () => {
    expect(snapHour(0)).toBe(12);
    expect(snapHour(89)).toBe(3);
    expect(snapHour(92)).toBe(3);
    expect(snapHour(359)).toBe(12);
  });

  it('gears the hour hand to the minutes once the child lets go', () => {
    // AC-15: half past three means halfway between 3 and 4, wherever the finger stopped
    expect(settledHourAngle(3, 30)).toBeCloseTo(105);
    expect(settledHourAngle(3, 0)).toBeCloseTo(90);
    expect(settledHourAngle(12, 30)).toBeCloseTo(15);
  });
});

describe('whether the child got there', () => {
  it('judges the hands the child chose, not the pixels', () => {
    expect(judgePlacement({ hour: 3, minute: 30 }, { hour: 3, minute: 30 })).toBe(true);
    expect(judgePlacement({ hour: 3, minute: 30 }, { hour: 4, minute: 30 })).toBe(false);
    expect(judgePlacement({ hour: 3, minute: 30 }, { hour: 3, minute: 0 })).toBe(false);
  });

  it('does not judge a hand the level never drew', () => {
    // o'clock levels draw the hour hand only: the minute cannot be wrong if it cannot be moved
    expect(judgePlacement({ hour: 4, minute: 0 }, { hour: 4, minute: 30 }, 'hour')).toBe(true);
    expect(judgePlacement({ hour: 4, minute: 0 }, { hour: 3, minute: 0 }, 'hour')).toBe(false);
  });

  it('still knows AC-14s three degrees, for a rung that does not snap', () => {
    expect(withinTolerance(31, 30)).toBe(true);
    expect(withinTolerance(34, 30)).toBe(false);
    expect(withinTolerance(1, 359)).toBe(true);  // across midnight
  });
});
