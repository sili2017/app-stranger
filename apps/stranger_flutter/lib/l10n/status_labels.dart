import 'gen/app_localizations.dart';

/// MeetOffer.status comes straight off the wire (`active`/`expired`/`stopped`) — this is
/// the one place that turns it into localized display text, shared by every screen that
/// shows an offer's status (T107).
String offerStatusLabel(AppLocalizations l10n, String status) {
  switch (status) {
    case 'active':
      return l10n.offerStatusActive;
    case 'expired':
      return l10n.offerStatusExpired;
    case 'stopped':
      return l10n.offerStatusStopped;
    default:
      return status;
  }
}
