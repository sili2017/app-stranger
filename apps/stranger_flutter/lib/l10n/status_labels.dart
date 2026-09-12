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

/// A glanceable symbol alongside [offerStatusLabel]'s text: a running offer reads as
/// "live" (🟢), an expired one as "ran out of time" (⏳ — matches the request for an
/// analog-clock-style cue), and a creator-stopped one as a plain "ended" cross (❌).
String offerStatusEmoji(String status) {
  switch (status) {
    case 'active':
      return '🟢';
    case 'expired':
      return '⏳';
    case 'stopped':
      return '❌';
    default:
      return '';
  }
}
