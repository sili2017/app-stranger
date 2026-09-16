import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/app_exception.dart';
import '../l10n/gen/app_localizations.dart';
import '../l10n/status_labels.dart';
import '../layout/responsive.dart';
import '../models/chat.dart';
import '../models/offer.dart';
import '../state/app_state.dart';
import '../widgets/async_state_views.dart';
import 'chat_screen.dart';
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
  bool _alreadyInterested = false;
  String? _shortPlaceName;
  bool _shortPlaceNameFetchStarted = false;

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
      var alreadyInterested = _alreadyInterested;
      if (offer.creatorUserId == appState.userId) {
        eois = await appState.participation
            .listExpressionsOfInterest(widget.offerId);
      } else {
        alreadyInterested =
            await appState.participation.hasExpressedInterest(widget.offerId);
      }
      if (!mounted) return;
      setState(() {
        _offer = offer;
        _place = place;
        _expressionsOfInterest = eois;
        _alreadyInterested = alreadyInterested;
        _error = null;
      });
      if (place != null &&
          place['label'] == null &&
          !_shortPlaceNameFetchStarted) {
        _shortPlaceNameFetchStarted = true;
        unawaited(_resolveShortPlaceName(
          (place['lat'] as num).toDouble(),
          (place['lng'] as num).toDouble(),
        ));
      }
    } catch (e) {
      if (!mounted) return;
      if (!silent) setState(() => _error = e);
    }
  }

  /// Point 27.2: when the creator didn't type a place label, show a short (2-3 word)
  /// place name instead of raw coordinates — best-effort reverse geocoding via
  /// OpenStreetMap's Nominatim, same no-signup provider publish_screen's city
  /// auto-fill already uses. Never blocks or replaces the exact lat/lng used for the
  /// Maps deep link, only the label text shown to the user.
  Future<void> _resolveShortPlaceName(double lat, double lng) async {
    try {
      final uri = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse'
        '?format=jsonv2&lat=$lat&lon=$lng&zoom=18&addressdetails=1',
      );
      final response =
          await http.get(uri, headers: const {'Accept-Language': 'en'}).timeout(
        const Duration(seconds: 6),
      );
      if (response.statusCode != 200) return;
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final address = data['address'] as Map<String, dynamic>?;
      final candidate = (data['name'] as String?)?.trim().isNotEmpty == true
          ? data['name'] as String
          : (address?['road'] ?? address?['suburb'] ?? address?['neighbourhood'])
              as String?;
      if (candidate == null || candidate.trim().isEmpty) return;
      final shortened =
          candidate.trim().split(RegExp(r'\s+')).take(3).join(' ');
      if (!mounted) return;
      setState(() => _shortPlaceName = shortened);
    } catch (_) {
      // best-effort; the raw pin still opens Maps correctly either way
    }
  }

  Future<void> _openInMaps(double lat, double lng, String? label) async {
    final l10n = AppLocalizations.of(context)!;
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.map_outlined),
              title: Text(l10n.offerOpenInGoogleMaps),
              onTap: () => Navigator.of(sheetContext).pop('google'),
            ),
            ListTile(
              leading: const Icon(Icons.map_outlined),
              title: Text(l10n.offerOpenInAppleMaps),
              onTap: () => Navigator.of(sheetContext).pop('apple'),
            ),
          ],
        ),
      ),
    );
    if (choice == null || !mounted) return;
    final query = Uri.encodeComponent(label ?? '$lat,$lng');
    final uri = choice == 'apple'
        ? Uri.parse('https://maps.apple.com/?ll=$lat,$lng&q=$query')
        : Uri.parse('https://www.google.com/maps/search/?api=1&query=$lat,$lng');
    final opened =
        await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      showErrorSnackBar(context, l10n.offerMapsLaunchFailed);
    }
  }

  /// Point 27.1: best-effort social share of the just-published offer — never the
  /// exact place (still gated behind selection per FR-002), only the activity text,
  /// city, and a link back to the app.
  Future<void> _shareOnSocial(String platform) async {
    final l10n = AppLocalizations.of(context)!;
    final offer = _offer!;
    final message = l10n.offerShareMessage(
      offer.activityText,
      offer.cityId,
      Uri.base.toString(),
    );
    if (platform == 'instagram') {
      await Clipboard.setData(ClipboardData(text: message));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.offerShareInstagramHint)),
        );
      }
    }
    final uri = switch (platform) {
      'whatsapp' => Uri.parse('https://wa.me/?text=${Uri.encodeComponent(message)}'),
      'facebook' => Uri.parse(
          'https://www.facebook.com/sharer/sharer.php'
          '?u=${Uri.encodeComponent(Uri.base.toString())}'
          '&quote=${Uri.encodeComponent(message)}',
        ),
      _ => Uri.parse('https://www.instagram.com/'),
    };
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      showErrorSnackBar(context, l10n.offerShareLaunchFailed);
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
        setState(() => _alreadyInterested = true);
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
      if (mounted) await _navigateToChatWhenReady();
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Item 29: tapping the green checkmark on an already-selected expression of
  /// interest opens the shared chat for this offer — same lookup _select() already
  /// does right after choosing someone, reused here for a selection made earlier.
  Future<void> _openChatForSelection() async {
    setState(() => _busy = true);
    try {
      await _navigateToChatWhenReady();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Chat creation is async (Messaging consumes participation.participant-selected —
  /// see chat-creation.consumer.ts) so there's no chatId synchronously from select()
  /// itself. Poll the caller's own conversation list, filtered by this offer, bounded,
  /// with a non-blocking fallback if it isn't ready in time.
  Future<void> _navigateToChatWhenReady() async {
    final appState = context.read<AppState>();
    final deadline = DateTime.now().add(const Duration(seconds: 15));
    while (DateTime.now().isBefore(deadline)) {
      try {
        final chats = await appState.messaging.listConversations();
        Chat? match;
        for (final c in chats) {
          if (c.offerId == widget.offerId) {
            match = c;
            break;
          }
        }
        if (match != null && mounted) {
          Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => ChatScreen(
              chatId: match!.id,
              offerId: match.offerId,
              title: _offer?.activityText ?? match.offerId,
              isActive: match.isActive,
            ),
          ));
          return;
        }
      } catch (_) {
        // best-effort; retry until the deadline
      }
      await Future.delayed(const Duration(seconds: 2));
      if (!mounted) return;
    }
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppLocalizations.of(context)!.offerChatNotReadyYet)),
      );
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

  /// Convergence T132 (FR-015, Clarifications Session 2026-09-12 round 2): manual,
  /// one-tap — not automatic or continuous. The backend returns a preformatted message
  /// for the user to hand off via whatever channel they and their contact already use.
  Future<void> _shareMeetup() async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _busy = true);
    try {
      final share =
          await context.read<AppState>().trustSafety.shareMeetup(widget.offerId);
      await Clipboard.setData(ClipboardData(text: share.message));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.safetyShareMeetupSent)),
        );
      }
    } on AppException catch (e) {
      if (!mounted) return;
      if (e.code == 'NO_TRUSTED_CONTACT') {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.safetyShareMeetupNoContact)),
        );
      } else {
        showErrorSnackBar(context, e);
      }
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
    final lat = (_place!['lat'] as num).toDouble();
    final lng = (_place!['lng'] as num).toDouble();
    final label = _place!['label'] as String? ?? _shortPlaceName;
    final rendezvous = _place!['rendezvousInstruction'] as String?;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.place_outlined),
                  tooltip: l10n.offerOpenInMaps,
                  onPressed: () => _openInMaps(lat, lng, label),
                ),
                Expanded(
                  child: Text(
                    label ?? l10n.offerLocationPinned,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              ],
            ),
            if (rendezvous != null) ...[
              const SizedBox(height: 8),
              Text(l10n.offerRendezvousInstructions(rendezvous)),
            ],
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: _busy ? null : _shareMeetup,
                icon: const Icon(Icons.shield_outlined),
                label: Text(l10n.safetyShareMeetup),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _shareOfferSection(BuildContext context, AppLocalizations l10n) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.offerShareOfferTitle,
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: () => _shareOnSocial('whatsapp'),
                icon: const Icon(Icons.chat_bubble_outline),
                label: Text(l10n.offerShareWhatsapp),
              ),
              OutlinedButton.icon(
                onPressed: () => _shareOnSocial('facebook'),
                icon: const Icon(Icons.facebook_outlined),
                label: Text(l10n.offerShareFacebook),
              ),
              OutlinedButton.icon(
                onPressed: () => _shareOnSocial('instagram'),
                icon: const Icon(Icons.camera_alt_outlined),
                label: Text(l10n.offerShareInstagram),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _creatorControls(BuildContext context, AppLocalizations l10n) {
    final offer = _offer!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (offer.isActive) _shareOfferSection(context, l10n),
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
                    ? IconButton(
                        icon: const Icon(Icons.check_circle,
                            color: Colors.green),
                        tooltip: l10n.offerSelected,
                        onPressed: _busy ? null : _openChatForSelection,
                      )
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
          onPressed: (_busy || _alreadyInterested) ? null : _expressInterest,
          icon: Icon(_alreadyInterested
              ? Icons.favorite
              : Icons.waving_hand_outlined),
          label: Text(_alreadyInterested
              ? l10n.offerInterestSentLabel
              : l10n.offerImInterested),
        ),
      ],
    );
  }
}
