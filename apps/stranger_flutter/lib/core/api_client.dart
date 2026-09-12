import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import 'app_exception.dart';
import 'session.dart';

/// Thin REST client for one domain service's base URL. Every backend service returns
/// contracts/api-standards.md's standard envelope on error, so this is the single place
/// that turns a non-2xx response into an [AppException] — callers never parse JSON errors
/// themselves.
class ApiClient {
  ApiClient(this.baseUrl, this.session);

  final String baseUrl;
  final Session session;
  final http.Client _http = http.Client();

  Map<String, String> _headers({String? idempotencyKey}) {
    final headers = {'Content-Type': 'application/json'};
    final userId = session.userId;
    if (userId != null) headers['x-dev-user-id'] = userId;
    if (idempotencyKey != null) headers['Idempotency-Key'] = idempotencyKey;
    return headers;
  }

  Uri _uri(String path, [Map<String, String>? query]) {
    final uri = Uri.parse('$baseUrl$path');
    if (query == null || query.isEmpty) return uri;
    return uri.replace(queryParameters: {...uri.queryParameters, ...query});
  }

  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    final response =
        await _send(() => _http.get(_uri(path, query), headers: _headers()));
    return _decode(response);
  }

  Future<dynamic> post(String path,
      {Object? body, String? idempotencyKey}) async {
    final response = await _send(
      () => _http.post(
        _uri(path),
        headers:
            _headers(idempotencyKey: idempotencyKey ?? newIdempotencyKey()),
        body: body == null ? null : jsonEncode(body),
      ),
    );
    return _decode(response);
  }

  Future<dynamic> put(String path, {Object? body}) async {
    final response = await _send(
      () => _http.put(
        _uri(path),
        headers: _headers(),
        body: body == null ? null : jsonEncode(body),
      ),
    );
    return _decode(response);
  }

  Future<dynamic> patch(String path, {Object? body}) async {
    final response = await _send(
      () => _http.patch(
        _uri(path),
        headers: _headers(),
        body: body == null ? null : jsonEncode(body),
      ),
    );
    return _decode(response);
  }

  Future<dynamic> delete(String path) async {
    final response =
        await _send(() => _http.delete(_uri(path), headers: _headers()));
    return _decode(response);
  }

  Future<http.Response> _send(Future<http.Response> Function() fn) async {
    try {
      return await fn();
    } on http.ClientException catch (e) {
      throw NetworkException(e.message);
    } catch (e) {
      throw NetworkException(e.toString());
    }
  }

  dynamic _decode(http.Response response) {
    final body = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }
    if (body is Map && body['error'] is Map) {
      final error = body['error'] as Map;
      throw AppException(
        (error['code'] ?? 'UNKNOWN') as String,
        (error['messageKey'] ?? 'errors.unknown') as String,
        response.statusCode,
        (error['details'] as List?) ?? const [],
      );
    }
    throw AppException(
        'HTTP_${response.statusCode}', 'errors.unknown', response.statusCode);
  }

  /// Good enough entropy for a dev tool's retry-safety key — not cryptographically
  /// reviewed, since the backend's IdempotencyInterceptor only needs uniqueness per
  /// logical action, not unguessability.
  static String newIdempotencyKey() {
    final rand = Random();
    final suffix =
        List.generate(8, (_) => rand.nextInt(36).toRadixString(36)).join();
    return '${DateTime.now().microsecondsSinceEpoch}-$suffix';
  }
}
