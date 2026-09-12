import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../core/app_exception.dart';
import '../core/location_service.dart';
import '../l10n/city_data.dart';
import '../l10n/gen/app_localizations.dart';
import '../layout/responsive.dart';
import '../services/offer_api.dart';
import '../state/app_state.dart';
import '../widgets/analog_clock_dial.dart';
import '../widgets/async_state_views.dart';
import '../widgets/location_rationale.dart';
import 'entitlements_screen.dart';
import 'offer_detail_screen.dart';

/// Curated activity ideas, each with a matching emoji baked in, shown as the user
/// types in the activity field — meant to both speed up publishing and make a
/// free-text offer more inviting to browse in Discover.
const List<String> _activitySuggestions = [
  '☕ Grab a coffee together',
  '🍵 Sunny wants to drink tea',
  '🎲 Play some board games',
  '🚶 Go for an evening walk',
  '🏏 Casual game of cricket',
  '🍜 Try a new street food stall',
  '📸 Explore the city and take photos',
  '🎬 Watch a movie together',
  '⚽ Kick a football around',
  '🎨 Sketch or paint outdoors',
  '📚 Study or read together at a cafe',
  '🎵 Jam session — bring an instrument',
  '🧘 Morning yoga in the park',
  '🚴 Cycle around the neighborhood',
  '🍦 Ice cream run',
];

/// A broader palette for the standalone smiley picker, so a custom (non-suggested)
/// activity can still be made more lucrative with an emoji.
const List<String> _emojiPalette = [
  '😀', '😊', '😎', '🥳', '😍', '🤩', '😋', '🙌', '👋', '🤝', //
  '☕', '🍵', '🍕', '🍦', '🍜', '🎲', '⚽', '🏏', '🎬', '🎵', //
  '📸', '🎨', '📚', '🧘', '🚴', '🚶', '🌇', '🌊', '🏖️', '🎉', //
];

/// Story 1: publish a meet offer — default 15-minute lifetime (FR-003), capacity fixed
/// at publish (FR-008), free-text activity with no fixed catalog (FR-018).
class PublishScreen extends StatefulWidget {
  const PublishScreen({super.key});

  @override
  State<PublishScreen> createState() => _PublishScreenState();
}

class _PublishScreenState extends State<PublishScreen> {
  final _formKey = GlobalKey<FormState>();
  final _activityController = TextEditingController();
  // RawAutocomplete asserts textEditingController and focusNode are either both
  // supplied or both omitted — Autocomplete needs an explicit controller so the emoji
  // picker and suggestion selection can both write into the same field, so this has to
  // come along with it.
  final _activityFocusNode = FocusNode();
  final _cityController = TextEditingController();
  final _cityFocusNode = FocusNode();
  final _placeLabelController = TextEditingController();
  final _rendezvousController = TextEditingController();
  final _moneyNoteController = TextEditingController();

  String _placeKind = 'pin';
  double? _lat;
  double? _lng;
  int _lifetimeMinutes = 15;
  int _capacity = 3;
  String _moneyLabel = 'split';
  bool _submitting = false;
  bool _locating = false;

  @override
  void initState() {
    super.initState();
    // Best-effort: silently try to have both the place pin and the city field ready
    // before the user touches anything, so publishing is a single flow rather than a
    // "type activity, then remember to also set location and city" chore. Never blocks
    // the form and never overwrites something the user already typed.
    // Deferred to after the first frame — showLocationRationaleOnce calls showDialog,
    // which Flutter disallows synchronously inside initState.
    WidgetsBinding.instance
        .addPostFrameCallback((_) => _prefillFromCurrentLocation());
  }

  @override
  void dispose() {
    _activityController.dispose();
    _activityFocusNode.dispose();
    _cityController.dispose();
    _cityFocusNode.dispose();
    _placeLabelController.dispose();
    _rendezvousController.dispose();
    _moneyNoteController.dispose();
    super.dispose();
  }

