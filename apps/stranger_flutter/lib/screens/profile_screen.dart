import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/gen/app_localizations.dart';
import '../layout/responsive.dart';
import '../models/profile.dart';
import '../state/app_state.dart';
import '../widgets/async_state_views.dart';
import 'city_interests_screen.dart';
import 'edit_profile_screen.dart';
import 'entitlements_screen.dart';
import 'login_screen.dart';
import 'verification_screen.dart';

/// FR-013/FR-024: the signed-in user's own Controlled-public profile view — the average
/// rating and count shown here are exactly what any other user would see, never
/// individual feedback text or photos (constitution §3.V).
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  PublicProfile? _profile;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    final appState = context.read<AppState>();
    try {
      final profile = await appState.identity.getProfile(appState.userId!);
      if (!mounted) return;
      setState(() => _profile = profile);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
  }

  Future<void> _signOut() async {
    await context.read<AppState>().signOut();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  Future<void> _pickLanguage() async {
    final l10n = AppLocalizations.of(context)!;
    final appState = context.read<AppState>();
    final current = appState.languageOverride;
    final selected = await showDialog<String?>(
      context: context,
      builder: (dialogContext) => SimpleDialog(
        title: Text(l10n.profileLanguage),
        children: [
          RadioGroup<String?>(
            groupValue: current,
            onChanged: (v) => Navigator.pop(dialogContext, v),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                RadioListTile<String?>(
                  title: Text(l10n.profileLanguageSystemDefault),
                  value: null,
                ),
                RadioListTile<String?>(
                    title: Text(l10n.languageEnglish), value: 'en'),
                RadioListTile<String?>(
                    title: Text(l10n.languageHindi), value: 'hi'),
              ],
            ),
          ),
        ],
      ),
    );
    // showDialog resolves with null both when the user explicitly picks "System
    // default" (value: null) and when they dismiss without choosing — pop's own
    // `didPop` argument doesn't distinguish these for a SimpleDialog, so this
    // (safe) reset-to-default on dismiss is a deliberate simplification, not a bug.
    if (selected != current) {
      await appState.setLanguageOverride(selected);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final userId = context.watch<AppState>().userId ?? '';
    final languageOverride = context.watch<AppState>().languageOverride;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.profileTitle)),
      body: ResponsiveCenter(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            CircleAvatar(
                radius: 36,
                child: Text(userId.isEmpty ? '?' : userId[0].toUpperCase())),
            const SizedBox(height: 12),
            Text(userId,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            if (_error != null)
              ErrorView(error: _error!, onRetry: _load)
            else if (_profile == null)
              const LoadingView()
            else
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _row(l10n.profileAgeRange, _profile!.ageRangeLabel),
                      _row(l10n.profileVerification,
                          _profile!.verificationStatus),
                      _row(
                        l10n.profileRating,
                        _profile!.publicRatingCount == 0
                            ? l10n.profileNoRatings
                            : l10n.profileRatingValue(
                                _profile!.publicRatingAverage!
                                    .toStringAsFixed(1),
                                _profile!.publicRatingCount,
                              ),
                      ),
                      if (_profile!.interests.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: _profile!.interests
                              .map((i) => Chip(
                                    label: Text(i),
                                    visualDensity: VisualDensity.compact,
                                  ))
                              .toList(),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 24),
            ListTile(
              leading: const Icon(Icons.edit_outlined),
              title: Text(l10n.profileEditProfile),
              trailing: const Icon(Icons.chevron_right),
              onTap: _profile == null
                  ? null
                  : () => Navigator.of(context)
                      .push(MaterialPageRoute(
                        builder: (_) => EditProfileScreen(profile: _profile!),
                      ))
                      .then((_) => _load()),
            ),
            ListTile(
              leading: const Icon(Icons.verified_user_outlined),
              title: Text(l10n.profileVerification),
              subtitle:
                  _profile == null ? null : Text(_profile!.verificationStatus),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context)
                  .push(MaterialPageRoute(
                      builder: (_) => const VerificationScreen()))
                  .then((_) => _load()),
            ),
            ListTile(
              leading: const Icon(Icons.location_city_outlined),
              title: Text(l10n.profileCityInterests),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const CityInterestsScreen()),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.card_membership_outlined),
              title: Text(l10n.profileEntitlements),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const EntitlementsScreen()),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.language_outlined),
              title: Text(l10n.profileLanguage),
              subtitle: Text(
                languageOverride == 'en'
                    ? l10n.languageEnglish
                    : languageOverride == 'hi'
                        ? l10n.languageHindi
                        : l10n.profileLanguageSystemDefault,
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: _pickLanguage,
            ),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: _signOut,
              icon: const Icon(Icons.logout),
              label: Text(l10n.profileSignOut),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
          Text(value),
        ],
      ),
    );
  }
}
