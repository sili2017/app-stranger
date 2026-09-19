import 'package:flutter/material.dart';
import '../tokens.dart';

enum StatusTone { neutral, positive, warning, danger, info }

/// A colored pill for a single piece of state (an offer's status, a
/// verification state, …) — replaces the raw unstyled [Chip] rows that
/// otherwise all look identical regardless of what they're actually saying.
class StatusBadge extends StatelessWidget {
  const StatusBadge({
    super.key,
    required this.label,
    this.tone = StatusTone.neutral,
    this.icon,
  });

  final String label;
  final StatusTone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final (bg, fg) = switch (tone) {
      StatusTone.neutral => (scheme.surfaceContainerHigh, scheme.onSurface),
      StatusTone.positive => (
          const Color(0xFFD7F2DE),
          const Color(0xFF1E7A3B)
        ),
      StatusTone.warning => (
          const Color(0xFFFBEBCE),
          const Color(0xFF8A5A00)
        ),
      StatusTone.danger => (scheme.errorContainer, scheme.onErrorContainer),
      StatusTone.info => (scheme.secondaryContainer, scheme.onSecondaryContainer),
    };

    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: fg),
            const SizedBox(width: AppSpacing.xs),
          ],
          Text(
            label,
            style: Theme.of(context)
                .textTheme
                .labelMedium
                ?.copyWith(color: fg),
          ),
        ],
      ),
    );
  }
}
