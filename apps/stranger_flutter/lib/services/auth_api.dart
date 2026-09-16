import '../core/api_client.dart';

/// Item 30: the result of any of the four registration/login paths — a real bearer
/// session token the caller must hand to AppState.signInWithToken.
class AuthResult {
  AuthResult({
    required this.userId,
    required this.token,
    required this.ageAssuranceStatus,
  });

  final String userId;
  final String token;
  final String ageAssuranceStatus;

  factory AuthResult.fromJson(Map<String, dynamic> json) => AuthResult(
        userId: json['userId'] as String,
        token: json['token'] as String,
        ageAssuranceStatus: json['ageAssuranceStatus'] as String,
      );
}

class AuthApi {
  AuthApi(this._client);
  final ApiClient _client;

  /// Item 33: the primary signup path — name and date of birth only, so a new user is
  /// in the app and able to connect with people as fast as possible. Email/password is
  /// deferred to [completeProfileEmail].
  Future<AuthResult> registerQuick({
    required String firstName,
    required String dateOfBirth,
  }) async {
    final json = await _client.post('/auth/register/quick',
        body: {'firstName': firstName, 'dateOfBirth': dateOfBirth});
    return AuthResult.fromJson(json as Map<String, dynamic>);
  }

  /// Item 33: the deferred "profile completion" step — adds a real, recoverable
  /// email+password credential to the signed-in caller's own account.
  Future<void> completeProfileEmail({
    required String email,
    required String password,
  }) =>
      _client.post('/auth/complete-profile/email',
          body: {'email': email, 'password': password});

  /// Item 33: whether the signed-in account already has an email/password credential
  /// — drives Profile's "secure your account" prompt.
  Future<bool> hasPassword() async {
    final json = await _client.get('/auth/me');
    return (json as Map<String, dynamic>)['hasPassword'] as bool;
  }

  /// Item 30.1.3: still available as a direct alternative — see auth.service.ts.
  Future<AuthResult> registerWithEmail({
    required String email,
    required String password,
    required String dateOfBirth,
    required String firstName,
  }) async {
    final json = await _client.post('/auth/register/email', body: {
      'email': email,
      'password': password,
      'dateOfBirth': dateOfBirth,
      'firstName': firstName,
    });
    return AuthResult.fromJson(json as Map<String, dynamic>);
  }

  /// Item 30.1.3.
  Future<AuthResult> loginWithEmail({
    required String email,
    required String password,
  }) async {
    final json = await _client.post('/auth/login/email',
        body: {'email': email, 'password': password});
    return AuthResult.fromJson(json as Map<String, dynamic>);
  }

  /// Items 30.1.1/30.1.2 — [provider] is 'google', 'facebook', or 'apple'. [token] is
  /// the provider's own ID token (Google/Apple) or access token (Facebook) — never a
  /// client-asserted identity. [dateOfBirth]/[firstName] are only used (and only
  /// required) the first time this provider identity is seen.
  Future<AuthResult> loginWithOAuth({
    required String provider,
    required String token,
    String? dateOfBirth,
    String? firstName,
  }) async {
    final json = await _client.post('/auth/oauth/$provider/login', body: {
      'token': token,
      if (dateOfBirth != null) 'dateOfBirth': dateOfBirth,
      if (firstName != null) 'firstName': firstName,
    });
    return AuthResult.fromJson(json as Map<String, dynamic>);
  }

  /// Item 30.2: stateless session tokens — this mainly exists for symmetry/audit; the
  /// client's own token discard (AppState.signOut) is what actually ends the session.
  Future<void> logout() => _client.post('/auth/logout');
}
