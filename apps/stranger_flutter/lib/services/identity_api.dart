import '../core/api_client.dart';
import '../models/profile.dart';

class IdentityApi {
  IdentityApi(this._client);
  final ApiClient _client;

  Future<String> signupAgeAssurance({
    required String dateOfBirth,
    required String livenessResult,
  }) async {
    final json = await _client.post(
      '/verification/signup-age-assurance',
      body: {'dateOfBirth': dateOfBirth, 'livenessResult': livenessResult},
    );
    return json['ageAssuranceStatus'] as String;
  }

  Future<PublicProfile> getProfile(String userId) async {
    final json = await _client.get('/profiles/$userId');
    return PublicProfile.fromJson(json as Map<String, dynamic>);
  }

  Future<PublicProfile> updateProfile(
    String userId, {
    String? firstName,
    List<String>? interests,
  }) async {
    final json = await _client.patch('/profiles/$userId', body: {
      if (firstName != null) 'firstName': firstName,
      if (interests != null) 'interests': interests,
    });
    return PublicProfile.fromJson(json as Map<String, dynamic>);
  }

  /// Auto-passes in this dev build (no real ML/human review pipeline exists yet — see
  /// verification.service.ts's own note) and immediately updates the profile photo.
  Future<void> submitPhotoVerification(String evidenceAssetId) => _client
      .post('/verification/photo', body: {'evidenceAssetId': evidenceAssetId});

  /// Only succeeds when a government-ID case is actually pending (a signup flagged as a
  /// possible minor) — see verification.service.ts's NO_PENDING_ID_CASE error.
  Future<void> submitGovernmentId(String evidenceAssetId) =>
      _client.post('/verification/government-id',
          body: {'evidenceAssetId': evidenceAssetId});

  Future<List<String>> listCityInterests() async {
    final json = await _client.get('/city-interests') as List;
    return json
        .map((e) => (e as Map<String, dynamic>)['cityId'] as String)
        .toList();
  }

  Future<void> addCityInterest(String cityId) =>
      _client.post('/city-interests', body: {'cityId': cityId});

  Future<void> removeCityInterest(String cityId) =>
      _client.delete('/city-interests/$cityId');
}
