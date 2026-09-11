import '../core/api_client.dart';

class RatingFeedback {
  RatingFeedback({
    required this.id,
    required this.selectionId,
    required this.starRating,
    this.writtenFeedback,
    required this.visibility,
  });

  final String id;
  final String selectionId;
  final int starRating;
  final String? writtenFeedback;
  final String visibility;

  factory RatingFeedback.fromJson(Map<String, dynamic> json) => RatingFeedback(
        id: json['id'] as String,
        selectionId: json['selectionId'] as String,
        starRating: json['starRating'] as int,
        writtenFeedback: json['writtenFeedback'] as String?,
        visibility: json['visibility'] as String,
      );
}

class TrustSafetyApi {
  TrustSafetyApi(this._client);
  final ApiClient _client;

  Future<RatingFeedback> submitRating({
    required String selectionId,
    required int starRating,
    String? writtenFeedback,
  }) async {
    final json = await _client.post(
      '/ratings',
      body: {
        'selectionId': selectionId,
        'starRating': starRating,
        if (writtenFeedback != null && writtenFeedback.isNotEmpty)
          'writtenFeedback': writtenFeedback,
      },
    );
    return RatingFeedback.fromJson(json as Map<String, dynamic>);
  }
}
