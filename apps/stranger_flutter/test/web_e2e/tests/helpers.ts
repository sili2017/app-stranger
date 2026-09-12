import { Page, Locator, expect } from '@playwright/test';

/**
 * Flutter Web (canvaskit) renders everything to <canvas> — there is no readable DOM text
 * until the engine's accessibility/semantics tree is switched on, which normally happens
 * when a screen reader focuses `flt-semantics-placeholder`. Playwright's mouse click
 * can't reach that element (it's positioned off-viewport by design), so this dispatches
 * the same click event the engine listens for directly. Call once per fresh page load,
 * before any role/text/label locator.
 */
export async function enableSemantics(page: Page): Promise<void> {
  await page.waitForSelector('flt-semantics-placeholder', { state: 'attached' });
  await page.evaluate(() => {
    document
      .querySelector('flt-semantics-placeholder')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  // The semantics tree populates asynchronously after the click; wait for real text
  // (the login screen's title) rather than a fixed sleep.
  await expect(page.getByText('Stranger', { exact: true })).toBeVisible({ timeout: 10_000 });
}

/** Loads the app fresh (clears any prior session) and enables semantics. */
export async function gotoFresh(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await enableSemantics(page);
}

/**
 * Flutter Web paints a scrollable ListView entirely inside <canvas> — there is no real
 * DOM scroll container for `scrollIntoViewIfNeeded()` to act on, so a semantics node
 * below the fold has a real (off-screen) bounding box that never becomes "in view" by
 * DOM means. A mouse-wheel event over the canvas is what the Flutter engine actually
 * listens for as a scroll gesture, so this scrolls by wheel until the target's bounding
 * box is inside the viewport (or gives up after a few attempts).
 */
export async function scrollUntilVisible(page: Page, locator: Locator): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) return;
  for (let attempt = 0; attempt < 10; attempt++) {
    // An explicit timeout here matters: with none, `boundingBox()` falls back to
    // Playwright's default actionability wait, which — if the locator's match count is
    // transiently zero (e.g. a stale node mid route-transition) — blocks until the
    // *whole test's* timeout kills it, rather than letting this function's own retry
    // loop (or fillField's, which wraps this) actually retry against fresher DOM state.
    const box = await locator.boundingBox({ timeout: 3_000 }).catch(() => null);
    if (box && box.y >= 0 && box.y + box.height <= viewport.height) return;
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    const direction = box && box.y < 0 ? -400 : 400;
    await page.mouse.wheel(0, direction);
    await page.waitForTimeout(200);
  }
}

/**
 * `Locator.isVisible()` (what `waitForVisibleText` checks) only means "rendered and not
 * hidden" — it says nothing about whether the element is within the current scroll
 * position, and a bare `.click({force: true})` on a locator returned by
 * `waitForVisibleText` skips Playwright's own scroll-into-view/actionability checks. On
 * a Flutter Web canvas list (no real DOM scroll container — see `scrollUntilVisible`),
 * that combination is a silent no-op click at stale coordinates when the row is below
 * the fold, leaving the page on the same screen with no error — exactly the bug
 * `clickButton` was already built to avoid for buttons. Use this for clicking any row
 * locator obtained from `waitForVisibleText` (a feed item, an offer, a chat).
 */
export async function clickRow(page: Page, locator: Locator): Promise<void> {
  await scrollUntilVisible(page, locator);
  await locator.click({ force: true, timeout: 5_000 });
}

/**
 * `force: true` on the click below is necessary because Flutter Web's semantics tree
 * occasionally leaves a neighboring (often invisible) node geometrically overlapping the
 * real target — a known engine quirk with scrollable lists — which fails Playwright's
 * actionability check even though the button is genuinely visible/enabled.
 *
 * `getByRole`'s `name` does a substring match by default — e.g. `'Publish'` matches both
 * the "Publish Tab 2 of 5" nav destination AND the form's own "Publish" submit button,
 * and `.first()` silently picked the (already-selected, so a no-op) nav tab instead of
 * submitting the form. Default to `exact: true` here rather than chasing that per call
 * site; pass a RegExp (e.g. for `goToTab`'s prefix match) when substring matching is
 * actually wanted.
 */
export async function clickButton(page: Page, name: string | RegExp): Promise<void> {
  const button = page
    .getByRole('button', { name, exact: typeof name === 'string' })
    .first();
  await scrollUntilVisible(page, button);
  await button.click({ force: true, timeout: 5_000 });
}

