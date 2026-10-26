import { expect, test } from '@playwright/test';

/** AC-35: every control a child must hit is at least 44 px on its smallest side, measured where it lives. */
const MIN = 44;

async function measure(page: import('@playwright/test').Page, selector: string): Promise<string[]> {
  const boxes = await page.locator(selector).evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return {
        text: (node.textContent ?? '').trim().slice(0, 24),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        hidden: style.visibility === 'hidden' || style.display === 'none' || rect.width === 0,
      };
    }),
  );
  return boxes
    .filter((box) => !box.hidden && (box.w < MIN || box.h < MIN))
    .map((box) => `"${box.text}" ${box.w}x${box.h}`);
}

// AC-35
test('the shelf offers thumb-sized controls', async ({ page }) => {
  await page.goto('/');
  expect(await measure(page, '.picker button')).toEqual([]);
});

test('a play screen offers thumb-sized controls', async ({ page }) => {
  await page.goto('/?level=t2.4');
  expect(await measure(page, 'main button')).toEqual([]);
});

test('a build screen offers thumb-sized numerals', async ({ page }) => {
  await page.goto('/?level=t1.4');
  expect(await measure(page, '[data-tray], [data-action="done"]')).toEqual([]);
});
