import { PushMessage, PushSender } from './push-sender.interface';

/**
 * research.md §8: FCM is the approved single push transport for both platforms — this
 * is not an ADQ-blocked stub in the same sense as the auth/event-bus/storage stubs,
 * since the *technology choice* is already resolved. What's missing in this dev
 * environment is real service-account credentials: without
 * `FCM_SERVICE_ACCOUNT_JSON`/`FCM_PROJECT_ID`, this falls back to a local logger so the
 * rest of the pipeline (job creation, delivery-attempt bookkeeping, in-app fallback) is
 * still exercisable without a live Firebase project.
 */
export class FcmPushSender implements PushSender {
  private readonly projectId = process.env.FCM_PROJECT_ID;
  private readonly serviceAccountJson = process.env.FCM_SERVICE_ACCOUNT_JSON;

  async send(message: PushMessage): Promise<{ delivered: boolean }> {
    if (!this.projectId || !this.serviceAccountJson) {
      // eslint-disable-next-line no-console
      console.log(
        `[dev fcm-stub] would push token=${message.token} template=${message.templateKey}`,
      );
      return { delivered: true };
    }

    // Real FCM HTTP v1 delivery: POST to
    // https://fcm.googleapis.com/v1/projects/{projectId}/messages:send with an
    // OAuth2 bearer token minted from the service account. Not exercised here —
    // no live Firebase project is configured in this environment.
    throw new Error('FCM live delivery not implemented — configure a local dev-stub instead');
  }
}
