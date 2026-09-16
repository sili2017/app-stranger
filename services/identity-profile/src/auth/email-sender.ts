export interface EmailSender {
  send(to: string, subject: string, body: string): Promise<void>;
}

/**
 * Item 35: no real email provider is wired up (no SendGrid/SES account exists for
 * this project yet) — same dev-stub pattern as sms-sender.ts. Logs the message
 * (including the verification link) instead of sending it, so whoever's testing can
 * copy the link straight out of the service log.
 */
class DevLogEmailSender implements EmailSender {
  async send(to: string, subject: string, body: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[dev-email] to ${to} — ${subject}\n${body}`);
  }
}

/**
 * EMAIL_PROVIDER is unset everywhere today — this always returns the dev logger. Add
 * a real branch here (env: EMAIL_PROVIDER=sendgrid + SENDGRID_API_KEY, say) once a
 * provider is chosen; every caller already only depends on the EmailSender interface.
 */
export function createEmailSender(): EmailSender {
  return new DevLogEmailSender();
}
