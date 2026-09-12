import Stripe from 'stripe';
import { PaymentVerifier, MockPaymentVerifier } from './mock-payment-verifier';
import { StripePaymentVerifier } from './stripe-payment-verifier';

/**
 * Convergence T124: single point of construction for both call sites' PaymentVerifier
 * (`purchases.service.ts`, `subscriptions.service.ts`), so the ADQ-004 cutover to
 * Stripe doesn't mean editing either directly — mirrors `createEventBus`'s pattern
 * (packages/ts-platform/src/events/event-bus-factory.ts) for the same reason.
 *
 * Defaults to the dev-only mock when `PAYMENT_PROVIDER` is unset (or anything other
 * than "stripe"), so importing this module in a unit test never requires a Stripe
 * secret key. Set `PAYMENT_PROVIDER=stripe` + `STRIPE_SECRET_KEY` to opt in for real.
 */
export function createPaymentVerifier(): PaymentVerifier {
  const provider = process.env.PAYMENT_PROVIDER ?? 'mock';
  if (provider === 'stripe') {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
    return new StripePaymentVerifier(stripe);
  }
  return new MockPaymentVerifier();
}