/**
 * `.fill()`'s own implicit focus step is subject to the same overlapping-semantics-node
 * problem as clicks — it can silently land on the wrong node and leave the real field
 * empty with no error thrown. Scrolling into view + forcing the click first, then
 * filling, is reliable.
 *
 * `.fill()` itself turned out to be the deeper issue, caught via the publish form
 * submitting with "City id" reporting Required despite `fillField`'s own verification
 * passing: `.fill()` sets the DOM proxy's `.value` and dispatches one synthetic `input`
 * event, and `inputValue()` reads that same proxy back — so the self-check can pass
 * while Flutter Web's actual `TextEditingController` never got the update, because its
 * web text-input listener doesn't reliably pick up a single synthetic event the way it
 * does a real keystroke sequence. `.pressSequentially()` (real per-character
 * keydown/input/keyup) is the standard fix for this exact class of Flutter Web flake.
 *
 * (Tried `exact: true` on the `getByLabel` here too, to fix a suspected "Message" vs
 * "Message (optional)" collision — it broke matching universally instead, since Flutter
 * Web folds a field's hint text into its accessible name. Reverted; substring matching
 * plus the bounded timeouts below and in `scrollUntilVisible` is what actually prevents
 * a transiently-wrong or zero-count match from hanging the whole test.)
 *
 * One more layer, caught via a screenshot showing the right text typed into the visible
 * field while this function kept looping anyway: `.first()` on a `getByLabel` locator is
 * re-evaluated live on every call, so the node interacted with (click/fill/type) and the
 * node read back by the verification check can be two different DOM elements if Flutter
 * Web transiently renders a duplicate/stale proxy for the same field — the same
 * duplicate-semantics-node behavior `waitForVisibleText` already works around for text,
 * just biting an input field's value this time. So verification below checks every
 * current match for the label, not only the one `.first()` would now resolve to.
 */
export async function fillField(page: Page, label: string, value: string): Promise<void> {
  const candidates = page.getByLabel(label);
  // Self-verifying: a preceding field's fill can shift this one's layout (e.g. a
  // maxLength counter appearing) mid-flight, landing the click on stale coordinates
  // with no error — confirm the value actually stuck, retrying a couple of times
  // rather than trusting the type silently succeeded.
  for (let attempt = 0; attempt < 3; attempt++) {
    const field = candidates.first();
    await scrollUntilVisible(page, field);
    try {
      await field.click({ force: true, timeout: 5_000 });
      await field.fill('', { timeout: 5_000 }); // clear before retyping
      await field.pressSequentially(value, { delay: 15, timeout: 10_000 });
    } catch {
      // A transiently stale/zero-count match — fall through to retry rather than
      // propagate, matching this loop's existing tolerance for a failed attempt.
    }
    const count = await candidates.count();
    for (let i = 0; i < count; i++) {
      const current = await candidates.nth(i).inputValue({ timeout: 2_000 }).catch(() => null);
      if (current === value) return;
    }
    await page.waitForTimeout(250);
  }
}

/**
 * Dev-only sign-in (see login_screen.dart): a plain name + the date picker's own default
 * date (already a valid 18+ DOB, so there's no need to scroll its day/month/year wheels)
 * is enough to pass the backend's real FR-016 age-assurance check.
 *
 * The DOB picker is a `showModalBottomSheet` sliding up a `CupertinoDatePicker` (the
 * requested iOS-style wheel picker) — it's dismissible by tapping its barrier, and a
 * `Done` click fired while it's still sliding into place either misses the button
 * entirely or lands on that barrier instead, silently closing the sheet with no DOB
 * set (caught live: the whole form ended up reset, name field included). Waiting for
 * `Done` to be visible isn't enough on its own — an animating element is "visible"
 * throughout its slide — so this also waits for its position to stop moving between
 * two checks before clicking, rather than a blind fixed delay.
 */
export async function signUp(page: Page, name: string): Promise<void> {
  await fillField(page, 'Your name (dev sign-in)', name);
  await page.getByText('Select date of birth').click({ force: true });
  const doneButton = await waitForVisibleText(page, 'Done');
  await waitForStablePosition(page, doneButton);
  await clickButton(page, 'Done');
  await clickButton(page, 'Continue');
  // Publish (not Discover) is the default landing tab — confirmed live via a DOM dump
  // that the nav rail's own "Discover" destination isn't a bare "Discover" match
  // anyway (its accessible text is "Discover\nTab 1 of 5", so `exact: true` against
  // plain "Discover" never matched it; that assertion only ever passed before because
  // Discover was also the default screen, with its own standalone "Discover" heading).
  //
  // Landing on Publish also triggers its one-time location-rationale dialog (shown
  // once per browser storage, which gotoFresh's localStorage.clear() resets every
  // time) — a modal dialog excludes the screen behind it from the semantics tree
  // while shown, which hid "Publish an offer" from the very check below until this
  // was dismissed first.
  await dismissLocationRationaleIfShown(page);
  await expect(
    page.getByText('Publish an offer', { exact: true }).first(),
  ).toBeVisible({
    timeout: 15_000,
  });
}

/** See signUp's note above — best-effort, since the dialog only shows the first time
 * ever for a given browser storage state. */
