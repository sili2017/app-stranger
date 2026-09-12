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

/// Convergence T132 (FR-015, Clarifications Session 2026-09-12 round 2).
class TrustedContact {
  TrustedContact({required this.contactHandle});
  final String contactHandle;

  factory TrustedContact.fromJson(Map<String, dynamic> json) =>
      TrustedContact(contactHandle: json['contactHandle'] as String);
}

/// Convergence T132: a manual, one-tap share result — the client hands `message` off
/// via its own share sheet, since no SMS/email provider is integrated in this codebase.
class MeetupShare {
  MeetupShare({required this.contactHandle, required this.message});
  final String contactHandle;
  final String message;

  factory MeetupShare.fromJson(Map<String, dynamic> json) => MeetupShare(
        contactHandle: json['contactHandle'] as String,
        message: json['message'] as String,
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

  Future<TrustedContact?> getTrustedContact() async {
    final json = await _client.get('/trusted-contacts');
    if (json == null) return null;
    return TrustedContact.fromJson(json as Map<String, dynamic>);
  }

  Future<void> setTrustedContact(String contactHandle) async {
    await _client.put(
      '/trusted-contacts',
      body: {'contactHandle': contactHandle},
    );
  }

  Future<MeetupShare> shareMeetup(String offerId) async {
    final json = await _client.post(
      '/trusted-contacts/share',
      body: {'offerId': offerId},
    );
    return MeetupShare.fromJson(json as Map<String, dynamic>);
  }
}
