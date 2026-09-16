import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../l10n/gen/app_localizations.dart';
import '../layout/responsive.dart';
import '../models/profile.dart';
import '../state/app_state.dart';
import '../widgets/async_state_views.dart';
import '../widgets/profile_avatar.dart';
import 'auth_screen.dart';
import 'city_interests_screen.dart';
import 'edit_profile_screen.dart';
import 'entitlements_screen.dart';
import 'safety_screen.dart';
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
  bool _uploadingPhoto = false;

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

  /// Feature 25: reuses verification_screen.dart's exact pick-upload-attach pattern —
  /// submitPhotoVerification already sets PublicProfile.photoAssetId as a side effect
  /// (see that endpoint's own doc comment: "voluntary re-verification photo from
  /// Profile... immediately reflects on the public profile"), so no new backend
  /// endpoint is needed to persist the picture itself.
  Future<void> _pickAndUploadPhoto() async {
    final picked =
        await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    if (!mounted) return;
    setState(() => _uploadingPhoto = true);
    final appState = context.read<AppState>();
    try {
      final asset = await appState.media.upload(
        filename: 'profile-photo.jpg',
        contentType: 'image/jpeg',
        bytes: bytes,
      );
      await appState.identity.submitPhotoVerification(asset.id);
      await _load();
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  Future<void> _signOut() async {
    await context.read<AppState>().signOut();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const AuthScreen()),
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
    // A dev-only sign-in's userId is whatever plain name was typed, so it was always
    // a fine display name by coincidence — a real account's userId is a UUID, so the
    // profile's own firstName (once loaded) is what should actually show here.
    final displayName =
        (_profile?.firstName.isNotEmpty ?? false) ? _profile!.firstName : userId;
    final languageOverride = context.watch<AppState>().languageOverride;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.profileTitle)),
      body: ResponsiveCenter(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Center(
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  ProfileAvatar(
                    photoAssetId: _profile?.photoAssetId,
                    fallbackText:
                        displayName.isEmpty ? '?' : displayName[0].toUpperCase(),
                  ),
                  Positioned(
                    right: -4,
                    bottom: -4,
                    child: Material(
                      color: Theme.of(context).colorScheme.primary,
                      shape: const CircleBorder(),
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: _uploadingPhoto ? null : _pickAndUploadPhoto,
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: _uploadingPhoto
                              ? SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color:
                                        Theme.of(context).colorScheme.onPrimary,
                                  ),
                                )
                              : Icon(
                                  Icons.camera_alt_outlined,
                                  size: 16,
                                  color: Theme.of(context).colorScheme.onPrimary,
                                ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(displayName,
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
              leading: const Icon(Icons.shield_outlined),
              title: Text(l10n.profileSafety),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SafetyScreen()),
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
