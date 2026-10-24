/**
 * The SVG clock face.
 *
 * Deliberately a plain function returning an element rather than a component: it takes a time and a
 * face config, and the config is the only thing that decides what appears. AC-04 ("an hour-only
 * level renders no minute hand") is a claim about the DOM, so the tests run under happy-dom and ask
 * the DOM, not a string.
 *
 * Geometry comes from `clock.ts` — the hour hand creeps, it never snaps. This module does not
 * compute angles of its own.
 *
 * Colours are the parity contract's palette (specs/design-parity.md §4.2): the face sits on the
 * cream `#fff9c4` frame with a 3px teal border, supplied by CSS. Here we only draw what is inside.
 */

import { hourAngle, minuteAngle } from './clock';

import type { Face } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';

const CENTRE = 50;
const DIAL_RADIUS = 46;
const NUMERAL_RADIUS = 36;
const LABEL_RADIUS = 43;
// Hand lengths as a fraction of the dial, per specs/design-parity.md §4.2 (0.46 / 0.70).
const HOUR_HAND_LENGTH = DIAL_RADIUS * 0.46;
const MINUTE_HAND_LENGTH = DIAL_RADIUS * 0.7;
/** A minute hand being read against the 5-minute ring has to reach it, or it points at nothing. */
const MINUTE_HAND_TO_RING = LABEL_RADIUS - 1.5;

/** The parity palette. Both hand colours already exist in the reference stylesheet. */
export const FACE_COLOURS = {
  hour: '#ff6b6b',
  minute: '#333',
  numeral: '#333',
  label: '#4b5563',
  dial: '#fff',
} as const;

function el<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

/** Position on the dial for an angle in degrees clockwise from 12 o'clock. */
function pointAt(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTRE + radius * Math.sin(rad), y: CENTRE - radius * Math.cos(rad) };
}

export interface ClockTime {
  hour: number;
  minute: number;
}

/** "3:30", or "07:43" in 24-hour form when asked. Used by the digital readout (T6). */
export function formatDigital(time: ClockTime, twentyFourHour = false): string {
  const hour = twentyFourHour ? time.hour % 24 : time.hour % 12 === 0 ? 12 : time.hour % 12;
  return `${twentyFourHour ? String(hour).padStart(2, '0') : hour}:${String(time.minute).padStart(2, '0')}`;
}

/**
 * Draw the face for `time` according to `face`.
 *
 * The order matters only for stacking: dial, marks, labels, numerals, hands, centre dot.
 */
