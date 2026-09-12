import Stripe from 'stripe';
import { PaymentVerifier } from './mock-payment-verifier';

/**
 * ADR-009: Stripe replaces the Apple/Google-IAP-shaped mock, identically for mobile
 * and web — both complete payment client-side via Stripe.js/Elements (Checkout for
 * subscriptions, a PaymentIntent for the one-time broadcast) before calling our
 * existing receiptToken-shaped endpoints, so `receiptToken` here is really either a
 * PaymentIntent id or a Checkout Session id. Trying PaymentIntent first and falling
 * back to Checkout Session keeps `PaymentVerifier`'s single-string-argument shape
 * intact rather than adding a second "kind" parameter through every call site.
 */
export class StripePaymentVerifier implements PaymentVerifier {
  constructor(private readonly stripe: Stripe) {}

  async verifyReceipt(receiptToken: string): Promise<{ valid: boolean }> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(receiptToken);
      return { valid: paymentIntent.status === 'succeeded' };
    } catch {
      // Not a PaymentIntent id (or Stripe rejected it) — try it as a Checkout Session.
    }

    try {
      const session = await this.stripe.checkout.sessions.retrieve(receiptToken);
      return { valid: session.payment_status === 'paid' };
    } catch {
      return { valid: false };
    }
  }
}
