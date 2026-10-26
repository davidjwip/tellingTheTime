import { describe, expect, it } from 'vitest';

import { idealAngle, judgeBuild } from '../src/build';

describe('where a numeral belongs', () => {
  it('puts 12 at the top and counts clockwise', () => {
    expect(idealAngle(12)).toBe(0);
    expect(idealAngle(1)).toBe(30);
    expect(idealAngle(3)).toBe(90);
    expect(idealAngle(6)).toBe(180);
    expect(idealAngle(11)).toBe(330);
  });
});

describe('whether the face is built', () => {
  const place = (angles: Record<number, number>) =>
    Object.entries(angles).map(([numeral, angle]) => ({ numeral: Number(numeral), angle }));

  // AC-18 AC-79
  it('passes at ten of twelve within twelve degrees', () => {
    const all = place(Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, idealAngle(i + 1)])));
    expect(judgeBuild(all)).toEqual({ placed: 12, good: 12, pass: true });

    const ten = all.slice(0, 10);
    expect(judgeBuild(ten).pass).toBe(true); // ten right, two never placed: still a built face

    const nine = all.slice(0, 9);
    expect(judgeBuild(nine).pass).toBe(false);
  });

  // AC-79
  it('counts a slightly-off drop as good, and a numeral in the wrong slot as not', () => {
    const nearly = place({ 3: idealAngle(3) + 9 }); // 9 degrees off, inside the tolerance
    expect(judgeBuild(nearly).good).toBe(1);

    const wrongSlot = place({ 3: idealAngle(4) }); // placed on the four
    expect(judgeBuild(wrongSlot).good).toBe(0);
  });

  it('measures the short way round the dial', () => {
    // 12 dropped at 354 is 6 degrees away, not 354
    expect(judgeBuild(place({ 12: 354 })).good).toBe(1);
  });
});
