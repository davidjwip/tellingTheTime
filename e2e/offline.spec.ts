import { expect, test } from '@playwright/test';

/** AC-34: once loaded, a whole round completes with no network at all. */
// AC-34
test('a round finishes with the network switched off', async ({ page, context }) => {
  await page.goto('/?level=t2.4');
  await expect(page.locator('[data-verdict="correct"]').first()).toBeVisible();

  await context.setOffline(true);

  // ten right answers, the app's own goal, with nothing but the bundle already in the browser
  for (let answered = 0; answered < 10; answered += 1) {
    const yes = page.locator('[data-verdict="correct"]');
    if (!(await yes.count())) break;
    await yes.first().click();
  }

  await expect(
    page.locator('[data-action="close-celebration"], [data-action="close-summary"], [data-summary]').first(),
  ).toBeVisible({ timeout: 5000 });

  await context.setOffline(false);
});
