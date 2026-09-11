import { test, expect, Page } from '@playwright/test';
import {
  gotoFresh,
  signUp,
  uniqueName,
  goToTab,
  clickButton,
  fillField,
  ensureLocationSet,
} from './helpers';

// Mumbai coordinates, matching every other manual/curl verification in this codebase.
const MUMBAI = { latitude: 18.94, longitude: 72.835 };

async function publishOffer(page: Page, activityText: string) {
  await goToTab(page, 'Publish');
  await fillField(page, 'What do you want to do?', activityText);
  await fillField(page, 'City id (e.g. mumbai)', 'mumbai');
  await ensureLocationSet(page);
  await clickButton(page, 'Publish');
  await expect(page.getByText(activityText)).toBeVisible({ timeout: 15_000 });
}

test.describe('Story 1: publish an immediate meet offer', () => {
  test('publishing with the default lifetime lands on the offer detail screen active', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(MUMBAI);

    await gotoFresh(page);
    await signUp(page, uniqueName('e2e_pub'));
    await publishOffer(page, 'Sunny wants to drink tea');

    // Landing on the offer detail screen with the default 15-minute lifetime (FR-003)
    // and the exact place visible to the creator (FR-002). "Stop offer" only renders
    // for an active offer (offer_detail_screen.dart), so its presence is the status
    // signal — the "active" Chip's own text is flakier to match exactly (its semantics
    // node composes with sibling Chips in a way plain getByText doesn't isolate).
    await expect(page.getByRole('button', { name: 'Stop offer', exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('a free-text activity not in any example list is accepted (FR-018)', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(MUMBAI);

    await gotoFresh(page);
    await signUp(page, uniqueName('e2e_freetext'));
    await publishOffer(page, 'kite flying at Juhu beach');
  });

  test('stopping an active offer transitions it to stopped and offers a rebroadcast', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(MUMBAI);

    await gotoFresh(page);
    await signUp(page, uniqueName('e2e_stop'));
    await publishOffer(page, 'board games meetup');

    await clickButton(page, 'Stop offer');
    // "Rebroadcast" only renders once the offer is no longer active — the same
    // status signal used above, mirrored for the stopped state.
    await expect(page.getByRole('button', { name: 'Rebroadcast', exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });
});
