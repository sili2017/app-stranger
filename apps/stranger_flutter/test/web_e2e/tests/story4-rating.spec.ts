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
 * ChatScreen's single AppBar action (the rate star) sits with its right edge flush
 * against the viewport's right edge (zero trailing margin — every other AppBar in
 * this app has at least one sibling action, giving natural margin this one lacks).
 * Playwright's normal `.click()` refuses it outright ("Element is outside of the
 * viewport", even with `force: true`), and a raw `page.mouse.click()` at the same
 * coordinates clicks "through" without reliably opening the sheet — Flutter Web's
 * gesture arena for this specific flt-tappable node needs the real event dispatched
 * on the semantics node itself, the same technique enableSemantics already uses
 * elsewhere in this file, which is what reliably works here.
 */
async function clickRateThisMeetup(page: import('@playwright/test').Page): Promise<void> {
  const dispatched = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('flt-semantics[flt-tappable]'));
    const target = nodes.find((n) => n.textContent === 'Rate this meetup');
    if (!target) return false;
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  });
  if (!dispatched) throw new Error('Rate this meetup button not found');
}

/**
 * Convergence T136: Story 4 (build trust through post-meeting feedback) had no E2E
 * coverage at all before this task — T119 explicitly left it for a future session.
 * Stopping the offer resolves the pending Selection straight to "happened"
 * (services/participation/src/events/event-consumers.service.ts), so this test
 * doesn't need to wait out the real 2-hour rating-prompt delay: RatingService.submit
 * only requires the RatingPrompt *record* to exist (created immediately on
 * resolution), not that its scheduled send has actually fired yet.
 */
test('both participants rate each other after the meetup resolves, and both ratings go public immediately (T127 mutual rule)', async ({
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
  const activityText = `e2e rating flow ${Date.now()}`;

  // --- Creator publishes, recipient discovers + expresses interest + gets selected ---
  await gotoFresh(creator);
  await signUp(creator, uniqueName('e2e_rater_a'));
  await goToTab(creator, 'Publish');
  await fillField(creator, 'What do you want to do?', activityText);
  await fillField(creator, 'City id (e.g. mumbai)', 'mumbai');
  await ensureLocationSet(creator);
  await clickButton(creator, 'Publish');
  await expect(creator.getByRole('button', { name: 'Stop offer', exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await goBack(creator);

  await gotoFresh(recipient);
  await signUp(recipient, uniqueName('e2e_rater_b'));
  await goToTab(recipient, 'Discover');
  await addCityInterest(recipient, 'mumbai');
  const feedItem = await waitForVisibleText(recipient, activityText);
  await clickRow(recipient, feedItem);
  await waitForVisibleText(recipient, 'The exact place is revealed once you are selected');
  await clickButton(recipient, "I'm interested");
  await waitForVisibleText(recipient, 'Interest sent');
  await goBack(recipient);

  await goToTab(creator, 'My offers');
  const myOfferRow = await waitForVisibleText(creator, activityText);
  await clickRow(creator, myOfferRow);
  await clickButton(creator, 'Select');
  await waitForVisibleText(creator, 'Selected');

  // --- Resolve the meetup: stopping transitions the pending Selection to "happened" ---
  await clickButton(creator, 'Stop offer');
  await waitForVisibleText(creator, 'Rebroadcast');
  await goBack(creator);

  // --- Creator rates the recipient ---
  await goToTab(creator, 'Chats');
  const creatorChatRow = await waitForVisibleText(creator, activityText);
  await clickRow(creator, creatorChatRow);
  await clickRateThisMeetup(creator);
  await clickButton(creator, 'Rate');
  await waitForVisibleText(creator, 'Rate this person');
  await clickButton(creator, 'Submit');
  await waitForVisibleText(creator, 'Thanks for the feedback!');
  await goBack(creator);

  // --- Recipient rates the creator — this is the second submission, so T127's mutual
  // rule should make both ratings public immediately, not wait for the 5-day SLA. ---
  await goToTab(recipient, 'Chats');
  const recipientChatRow = await waitForVisibleText(recipient, activityText);
  await clickRow(recipient, recipientChatRow);
  await clickRateThisMeetup(recipient);
  await clickButton(recipient, 'Rate');
  await waitForVisibleText(recipient, 'Rate this person');
  await clickButton(recipient, 'Submit');
  await waitForVisibleText(recipient, 'Thanks for the feedback!');
  await goBack(recipient);

  // --- Both public profiles now reflect the rating (FR-024's public summary) ---
  await goToTab(creator, 'Profile');
  await waitForVisibleText(creator, '5.0');

  await goToTab(recipient, 'Profile');
  await waitForVisibleText(recipient, '5.0');

  await creatorContext.close();
  await recipientContext.close();
});
