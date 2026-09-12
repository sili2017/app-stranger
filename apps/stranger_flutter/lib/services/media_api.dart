import 'dart:convert';
import 'dart:typed_data';
import '../core/api_client.dart';

class UploadedAsset {
  UploadedAsset(
      {required this.id, required this.contentType, required this.byteSize});

  final String id;
  final String contentType;
  final int byteSize;

  factory UploadedAsset.fromJson(Map<String, dynamic> json) => UploadedAsset(
        id: json['id'] as String,
        contentType: json['contentType'] as String,
        byteSize: json['byteSize'] as int,
      );
}

/// Backs the Media service's base64-JSON asset upload (see that service's assets/dto.ts
/// for why base64 over multipart) — used for a profile photo, a verification photo, and
/// a government-ID scan, all of which just need an `assetId` to hand to Identity &
/// Profile afterwards.
class MediaApi {
  MediaApi(this._client);
  final ApiClient _client;

  Future<UploadedAsset> upload({
    required String filename,
    required String contentType,
    required Uint8List bytes,
  }) async {
    final json = await _client.post(
      '/assets',
      body: {
        'filename': filename,
        'contentType': contentType,
        'base64Data': base64Encode(bytes),
      },
    );
    return UploadedAsset.fromJson(json as Map<String, dynamic>);
  }
}
