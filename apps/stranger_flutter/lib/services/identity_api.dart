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
