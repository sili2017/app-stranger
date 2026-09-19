import 'package:flutter/material.dart';

import '../tokens.dart';

/// A consistently-styled surface — soft shadow, rounded corners, optional tap
/// ripple — for anything that used to reach for a bare Material [Card].
/// Deliberately has a real (if subtle) shadow rather than Material 3's flat
/// tonal-elevation default, since a flat surface-on-surface card reads as
/// "unfinished" against this app's otherwise colorful surfaces.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(AppSpacing.md),
    this.color,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final surface = Material(
      color: color ?? scheme.surfaceContainerLow,
      borderRadius: BorderRadius.circular(AppRadius.md),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(padding: padding, child: child),
      ),
    );

    return _shadowWrap(surface);
  }

  Widget _shadowWrap(Widget child) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.md),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
  }
}
