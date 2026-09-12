import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/gen/app_localizations.dart';
import '../layout/responsive.dart';
import '../state/app_state.dart';
import '../widgets/async_state_views.dart';

/// Convergence T131/T132 (FR-015, Clarifications Session 2026-09-12 round 2): a
/// static, always-accessible safety-guidance screen, plus the trusted-contact setting
/// this app's one-tap "share my current meetup" action (see OfferDetailScreen) reads
/// from. Neither existed anywhere in this codebase before this task.
class SafetyScreen extends StatefulWidget {
  const SafetyScreen({super.key});

  @override
  State<SafetyScreen> createState() => _SafetyScreenState();
}

class _SafetyScreenState extends State<SafetyScreen> {
  final _contactController = TextEditingController();
  bool _loading = true;
  bool _saving = false;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _contactController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final contact = await context.read<AppState>().trustSafety.getTrustedContact();
      if (!mounted) return;
      setState(() {
        _contactController.text = contact?.contactHandle ?? '';
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  Future<void> _save() async {
    final l10n = AppLocalizations.of(context)!;
    final value = _contactController.text.trim();
    if (value.isEmpty) return;
    setState(() => _saving = true);
    try {
      await context.read<AppState>().trustSafety.setTrustedContact(value);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.safetyTrustedContactSaved)),
        );
      }
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
      appBar: AppBar(title: Text(l10n.safetyTitle)),
      body: _error != null
          ? ErrorView(error: _error!, onRetry: _load)
          : _loading
              ? const LoadingView()
              : ResponsiveCenter(child: _body(context, l10n)),
    );
  }

  Widget _body(BuildContext context, AppLocalizations l10n) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(l10n.safetyGuidanceHeading,
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        _guidanceTile(Icons.place_outlined, l10n.safetyGuidanceConfirmPlace),
        _guidanceTile(Icons.people_outline, l10n.safetyGuidanceTellSomeone),
        _guidanceTile(Icons.psychology_outlined, l10n.safetyGuidanceTrustInstincts),
        _guidanceTile(Icons.emergency_outlined, l10n.safetyGuidanceEmergency),
        const SizedBox(height: 24),
        Text(l10n.safetyTrustedContactHeading,
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Text(l10n.safetyTrustedContactDescription),
        const SizedBox(height: 12),
        TextField(
          controller: _contactController,
          decoration: InputDecoration(
            labelText: l10n.safetyTrustedContactLabel,
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: _saving ? null : _save,
          icon: const Icon(Icons.save_outlined),
          label: Text(l10n.safetyTrustedContactSave),
        ),
      ],
    );
  }

  Widget _guidanceTile(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20),
          const SizedBox(width: 12),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}
