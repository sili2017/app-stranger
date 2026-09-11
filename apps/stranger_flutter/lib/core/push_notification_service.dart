import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// T118: FCM push on mobile, web push where the browser supports it — with the in-app
/// live feed (NotificationsScreen) as the universal fallback that always works
/// regardless of this class's outcome (FR-006's "never silently missed" rule lives
/// there, not here).
///
/// **This has no real Firebase project behind it in this environment** — there is no
/// `firebase_options.dart`/platform config, matching the backend's own dev-stub pattern
/// (`FcmPushSender` falls back to a local logger without live credentials). Every step
/// here is wrapped so a missing/misconfigured Firebase project degrades to "push isn't
/// available" rather than crashing the app — this is unverified against a real Firebase
/// project and MUST be validated with real credentials before shipping.
class PushNotificationService {
  /// Returns the FCM token on success, or null if push isn't available for any reason
  /// (no Firebase config, permission denied, unsupported platform/browser).
  Future<String?> requestPermissionAndGetToken() async {
    try {
      await Firebase.initializeApp();
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.requestPermission();
      final granted =
          settings.authorizationStatus == AuthorizationStatus.authorized ||
              settings.authorizationStatus == AuthorizationStatus.provisional;
      if (!granted) return null;
      return await messaging.getToken();
    } catch (_) {
      return null;
    }
  }

  String get currentPlatform {
    if (kIsWeb) return 'web';
    return defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';
  }
}
