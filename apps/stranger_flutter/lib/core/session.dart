import 'package:shared_preferences/shared_preferences.dart';

/// Dev-only stand-in for a real session (ADQ-002a is still open — see
/// services/api-gateway/src/auth/dev-oidc-issuer.ts). Holds the `x-dev-user-id` every
/// backend service reads via its `devPrincipalMiddleware`. Persisted to local storage
/// (web-compatible) purely so a page refresh during manual testing doesn't sign you out.
class Session {
  Session._(this._prefs);

  final SharedPreferences _prefs;
  static const _key = 'dev_user_id';
  static const _localeKey = 'language_override';
  static const _pushEnabledKey = 'push_enabled';
  static const _locationRationaleSeenKey = 'location_rationale_seen';

  static Future<Session> load() async {
    final prefs = await SharedPreferences.getInstance();
    return Session._(prefs);
  }

  String? get userId => _prefs.getString(_key);

  Future<void> signIn(String userId) => _prefs.setString(_key, userId);

  Future<void> signOut() => _prefs.remove(_key);

  /// FR-040: a user override takes priority over the device locale; null means "use the
  /// device locale, falling back to English" (see AppState.resolveLocale).
  String? get languageOverride => _prefs.getString(_localeKey);

  Future<void> setLanguageOverride(String? languageCode) {
    if (languageCode == null) return _prefs.remove(_localeKey);
    return _prefs.setString(_localeKey, languageCode);
  }

  /// T118: whether this device already registered a push token this session — purely a
  /// UI convenience (hide the "enable push" banner once dismissed/accepted), not a
  /// source of truth for whether push actually works (see PushNotificationService).
  bool get pushEnabled => _prefs.getBool(_pushEnabledKey) ?? false;

  Future<void> setPushEnabled(bool enabled) =>
      _prefs.setBool(_pushEnabledKey, enabled);

  /// Whether the location-permission rationale dialog has already been shown once —
  /// shown at most once per device so it motivates rather than nags (see
  /// LocationRationale.showOnce).
  bool get hasSeenLocationRationale =>
      _prefs.getBool(_locationRationaleSeenKey) ?? false;

  Future<void> setHasSeenLocationRationale() =>
      _prefs.setBool(_locationRationaleSeenKey, true);
}
