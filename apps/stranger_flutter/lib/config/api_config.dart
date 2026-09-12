/// Dev-local base URLs for each domain service (see specs/tasks.md "Running locally").
/// The gateway does not yet proxy to domain services (T017-T020), so the client calls
/// each one directly on its own port — matching every curl example used to verify this
/// backend manually.
class ApiConfig {
  ApiConfig._();

  static const String identityProfile = String.fromEnvironment(
    'IDENTITY_BASE_URL',
    defaultValue: 'http://localhost:3001',
  );
  static const String offer = String.fromEnvironment(
    'OFFER_BASE_URL',
    defaultValue: 'http://localhost:3002',
  );
  static const String discoveryLocation = String.fromEnvironment(
    'DISCOVERY_BASE_URL',
    defaultValue: 'http://localhost:3003',
  );
  static const String participation = String.fromEnvironment(
    'PARTICIPATION_BASE_URL',
    defaultValue: 'http://localhost:3004',
  );
  static const String messaging = String.fromEnvironment(
    'MESSAGING_BASE_URL',
    defaultValue: 'http://localhost:3005',
  );
  static const String trustSafety = String.fromEnvironment(
    'TRUST_SAFETY_BASE_URL',
    defaultValue: 'http://localhost:3006',
  );
  static const String entitlementsBilling = String.fromEnvironment(
    'ENTITLEMENTS_BASE_URL',
    defaultValue: 'http://localhost:3007',
  );
  static const String notification = String.fromEnvironment(
    'NOTIFICATION_BASE_URL',
    defaultValue: 'http://localhost:3008',
  );
  static const String media = String.fromEnvironment(
    'MEDIA_BASE_URL',
    defaultValue: 'http://localhost:3009',
  );
}
