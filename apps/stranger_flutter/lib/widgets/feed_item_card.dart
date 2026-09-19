import 'package:flutter/material.dart';
import 'package:stranger_design_system/stranger_design_system.dart';
import '../l10n/gen/app_localizations.dart';
import '../models/offer.dart';

class FeedItemCard extends StatelessWidget {
  const FeedItemCard({super.key, required this.item, required this.onTap});

  final DiscoveryFeedItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final remaining = item.timeRemaining;
    final minutesLeft = remaining.inMinutes.clamp(0, 999);
    final urgent = minutesLeft <= 15;

    return AppCard(
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: scheme.primaryContainer,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              item.distanceBand.replaceAll('km', ''),
              style: textTheme.labelLarge
                  ?.copyWith(color: scheme.onPrimaryContainer),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.activityText,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.titleSmall,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  l10n.feedItemSummary(
                      item.distanceBand, item.interestCount, minutesLeft),
                  style: textTheme.bodySmall
                      ?.copyWith(color: scheme.onSurfaceVariant),
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    StatusBadge(
                      label: item.cityId,
                      tone: StatusTone.neutral,
                      icon: Icons.place_outlined,
                    ),
                    if (urgent) ...[
                      const SizedBox(width: AppSpacing.xs),
                      StatusBadge(
                        label: l10n.feedEndingSoon,
                        tone: StatusTone.warning,
                        icon: Icons.timer_outlined,
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
