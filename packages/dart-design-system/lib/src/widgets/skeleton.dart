import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../tokens.dart';

/// A shimmering placeholder block — use in place of [CircularProgressIndicator]
/// wherever the loaded content has a predictable shape (a list of cards, a
/// detail page), so the screen looks like it's already loading content rather
/// than just spinning.
class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius = AppRadius.sm,
  });

  final double? width;
  final double height;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Shimmer.fromColors(
      baseColor: scheme.surfaceContainerHigh,
      highlightColor: scheme.surfaceContainerHighest,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}

/// A skeleton shaped like a typical list-item card (avatar + two text lines)
/// — drop a handful of these in a `Column` while a list is loading.
class SkeletonListTile extends StatelessWidget {
  const SkeletonListTile({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          const SkeletonBox(width: 48, height: 48, borderRadius: 24),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                SkeletonBox(width: double.infinity, height: 14),
                SizedBox(height: AppSpacing.xs),
                SkeletonBox(width: 120, height: 12),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
