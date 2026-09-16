export interface SmsSender {
  send(phone: string, body: string): Promise<void>;
}

/**
 * Item 35: no real SMS provider is wired up (no Twilio/SNS account exists for this
 * project yet) — matches this codebase's existing dev-stub pattern for anything that
 * needs a real third-party account it doesn't have (FcmPushSender falls back to a
 * local logger without live Firebase credentials; DevOidcIssuer stands in for a real
 * OIDC vendor). Logs the code instead of sending it, so phone verification is fully
 * real and testable end-to-end except for the one step — an actual carrier
 * delivering the SMS — nobody has a paid account for yet.
 */
class DevLogSmsSender implements SmsSender {
  async send(phone: string, body: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[dev-sms] to ${phone}: ${body}`);
  }
}

/**
 * SMS_PROVIDER is unset everywhere today — this always returns the dev logger. Once a
 * real provider is chosen (env: SMS_PROVIDER=twilio + TWILIO_ACCOUNT_SID/AUTH_TOKEN/
 * FROM_NUMBER, say), add that branch here; every caller already only depends on the
 * SmsSender interface, not on this factory's current dev-only behavior.
 */
export function createSmsSender(): SmsSender {
  return new DevLogSmsSender();
}