async function dismissLocationRationaleIfShown(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Sounds good', exact: true });
  try {
    await button.waitFor({ state: 'visible', timeout: 3_000 });
    // Convergence T133: this used a bare `.click({force: true})` with no
    // scroll-into-view step, unlike every other button click in this file
    // (clickButton). That's exactly the "silent no-op" failure mode this file's own
    // header comment already documents — it happened to work in Chromium but not in
    // WebKit, which computes the click's hit-test point differently. Found via the
    // T133 cross-browser run; fixed by reusing the same robust helper as every other
    // button here, rather than a second, less-robust click path.
    await scrollUntilVisible(page, button);
    await button.click({ force: true, timeout: 5_000 });
  } catch {
    // Never shown this run (already dismissed earlier in this browser context, or
    // geolocation resolved before the dialog could even appear) — nothing to do.
  }
}

/** Polls a locator's bounding box until two consecutive reads match, i.e. it has
 * stopped moving (a slide/fade transition settled) — see `signUp`'s DOB picker note. */
async function waitForStablePosition(
  page: Page,
  locator: Locator,
  timeoutMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let previous = await locator.boundingBox().catch(() => null);
  while (Date.now() < deadline) {
    await page.waitForTimeout(150);
    const current = await locator.boundingBox().catch(() => null);
    if (
      previous &&
      current &&
      previous.x === current.x &&
      previous.y === current.y
    ) {
      return;
    }
    previous = current;
  }
}

/** This app pushes unnamed routes (no GoRouter/named-route URL sync), so "back" means
 * the AppBar's own back button, not the browser's. */
export async function goBack(page: Page): Promise<void> {
  await clickButton(page, 'Back');
}

/** HomeShell's NavigationBar/NavigationRail destinations expose an accessible name like
 * "Publish Tab 2 of 5", not the plain label — this matches the label as a prefix. */
export async function goToTab(
  page: Page,
  label: 'Discover' | 'Publish' | 'My offers' | 'Chats' | 'Profile',
): Promise<void> {
  await clickButton(page, new RegExp(`^${label}`));
}

/**
 * PublishScreen silently prefetches the current location on mount (so a user never
 * has to click the button at all if it succeeds) — with geolocation granted, as every
 * E2E test does, the button may already read "Location set (...)" rather than "Use
 * current location" by the time a test gets here. Use this instead of unconditionally
 * clicking the button.
 */
export async function ensureLocationSet(page: Page): Promise<void> {
  if ((await page.getByText(/Location set/).count()) === 0) {
    await clickButton(page, /Use current location/);
  }
  await expect(page.getByText(/Location set/)).toBeVisible({ timeout: 10_000 });
}

export async function addCityInterest(page: Page, city: string): Promise<void> {
  await clickButton(page, 'City interests');
  await expect(page.getByRole('heading', { name: 'City interests' })).toBeVisible();
  await fillField(page, 'City id (e.g. mumbai)', city);
  await clickButton(page, 'Add');
  await waitForVisibleText(page, city);
  await goBack(page);
}

/**
 * Flutter Web's aria-live announcer duplicates newly-appeared text into an invisible
 * `flt-announcement-polite` node alongside the real, visible element — a bare
 * `getByText(...).first()` can lock onto that invisible announcement and poll forever
 * (Playwright's own `:visible`/`visible=true` selector filters didn't reliably exclude
 * it either). This polls all current text matches for a genuinely visible one, waiting
 * up to `timeoutMs` — use it in place of both `expect(getByText(...)).toBeVisible()`
 * (just await it) and `getByText(...).click()` (await it, then `.click()` the result)
 * whenever asserting on or interacting with text that just appeared as the result of an
 * action (a snackbar, a list item, a status change).
 *
 * Separately, Flutter Web sometimes merges a composite row's semantics (e.g. a
 * ListTile-style leading-icon + title + trailing-button row) into a single
 * `flt-semantics` node exposed only via `aria-label`, with empty `textContent` — proven
 * by inspecting the DOM after adding a city interest: the row landed as
 * `<flt-semantics role="group" aria-label="mumbai">` with no text node inside it.
 * `getByText`, which matches `textContent`, never sees these, so the candidate pool also
 * includes a CSS attribute match against `aria-label` for string queries.
 */
export async function waitForVisibleText(
  page: Page,
  text: string | RegExp,
  timeoutMs = 15_000,
): Promise<Locator> {
  const byText = page.getByText(text);
  const candidates =
    typeof text === 'string'
      ? byText.or(page.locator(`[aria-label*="${text.replace(/"/g, '\\"')}" i]`))
      : byText;
  const deadline = Date.now() + timeoutMs;
  do {
    const count = await candidates.count();
    for (let i = 0; i < count; i++) {
      if (await candidates.nth(i).isVisible()) return candidates.nth(i);
    }
    await page.waitForTimeout(200);
  } while (Date.now() < deadline);
  throw new Error(`Timed out after ${timeoutMs}ms waiting for visible text: ${text}`);
}

export function uniqueName(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}
