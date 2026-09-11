import 'package:flutter/material.dart';
import '../l10n/gen/app_localizations.dart';
import '../models/offer.dart';

class FeedItemCard extends StatelessWidget {
  const FeedItemCard({super.key, required this.item, required this.onTap});

  final DiscoveryFeedItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final remaining = item.timeRemaining;
    final minutesLeft = remaining.inMinutes.clamp(0, 999);
    return Card(
      child: ListTile(
        onTap: onTap,
        leading:
            CircleAvatar(child: Text(item.distanceBand.replaceAll('km', ''))),
        title: Text(item.activityText,
            maxLines: 2, overflow: TextOverflow.ellipsis),
        subtitle: Text(
          l10n.feedItemSummary(
              item.distanceBand, item.interestCount, minutesLeft),
        ),
        trailing: Text(item.cityId),
      ),
    );
  }
}
