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

/// PublicProfile.verificationStatus comes straight off the wire (`unverified`/
/// `photo_verified`/`id_verified`) — item 34's localized text for it.
String verificationStatusLabel(AppLocalizations l10n, String status) {
  switch (status) {
    case 'unverified':
      return l10n.profileVerificationUnverified;
    case 'photo_verified':
      return l10n.profileVerificationPhotoVerified;
    case 'id_verified':
      return l10n.profileVerificationIdVerified;
    default:
      return status;
  }
}

/// Item 34: a warning cue until verification is actually done, a trust cue once it is
/// — never the same neutral icon for both states.
bool isVerified(String status) => status != 'unverified';
