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
  // Convergence T133 (ADQ-008, ADR-006): the approved v1 matrix is current-stable
  // Chrome, Safari, Firefox, and Edge. Edge and Chrome share Chromium's engine, so a
  // `msedge` channel run (real installed Edge, not just another Chromium build) is the
  // meaningful addition over the existing `chromium` project, not a duplicate of it;
  // Safari itself has no Playwright driver on any OS, so `webkit` (the closest
  // automatable equivalent, same engine family) stands in for it, same as this
  // convention is used industry-wide.
  //
  // Verified this session: chromium and firefox both pass all 4 tests. webkit
  // currently FAILS all 4 — signUp's dismissLocationRationaleIfShown click on "Sounds
  // good" doesn't dismiss the dialog in WebKit even after matching clickButton's
  // scroll-into-view pattern (ruled out: timing, off-screen/no-scroll click). Root
  // cause not yet found; a real, reproducible WebKit-only gap, not a flake — left
  // failing rather than skipped so it stays visible. `edge` requires the `msedge`
  // channel installed locally (`npx playwright install msedge`), which needs sudo in
  // this environment and wasn't available to verify here; the config itself is
  // correct and lists its 4 tests cleanly (`--list --project=edge`).
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    {
      name: 'edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
  ],
});