export function renderFace(time: ClockTime, face: Face): SVGSVGElement {
  const svg = el('svg', {
    viewBox: '0 0 100 100',
    role: 'img',
    // the adult's screen reader is the only reader here; the child cannot read either way
    'aria-label': `Clock showing ${formatDigital(time)}`,
    'data-face': 'true',
  });

  svg.append(el('circle', { cx: CENTRE, cy: CENTRE, r: DIAL_RADIUS, fill: FACE_COLOURS.dial }));

  // Reserved for T5: 60 minute ticks. Never set in v1 data, but drawn if a level asks.
  if (face.minuteMarks) {
    for (let i = 0; i < 60; i += 1) {
      const outer = pointAt(i * 6, DIAL_RADIUS - 0.5);
      const inner = pointAt(i * 6, DIAL_RADIUS - (i % 5 === 0 ? 4 : 2.5));
      svg.append(
        el('line', {
          x1: inner.x,
          y1: inner.y,
          x2: outer.x,
          y2: outer.y,
          stroke: FACE_COLOURS.label,
          'stroke-width': i % 5 === 0 ? 0.8 : 0.4,
          'data-minute-mark': 'true',
        }),
      );
    }
  }

  // Reserved for T5: tint the past half and the to half. Two semicircles, drawn under the hands.
  if (face.pastToShade) {
    for (const side of ['past', 'to'] as const) {
      const start = side === 'past' ? 0 : 180;
      const a = pointAt(start, DIAL_RADIUS - 1);
      const b = pointAt(start + 180, DIAL_RADIUS - 1);
      svg.append(
        el('path', {
          d: `M ${CENTRE} ${CENTRE} L ${a.x} ${a.y} A ${DIAL_RADIUS - 1} ${DIAL_RADIUS - 1} 0 0 1 ${b.x} ${b.y} Z`,
          // both from the palette and both distinguishable from the cream dial; a tint of the
          // frame colour would be invisible, which is how the first version shipped
          fill: side === 'past' ? '#4ecdc4' : '#ff6b6b',
          'fill-opacity': side === 'past' ? 0.12 : 0.08,
          'data-pastto-shade': side,
        }),
      );
    }
  }

  // The 5 / 10 / 15 … ring, T1.3.
  if (face.minuteLabels) {
    for (let i = 0; i < 12; i += 1) {
      const { x, y } = pointAt(i * 30, LABEL_RADIUS);
      // A 4-year-old reads this ring, so it is not a footnote: larger type, and a stronger ink than
      // the tick marks it sits beside.
      const label = el('text', {
        x,
        y,
        'font-size': 5,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        fill: FACE_COLOURS.label,
        'data-minute-label': 'true',
        'data-value': i === 0 ? 60 : i * 5,
      });
      label.textContent = i === 0 ? '60' : String(i * 5);
      svg.append(label);
    }
  }

  if (face.numerals) {
    for (let i = 0; i < 12; i += 1) {
      const { x, y } = pointAt(i * 30, NUMERAL_RADIUS);
      const numeral = el('text', {
        x,
        y,
        'font-size': 9,
        'font-weight': 600,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        fill: FACE_COLOURS.numeral,
        'data-numeral': i === 0 ? 12 : i,
        'data-value': i === 0 ? 12 : i,
      });
      numeral.textContent = String(i === 0 ? 12 : i);
      svg.append(numeral);
    }
  }

  if (face.hands === 'hour' || face.hands === 'both') {
    const angle = hourAngle(time.hour, time.minute);
    svg.append(
      el('line', {
        x1: CENTRE,
        y1: CENTRE,
        x2: CENTRE,
        y2: CENTRE - HOUR_HAND_LENGTH,
        // currentColor, per the parity contract: the colour arrives as the CSS colour property, so
        // a stylesheet can override it and the token gate can see it. TODAY it is set inline from
        // FACE_COLOURS; it moves to a class when the play-screen stylesheet lands.
        stroke: 'currentColor',
        style: `color: ${FACE_COLOURS.hour}`,
        'stroke-width': 4.5,
        'stroke-linecap': 'round',
        transform: `rotate(${angle} ${CENTRE} ${CENTRE})`,
        'data-hand': 'hour',
        'data-length': HOUR_HAND_LENGTH,
      }),
    );
  }

  if (face.hands === 'both') {
    const minuteLength = face.minuteLabels ? MINUTE_HAND_TO_RING : MINUTE_HAND_LENGTH;
    // A parked minute hand is drawn at 12 and never moves — t2.4, where o'clock is secure and the
    // second hand's existence is the only new thing.
    const angle = face.minuteHandParked ? 0 : minuteAngle(time.minute);
    svg.append(
      el('line', {
        x1: CENTRE,
        y1: CENTRE,
        x2: CENTRE,
        y2: CENTRE - minuteLength,
        stroke: 'currentColor',
        style: `color: ${FACE_COLOURS.minute}`,
        'stroke-width': 2.5,
        'stroke-linecap': 'round',
        transform: `rotate(${angle} ${CENTRE} ${CENTRE})`,
        'data-hand': 'minute',
        'data-length': minuteLength,
      }),
    );
  }

  if (face.hands !== 'none') {
    svg.append(el('circle', { cx: CENTRE, cy: CENTRE, r: 2.2, fill: FACE_COLOURS.minute }));
  }

  // Reserved for T6: a digital readout beneath the dial.
  if (face.showDigital) {
    const digital = el('text', {
      x: CENTRE,
      y: 95,
      'font-size': 7,
      'text-anchor': 'middle',
      fill: FACE_COLOURS.numeral,
      'data-digital': 'true',
    });
    digital.textContent = formatDigital(time);
    svg.append(digital);
  }

  return svg;
}
