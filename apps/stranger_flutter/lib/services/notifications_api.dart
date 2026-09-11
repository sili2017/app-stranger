import '../core/api_client.dart';

class NotificationJob {
  NotificationJob({
    required this.id,
    required this.channel,
    required this.templateKey,
    required this.payload,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String channel;
  final String templateKey;
  final Map<String, dynamic> payload;
  final String status;
  final DateTime createdAt;

  factory NotificationJob.fromJson(Map<String, dynamic> json) =>
      NotificationJob(
        id: json['id'] as String,
        channel: json['channel'] as String,
        templateKey: json['templateKey'] as String,
        payload: (json['payload'] as Map?)?.cast<String, dynamic>() ?? const {},
        status: json['status'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

class NotificationsApi {
  NotificationsApi(this._client);
  final ApiClient _client;

  /// T108/FR-006: the in-app live feed — the universal fallback every user gets
  /// regardless of push permission. Filters to `channel: in_app`; a `push` row for the
  /// same event is a separate delivery attempt, not a second notification to show.
  Future<List<NotificationJob>> listInApp() async {
    final json = await _client.get('/notifications') as List;
    return json
        .map((e) => NotificationJob.fromJson(e as Map<String, dynamic>))
        .where((n) => n.channel == 'in_app')
        .toList();
  }

  Future<void> registerPushToken(String token, String platform) =>
      _client.put('/notifications/push-token',
          body: {'token': token, 'platform': platform});
}
