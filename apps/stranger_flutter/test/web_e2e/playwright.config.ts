import { defineConfig, devices } from '@playwright/test';

/**
 * T119: browser-based E2E tests against the real Flutter Web build (`flutter build web`
 * served statically, or `flutter run -d web-server` in dev) and the real backend — no
 * mocking, matching every other test in this codebase's "verified live" convention.
 * APP_URL/BACKEND_* env vars let CI point this at whatever ports it started the stack
 * on; defaults match specs/tasks.md's "Running locally" section.
 */
export default defineConfig({
  testDir: './tests',
  // Story2-3 alone is a two-user, ~20-step flow where several steps each carry their own
  // up-to-15s wait (waitForVisibleText), several of which legitimately need a 5s poll
  // cycle to observe an eventually-consistent read model (discovery feed, conversations)
  // catch up. Observed completing in ~110s once the underlying flakiness was fixed;
  // 180s keeps comfortable margin without masking a real regression as a slow pass.
  timeout: 180_000,
  expect: { timeout: 10_000 },
  retries: 0,
  fullyParallel: false, // tests share backend state (dev users, offers) — run in order
  reporter: [['list']],
  use: {
    baseURL: process.env.APP_URL ?? 'http://127.0.0.1:8765',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
