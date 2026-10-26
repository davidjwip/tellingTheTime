import { defineConfig, devices } from '@playwright/test';

/**
 * The tests that need a real browser.
 *
 * Everything in test/ runs in happy-dom, which fakes exactly the three things this app depends on:
 * pointer capture, `touch-action`, and the absence of a network. A drag that "works" there can do
 * nothing on an iPad. These specs load the built bundle in Chromium and ask the questions the fake
 * DOM cannot answer.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 900, height: 900 } } },
    {
      name: 'phone',
      use: { ...devices['Pixel 5'], viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true },
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
