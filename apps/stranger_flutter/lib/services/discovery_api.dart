import '../core/api_client.dart';
import '../models/offer.dart';

class DiscoveryFeedPage {
  DiscoveryFeedPage(this.items, this.nextCursor);
  final List<DiscoveryFeedItem> items;
  final String? nextCursor;
}

class DiscoveryApi {
  DiscoveryApi(this._client);
  final ApiClient _client;

  Future<void> setLocation(
          {required double lat, required double lng, String? source}) =>
      _client.put('/me/location',
          body: {'lat': lat, 'lng': lng, 'source': source ?? 'live_gps'});

  Future<DiscoveryFeedPage> getFeed({
    String? activity,
    String? distanceBand,
    String? cursor,
  }) async {
    final json = await _client.get(
      '/discovery/feed',
      query: {
        if (activity != null && activity.isNotEmpty) 'activity': activity,
        if (distanceBand != null) 'distanceBand': distanceBand,
        if (cursor != null) 'cursor': cursor,
      },
    ) as Map<String, dynamic>;
    final items = (json['items'] as List)
        .map((e) => DiscoveryFeedItem.fromJson(e as Map<String, dynamic>))
        .toList();
    return DiscoveryFeedPage(items, json['nextCursor'] as String?);
  }
}
