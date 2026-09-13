import '../core/api_client.dart';
import '../models/participation.dart';

class ParticipationApi {
  ParticipationApi(this._client);
  final ApiClient _client;

  Future<ExpressionOfInterest> expressInterest(String offerId,
      {String? message}) async {
    final json = await _client.post(
      '/offers/$offerId/expressions-of-interest',
      body: {if (message != null && message.isNotEmpty) 'message': message},
    );
    return ExpressionOfInterest.fromJson(json as Map<String, dynamic>);
  }

  /// Creator-only; includes `selected` so the UI can grey out an already-chosen EOI.
  Future<List<Map<String, dynamic>>> listExpressionsOfInterest(
      String offerId) async {
    final json =
        await _client.get('/offers/$offerId/expressions-of-interest') as List;
    return json.cast<Map<String, dynamic>>();
  }

  /// Recipient-only: whether the current user already expressed interest — lets a
  /// button state (e.g. "Interest sent") survive a screen revisit or app restart.
  Future<bool> hasExpressedInterest(String offerId) async {
    final json =
        await _client.get('/offers/$offerId/expressions-of-interest/mine');
    return (json as Map<String, dynamic>)['expressed'] as bool;
  }

  Future<Selection> select(
      String offerId, String expressionOfInterestId) async {
    final json = await _client.post(
      '/offers/$offerId/selections',
      body: {'expressionOfInterestId': expressionOfInterestId},
    );
    return Selection.fromJson(json as Map<String, dynamic>);
  }

  Future<void> cancel(String offerId, String selectionId) =>
      _client.post('/offers/$offerId/selections/$selectionId/cancel');

  /// Creator sees every selection on the offer; a recipient sees only their own —
  /// backs the "rate this meetup" action (Story 4).
  Future<List<Map<String, dynamic>>> listSelectionsVisibleToMe(
      String offerId) async {
    final json = await _client.get('/offers/$offerId/selections/mine') as List;
    return json.cast<Map<String, dynamic>>();
  }
}
