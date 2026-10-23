import { beforeEach, describe, expect, it } from 'vitest';

import { LEVELS } from '../src/levels';
import { mountPlay } from '../src/play';

import type { Level } from '../src/types';

let app: HTMLElement;
let overlayRoot: HTMLElement;

const level = (id: string): Level => {
  const found = LEVELS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no level ${id}`);
  return found;
};

beforeEach(() => {
  document.body.replaceChildren();
  app = document.createElement('div');
  overlayRoot = document.createElement('div');
  document.body.append(app, overlayRoot);
});

const tapAt = (element: Element, x = 100, y = 300): void => {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
};

describe('a bounced tap on an order card', () => {
  it('does not place a second card, because the pool reflowed under the finger', () => {
    mountPlay(app, overlayRoot, level('t0.1'));

    const first = app.querySelector('[data-card]');
    expect(first).not.toBeNull();
    tapAt(first!);

    // the same physical spot, moments later: the DOM has reflowed, so this lands on a different card
    const under = app.querySelector('[data-card]');
    tapAt(under!);

    expect(app.querySelectorAll('.order-slot [data-card]')).toHaveLength(1);
  });

  it('does accept a tap somewhere else, because that is not a bounce', () => {
    mountPlay(app, overlayRoot, level('t0.1'));

    tapAt(app.querySelector('[data-card]')!, 100, 300);
    tapAt(app.querySelector('[data-card]')!, 400, 500);

    expect(app.querySelectorAll('.order-slot [data-card]')).toHaveLength(2);
  });
});
