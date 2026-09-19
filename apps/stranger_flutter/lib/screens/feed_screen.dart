import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:stranger_design_system/stranger_design_system.dart';
import '../core/location_service.dart';
import '../l10n/gen/app_localizations.dart';
import '../layout/responsive.dart';
import '../models/offer.dart';
import '../state/app_state.dart';
import '../widgets/async_state_views.dart';
import '../widgets/feed_item_card.dart';
import '../widgets/location_rationale.dart';
import '../widgets/notification_bell.dart';
import 'city_interests_screen.dart';
import 'offer_detail_screen.dart';

/// Story 2: a recipient with a matching city interest and a current location within
/// the offer's eligibility radius sees it, prioritized by proximity (FR-004/FR-005).
class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key});

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final _locationService = LocationService();
  final _activityController = TextEditingController();
  String? _distanceBandFilter;
  List<DiscoveryFeedItem>? _items;
  Object? _error;
  bool _locating = false;
  // True when the fallback location banner should show as the last-known-location
  // variant rather than the fully-unavailable variant; null means no banner at all.
  bool? _locationIsFallback;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _refresh();
    // Discovery eligibility (new offers, new city interests) is built asynchronously
    // from domain events (see discovery-location's EventConsumersService) — a one-shot
    // refresh can race ahead of that propagation. Poll like ChatScreen/OfferDetailScreen
    // already do, so a nearby offer appears without the user needing to pull-to-refresh.
    _pollTimer = Timer.periodic(
        const Duration(seconds: 5), (_) => _refresh(silent: true));
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _activityController.dispose();
    super.dispose();
  }

  Future<void> _refresh({bool silent = false}) async {
    // A silent background poll shouldn't flash the full-page loading state over
    // whatever the user is currently looking at (or mid-scroll through) — and
    // definitely shouldn't pop the rationale dialog over it either.
    if (!silent) {
      setState(() {
        _locating = true;
        _error = null;
      });
      await showLocationRationaleOnce(context);
      if (!mounted) return;
    }

    final appState = context.read<AppState>();
    try {
      final location = await _locationService.getCurrentLocation();
      if (location != null) {
        await appState.discovery.setLocation(
          lat: location.lat,
          lng: location.lng,
          source: location.isLiveFix ? 'live_gps' : 'last_known',
        );
        _locationIsFallback = location.isLiveFix ? null : true;
      } else {
        _locationIsFallback = false;
      }
    } catch (_) {
      _locationIsFallback = false;
    }

    try {
      final page = await appState.discovery.getFeed(
        activity: _activityController.text.trim(),
        distanceBand: _distanceBandFilter,
      );
      if (!mounted) return;
      setState(() {
        _items = page.items;
        _locating = false;
      });
    } catch (e) {
      if (!mounted) return;
      if (silent) {
        return; // best-effort — don't surface a transient poll failure
      }
      setState(() {
        _error = e;
        _locating = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.feedTitle),
        actions: [
          const NotificationBell(),
          IconButton(
            icon: const Icon(Icons.location_city_outlined),
            tooltip: l10n.cityInterestsTitle,
            // Refresh on return — adding/removing a city interest changes which offers
            // this feed is eligible to show, so a plain push-and-forget left it stale.
            onPressed: () => Navigator.of(context)
                .push(
                  MaterialPageRoute(
                      builder: (_) => const CityInterestsScreen()),
                )
                .then((_) => _refresh()),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ResponsiveCenter(
          maxWidth: 760,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _filterBar(l10n),
              if (_locationIsFallback != null) ...[
                const SizedBox(height: 8),
                _InfoBanner(
                  text: _locationIsFallback!
                      ? l10n.feedLocationFallbackNote
                      : l10n.feedLocationUnavailableNote,
                ),
              ],
              const SizedBox(height: 12),
              if (_error != null)
                SizedBox(
                    height: 300,
                    child: ErrorView(error: _error!, onRetry: _refresh))
              else if (_items == null || _locating)
                const SkeletonListView()
              else if (_items!.isEmpty)
                SizedBox(
                  height: 300,
                  child: EmptyView(
                      message: l10n.feedEmpty, icon: Icons.explore_outlined),
                )
              else
                ..._items!.asMap().entries.map(
                      (entry) => Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: FadeSlideIn(
                          delay: Duration(milliseconds: entry.key * 40),
                          child: FeedItemCard(
                            item: entry.value,
                            // Refresh on return — see my_offers_screen.dart's onTap
                            // for why (expressing interest, or the offer resolving,
                            // changes state a plain push-and-forget would leave
                            // stale here).
                            onTap: () => Navigator.of(context)
                                .push(
                                  MaterialPageRoute(
                                    builder: (_) => OfferDetailScreen(
                                        offerId: entry.value.offerId),
                                  ),
                                )
                                .then((_) => _refresh()),
                          ),
                        ),
                      ),
                    ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _filterBar(AppLocalizations l10n) {
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: _activityController,
            decoration: InputDecoration(
              labelText: l10n.feedFilterActivity,
              isDense: true,
            ),
            onSubmitted: (_) => _refresh(),
          ),
        ),
        const SizedBox(width: 8),
        DropdownMenu<String?>(
          initialSelection: _distanceBandFilter,
          label: Text(l10n.feedDistanceLabel),
          onSelected: (value) {
            setState(() => _distanceBandFilter = value);
            _refresh();
          },
          dropdownMenuEntries: [
            DropdownMenuEntry(value: null, label: l10n.commonAny),
            const DropdownMenuEntry(value: '<1km', label: '<1km'),
            const DropdownMenuEntry(value: '1-5km', label: '1-5km'),
            const DropdownMenuEntry(value: '5-15km', label: '5-15km'),
            const DropdownMenuEntry(value: '15km+', label: '15km+'),
          ],
        ),
      ],
    );
  }
}

class _InfoBanner extends StatelessWidget {
  const _InfoBanner({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline,
              size: 18, color: Theme.of(context).colorScheme.onSurfaceVariant),
          const SizedBox(width: 8),
          Expanded(
              child: Text(text, style: Theme.of(context).textTheme.bodySmall)),
        ],
      ),
    );
  }
}
