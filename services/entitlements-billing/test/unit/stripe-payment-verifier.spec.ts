import 'reflect-metadata';
import Stripe from 'stripe';
import { StripePaymentVerifier } from '../../src/payment-webhook/stripe-payment-verifier';

jest.mock('stripe');

/**
 * T124/ADR-004: receiptToken is either a PaymentIntent id or a Checkout Session id
 * (see stripe-payment-verifier.ts's module comment for why) — no real network calls,
 * the Stripe SDK itself is mocked.
 */
describe('StripePaymentVerifier (T124, ADQ-004)', () => {
  const paymentIntentsRetrieve = jest.fn();
  const sessionsRetrieve = jest.fn();

  beforeEach(() => {
    paymentIntentsRetrieve.mockReset();
    sessionsRetrieve.mockReset();
    (Stripe as unknown as jest.Mock).mockImplementation(() => ({
      paymentIntents: { retrieve: paymentIntentsRetrieve },
      checkout: { sessions: { retrieve: sessionsRetrieve } },
    }));
  });

  function makeVerifier() {
    const stripe = new (Stripe as unknown as new (key: string) => Stripe)('sk_test_fake');
    return new StripePaymentVerifier(stripe);
  }

  it('succeeded PaymentIntent -> valid true', async () => {
    paymentIntentsRetrieve.mockResolvedValue({ status: 'succeeded' });

    const result = await makeVerifier().verifyReceipt('pi_123');

    expect(result).toEqual({ valid: true });
    expect(paymentIntentsRetrieve).toHaveBeenCalledWith('pi_123');
    expect(sessionsRetrieve).not.toHaveBeenCalled();
  });

  it('failed/incomplete PaymentIntent -> valid false', async () => {
    paymentIntentsRetrieve.mockResolvedValue({ status: 'requires_payment_method' });

    const result = await makeVerifier().verifyReceipt('pi_456');

    expect(result).toEqual({ valid: false });
  });

  it('Checkout Session id (PaymentIntent retrieve throws, falls back) with payment_status paid -> valid true', async () => {
    paymentIntentsRetrieve.mockRejectedValue(new Error('No such payment_intent: cs_789'));
    sessionsRetrieve.mockResolvedValue({ payment_status: 'paid' });

    const result = await makeVerifier().verifyReceipt('cs_789');

    expect(result).toEqual({ valid: true });
    expect(sessionsRetrieve).toHaveBeenCalledWith('cs_789');
  });

  it('Checkout Session found but not paid -> valid false', async () => {
    paymentIntentsRetrieve.mockRejectedValue(new Error('No such payment_intent'));
    sessionsRetrieve.mockResolvedValue({ payment_status: 'unpaid' });

    const result = await makeVerifier().verifyReceipt('cs_999');

    expect(result).toEqual({ valid: false });
  });

  it('Stripe API throwing on both PaymentIntent and Checkout Session lookups -> valid false', async () => {
    paymentIntentsRetrieve.mockRejectedValue(new Error('boom'));
    sessionsRetrieve.mockRejectedValue(new Error('boom'));

    const result = await makeVerifier().verifyReceipt('not_a_real_id');

    expect(result).toEqual({ valid: false });
  });
});
