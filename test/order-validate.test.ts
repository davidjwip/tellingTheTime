import { describe, expect, it } from 'vitest';

import { orderFor, renderOrder } from '../src/order';

const lcg = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
};

/**
 * renderOrder takes the placed row from outside, so it treats it like any other untrusted input.
 * Neither case is reachable through the tap handler today; both are reachable through the exported
 * function, and an unknown id would otherwise leave a slot permanently empty.
 */
describe('renderOrder validates the placed row', () => {
  const deal = () => {
    const dealt = orderFor({ kind: 'weekTiles' } as never, undefined, lcg(1));
    expect(dealt).toBeDefined();
    const cards = dealt!.cards;
    return { cards, order: dealt!.answer, item: { task: 'order' as const, key: 'k', cards, order: dealt!.answer } };
  };

  it('ignores an id that is not one of the cards', () => {
    const { item, cards } = deal();
    const element = renderOrder(item as never, ['not-a-card']);
    // every card is still renderable: six in the pool, none lost to a phantom slot
    expect(element.querySelectorAll('[data-card]')).toHaveLength(cards.length);
    expect(element.querySelectorAll('.order-slot [data-card]')).toHaveLength(0);
  });

  it('does not let one card fill two slots', () => {
    const { item, cards } = deal();
    const first = cards[0]!.id;
    const element = renderOrder(item as never, [first, first]);
    expect(element.querySelectorAll('.order-slot [data-card]')).toHaveLength(1);
    expect(element.querySelectorAll('[data-card]')).toHaveLength(cards.length);
  });
});
