import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/city_data.dart';
import '../l10n/gen/app_localizations.dart';
import '../layout/responsive.dart';
import '../state/app_state.dart';
import '../widgets/async_state_views.dart';

/// FR-023: a user may register any number of city interests, prioritizing those cities
/// in Discover. With none registered, every active offer is in play (nearest first) —
/// see eligibility.service.ts's own note on this fallback, fixed after manual testing
/// found a fresh account's feed was empty forever with no interest registered.
class CityInterestsScreen extends StatefulWidget {
  const CityInterestsScreen({super.key});

  @override
  State<CityInterestsScreen> createState() => _CityInterestsScreenState();
}

class _CityInterestsScreenState extends State<CityInterestsScreen> {
  final _newCityController = TextEditingController();
  // Paired with the Autocomplete below — RawAutocomplete requires focusNode and
  // textEditingController to be either both supplied or both omitted (see
  // publish_screen.dart's activity field, which hit this same assertion first).
  final _newCityFocusNode = FocusNode();
  List<String>? _cities;
  Object? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _newCityController.dispose();
    _newCityFocusNode.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _error = null;
      _cities = null;
    });
    try {
      final cities =
          await context.read<AppState>().identity.listCityInterests();
      if (!mounted) return;
      setState(() => _cities = cities);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
  }

  Future<void> _add() async {
    final city = _newCityController.text.trim().toLowerCase();
    if (city.isEmpty) return;
    setState(() => _busy = true);
    try {
      await context.read<AppState>().identity.addCityInterest(city);
      _newCityController.clear();
      await _load();
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _remove(String city) async {
    setState(() => _busy = true);
    try {
      await context.read<AppState>().identity.removeCityInterest(city);
      await _load();
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
      appBar: AppBar(title: Text(l10n.cityInterestsTitle)),
      body: ResponsiveCenter(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Autocomplete<String>(
                      textEditingController: _newCityController,
                      focusNode: _newCityFocusNode,
                      optionsBuilder: (value) {
                        final query = value.text.trim().toLowerCase();
                        if (query.isEmpty) {
                          return const Iterable<String>.empty();
                        }
                        return knownCityIds.where((c) => c.contains(query));
                      },
                      onSelected: (selection) =>
                          _newCityController.text = selection,
                      fieldViewBuilder:
                          (context, controller, focusNode, onFieldSubmitted) {
                        return TextField(
                          controller: controller,
                          focusNode: focusNode,
                          decoration: InputDecoration(
                            labelText: l10n.cityInterestsIdLabel,
                            border: const OutlineInputBorder(),
                          ),
                          onSubmitted: (_) => _add(),
                        );
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                      onPressed: _busy ? null : _add,
                      child: Text(l10n.commonAdd)),
                ],
              ),
              const SizedBox(height: 16),
              if (_error != null)
                ErrorView(error: _error!, onRetry: _load)
              else if (_cities == null)
                const LoadingView()
              else if (_cities!.isEmpty)
                EmptyView(
                    message: l10n.cityInterestsEmpty,
                    icon: Icons.location_city_outlined)
              else
                ..._cities!.map(
                  (city) => Card(
                    child: ListTile(
                      leading: Text(cityEmoji(city),
                          style: const TextStyle(fontSize: 24)),
                      title: Text(city),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline),
                        onPressed: _busy ? null : () => _remove(city),
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
}
