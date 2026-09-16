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

  /// Item 30.1.3.
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
