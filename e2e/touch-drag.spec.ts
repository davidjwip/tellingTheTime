import { expect, test } from '@playwright/test';

import { advanceTo, dialGeometry, pointAt, touchDrag } from './helpers';

/**
 * AC-71, in a real browser.
 *
 * happy-dom dispatches pointer events because a test told it to. Chromium decides for itself, honours
 * `touch-action`, and can steal a drag as a scroll. This is the only place that can tell the
 * difference.
 */
// AC-71
const onPhone = (name: string): boolean => name === 'phone';

test('a hand follows the mouse', async ({ page }, info) => {
  test.skip(onPhone(info.project.name), 'the mouse path is the desktop project; touch is covered below');
  await page.goto('/?level=t4.3');
  await advanceTo(page, '[data-grab="hour"]');

  const before = await page.locator('[data-hand="hour"]').getAttribute('transform');
  const { cx, cy, r } = await dialGeometry(page);

  const start = pointAt(cx, cy, r * 0.55, 0); // on the shaft, not the numeral it points at
  const end = pointAt(cx, cy, r, 300);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();

  const after = await page.locator('[data-hand="hour"]').getAttribute('transform');
  expect(after, 'the hour hand did not move with the pointer').not.toBe(before);

  // this level draws both hands, and Done waits for both: move the minute hand too
  const minuteStart = pointAt(cx, cy, r * 0.55, 0);
  const minuteEnd = pointAt(cx, cy, r, 135);
  await page.mouse.move(minuteStart.x, minuteStart.y);
  await page.mouse.down();
  await page.mouse.move(minuteEnd.x, minuteEnd.y, { steps: 10 });
  await page.mouse.up();

  // and Done becomes pressable only because something was moved
  await expect(page.locator('[data-action="done"]')).toBeEnabled();
});

test('a real touch drag moves a hand without scrolling the page', async ({ page }, info) => {
  // the dispatch below only produces pointer events in a touch-capable context
  test.skip(!onPhone(info.project.name), 'touch needs the phone project');
  await page.goto('/?level=t4.3');
  await advanceTo(page, '[data-grab="hour"]');
  await page.evaluate(() => window.scrollTo(0, 0));

  const { cx, cy, r } = await dialGeometry(page);
  const before = {
    hour: await page.locator('[data-hand="hour"]').getAttribute('transform'),
    minute: await page.locator('[data-hand="minute"]').getAttribute('transform'),
  };

  // both hands point at twelve, so either may be the one caught; what matters is that a hand moves
  await touchDrag(page, pointAt(cx, cy, r * 0.55, 0), pointAt(cx, cy, r * 0.55, 300));

  const after = {
    hour: await page.locator('[data-hand="hour"]').getAttribute('transform'),
    minute: await page.locator('[data-hand="minute"]').getAttribute('transform'),
  };
  expect(before.hour !== after.hour || before.minute !== after.minute, 'no hand followed the touch').toBe(
    true,
  );
  // The dial must claim the gesture. Proving that by watching the page scroll was vacuous: at this
  // viewport the screen fits, so nothing scrolls with or without the rule. What can be asserted is
  // the promise itself - and separately, that the hand moved, which is the behaviour it protects.
  const claimed = await page.evaluate(() => {
    const dial = document.querySelector('.set-frame svg') as SVGElement | null;
    return dial ? getComputedStyle(dial).touchAction : 'no dial';
  });
  expect(claimed, 'the dial does not claim the touch gesture').toBe('none');
});

test('the minute hand can be moved too, on a level that draws it', async ({ page }, info) => {
  test.skip(onPhone(info.project.name), 'the mouse path is the desktop project');
  await page.goto('/?level=t4.2');
  await advanceTo(page, '[data-grab="minute"]');

  const before = await page.locator('[data-hand="minute"]').getAttribute('transform');
  const { cx, cy, r } = await dialGeometry(page);
  const start = pointAt(cx, cy, r, 0);
  const end = pointAt(cx, cy, r, 120);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await page.mouse.up();

  expect(await page.locator('[data-hand="minute"]').getAttribute('transform')).not.toBe(before);
});
