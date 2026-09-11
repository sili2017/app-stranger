/**
 * FR-036/FR-037: USD is the initial business reference currency; base subscription
 * prices themselves are still `NEEDS CLARIFICATION` (spec.md Open Question 20) — these
 * are placeholder reference values only, to make the pricing pipeline concrete, not an
 * approved price list. Discounts are fixed by FR-037: 10% monthly, 20% yearly, 0% weekly.
 */
export const FREE_MONTHLY_ALLOWANCE = 3; // FR-030

export const ONE_TIME_BROADCAST_REFERENCE_PRICE_MINOR = 100; // USD 1.00 (FR-035)
export const REFERENCE_CURRENCY = 'USD';

export const SUBSCRIPTION_BASE_PRICE_MINOR: Record<'weekly' | 'monthly' | 'yearly', number> = {
  weekly: 299, // USD 2.99 — placeholder, NEEDS CLARIFICATION
  monthly: 999, // USD 9.99 — placeholder, NEEDS CLARIFICATION
  yearly: 9999, // USD 99.99 — placeholder, NEEDS CLARIFICATION
};

export const SUBSCRIPTION_DISCOUNT_PCT: Record<'weekly' | 'monthly' | 'yearly', number> = {
  weekly: 0,
  monthly: 10,
  yearly: 20,
};

export function discountedPriceMinor(plan: 'weekly' | 'monthly' | 'yearly'): number {
  const base = SUBSCRIPTION_BASE_PRICE_MINOR[plan];
  const discount = SUBSCRIPTION_DISCOUNT_PCT[plan];
  return Math.round(base * (1 - discount / 100));
}

export function periodLengthMs(plan: 'weekly' | 'monthly' | 'yearly'): number {
  const DAY_MS = 24 * 60 * 60 * 1000;
  switch (plan) {
    case 'weekly':
      return 7 * DAY_MS;
    case 'monthly':
      return 30 * DAY_MS;
    case 'yearly':
      return 365 * DAY_MS;
  }
}

/**
 * Placeholder UTC YYYY-MM calendar-month key, pending the registered-address-city →
 * timezone mapping decision (spec Open Question 18; data-model.md Schema Design
 * Review Gates).
 */
export function currentCalendarMonthKey(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}
