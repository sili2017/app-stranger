import 'package:flutter/foundation.dart';
import '../config/api_config.dart';
import '../core/api_client.dart';
import '../core/session.dart';
import '../services/identity_api.dart';
import '../services/offer_api.dart';
import '../services/discovery_api.dart';
import '../services/participation_api.dart';
import '../services/messaging_api.dart';
import '../services/trust_safety_api.dart';
import '../services/entitlements_api.dart';
import '../services/notifications_api.dart';
import '../services/media_api.dart';

/// Root app state: the current dev-only session plus one typed API per domain service.
/// Screens read this via `context.watch<AppState>()` / `context.read<AppState>()` rather
/// than constructing their own clients, so every request carries the same signed-in
/// `x-dev-user-id`.
class AppState extends ChangeNotifier {
  AppState(this.session)
      : identity = IdentityApi(ApiClient(ApiConfig.identityProfile, session)),
        offer = OfferApi(ApiClient(ApiConfig.offer, session)),
        discovery =
            DiscoveryApi(ApiClient(ApiConfig.discoveryLocation, session)),
        participation =
            ParticipationApi(ApiClient(ApiConfig.participation, session)),
        messaging = MessagingApi(ApiClient(ApiConfig.messaging, session)),
        trustSafety = TrustSafetyApi(ApiClient(ApiConfig.trustSafety, session)),
        entitlements =
            EntitlementsApi(ApiClient(ApiConfig.entitlementsBilling, session)),
        notifications =
            NotificationsApi(ApiClient(ApiConfig.notification, session)),
        media = MediaApi(ApiClient(ApiConfig.media, session));

  final Session session;
  final IdentityApi identity;
  final OfferApi offer;
  final DiscoveryApi discovery;
  final ParticipationApi participation;
  final MessagingApi messaging;
  final TrustSafetyApi trustSafety;
  final EntitlementsApi entitlements;
  final NotificationsApi notifications;
  final MediaApi media;

  String? get userId => session.userId;
  bool get isSignedIn => userId != null;

  Future<void> signIn(String userId) async {
    await session.signIn(userId);
    notifyListeners();
  }

  Future<void> signOut() async {
    await session.signOut();
    notifyListeners();
  }

  /// FR-040/T107: null means "device locale, falling back to English" — see
  /// StrangerApp.localeResolutionCallback for where that fallback actually happens.
  String? get languageOverride => session.languageOverride;

  Future<void> setLanguageOverride(String? languageCode) async {
    await session.setLanguageOverride(languageCode);
    notifyListeners();
  }

  bool get pushEnabled => session.pushEnabled;

  Future<void> markPushEnabled() async {
    await session.setPushEnabled(true);
    notifyListeners();
  }

  bool get hasSeenLocationRationale => session.hasSeenLocationRationale;

  Future<void> markLocationRationaleSeen() async {
    await session.setHasSeenLocationRationale();
    notifyListeners();
  }
}
