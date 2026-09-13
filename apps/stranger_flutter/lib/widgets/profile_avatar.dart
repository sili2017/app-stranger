import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/api_config.dart';
import '../state/app_state.dart';

/// Feature 25: the first `Image.network` usage in this app, so this sets the
/// convention. The app's ApiClient authenticates via a plain `x-dev-user-id` header
/// rather than a bearer token (core/api_client.dart), so the request needs that header
/// passed explicitly — a plain `NetworkImage(url)` with no headers would 403.
class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({
    super.key,
    required this.photoAssetId,
    required this.fallbackText,
    this.radius = 36,
  });

  final String? photoAssetId;
  final String fallbackText;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final assetId = photoAssetId;
    if (assetId == null) {
      return CircleAvatar(radius: radius, child: Text(fallbackText));
    }
    final userId = context.read<AppState>().userId;
    return CircleAvatar(
      radius: radius,
      child: ClipOval(
        child: Image.network(
          '${ApiConfig.media}/assets/$assetId/content',
          headers: userId != null ? {'x-dev-user-id': userId} : null,
          errorBuilder: (context, error, stack) => Text(fallbackText),
          width: radius * 2,
          height: radius * 2,
          fit: BoxFit.cover,
          loadingBuilder: (context, child, progress) => progress == null
              ? child
              : const CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
    );
  }
}
