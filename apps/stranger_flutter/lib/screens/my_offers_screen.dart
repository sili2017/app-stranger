import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/gen/app_localizations.dart';
import '../l10n/status_labels.dart';
import '../layout/responsive.dart';
import '../models/offer.dart';
import '../state/app_state.dart';
import '../widgets/async_state_views.dart';
import '../widgets/notification_bell.dart';
import 'offer_detail_screen.dart';

/// FR-012: creator-visible history of every offer they've published, including past
/// (expired/stopped) ones — this is also where a rebroadcast's pre-filled draft starts
/// from (see OfferDetailScreen).
class MyOffersScreen extends StatefulWidget {
  const MyOffersScreen({super.key});

  @override
  State<MyOffersScreen> createState() => _MyOffersScreenState();
}

class _MyOffersScreenState extends State<MyOffersScreen> {
  List<MeetOffer>? _offers;
  Object? _error;
  String? _deletingId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final offers = await context.read<AppState>().offer.listMine();
      if (!mounted) return;
      setState(() => _offers = offers);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
  }

  /// Item 28: a creator may declutter their history once an offer is no longer
  /// active — the backend itself rejects deleting a still-active one (stop it first).
  Future<void> _confirmDelete(MeetOffer offer) async {
    final l10n = AppLocalizations.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.myOffersDeleteConfirmTitle),
        content: Text(l10n.myOffersDeleteConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(l10n.myOffersDeleteConfirmAction),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _deletingId = offer.id);
    try {
      await context.read<AppState>().offer.delete(offer.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.myOffersDeleted)));
      await _load();
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _deletingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.myOffersTitle),
        actions: const [NotificationBell()],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ResponsiveCenter(
          maxWidth: 760,
          child: _error != null
              ? ErrorView(error: _error!, onRetry: _load)
              : _offers == null
                  ? const LoadingView()
                  : _offers!.isEmpty
                      ? EmptyView(
                          message: l10n.myOffersEmpty,
                          icon: Icons.campaign_outlined)
                      : ListView(
                          padding: const EdgeInsets.all(16),
                          children: _offers!
                              .map(
                                (o) => Card(
                                  child: ListTile(
                                    title: Text(o.activityText,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis),
                                    subtitle: Text(
                                      l10n.myOffersSubtitle(
                                        '${offerStatusEmoji(o.status)} ${offerStatusLabel(l10n, o.status)}',
                                        o.interestCount,
                                      ),
                                    ),
                                    trailing: o.isActive
                                        ? Text(o.cityId)
                                        : Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Text(o.cityId),
                                              _deletingId == o.id
                                                  ? const Padding(
                                                      padding:
                                                          EdgeInsets.all(8),
                                                      child: SizedBox(
                                                        width: 20,
                                                        height: 20,
                                                        child:
                                                            CircularProgressIndicator(
                                                                strokeWidth: 2),
                                                      ),
                                                    )
                                                  : IconButton(
                                                      icon: const Icon(
                                                          Icons.delete_outline),
                                                      tooltip:
                                                          l10n.myOffersDelete,
                                                      onPressed: () =>
                                                          _confirmDelete(o),
                                                    ),
                                            ],
                                          ),
                                    // Detail lets you stop/rebroadcast/select — a plain `push`
                                    // with no refresh-on-return left this list showing "active"
                                    // for an offer just stopped seconds earlier, since this
                                    // screen's own state is untouched by popping back into it
                                    // (only a tab switch remounts it fresh).
                                    onTap: () => Navigator.of(context)
                                        .push(
                                          MaterialPageRoute(
                                            builder: (_) => OfferDetailScreen(
                                                offerId: o.id),
                                          ),
                                        )
                                        .then((_) => _load()),
                                  ),
                                ),
                              )
                              .toList(),
                        ),
        ),
      ),
    );
  }
}
