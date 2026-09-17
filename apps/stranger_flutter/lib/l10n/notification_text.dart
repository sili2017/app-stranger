import 'gen/app_localizations.dart';
import '../services/notifications_api.dart';

/// Turns a NotificationJob's `templateKey` + `payload` into localized display text —
/// mirrors contracts/events.md's event catalog (T108's notification.service.ts queues
/// exactly these templateKeys) on the client side.
String notificationText(AppLocalizations l10n, NotificationJob job) {
  switch (job.templateKey) {
    case 'participation.interest-expressed':
      final name = job.payload['interestedUserName'] as String?;
      return l10n.notificationInterestExpressed((name == null || name.isEmpty)
          ? l10n.notificationSomeoneFallback
          : name);
    case 'participation.participant-selected':
      return l10n.notificationParticipantSelected;
    case 'participation.selection-cancelled':
      return l10n.notificationSelectionCancelled;
    case 'offer.expired-without-selection':
      return l10n.notificationOfferExpiredWithoutSelection;
    case 'billing.subscription-changed':
      return l10n.notificationSubscriptionChanged(
          (job.payload['status'] as String?) ?? '');
    case 'billing.one-time-broadcast-granted':
      return l10n.notificationOneTimeBroadcastGranted;
    default:
      return job.templateKey;
  }
}
