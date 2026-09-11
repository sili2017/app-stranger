import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/gen/app_localizations.dart';
import '../layout/responsive.dart';
import '../state/app_state.dart';
import '../widgets/async_state_views.dart';
import 'home_shell.dart';

/// Dev-only stand-in for real sign-up/sign-in (ADQ-002a is still open — every backend
/// service trusts whatever `x-dev-user-id` this screen sets). Still runs the *real*
/// FR-016 age-assurance rule server-side: under-18 is rejected with a real 403.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _userIdController = TextEditingController();
  DateTime? _dateOfBirth;
  bool _submitting = false;

  @override
  void dispose() {
    _userIdController.dispose();
    super.dispose();
  }

  /// A scrolling day/month/year wheel (`CupertinoDatePicker`) rather than Material's
  /// calendar-grid `showDatePicker` — the requested "the way latest Apple offers"
  /// picker. Cupertino widgets render fine outside a `CupertinoApp` (they don't need
  /// Cupertino theming to function), so no app-wide framework change is needed for
  /// just this one picker.
  Future<void> _pickDateOfBirth() async {
    final now = DateTime.now();
    var pending = _dateOfBirth ?? DateTime(now.year - 25, now.month, now.day);
    final l10n = AppLocalizations.of(context)!;
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Padding(
                  padding: const EdgeInsets.all(8),
                  child: TextButton(
                    onPressed: () => Navigator.of(sheetContext).pop(true),
                    child: Text(l10n.loginDobPickerDone),
                  ),
                ),
              ],
            ),
            SizedBox(
              height: 216,
              child: CupertinoDatePicker(
                mode: CupertinoDatePickerMode.date,
                initialDateTime: pending,
                minimumDate: DateTime(now.year - 100),
                maximumDate: now,
                onDateTimeChanged: (value) => pending = value,
              ),
            ),
          ],
        ),
      ),
    );
    if (confirmed == true) setState(() => _dateOfBirth = pending);
  }

  Future<void> _continue() async {
    final l10n = AppLocalizations.of(context)!;
    final userId = _userIdController.text.trim();
    if (userId.isEmpty || _dateOfBirth == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.loginMissingFields)));
      return;
    }

    setState(() => _submitting = true);
    final appState = context.read<AppState>();
    try {
      await appState.signIn(userId);
      final dob = '${_dateOfBirth!.year.toString().padLeft(4, '0')}-'
          '${_dateOfBirth!.month.toString().padLeft(2, '0')}-'
          '${_dateOfBirth!.day.toString().padLeft(2, '0')}';
      await appState.identity
          .signupAgeAssurance(dateOfBirth: dob, livenessResult: 'passed');
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomeShell()));
    } catch (e) {
      await appState.signOut();
      if (!mounted) return;
      showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      body: SafeArea(
        child: ResponsiveCenter(
          maxWidth: 420,
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Icon(Icons.handshake_outlined,
                    size: 56, color: Theme.of(context).colorScheme.primary),
                const SizedBox(height: 16),
                Text(
                  l10n.appTitle,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  l10n.appTagline,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 32),
                TextField(
                  controller: _userIdController,
                  decoration: InputDecoration(
                    labelText: l10n.loginNameLabel,
                    border: const OutlineInputBorder(),
                  ),
                  textInputAction: TextInputAction.done,
                ),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: _pickDateOfBirth,
                  icon: const Icon(Icons.cake_outlined),
                  label: Text(
                    _dateOfBirth == null
                        ? l10n.loginSelectDob
                        : l10n.loginDobLabel(
                            '${_dateOfBirth!.year}-${_dateOfBirth!.month.toString().padLeft(2, '0')}-${_dateOfBirth!.day.toString().padLeft(2, '0')}',
                          ),
                  ),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _submitting ? null : _continue,
                  child: _submitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.loginContinue),
                ),
                const SizedBox(height: 8),
                Text(
                  l10n.loginDisclaimer,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
