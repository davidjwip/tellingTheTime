import type { Page } from '@playwright/test';

/** Answer read items with an adult's ✓ until a screen with the given hook appears. */
export async function advanceTo(page: Page, selector: string, limit = 12): Promise<void> {
  for (let step = 0; step < limit; step += 1) {
    if (await page.locator(selector).count()) return;
    const yes = page.locator('[data-verdict="correct"]');
    if (!(await yes.count())) throw new Error(`no ${selector} and nothing to answer`);
    await yes.first().click();
  }
  throw new Error(`${selector} never appeared`);
}

/** The dial's centre and radius, from the real layout rather than a guess. */
export async function dialGeometry(page: Page): Promise<{ cx: number; cy: number; r: number }> {
  const box = await page.locator('svg').first().boundingBox();
  if (!box) throw new Error('no dial on screen');
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2, r: box.width * 0.36 };
}

/** A point at an angle clockwise from the top. */
export function pointAt(cx: number, cy: number, r: number, degrees: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  return { x: cx + Math.sin(radians) * r, y: cy - Math.cos(radians) * r };
}

/**
 * A real touch drag, through the browser's own input pipeline.
 *
 * Playwright's `touchscreen` only taps, and dispatching `TouchEvent` from page script would bypass the
 * browser's gesture handling — which is the thing worth testing. CDP's Input domain goes through the
 * same path a finger does, so `touch-action` and pointer capture behave as they do on a phone.
 */
export async function touchDrag(
  page: import('@playwright/test').Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 10,
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  for (let step = 1; step <= steps; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + ((to.x - from.x) * step) / steps, y: from.y + ((to.y - from.y) * step) / steps }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
