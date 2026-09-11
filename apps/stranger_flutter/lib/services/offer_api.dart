import '../core/api_client.dart';
import '../core/app_exception.dart';
import '../models/offer.dart';

class MoneyPreference {
  MoneyPreference({required this.label, this.note});
  final String label;
  final String? note;

  Map<String, dynamic> toJson() =>
      {'label': label, if (note != null) 'note': note};
}

class OfferApi {
  OfferApi(this._client);
  final ApiClient _client;

  Future<MeetOffer> publish({
    required String activityText,
    required String placeKind,
    required double lat,
    required double lng,
    String? placeLabel,
    String? rendezvousInstruction,
    required String cityId,
    int? lifetimeMinutes,
    required int capacity,
    MoneyPreference? moneyPreference,
  }) async {
    final json = await _client.post(
      '/offers',
      body: {
        'activityText': activityText,
        'place': {
          'kind': placeKind,
          'lat': lat,
          'lng': lng,
          if (placeLabel != null) 'label': placeLabel,
          if (rendezvousInstruction != null)
            'rendezvousInstruction': rendezvousInstruction,
        },
        'cityId': cityId,
        if (lifetimeMinutes != null) 'lifetimeMinutes': lifetimeMinutes,
        'capacity': capacity,
        if (moneyPreference != null)
          'moneyPreference': moneyPreference.toJson(),
      },
    );
    return MeetOffer.fromJson(json as Map<String, dynamic>);
  }

  Future<MeetOffer> getOffer(String offerId) async {
    final json = await _client.get('/offers/$offerId');
    return MeetOffer.fromJson(json as Map<String, dynamic>);
  }

  Future<List<MeetOffer>> listMine() async {
    final json = await _client.get('/offers') as List;
    return json
        .map((e) => MeetOffer.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<MeetOffer> stop(String offerId) async {
    final json = await _client.post('/offers/$offerId/stop');
    return MeetOffer.fromJson(json as Map<String, dynamic>);
  }

  /// Only succeeds for the creator or a recipient with an accepted Selection (FR-002).
  Future<Map<String, dynamic>?> getExactPlace(String offerId) async {
    try {
      final json = await _client.get('/offers/$offerId/place');
      return json as Map<String, dynamic>;
    } on AppException catch (e) {
      if (e.statusCode == 403) return null;
      rethrow;
    }
  }

  Future<Map<String, dynamic>> getRebroadcastDraft(String offerId) async {
    final json = await _client.get('/offers/$offerId/rebroadcast');
    return json as Map<String, dynamic>;
  }

  Future<MeetOffer> confirmRebroadcast(
      String offerId, Map<String, dynamic> draft) async {
    final json =
        await _client.post('/offers/$offerId/rebroadcast', body: draft);
    return MeetOffer.fromJson(json as Map<String, dynamic>);
  }
}
