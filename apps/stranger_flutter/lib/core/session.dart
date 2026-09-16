import 'package:shared_preferences/shared_preferences.dart';

/// Item 30.2: "kept logged into the device till they logout themselves" — this is the
/// one place that persists across app restarts. `userId` is set by either sign-in path:
/// a real one (`signInWithToken`, see AuthApi) that also stores a bearer session token
/// ApiClient sends on every request, or the pre-existing dev-only one (`signIn`, see
/// LoginScreen) with no token at all — every backend service's shared auth middleware
/// falls back to trusting a bare `x-dev-user-id` header only when no token is present,
/// so both keep working side by side. Persisted to local storage (web-compatible).
class Session {
  Session._(this._prefs);

  final SharedPreferences _prefs;
  static const _key = 'dev_user_id';
  static const _tokenKey = 'session_token';
  static const _authMethodKey = 'auth_method';
  static const _localeKey = 'language_override';
  static const _pushEnabledKey = 'push_enabled';
  static const _locationRationaleSeenKey = 'location_rationale_seen';

  static Future<Session> load() async {
    final prefs = await SharedPreferences.getInstance();
    return Session._(prefs);
  }

  String? get userId => _prefs.getString(_key);

  /// The real bearer session token from email/password or an OAuth login — null for a
  /// dev-only sign-in (see class doc).
  String? get token => _prefs.getString(_tokenKey);

  /// 'email' | 'google' | 'facebook' | 'apple' | null (dev-only sign-in, or signed out).
  String? get authMethod => _prefs.getString(_authMethodKey);

  /// Item 30: a real session from email/password or an OAuth provider.
  Future<void> signInWithToken(
    String userId,
    String token,
    String authMethod,
  ) async {
    await _prefs.setString(_key, userId);
    await _prefs.setString(_tokenKey, token);
    await _prefs.setString(_authMethodKey, authMethod);
  }

  /// Dev-only sign-in (manual/testing) — no token; the backend trusts the bare
  /// `x-dev-user-id` header verbatim (see createAuthMiddleware's fallback).
  Future<void> signIn(String userId) async {
    await _prefs.setString(_key, userId);
    await _prefs.remove(_tokenKey);
    await _prefs.remove(_authMethodKey);
  }

  Future<void> signOut() async {
    await _prefs.remove(_key);
    await _prefs.remove(_tokenKey);
    await _prefs.remove(_authMethodKey);
  }

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
