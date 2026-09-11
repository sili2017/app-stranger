import { test, expect } from '@playwright/test';
import {
  gotoFresh,
  signUp,
  uniqueName,
  goToTab,
  goBack,
  clickButton,
  clickRow,
  fillField,
  addCityInterest,
  ensureLocationSet,
  waitForVisibleText,
} from './helpers';

const MUMBAI = { latitude: 18.94, longitude: 72.835 };

/**
 * Stories 2 & 3 together, exactly as specs/quickstart.md's own scenarios do: a second
 * signed-in user (separate browser context — genuinely two different people, not one
 * page switching identities) must discover the offer, express interest, then the
 * creator selects them and a shared chat opens for both (FR-004/FR-005/FR-009).
 */
test('a recipient discovers, expresses interest, gets selected, and chats with the creator', async ({
  browser,
}) => {
  const creatorContext = await browser.newContext();
  const recipientContext = await browser.newContext();
  await creatorContext.grantPermissions(['geolocation']);
  await creatorContext.setGeolocation(MUMBAI);
  await recipientContext.grantPermissions(['geolocation']);
  await recipientContext.setGeolocation(MUMBAI);

  const creator = await creatorContext.newPage();
  const recipient = await recipientContext.newPage();

  const activityText = `e2e board games ${Date.now()}`;

  // --- Creator publishes ---
  await gotoFresh(creator);
  await signUp(creator, uniqueName('e2e_creator'));
  await goToTab(creator, 'Publish');
  await fillField(creator, 'What do you want to do?', activityText);
  await fillField(creator, 'City id (e.g. mumbai)', 'mumbai');
  await ensureLocationSet(creator);
  await clickButton(creator, 'Publish');
  await expect(creator.getByRole('button', { name: 'Stop offer', exact: true })).toBeVisible({
    timeout: 15_000,
  });
  // The exact place is visible to the creator immediately (FR-002).
  await waitForVisibleText(creator, '18.94');
  // A successful publish auto-navigates (push) to this offer's detail screen, which has
  // no side nav of its own — back out to the HomeShell before using tab navigation again.
  await goBack(creator);

  // --- Recipient discovers and expresses interest ---
  await gotoFresh(recipient);
  await signUp(recipient, uniqueName('e2e_recipient'));
  // Publish (not Discover) is the default landing tab, but "City interests" is an
  // AppBar action on the Discover screen specifically — get there first.
  await goToTab(recipient, 'Discover');
  await addCityInterest(recipient, 'mumbai');
  const feedItem = await waitForVisibleText(recipient, activityText);
  await clickRow(recipient, feedItem);
  // Exact place is hidden from a not-yet-selected recipient (FR-002).
  await waitForVisibleText(recipient, 'The exact place is revealed once you are selected');
  await fillField(recipient, 'Message (optional)', 'excited to join!');
  await clickButton(recipient, "I'm interested");
  await waitForVisibleText(recipient, 'Interest sent');
  // Same reason as the creator's goBack above — this is still the pushed detail screen.
  await goBack(recipient);

  // --- Creator selects the recipient ---
  await goToTab(creator, 'My offers');
  const myOfferRow = await waitForVisibleText(creator, activityText);
  await clickRow(creator, myOfferRow);
  await waitForVisibleText(creator, 'excited to join!');
  await clickButton(creator, 'Select');
  await waitForVisibleText(creator, 'Selected');
  await goBack(creator);

  // --- Both parties now have a shared chat (FR-009) ---
  await goToTab(creator, 'Chats');
  const creatorChatRow = await waitForVisibleText(creator, activityText);
  await clickRow(creator, creatorChatRow);
  await fillField(creator, 'Message', 'see you at the venue!');
  await clickButton(creator, 'Send');
  await waitForVisibleText(creator, 'see you at the venue!');

  await goToTab(recipient, 'Chats');
  const recipientChatRow = await waitForVisibleText(recipient, activityText);
  await clickRow(recipient, recipientChatRow);
  await waitForVisibleText(recipient, 'see you at the venue!');

  await creatorContext.close();
  await recipientContext.close();
});
