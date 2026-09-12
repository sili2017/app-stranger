import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/gen/app_localizations.dart';
import '../layout/responsive.dart';
import '../models/profile.dart';
import '../state/app_state.dart';
import '../widgets/async_state_views.dart';

/// A real gap found via manual testing: the profile model always had `firstName` and
/// `interests` fields (see models/profile.dart), but nothing anywhere let a user set
/// them — no screen, and until now no backend endpoint either
/// (`PATCH /profiles/:userId`, identity-profile's profiles.controller.ts).
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key, required this.profile});

  final PublicProfile profile;

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final _nameController =
      TextEditingController(text: widget.profile.firstName);
  late final _interestsController =
      TextEditingController(text: widget.profile.interests.join(', '));
  bool _saving = false;

  @override
  void dispose() {
    _nameController.dispose();
    _interestsController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final l10n = AppLocalizations.of(context)!;
    final appState = context.read<AppState>();
    try {
      final interests = _interestsController.text
          .split(',')
          .map((s) => s.trim())
          .where((s) => s.isNotEmpty)
          .toList();
      await appState.identity.updateProfile(
        appState.userId!,
        firstName: _nameController.text.trim(),
        interests: interests,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.editProfileSaved)));
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.editProfileTitle)),
      body: ResponsiveCenter(
        maxWidth: 480,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _nameController,
                decoration: InputDecoration(
                  labelText: l10n.editProfileNameLabel,
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _interestsController,
                decoration: InputDecoration(
                  labelText: l10n.editProfileInterestsLabel,
                  hintText: l10n.editProfileInterestsHint,
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(l10n.editProfileSave),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
