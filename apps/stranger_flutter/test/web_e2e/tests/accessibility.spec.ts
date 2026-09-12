import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gotoFresh, signUp, goToTab, uniqueName } from './helpers';

/**
 * Convergence T134 (ADQ-008, ADR-006): the WCAG 2.1 AA accessibility audit process
 * this repo didn't have at all before this task — no axe-core/pa11y or any other
 * tooling existed anywhere. Runs axe-core against the same real Flutter Web build and
 * real backend every other test in this suite uses (no mocking), scoped to
 * `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` rule sets to match ADR-006's approved
 * standard exactly — not axe's broader "best practice" rules, which aren't part of
 * that standard and would report noise unrelated to this task.
 *
 * Each screen is audited only after enableSemantics (via gotoFresh/signUp) — before
 * that, Flutter Web's canvas has no real accessibility tree at all, and an axe scan
 * of an empty DOM would trivially "pass" without checking anything real.
 *
 * Verified this session: login and Profile screens are clean. Discover and Publish
 * each have one real, reproducible violation, left failing rather than hidden:
 * - Discover: an icon-only button in the app bar (bell or city-interests — its
 *   position didn't conclusively resolve to one over the other) has no accessible
 *   name (`aria-command-name`). Attempted fix: wrapped FeedScreen's notification
 *   button in `Semantics(label: ...)` — did not change the audit result.
 * - Publish: both Slider controls (`axe` rule `label`) render as a native
 *   `<input type="range" ... disabled>` with no accessible name. Attempted fix:
 *   wrapped both Sliders in `Semantics(label: ...)` (reusing the visible text above
 *   each one) — did not change the audit result either.
 * Both fixes are still in the source as reasonable, correct Semantics usage, but
 * neither is confirmed to satisfy axe — this looks like a deeper Flutter-Web
 * semantics-to-ARIA pipeline gap (particularly plausible for Slider's native `<input
 * type=range>` proxy) rather than an app-level labeling mistake, and needs more
 * investigation than this task's scope covered.
 */
test.describe('Accessibility audit (T134, ADQ-008, WCAG 2.1 AA)', () => {
  const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

  test('login screen has no WCAG 2.1 AA violations', async ({ page }) => {
    await gotoFresh(page);

    const results = await new AxeBuilder({ page }).withTags(tags).analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test('Discover screen has no WCAG 2.1 AA violations', async ({ page }) => {
    await gotoFresh(page);
    await signUp(page, uniqueName('a11y-discover'));
    await goToTab(page, 'Discover');

    const results = await new AxeBuilder({ page }).withTags(tags).analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test('Publish screen has no WCAG 2.1 AA violations', async ({ page }) => {
    await gotoFresh(page);
    await signUp(page, uniqueName('a11y-publish'));
    // signUp already lands on Publish (the default tab) — no extra navigation needed.

    const results = await new AxeBuilder({ page }).withTags(tags).analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test('Profile screen has no WCAG 2.1 AA violations', async ({ page }) => {
    await gotoFresh(page);
    await signUp(page, uniqueName('a11y-profile'));
    await goToTab(page, 'Profile');

    const results = await new AxeBuilder({ page }).withTags(tags).analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
});

function formatViolations(violations: { id: string; help: string; nodes: unknown[] }[]): string {
  if (violations.length === 0) return '';
  return violations
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s))`)
    .join('\n');
}
