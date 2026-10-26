import { expect, test } from '@playwright/test';

// Playwright's touchscreen has no drag primitive, and a synthetic touch drag would prove only that
// our own handler runs. The desktop pointer path drives the same code with real events, so the drag
// is proven there; the phone project proves the layout and the tap.
test.skip(({ isMobile }) => isMobile === true, 'touch drags are covered by the desktop project');

import { advanceTo, dialGeometry, pointAt } from './helpers';

/**
 * AC-71, in a real browser.
 *
 * happy-dom dispatches pointer events because a test told it to. Chromium decides for itself, honours
 * `touch-action`, and can steal a drag as a scroll. This is the only place that can tell the
 * difference.
 */
// AC-71
test('a hand follows a real finger, and the page does not scroll under it', async ({ page }) => {
  await page.goto('/?level=t4.3');
  await advanceTo(page, '[data-grab="hour"]');

  const before = await page.locator('[data-hand="hour"]').getAttribute('transform');
  const { cx, cy, r } = await dialGeometry(page);

  const start = pointAt(cx, cy, r * 0.55, 0); // on the shaft, not the numeral it points at
  const end = pointAt(cx, cy, r, 300);
  const scrollBefore = await page.evaluate(() => window.scrollY);
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

  // the drag must not have been claimed by the page as a scroll: the dial owns the gesture
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

  // and Done becomes pressable only because something was moved
  await expect(page.locator('[data-action="done"]')).toBeEnabled();
});

test('the minute hand can be moved too, on a level that draws it', async ({ page }) => {
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
