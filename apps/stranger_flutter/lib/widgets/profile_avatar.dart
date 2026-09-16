import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/api_config.dart';
import '../state/app_state.dart';

/// Feature 25: the first `Image.network` usage in this app, so this sets the
/// convention — a plain `NetworkImage(url)` with no headers would 403. Mirrors
/// ApiClient's own header logic (core/api_client.dart): a real session sends
/// `Authorization: Bearer <token>`, a dev-only sign-in falls back to `x-dev-user-id`
/// (ultrareview finding: this used to hardcode only the dev header, so every avatar
/// 401'd for anyone signed in with a real session once a service verifies it for
/// real).
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
    final session = context.read<AppState>().session;
    final token = session.token;
    final userId = session.userId;
    final headers = token != null
        ? {'Authorization': 'Bearer $token'}
        : userId != null
            ? {'x-dev-user-id': userId}
            : null;
    return CircleAvatar(
      radius: radius,
      child: ClipOval(
        child: Image.network(
          '${ApiConfig.media}/assets/$assetId/content',
          headers: headers,
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
