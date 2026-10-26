import { expect, test } from '@playwright/test';

/** AC-75 on a phone: two dials, both reachable, and the page does not scroll sideways. */
test.describe('the two dials at 320 px', () => {
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });

  // AC-75
  test('both dials fit, and both are thumb-sized', async ({ page }) => {
    await page.goto('/?level=t3.1');

    const dials = page.locator('[data-choice]');
    await expect(dials).toHaveCount(2);

    for (const index of [0, 1]) {
      const box = await dials.nth(index).boundingBox();
      expect(box, `dial ${index} has no box`).not.toBeNull();
      expect(box!.width, `dial ${index} width`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `dial ${index} height`).toBeGreaterThanOrEqual(44);
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'the page scrolls sideways on a phone').toBeLessThanOrEqual(1);
  });

  test('tapping a dial answers the question', async ({ page }) => {
    await page.goto('/?level=t3.1');
    const dials = page.locator('[data-choice]');
    await dials.first().tap();
    // a verdict was recorded, so the feedback area is no longer empty
    await expect(page.locator('#feedback, [data-verdict]').first()).toBeVisible();
  });
});
