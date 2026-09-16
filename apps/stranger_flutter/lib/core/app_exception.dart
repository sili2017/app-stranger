import '../l10n/gen/app_localizations.dart';

/// Mirrors contracts/api-standards.md's standard error envelope
/// (`{ error: { code, messageKey, correlationId, details } }`) so the UI can branch on
/// `code` (e.g. `ENTITLEMENT_REQUIRED`, `OFFER_NOT_ACTIVE`) the same way the backend's own
/// tests do, rather than parsing prose.
class AppException implements Exception {
  AppException(this.code, this.messageKey, this.statusCode,
      [this.details = const []]);

  final String code;
  final String messageKey;
  final int statusCode;
  final List<dynamic> details;

  /// T107: every error `messageKey` resolves through the same translation catalog as
  /// the rest of the UI (never pre-rendered English chosen server-side — ADR-004) —
  /// this is the one place that mapping happens, so no screen hardcodes error copy.
  String localizedMessage(AppLocalizations l10n) {
    switch (code) {
      case 'VALIDATION_ERROR':
        return l10n.errorValidation;
      case 'UNAUTHENTICATED':
        return l10n.errorUnauthenticated;
      case 'ACCOUNT_RESTRICTED':
        return l10n.errorAccountRestricted;
      case 'CONTENT_SCREENING_FAILED':
        return l10n.errorContentScreeningFailed;
      case 'ENTITLEMENT_REQUIRED':
        return l10n.errorEntitlementRequired;
      case 'OFFER_NOT_ACTIVE':
        return l10n.errorOfferNotActive;
      case 'OFFER_ACTIVE':
        return l10n.errorOfferActiveCannotDelete;
      case 'CAPACITY_REACHED':
        return l10n.errorCapacityReached;
      case 'NOT_ELIGIBLE':
        return l10n.errorNotEligible;
      case 'NOT_FOUND':
        return l10n.errorNotFound;
      case 'IDEMPOTENCY_KEY_CONFLICT':
        return l10n.errorIdempotencyConflict;
      case 'NO_PENDING_ID_CASE':
        return l10n.errorNoPendingIdCase;
      case 'UNDERAGE_SIGNUP':
        return l10n.errorUnderageSignup;
      case 'EMAIL_ALREADY_REGISTERED':
        return l10n.errorEmailAlreadyRegistered;
      case 'INVALID_CREDENTIALS':
        return l10n.errorInvalidCredentials;
      case 'DATE_OF_BIRTH_REQUIRED':
        return l10n.errorDateOfBirthRequired;
      case 'PROVIDER_NOT_CONFIGURED':
        return l10n.loginProviderNotConfigured;
      case 'INVALID_OAUTH_TOKEN':
        return l10n.errorInvalidOauthToken;
      case 'NO_EMAIL_SET':
        return l10n.errorNoEmailSet;
      case 'NO_PHONE_SET':
        return l10n.errorNoPhoneSet;
      case 'PHONE_ALREADY_REGISTERED':
        return l10n.errorPhoneAlreadyRegistered;
      case 'CODE_EXPIRED':
        return l10n.errorCodeExpired;
      case 'INVALID_CODE':
        return l10n.errorInvalidCode;
      case 'TOO_MANY_ATTEMPTS':
        return l10n.errorTooManyAttempts;
      default:
        return l10n.errorUnknown(messageKey);
    }
  }

  @override
  String toString() => 'AppException($code, $statusCode): $messageKey';
}

/// Thrown when a response is not the documented error envelope at all (e.g. a network
/// failure, or the service is unreachable) — distinct from a well-formed domain error.
class NetworkException implements Exception {
  NetworkException(this.message);
  final String message;

  @override
  String toString() => 'NetworkException: $message';
}
