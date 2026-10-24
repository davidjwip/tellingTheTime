import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { FACE_COLOURS, formatDigital, renderFace } from '../src/clockFace';
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

  it('holds the minute hand at 12 when it is parked, and only then', () => {
    // A parked hand at minute 0 is indistinguishable from an unparked one, so this test used to
    // pass with the parked feature deleted. At :30 the two cannot be confused.
    const parked = renderFace({ hour: 6, minute: 30 }, baseFace({ minuteHandParked: true }));
    expect(rotationOf(hand(parked, 'minute'))).toBeCloseTo(0, 2);
    expect(rotationOf(hand(parked, 'hour'))).toBeCloseTo(195, 2); // 6.5 -> 195 deg, still geared

    const moving = renderFace({ hour: 6, minute: 30 }, baseFace({ minuteHandParked: false }));
    expect(rotationOf(hand(moving, 'minute'))).toBeCloseTo(180, 2);
  });

  it('rotates each hand about the centre, not about the origin', () => {
    const svg = renderFace({ hour: 4, minute: 20 }, baseFace());
    for (const which of ['hour', 'minute'] as const) {
      expect(hand(svg, which)?.getAttribute('transform')).toMatch(/rotate\([-\d.]+ 50 50\)/);
    }
  });

  it('draws the hands at the ratios the parity contract fixes, measured from the geometry', () => {
    // measured from y2 rather than from a data attribute the renderer reports about itself
    const svg = renderFace({ hour: 3, minute: 15 }, baseFace());
    const reach = (which: 'hour' | 'minute') => {
      const y2 = Number(hand(svg, which)?.getAttribute('y2'));
      return 50 - y2; // the dial centre is 50 on a 100-unit viewBox
    };
    expect(reach('hour') / 46).toBeCloseTo(0.46, 2);
    expect(reach('minute') / 46).toBeCloseTo(0.7, 2);
    expect(reach('hour')).toBeLessThan(reach('minute'));
  });

  it('strokes with currentColor, taking the colour from the palette', () => {
    const svg = renderFace({ hour: 3, minute: 15 }, baseFace());
    for (const which of ['hour', 'minute'] as const) {
      expect(hand(svg, which)?.getAttribute('stroke')).toBe('currentColor');
    }
    expect(hand(svg, 'hour')?.getAttribute('style')).toContain('#ff6b6b');
    expect(hand(svg, 'minute')?.getAttribute('style')).toContain('#333');
  });

  it('reaches the 5-minute ring with the hand that is read against it', () => {
    const ringing = renderFace({ hour: 3, minute: 20 }, { ...baseFace(), hands: 'both', minuteLabels: true });
    const plain = renderFace({ hour: 3, minute: 20 }, { ...baseFace(), hands: 'both', minuteLabels: false });

    const reach = (svg: SVGSVGElement): number => 50 - Number(hand(svg, 'minute')?.getAttribute('y2'));
    const label = ringing.querySelector('[data-minute-label="true"]');
    // the radius of the ring, measured from where a label actually sits
    const ringRadius = Math.hypot(
      Number(label?.getAttribute('x')) - 50,
      Number(label?.getAttribute('y')) - 50,
    );

    // a hand of 33 units stops well short of a ring at 43: it would point at nothing
    expect(reach(plain)).toBeLessThan(ringRadius - 5);
    expect(reach(ringing)).toBeGreaterThanOrEqual(ringRadius - 3);
  });

  it('sets the ring in a size a four-year-old can read', () => {
    const svg = renderFace({ hour: 3, minute: 20 }, { ...baseFace(), hands: 'both', minuteLabels: true });
    const label = svg.querySelector('[data-minute-label="true"]');
    const numeral = svg.querySelector('[data-numeral]');
    const size = Number(label?.getAttribute('font-size'));
    // it is a ring the child is asked to read, not a footnote under the numerals
    expect(size).toBeGreaterThanOrEqual(5);
    expect(size).toBeGreaterThanOrEqual(Number(numeral?.getAttribute('font-size')) * 0.5);
  });

  it('draws only colours the parity contract names, so the palette cannot drift', () => {
    const contract = readFileSync('specs/design-parity.md', 'utf8');
    for (const [role, value] of Object.entries(FACE_COLOURS)) {
      expect(contract, `${role} = ${value} is not in the parity contract`).toContain(value);
    }
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

  it('draws two distinguishable past/to halves when pastToShade is set', () => {
    const svg = renderFace({ hour: 12, minute: 0 }, baseFace({ pastToShade: true }));
    const shades = [...svg.querySelectorAll('[data-pastto-shade]')];
    expect(shades.map((n) => n.getAttribute('data-pastto-shade')).sort()).toEqual(['past', 'to']);
    // a tint of the cream frame would be invisible on a cream face
    for (const shade of shades) {
      expect(shade.getAttribute('fill')).not.toBe(FACE_COLOURS.dial);
    }
  });

  it('names the time for a screen reader', () => {
    const svg = renderFace({ hour: 3, minute: 30 }, baseFace());
    expect(svg.getAttribute('aria-label')).toBe('Clock showing 3:30');
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
