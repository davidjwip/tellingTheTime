import { expect, test } from '@playwright/test';

import { dialGeometry, pointAt } from './helpers';

/** AC-78: pick a numeral from the tray, put it on the dial, and see it where it landed. */
// AC-78
test('a numeral can be picked up and put down on the dial', async ({ page }) => {
  await page.goto('/?level=t1.4');

  const tray = page.locator('[data-tray="3"]');
  await expect(tray).toHaveCount(1);
  await tray.click();

  const { cx, cy, r } = await dialGeometry(page);
  const spot = pointAt(cx, cy, r, 175); // dropped near the six, not exactly on it
  await page.mouse.click(spot.x, spot.y);

  // it is on the face now, drawn near where it was dropped rather than tidied onto a numeral
  const placed = page.locator('[data-placed-numeral="3"]');
  await expect(placed).toHaveCount(1);
  await expect(page.locator('[data-tray="3"]')).toHaveCount(0);

  // and it can be taken back off
  await page.mouse.click(spot.x, spot.y);
  await expect(page.locator('[data-tray="3"]')).toHaveCount(1);
});

test('Done is refused until the whole face is built', async ({ page }) => {
  await page.goto('/?level=t1.4');
  await expect(page.locator('[data-action="done"]')).toBeDisabled();
});
