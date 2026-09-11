import '../core/api_client.dart';
import '../models/profile.dart';

class EntitlementsApi {
  EntitlementsApi(this._client);
  final ApiClient _client;

  Future<Entitlements> getEntitlements() async {
    final json = await _client.get('/entitlements');
    return Entitlements.fromJson(json as Map<String, dynamic>);
  }

  Future<void> purchaseOneTimeBroadcast(
          {String receiptToken = 'dev-mock-receipt-token'}) =>
      _client
          .post('/broadcast-purchases', body: {'receiptToken': receiptToken});

  Future<void> subscribe(String plan,
          {String receiptToken = 'dev-mock-receipt-token'}) =>
      _client.post('/subscriptions',
          body: {'plan': plan, 'receiptToken': receiptToken});
}
