import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/app_exception.dart';
import '../l10n/gen/app_localizations.dart';
import '../l10n/status_labels.dart';
import '../layout/responsive.dart';
import '../models/offer.dart';
import '../state/app_state.dart';
import '../widgets/async_state_views.dart';
import 'entitlements_screen.dart';

/// Story 3: a recipient expresses interest, the creator selects, the exact place is
/// revealed only to the creator and the selected recipient (FR-002), a shared chat opens
/// automatically (handled server-side on selection — see ConversationsScreen).
class OfferDetailScreen extends StatefulWidget {
  const OfferDetailScreen({super.key, required this.offerId});
  final String offerId;

  @override
  State<OfferDetailScreen> createState() => _OfferDetailScreenState();
}

class _OfferDetailScreenState extends State<OfferDetailScreen> {
  MeetOffer? _offer;
  Map<String, dynamic>? _place;
  List<Map<String, dynamic>>? _expressionsOfInterest;
  Object? _error;
  Timer? _pollTimer;
  final _messageController = TextEditingController();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
    _pollTimer =
        Timer.periodic(const Duration(seconds: 5), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _messageController.dispose();
    super.dispose();
  }

  bool get _isCreator {
    final appState = context.read<AppState>();
    return _offer != null && _offer!.creatorUserId == appState.userId;
  }

  Future<void> _load({bool silent = false}) async {
    final appState = context.read<AppState>();
    try {
      final offer = await appState.offer.getOffer(widget.offerId);
      final place = await appState.offer.getExactPlace(widget.offerId);
      List<Map<String, dynamic>>? eois;
      if (offer.creatorUserId == appState.userId) {
        eois = await appState.participation
            .listExpressionsOfInterest(widget.offerId);
      }
      if (!mounted) return;
      setState(() {
        _offer = offer;
        _place = place;
        _expressionsOfInterest = eois;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      if (!silent) setState(() => _error = e);
    }
  }

  Future<void> _expressInterest() async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _busy = true);
    try {
      await context.read<AppState>().participation.expressInterest(
            widget.offerId,
            message: _messageController.text.trim(),
          );
      _messageController.clear();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.offerInterestSent)));
      }
      await _load();
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _select(String eoiId) async {
    setState(() => _busy = true);
    try {
      await context
          .read<AppState>()
          .participation
          .select(widget.offerId, eoiId);
      await _load();
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _stop() async {
    setState(() => _busy = true);
    try {
      await context.read<AppState>().offer.stop(widget.offerId);
      await _load();
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _rebroadcast() async {
    setState(() => _busy = true);
    final appState = context.read<AppState>();
    try {
      final draft = await appState.offer.getRebroadcastDraft(widget.offerId);
      final created =
          await appState.offer.confirmRebroadcast(widget.offerId, draft);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
            builder: (_) => OfferDetailScreen(offerId: created.id)),
      );
    } on AppException catch (e) {
      if (!mounted) return;
      if (e.code == 'ENTITLEMENT_REQUIRED') {
        Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const EntitlementsScreen()));
      } else {
        showErrorSnackBar(context, e);
      }
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.offerDetailTitle)),
      body: _error != null
          ? ErrorView(error: _error!, onRetry: _load)
          : _offer == null
              ? const LoadingView()
              : ResponsiveCenter(child: _body(context, l10n)),
    );
  }

  Widget _body(BuildContext context, AppLocalizations l10n) {
    final offer = _offer!;
    final minutesLeft = offer.timeRemaining.inMinutes.clamp(0, 999);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(offer.activityText,
            style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: [
            Chip(
              label: Text(
                '${offerStatusEmoji(offer.status)} ${offerStatusLabel(l10n, offer.status)}',
              ),
            ),
            Chip(label: Text(l10n.offerSpots(offer.capacity))),
            Chip(label: Text(l10n.offerInterested(offer.interestCount))),
            if (offer.isActive)
              Chip(label: Text(l10n.offerMinutesLeft(minutesLeft))),
          ],
        ),
        const SizedBox(height: 16),
        if (offer.moneyPreferenceLabel != null)
          Text(
            offer.moneyPreferenceNote != null
                ? l10n.offerMoneyPreferenceWithNote(
                    offer.moneyPreferenceLabel!,
                    offer.moneyPreferenceNote!,
                  )
                : l10n.offerMoneyPreference(offer.moneyPreferenceLabel!),
          ),
        const SizedBox(height: 16),
        _placeCard(context, l10n),
        const SizedBox(height: 24),
        if (_isCreator)
          _creatorControls(context, l10n)
        else
          _recipientControls(context, l10n),
      ],
    );
  }

  Widget _placeCard(BuildContext context, AppLocalizations l10n) {
    if (_place == null) {
      return Card(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              const Icon(Icons.lock_outline),
              const SizedBox(width: 8),
              Expanded(child: Text(l10n.offerPlaceLocked)),
            ],
          ),
        ),
      );
    }
    final label = _place!['label'] as String?;
    final rendezvous = _place!['rendezvousInstruction'] as String?;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.place_outlined),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    label ?? '${_place!['lat']}, ${_place!['lng']}',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              ],
            ),
            if (rendezvous != null) ...[
              const SizedBox(height: 8),
              Text(l10n.offerRendezvousInstructions(rendezvous)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _creatorControls(BuildContext context, AppLocalizations l10n) {
    final offer = _offer!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (offer.isActive)
          OutlinedButton.icon(
            onPressed: _busy ? null : _stop,
            icon: const Icon(Icons.stop_circle_outlined),
            label: Text(l10n.offerStop),
          )
        else
          FilledButton.icon(
            onPressed: _busy ? null : _rebroadcast,
            icon: const Icon(Icons.replay),
            label: Text(l10n.offerRebroadcast),
          ),
        const SizedBox(height: 16),
        Text(l10n.offerExpressionsOfInterest,
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        if (_expressionsOfInterest == null)
          const LoadingView()
        else if (_expressionsOfInterest!.isEmpty)
          EmptyView(message: l10n.offerNoInterestYet)
        else
          ..._expressionsOfInterest!.map((eoi) {
            final selected = eoi['selected'] == true;
            return Card(
              child: ListTile(
                leading: const Icon(Icons.person_outline),
                title: Text(eoi['recipientUserId'] as String),
                subtitle: Text((eoi['message'] as String?) ?? ''),
                trailing: selected
                    ? Chip(label: Text(l10n.offerSelected))
                    : FilledButton(
                        onPressed: (_busy || !offer.isActive)
                            ? null
                            : () => _select(eoi['id'] as String),
                        child: Text(l10n.offerSelect),
                      ),
              ),
            );
          }),
      ],
    );
  }

  Widget _recipientControls(BuildContext context, AppLocalizations l10n) {
    final offer = _offer!;
    if (!offer.isActive) {
      return EmptyView(
          message: l10n.offerNotActive, icon: Icons.event_busy_outlined);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _messageController,
          decoration: InputDecoration(
            labelText: l10n.offerMessageLabel,
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: _busy ? null : _expressInterest,
          icon: const Icon(Icons.waving_hand_outlined),
          label: Text(l10n.offerImInterested),
        ),
      ],
    );
  }
}
