import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../l10n/gen/app_localizations.dart';
import '../layout/responsive.dart';
import '../models/profile.dart';
import '../state/app_state.dart';
import '../widgets/async_state_views.dart';

/// Another real gap found via manual testing: nothing let a user submit a photo or a
/// government ID, even though the backend already models both (identity-profile's
/// VerificationCase.kind: photo_liveness | government_id) and now has real endpoints
/// for them (verification.controller.ts's POST /photo, POST /government-id — the
/// second only ever accepted a submission, it just had no client to call it from).
///
/// Known limitation: the Media service's dev-only local-filesystem storage
/// (ADQ-005 is still open) has no publicly fetchable URL for an uploaded asset, so a
/// photo can't be redisplayed after upload — only the just-picked preview (raw bytes
/// already in memory) is shown here, not anything reloaded from the server.
class VerificationScreen extends StatefulWidget {
  const VerificationScreen({super.key});

  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends State<VerificationScreen> {
  PublicProfile? _profile;
  Object? _error;
  bool _busyPhoto = false;
  bool _busyGovId = false;
  Uint8List? _lastPickedPreview;

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

  Future<Uint8List?> _pickImageBytes() async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
    );
    if (picked == null) return null;
    return picked.readAsBytes();
  }

  Future<void> _submitPhoto() async {
    final bytes = await _pickImageBytes();
    if (bytes == null || !mounted) return;
    final l10n = AppLocalizations.of(context)!;
    setState(() {
      _busyPhoto = true;
      _lastPickedPreview = bytes;
    });
    final appState = context.read<AppState>();
    try {
      final asset = await appState.media.upload(
        filename: 'verification-photo.jpg',
        contentType: 'image/jpeg',
        bytes: bytes,
      );
      await appState.identity.submitPhotoVerification(asset.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.verificationPhotoSubmitted)));
      await _load();
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _busyPhoto = false);
    }
  }

  Future<void> _submitGovernmentId() async {
    final bytes = await _pickImageBytes();
    if (bytes == null || !mounted) return;
    final l10n = AppLocalizations.of(context)!;
    setState(() => _busyGovId = true);
    final appState = context.read<AppState>();
    try {
      final asset = await appState.media.upload(
        filename: 'government-id.jpg',
        contentType: 'image/jpeg',
        bytes: bytes,
      );
      await appState.identity.submitGovernmentId(asset.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.verificationGovIdSubmitted)));
      await _load();
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _busyGovId = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.verificationTitle)),
      body: ResponsiveCenter(
        maxWidth: 480,
        child: _error != null
            ? ErrorView(error: _error!, onRetry: _load)
            : _profile == null
                ? const LoadingView()
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_lastPickedPreview != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.memory(_lastPickedPreview!,
                                height: 160, fit: BoxFit.cover),
                          ),
                        ),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              Icon(
                                _profile!.verificationStatus == 'unverified'
                                    ? Icons.error_outline
                                    : Icons.verified_outlined,
                                color:
                                    _profile!.verificationStatus == 'unverified'
                                        ? Theme.of(context).colorScheme.error
                                        : Colors.green,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                    '${l10n.profileVerification}: ${_profile!.verificationStatus}'),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(l10n.verificationPhotoSectionTitle,
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 4),
                      Text(l10n.verificationPhotoSectionBody,
                          style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: _busyPhoto ? null : _submitPhoto,
                        icon: _busyPhoto
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.camera_alt_outlined),
                        label: Text(l10n.verificationSubmitPhoto),
                      ),
                      const SizedBox(height: 24),
                      Text(l10n.verificationGovIdSectionTitle,
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 4),
                      Text(l10n.verificationGovIdSectionBody,
                          style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: _busyGovId ? null : _submitGovernmentId,
                        icon: _busyGovId
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.badge_outlined),
                        label: Text(l10n.verificationSubmitGovId),
                      ),
                    ],
                  ),
      ),
    );
  }
}
