import { test } from '@playwright/test';
import { gotoFresh, signUp, uniqueName, goToTab, clickButton, waitForVisibleText } from './helpers';

/**
 * Convergence T136: Story 5 (publish within a free allowance or subscription) had no
 * E2E coverage at all before this task — T119 explicitly left it for a future
 * session. Uses the dev-only MockPaymentVerifier (ADQ-004: any non-empty receipt
 * token succeeds), the only payment path that exists in this codebase today.
 */
test('a fresh user sees the free allowance, buys a one-time broadcast, and subscribes', async ({
  page,
}) => {
  await gotoFresh(page);
  await signUp(page, uniqueName('e2e_entitlements'));
  await goToTab(page, 'Profile');
  await clickButton(page, /Entitlements/);

  // A brand-new user's free monthly allowance is 3 (FR-030, SC-013).
  await waitForVisibleText(page, 'Free offers remaining this month');
  await waitForVisibleText(page, '3');
  await waitForVisibleText(page, 'No active subscription');
  await waitForVisibleText(page, 'One-time purchases available: 0');

  // --- One-time purchase (the USD-1-equivalent broadcast credit, FR-036) ---
  await clickButton(page, 'One-time broadcast');
  await waitForVisibleText(page, 'One-time broadcast purchased.');
  await waitForVisibleText(page, 'One-time purchases available: 1');

  // --- Subscribe — bypasses the free-allowance limit entirely while active (FR-032) ---
  await clickButton(page, 'Subscribe weekly');
  await waitForVisibleText(page, 'Subscribed (weekly).');
  await waitForVisibleText(page, 'Active subscription: weekly');
  // Real bug found here (Convergence T136): the backend sends `remainingFreeAllowance
  // ThisMonth: null` once subscribed (services/entitlements-billing/src/
  // entitlements.service.ts) — the Dart model's non-nullable `int` cast crashed this
  // whole screen outright for any subscribed user. Fixed in models/profile.dart +
  // entitlements_screen.dart; this assertion is what the crash screen replaced.
  await waitForVisibleText(page, 'Unlimited (subscribed)');
});
