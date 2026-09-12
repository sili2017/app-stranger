#!/usr/bin/env node
/**
 * Test data generator for stranger-meet-offers — run against the LIVE local backend
 * (all 10 services + Postgres + Redis must already be running; see
 * specs/tasks.md "Running locally").
 *
 * What it creates:
 *
 * 1. Four NAMED test users (sunny, david, richa, shobha) — signed up via the real
 *    FR-016 age-assurance endpoint, each with a city interest registered in mainz,
 *    frankfurt, AND mumbai. Sign in as any of them (dev sign-in screen, name only) to
 *    manually test with a realistic, populated account.
 *
 * 2. A batch of ACTIVE offers in mumbai, frankfurt, and mainz (two per city),
 *    published by fresh, disposable "seed_publisher_*" identities rather than the
 *    four named users above. Reason: FR-030 caps every account at 3 free published
 *    offers per calendar month — reusing the named users to publish would make this
 *    script fail on its 4th re-run in the same month. Disposable publishers sidestep
 *    that limit entirely, so this script is safe to re-run as often as you like.
 *
 * Offers live at most 30 minutes (the publish form's own max lifetime), so "always
 * available" in practice means re-running this periodically — e.g.:
 *   watch -n 1200 node scripts/seed-test-data.js
 * (every 20 minutes, comfortably inside the 30-minute window).
 *
 * Usage: node scripts/seed-test-data.js
 * Env overrides (defaults match a local `flutter run` setup):
 *   IDENTITY_BASE_URL (default http://127.0.0.1:3001)
 *   OFFER_BASE_URL    (default http://127.0.0.1:3002)
 */

const IDENTITY_BASE = process.env.IDENTITY_BASE_URL || 'http://127.0.0.1:3001';
const OFFER_BASE = process.env.OFFER_BASE_URL || 'http://127.0.0.1:3002';

const NAMED_USERS = ['sunny', 'david', 'richa', 'shobha'];

const CITIES = [
  { id: 'mumbai', lat: 18.94, lng: 72.835 },
  { id: 'frankfurt', lat: 50.1109, lng: 8.6821 },
  { id: 'mainz', lat: 49.9929, lng: 8.2473 },
];

const ACTIVITIES = [
  '☕ Grab a coffee together',
  '🎲 Play some board games',
  '🚶 Go for an evening walk',
  '🍜 Try a new street food stall',
  '📸 Explore the city and take photos',
  '🎬 Watch a movie together',
];

async function api(base, path, { method = 'GET', userId, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-dev-user-id': userId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${method} ${base}${path} -> ${res.status}: ${text}`);
  }
  return json;
}

function ensureUser(userId) {
  return api(IDENTITY_BASE, '/verification/signup-age-assurance', {
    method: 'POST',
    userId,
    body: { dateOfBirth: '1995-06-15', livenessResult: 'passed' },
  });
}

function ensureCityInterest(userId, cityId) {
  return api(IDENTITY_BASE, '/city-interests', {
    method: 'POST',
    userId,
    body: { cityId },
  });
}

function publishOffer(userId, city, activityText) {
  return api(OFFER_BASE, '/offers', {
    method: 'POST',
    userId,
    body: {
      activityText,
      place: { kind: 'pin', lat: city.lat, lng: city.lng },
      lifetimeMinutes: 30,
      capacity: 3 + Math.floor(Math.random() * 3),
      cityId: city.id,
      moneyPreference: { label: 'split' },
    },
  });
}

async function main() {
  console.log('Seeding named test users (sunny, david, richa, shobha)...');
  for (const name of NAMED_USERS) {
    await ensureUser(name);
    for (const city of CITIES) {
      await ensureCityInterest(name, city.id);
    }
    console.log(`  done ${name} — city interests: ${CITIES.map((c) => c.id).join(', ')}`);
  }

  console.log('Publishing fresh active offers via disposable publisher identities...');
  const runId = Date.now();
  let published = 0;
  for (const city of CITIES) {
    for (let i = 0; i < 2; i++) {
      const publisherId = `seed_publisher_${runId}_${city.id}_${i}`;
      await ensureUser(publisherId);
      const activity = ACTIVITIES[(published + i) % ACTIVITIES.length];
      await publishOffer(publisherId, city, `${activity} in ${city.id}`);
      published += 1;
    }
    console.log(`  done ${city.id} — 2 active offers published`);
  }

  console.log(
    `\nDone: ${NAMED_USERS.length} named users seeded, ${published} offers published across ${CITIES.length} cities.`,
  );
  console.log('Offers last up to 30 minutes — re-run this script periodically to keep them fresh.');
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exitCode = 1;
});
