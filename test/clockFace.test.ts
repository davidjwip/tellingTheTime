import { describe, expect, it } from 'vitest';

import { formatDigital, renderFace } from '../src/clockFace';
import type { Face } from '../src/types';

/**
 * AC-04 and the rendering half of §4.3/§4.4 — the SVG face.
 *
 * These run under happy-dom because AC-04 is a claim about what is *in the DOM*: "an hour-only
 * level renders no minute hand" cannot be checked against a string that mentions one.
 */

const baseFace = (over: Partial<Face> = {}): Face => ({
  hands: 'both',
  minuteHandParked: false,
  numerals: true,
  minuteMarks: false,
  minuteLabels: false,
  pastToShade: false,
  showDigital: false,
  ...over,
});

const hand = (svg: SVGSVGElement, which: 'hour' | 'minute') =>
  svg.querySelector(`[data-hand="${which}"]`);

/** Rotation in degrees, read back out of the transform attribute. */
const rotationOf = (el: Element | null): number => {
  const transform = el?.getAttribute('transform') ?? '';
  const match = /rotate\(([-\d.]+)/.exec(transform);
  if (!match) throw new Error(`no rotation in ${JSON.stringify(transform)}`);
  return Number(match[1]);
};

describe('AC-04 — an hour-only face renders no minute hand', () => {
  it('has no minute hand, no minute marks and no minute labels', () => {
    const svg = renderFace({ hour: 3, minute: 0 }, baseFace({ hands: 'hour' }));
    expect(hand(svg, 'minute')).toBeNull();
    expect(svg.querySelectorAll('[data-minute-mark]')).toHaveLength(0);
    expect(svg.querySelectorAll('[data-minute-label]')).toHaveLength(0);
  });

  it('still has the hour hand and the numerals', () => {
    const svg = renderFace({ hour: 3, minute: 0 }, baseFace({ hands: 'hour' }));
    expect(hand(svg, 'hour')).not.toBeNull();
    expect(svg.querySelectorAll('[data-numeral]')).toHaveLength(12);
  });

  it('hands:none renders neither hand — the T1 numerals-only face', () => {
    const svg = renderFace({ hour: 3, minute: 0 }, baseFace({ hands: 'none' }));
    expect(hand(svg, 'hour')).toBeNull();
    expect(hand(svg, 'minute')).toBeNull();
    expect(svg.querySelectorAll('[data-numeral]')).toHaveLength(12);
  });
});

describe('the hands carry the geometry from clock.ts', () => {
  it('puts the hour hand at 105° and the minute hand at 180° for 3:30', () => {
    const svg = renderFace({ hour: 3, minute: 30 }, baseFace());
    expect(rotationOf(hand(svg, 'hour'))).toBeCloseTo(105, 2);
    expect(rotationOf(hand(svg, 'minute'))).toBeCloseTo(180, 2);
  });

  it('puts the hour hand past the 12 at half past twelve', () => {
    const svg = renderFace({ hour: 12, minute: 30 }, baseFace());
    expect(rotationOf(hand(svg, 'hour'))).toBeCloseTo(15, 2);
  });

  it('holds the minute hand at 12 when it is parked', () => {
    const svg = renderFace({ hour: 6, minute: 0 }, baseFace({ minuteHandParked: true }));
    expect(rotationOf(hand(svg, 'minute'))).toBeCloseTo(0, 2);
    expect(rotationOf(hand(svg, 'hour'))).toBeCloseTo(180, 2);
  });

  it('draws the hour hand shorter than the minute hand', () => {
    const svg = renderFace({ hour: 3, minute: 15 }, baseFace());
    const length = (which: 'hour' | 'minute') =>
      Number(hand(svg, which)?.getAttribute('data-length'));
    expect(length('hour')).toBeGreaterThan(0);
    expect(length('hour')).toBeLessThan(length('minute'));
  });

  it('uses the palette from the parity contract: red hour, dark minute', () => {
    const svg = renderFace({ hour: 3, minute: 15 }, baseFace());
    expect(hand(svg, 'hour')?.getAttribute('stroke')?.toLowerCase()).toBe('#ff6b6b');
    expect(hand(svg, 'minute')?.getAttribute('stroke')?.toLowerCase()).toBe('#333333');
  });
});

describe('the face honours its own config', () => {
  it('omits the numerals when numerals is false — the build-the-face level', () => {
    const svg = renderFace({ hour: 12, minute: 0 }, baseFace({ numerals: false }));
    expect(svg.querySelectorAll('[data-numeral]')).toHaveLength(0);
  });

  it('draws the 5, 10 … 60 ring when minuteLabels is set', () => {
    const svg = renderFace({ hour: 12, minute: 0 }, baseFace({ hands: 'none', minuteLabels: true }));
    const labels = [...svg.querySelectorAll('[data-minute-label]')].map((el) => el.textContent);
    expect(labels).toHaveLength(12);
    expect(labels).toContain('5');
    expect(labels).toContain('60');
  });

  it('draws no minute marks or shading in v1, where those fields are reserved', () => {
    const svg = renderFace({ hour: 12, minute: 0 }, baseFace());
    expect(svg.querySelectorAll('[data-minute-mark]')).toHaveLength(0);
    expect(svg.querySelectorAll('[data-pastto-shade]')).toHaveLength(0);
  });

  it('is an SVG element with a square viewBox, so CSS can size it', () => {
    const svg = renderFace({ hour: 3, minute: 30 }, baseFace());
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 100 100');
  });
});

/**
 * The reserved T5/T6 paths. v1 data must keep these off (rule 6), but the renderer still has to be
 * correct for the tiers that will use them — untested code that ships later is how a T5 release
 * breaks the moment it is switched on.
 */
describe('the reserved paths, exercised directly', () => {
  it('draws 60 minute ticks when minuteMarks is set', () => {
    const svg = renderFace({ hour: 12, minute: 0 }, baseFace({ minuteMarks: true }));
    expect(svg.querySelectorAll('[data-minute-mark]')).toHaveLength(60);
  });

  it('draws the two past/to halves when pastToShade is set', () => {
    const svg = renderFace({ hour: 12, minute: 0 }, baseFace({ pastToShade: true }));
    const shades = [...svg.querySelectorAll('[data-pastto-shade]')].map((n) => n.getAttribute('data-pastto-shade'));
    expect(shades.sort()).toEqual(['past', 'to']);
  });

  it('writes a digital readout when showDigital is set', () => {
    const svg = renderFace({ hour: 7, minute: 43 }, baseFace({ showDigital: true }));
    expect(svg.querySelector('[data-digital]')?.textContent).toBe('7:43');
  });

  it('formats twelve- and twenty-four-hour times', () => {
    expect(formatDigital({ hour: 3, minute: 5 })).toBe('3:05');
    expect(formatDigital({ hour: 0, minute: 0 })).toBe('12:00');
    expect(formatDigital({ hour: 12, minute: 30 })).toBe('12:30');
    expect(formatDigital({ hour: 15, minute: 30 }, true)).toBe('15:30');
    expect(formatDigital({ hour: 7, minute: 43 }, true)).toBe('07:43');
  });
});
