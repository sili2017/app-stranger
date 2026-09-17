import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../l10n/gen/app_localizations.dart';
import '../l10n/status_labels.dart';
import '../layout/responsive.dart';
import '../models/profile.dart';
import '../services/auth_api.dart';
import '../state/app_state.dart';
import '../widgets/async_state_views.dart';
import 'complete_profile_screen.dart';

/// Item 35: a short, curated list rather than a full ~250-country picker — covers the
/// common cases with a plain dropdown and no new package dependency; "Other" falls
/// through to a free-text dial code for anywhere not listed.
const _dialCodes = [
  ('+1', '🇺🇸', 'US/Canada'),
  ('+44', '🇬🇧', 'UK'),
  ('+91', '🇮🇳', 'India'),
  ('+61', '🇦🇺', 'Australia'),
  ('+49', '🇩🇪', 'Germany'),
  ('+33', '🇫🇷', 'France'),
  ('+81', '🇯🇵', 'Japan'),
  ('+86', '🇨🇳', 'China'),
  ('+65', '🇸🇬', 'Singapore'),
  ('+971', '🇦🇪', 'UAE'),
  ('+27', '🇿🇦', 'South Africa'),
  ('+55', '🇧🇷', 'Brazil'),
];

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

  // Item 35: phone/email verification state.
  AccountStatus? _accountStatus;
  String _dialCode = _dialCodes.first.$1;
  final _phoneNumberController = TextEditingController();
  final _phoneCodeController = TextEditingController();
  bool _busySendCode = false;
  bool _busyVerifyPhone = false;
  bool _busyResendEmail = false;
  bool _editingPhone = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _phoneNumberController.dispose();
    _phoneCodeController.dispose();
    super.dispose();
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
    // Best-effort, separate from the main profile load — see ProfileScreen's own
    // identical note on why this can't 404 the whole screen for a fresh dev sign-in.
    try {
      final status = await appState.auth.me();
      if (!mounted) return;
      setState(() {
        _accountStatus = status;
        _editingPhone = status.phone == null;
      });
    } catch (_) {
      // leave phone/email sections hidden rather than guess
    }
  }

  Future<void> _sendPhoneCode() async {
    final l10n = AppLocalizations.of(context)!;
    final number = _phoneNumberController.text.trim();
    if (number.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.loginMissingFields)));
      return;
    }
    // E.164: a leading "+", then 7-15 digits total, no spaces/dashes — strip whatever
    // formatting someone typed in the national-number field before combining.
    final digits = number.replaceAll(RegExp(r'[^0-9]'), '');
    final phone = '$_dialCode$digits';
    setState(() => _busySendCode = true);
    try {
      await context.read<AppState>().auth.setPhone(phone);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.verificationCodeSent)));
      setState(() => _editingPhone = false);
      await _load();
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _busySendCode = false);
    }
  }

  Future<void> _resendPhoneCode() async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _busySendCode = true);
    try {
      await context.read<AppState>().auth.resendPhoneCode();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.verificationCodeSent)));
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _busySendCode = false);
    }
  }

  Future<void> _verifyPhone() async {
    final l10n = AppLocalizations.of(context)!;
    final code = _phoneCodeController.text.trim();
    if (code.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.loginMissingFields)));
      return;
    }
    setState(() => _busyVerifyPhone = true);
    try {
      await context.read<AppState>().auth.verifyPhone(code);
      if (!mounted) return;
      _phoneCodeController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.verificationPhoneVerified)));
      await _load();
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _busyVerifyPhone = false);
    }
  }

  Future<void> _resendEmail() async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _busyResendEmail = true);
    try {
      await context.read<AppState>().auth.resendEmailVerification();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.verificationEmailResent)));
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _busyResendEmail = false);
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
                                isVerified(_profile!.verificationStatus)
                                    ? Icons.verified
                                    : Icons.warning_amber_rounded,
                                color: isVerified(_profile!.verificationStatus)
                                    ? Theme.of(context).colorScheme.primary
                                    : Theme.of(context).colorScheme.error,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                    '${l10n.profileVerification}: ${verificationStatusLabel(l10n, _profile!.verificationStatus)}'),
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
                      const SizedBox(height: 24),
                      Text(l10n.verificationPhoneSectionTitle,
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 4),
                      Text(l10n.verificationPhoneSectionBody,
                          style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 8),
                      _phoneSection(context, l10n),
                      const SizedBox(height: 24),
                      Text(l10n.verificationEmailSectionTitle,
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 4),
                      Text(l10n.verificationEmailSectionBody,
                          style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 8),
                      _emailSection(context, l10n),
                    ],
                  ),
      ),
    );
  }

  Widget _phoneSection(BuildContext context, AppLocalizations l10n) {
    final status = _accountStatus;
    if (status == null) return const SizedBox.shrink();

    if (status.phone != null && status.phoneVerified) {
      return Row(
        children: [
          const Icon(Icons.verified, color: Colors.green),
          const SizedBox(width: 8),
          Expanded(child: Text(status.phone!)),
        ],
      );
    }

    if (status.phone != null && !_editingPhone) {
      // A number is on file but not yet verified — show it with the code entry.
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.warning_amber_rounded,
                  color: Theme.of(context).colorScheme.error),
              const SizedBox(width: 8),
              Expanded(child: Text(status.phone!)),
              TextButton(
                onPressed: () => setState(() => _editingPhone = true),
                child: Text(l10n.verificationChangeNumber),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _phoneCodeController,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: l10n.verificationCodeLabel,
                    border: const OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: _busyVerifyPhone ? null : _verifyPhone,
                child: _busyVerifyPhone
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(l10n.verificationVerify),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: _busySendCode ? null : _resendPhoneCode,
              child: Text(l10n.verificationResendCode),
            ),
          ),
        ],
      );
    }

    // No number on file yet, or the user tapped "change number".
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 118,
          child: DropdownButtonFormField<String>(
            initialValue: _dialCode,
            isExpanded: true,
            decoration: const InputDecoration(border: OutlineInputBorder()),
            items: _dialCodes
                .map((c) => DropdownMenuItem(
                      value: c.$1,
                      child: Text('${c.$2} ${c.$1}'),
                    ))
                .toList(),
            onChanged: (v) => setState(() => _dialCode = v ?? _dialCode),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: TextField(
            controller: _phoneNumberController,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              labelText: l10n.verificationPhoneNumberLabel,
              border: const OutlineInputBorder(),
            ),
          ),
        ),
        const SizedBox(width: 8),
        FilledButton(
          onPressed: _busySendCode ? null : _sendPhoneCode,
          child: _busySendCode
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : Text(l10n.verificationSendCode),
        ),
      ],
    );
  }

  Widget _emailSection(BuildContext context, AppLocalizations l10n) {
    final status = _accountStatus;
    if (status == null) return const SizedBox.shrink();

    if (status.email == null) {
      return Align(
        alignment: Alignment.centerLeft,
        child: OutlinedButton.icon(
          onPressed: () => Navigator.of(context)
              .push(MaterialPageRoute(
                  builder: (_) => const CompleteProfileScreen()))
              .then((_) => _load()),
          icon: const Icon(Icons.email_outlined),
          label: Text(l10n.verificationAddEmail),
        ),
      );
    }

    return Row(
      children: [
        Icon(
          status.emailVerified ? Icons.verified : Icons.warning_amber_rounded,
          color: status.emailVerified
              ? Colors.green
              : Theme.of(context).colorScheme.error,
        ),
        const SizedBox(width: 8),
        Expanded(child: Text(status.email!)),
        if (!status.emailVerified)
          TextButton(
            onPressed: _busyResendEmail ? null : _resendEmail,
            child: _busyResendEmail
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : Text(l10n.verificationResendEmail),
          ),
      ],
    );
  }
}