  Future<void> _prefillFromCurrentLocation() async {
    if (mounted) await showLocationRationaleOnce(context);
    if (!mounted) return;
    final result = await LocationService().getCurrentLocation();
    if (!mounted || result == null) return;
    setState(() {
      _lat ??= result.lat;
      _lng ??= result.lng;
    });
    if (_cityController.text.trim().isNotEmpty) return;
    final city = await _reverseGeocodeCity(result.lat, result.lng);
    if (!mounted || city == null) return;
    if (_cityController.text.trim().isEmpty) {
      setState(() => _cityController.text = city);
    }
  }

  /// Client-side reverse geocoding via OpenStreetMap's Nominatim — a concrete,
  /// no-signup pick for the "geocoding/reverse-geocoding provider for city
  /// normalization" follow-up ADQ-003 left open (`docs/architecture/decisions.md`).
  /// Best-effort only: city auto-fill is a convenience, never required to publish, so
  /// any failure (network, rate limit, no address match) just leaves the field empty
  /// for the user to fill in themselves.
  Future<String?> _reverseGeocodeCity(double lat, double lng) async {
    try {
      final uri = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse'
        '?format=jsonv2&lat=$lat&lon=$lng&zoom=10',
      );
      final response =
          await http.get(uri, headers: const {'Accept-Language': 'en'}).timeout(
        const Duration(seconds: 6),
      );
      if (response.statusCode != 200) return null;
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final address = data['address'] as Map<String, dynamic>?;
      final city = (address?['city'] ?? address?['town'] ?? address?['village'])
          as String?;
      if (city == null) return null;
      final slug = city.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '');
      return slug.isEmpty ? null : slug;
    } catch (_) {
      return null;
    }
  }

  Future<void> _useCurrentLocation() async {
    await showLocationRationaleOnce(context);
    if (!mounted) return;
    setState(() => _locating = true);
    final locationService = LocationService();
    final result = await locationService.getCurrentLocation();
    if (!mounted) return;
    setState(() {
      _locating = false;
      if (result != null) {
        _lat = result.lat;
        _lng = result.lng;
      }
    });
    if (result == null && mounted) {
      final l10n = AppLocalizations.of(context)!;
      final message = switch (locationService.lastFailureReason) {
        LocationFailureReason.insecureOrigin => l10n.feedLocationInsecureOrigin,
        LocationFailureReason.permissionDenied =>
          l10n.feedLocationPermissionDenied,
        _ => l10n.feedLocationError,
      };
      showErrorSnackBar(context, message);
    }
  }

  /// Opens a smiley grid and inserts the pick at the activity field's current cursor
  /// position (or appends, if nothing is focused) — lets a fully custom activity text
  /// still be made more lucrative, not just one chosen from `_activitySuggestions`.
  Future<void> _pickEmoji(TextEditingController controller) async {
    final l10n = AppLocalizations.of(context)!;
    final emoji = await showModalBottomSheet<String>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.publishEmojiPickerTitle,
                style: Theme.of(sheetContext).textTheme.titleMedium,
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _emojiPalette
                    .map(
                      (emoji) => InkWell(
                        borderRadius: BorderRadius.circular(8),
                        onTap: () => Navigator.of(sheetContext).pop(emoji),
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child:
                              Text(emoji, style: const TextStyle(fontSize: 24)),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ],
          ),
        ),
      ),
    );
    if (emoji == null) return;
    final text = controller.text;
    final selection = controller.selection;
    final insertAt = selection.isValid ? selection.start : text.length;
    final removeEnd = selection.isValid ? selection.end : insertAt;
    final newText = text.replaceRange(insertAt, removeEnd, emoji);
    controller.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: insertAt + emoji.length),
    );
  }

  bool get _requiresRendezvous => _placeKind == 'moving';

  Future<void> _publish() async {
    final l10n = AppLocalizations.of(context)!;
    if (!_formKey.currentState!.validate()) return;
    if (_lat == null || _lng == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.publishSetLocationFirst)));
      return;
    }

    setState(() => _submitting = true);
    final appState = context.read<AppState>();
    try {
      final offer = await appState.offer.publish(
        activityText: _activityController.text.trim(),
        placeKind: _placeKind,
        lat: _lat!,
        lng: _lng!,
        placeLabel: _placeLabelController.text.trim().isEmpty
            ? null
            : _placeLabelController.text.trim(),
        rendezvousInstruction: _rendezvousController.text.trim().isEmpty
            ? null
            : _rendezvousController.text.trim(),
        cityId: _cityController.text.trim().toLowerCase(),
        lifetimeMinutes: _lifetimeMinutes,
        capacity: _capacity,
        moneyPreference: MoneyPreference(
          label: _moneyLabel,
          note: _moneyNoteController.text.trim().isEmpty
              ? null
              : _moneyNoteController.text.trim(),
        ),
      );
      if (!mounted) return;
      _activityController.clear();
      _placeLabelController.clear();
      _rendezvousController.clear();
      _moneyNoteController.clear();
      Navigator.of(
        context,
      ).push(MaterialPageRoute(
          builder: (_) => OfferDetailScreen(offerId: offer.id)));
    } on AppException catch (e) {
      if (!mounted) return;
      if (e.code == 'ENTITLEMENT_REQUIRED') {
        await _showEntitlementRequiredDialog();
      } else {
        showErrorSnackBar(context, e);
      }
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _showEntitlementRequiredDialog() {
    final l10n = AppLocalizations.of(context)!;
    return showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.loginEntitlementDialogTitle),
        content: Text(l10n.loginEntitlementDialogBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(l10n.loginEntitlementNotNow),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const EntitlementsScreen()),
              );
            },
            child: Text(l10n.loginEntitlementViewOptions),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.publishTitle)),
      body: ResponsiveCenter(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Autocomplete<String>(
                textEditingController: _activityController,
                focusNode: _activityFocusNode,
                optionsBuilder: (value) {
                  final query = value.text.trim().toLowerCase();
                  if (query.isEmpty) return const Iterable<String>.empty();
                  return _activitySuggestions
                      .where((s) => s.toLowerCase().contains(query));
                },
                onSelected: (selection) => _activityController.text = selection,
                fieldViewBuilder:
                    (context, controller, focusNode, onFieldSubmitted) {
                  return TextFormField(
                    controller: controller,
                    focusNode: focusNode,
                    decoration: InputDecoration(
                      labelText: l10n.publishActivityLabel,
                      hintText: l10n.publishActivityHint,
                      border: const OutlineInputBorder(),
                      suffixIcon: IconButton(
                        icon: const Icon(Icons.emoji_emotions_outlined),
                        tooltip: l10n.publishEmojiPickerTooltip,
                        onPressed: () => _pickEmoji(controller),
                      ),
                    ),
                    maxLength: 140,
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? l10n.publishRequired
                        : null,
                  );
                },
              ),
              const SizedBox(height: 12),
              Autocomplete<String>(
                textEditingController: _cityController,
                focusNode: _cityFocusNode,
                optionsBuilder: (value) {
                  final query = value.text.trim().toLowerCase();
                  if (query.isEmpty) return const Iterable<String>.empty();
                  return knownCityIds.where((c) => c.contains(query));
                },
                onSelected: (selection) => _cityController.text = selection,
                fieldViewBuilder:
                    (context, controller, focusNode, onFieldSubmitted) {
                  return TextFormField(
                    controller: controller,
                    focusNode: focusNode,
                    decoration: InputDecoration(
                      labelText: l10n.publishCityLabel,
                      border: const OutlineInputBorder(),
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? l10n.publishRequired
                        : null,
                  );
                },
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: _placeKind,
                decoration: InputDecoration(
                  labelText: l10n.publishPlaceKindLabel,
                  border: const OutlineInputBorder(),
                ),
                items: [
                  DropdownMenuItem(
                      value: 'pin', child: Text(l10n.publishPlaceKindPin)),
                  DropdownMenuItem(
                      value: 'venue', child: Text(l10n.publishPlaceKindVenue)),
                  DropdownMenuItem(
                      value: 'live', child: Text(l10n.publishPlaceKindLive)),
                  DropdownMenuItem(
                      value: 'moving',
                      child: Text(l10n.publishPlaceKindMoving)),
                ],
                onChanged: (v) => setState(() => _placeKind = v ?? 'pin'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _placeLabelController,
                decoration: InputDecoration(
                  labelText: l10n.publishPlaceLabelLabel,
                  hintText: l10n.publishPlaceLabelHint,
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _locating ? null : _useCurrentLocation,
                      icon: _locating
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.my_location),
                      label: Text(
                        _lat == null
                            ? l10n.publishUseCurrentLocation
                            : l10n.publishLocationSet(
                                _lat!.toStringAsFixed(4),
                                _lng!.toStringAsFixed(4),
                              ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      decoration: InputDecoration(
                        labelText: l10n.publishLatLabel,
                        border: const OutlineInputBorder(),
                      ),
                      keyboardType: const TextInputType.numberWithOptions(
                          decimal: true, signed: true),
                      initialValue: _lat?.toString(),
                      onChanged: (v) => _lat = double.tryParse(v),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextFormField(
                      decoration: InputDecoration(
                        labelText: l10n.publishLngLabel,
                        border: const OutlineInputBorder(),
                      ),
                      keyboardType: const TextInputType.numberWithOptions(
                          decimal: true, signed: true),
                      initialValue: _lng?.toString(),
                      onChanged: (v) => _lng = double.tryParse(v),
                    ),
                  ),
                ],
              ),
              if (_requiresRendezvous) ...[
                const SizedBox(height: 12),
                TextFormField(
                  controller: _rendezvousController,
                  decoration: InputDecoration(
                    labelText: l10n.publishRendezvousLabel,
                    border: const OutlineInputBorder(),
                  ),
                  validator: (v) =>
                      _requiresRendezvous && (v == null || v.trim().isEmpty)
                          ? l10n.publishRequired
                          : null,
                ),
              ],
              const SizedBox(height: 20),
              Row(
                children: [
                  // The clock face is the primary at-a-glance signal; the text stays
                  // for accessibility (screen readers, and anyone who just wants the
                  // number) rather than being replaced outright.
                  AnalogClockDial(minutes: _lifetimeMinutes),
                  const SizedBox(width: 8),
                  Text(
                    l10n.publishLifetimeLabel(_lifetimeMinutes),
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                ],
              ),
              // Convergence T134 (ADQ-008, WCAG 2.1 AA): axe-core flagged this Slider
              // as having no accessible name — its own `label:` is only a drag-time
              // value tooltip, not a name describing what the control does. Reuses
              // the exact text already shown above it, so there's no new copy to
              // localize.
              Semantics(
                label: l10n.publishLifetimeLabel(_lifetimeMinutes),
                child: Slider(
                  value: _lifetimeMinutes.toDouble(),
                  min: 5,
                  max: 30,
                  divisions: 25,
                  label: '$_lifetimeMinutes',
                  onChanged: (v) => setState(() => _lifetimeMinutes = v.round()),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                l10n.publishCapacityLabel(_capacity),
                style: Theme.of(context).textTheme.labelLarge,
              ),
              const SizedBox(height: 4),
              Wrap(
                spacing: 2,
                children: List.generate(
                  _capacity,
                  (_) => Icon(Icons.person,
                      size: 20, color: Theme.of(context).colorScheme.primary),
                ),
              ),
              Semantics(
                label: l10n.publishCapacityLabel(_capacity),
                child: Slider(
                  value: _capacity.toDouble(),
                  min: 1,
                  max: 10,
                  divisions: 9,
                  label: '$_capacity',
                  onChanged: (v) => setState(() => _capacity = v.round()),
                ),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: _moneyLabel,
                decoration: InputDecoration(
                  labelText: l10n.publishMoneyPreferenceLabel,
                  border: const OutlineInputBorder(),
                ),
                items: [
                  DropdownMenuItem(
                      value: 'creator_pays',
                      child: Text(l10n.publishMoneyCreatorPays)),
                  DropdownMenuItem(
                      value: 'byo', child: Text(l10n.publishMoneyByo)),
                  DropdownMenuItem(
                      value: 'split', child: Text(l10n.publishMoneySplit)),
                  DropdownMenuItem(
                      value: 'estimated_cost',
                      child: Text(l10n.publishMoneyEstimated)),
                ],
                onChanged: (v) => setState(() => _moneyLabel = v ?? 'split'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _moneyNoteController,
                decoration: InputDecoration(
                  labelText: l10n.publishMoneyNoteLabel,
                  hintText: l10n.publishMoneyNoteHint,
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _submitting ? null : _publish,
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(l10n.publishSubmit),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
