import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/gen/app_localizations.dart';
import '../state/app_state.dart';
import 'async_state_views.dart';

/// Story 4: lets the signed-in user rate each participant of a resolved meetup. The
/// creator may see several selections (one per recipient); a recipient sees only their
/// own. Submitting is only accepted by the backend once the meetup resolved to
/// `happened` (FR-029) — NOT_RATING_ELIGIBLE surfaces as a normal error otherwise.
Future<void> showRateMeetupSheet(BuildContext context, String offerId) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    builder: (_) => _RateMeetupSheet(offerId: offerId),
  );
}

class _RateMeetupSheet extends StatefulWidget {
  const _RateMeetupSheet({required this.offerId});
  final String offerId;

  @override
  State<_RateMeetupSheet> createState() => _RateMeetupSheetState();
}

class _RateMeetupSheetState extends State<_RateMeetupSheet> {
  List<Map<String, dynamic>>? _selections;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final selections = await context
          .read<AppState>()
          .participation
          .listSelectionsVisibleToMe(widget.offerId);
      if (!mounted) return;
      setState(() => _selections = selections);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.rateSheetTitle,
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            if (_error != null)
              ErrorView(error: _error!, onRetry: _load)
            else if (_selections == null)
              const LoadingView()
            else if (_selections!.isEmpty)
              EmptyView(message: l10n.rateSheetEmpty)
            else
              ..._selections!.map(
                (s) => ListTile(
                  title: Text(s['recipientUserId'] as String),
                  subtitle: Text(l10n.rateSheetOutcome(s['outcome'] as String)),
                  trailing: FilledButton(
                    onPressed: () => _openRatingForm(s['id'] as String),
                    child: Text(l10n.rateSheetRate),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _openRatingForm(String selectionId) {
    Navigator.of(context).pop();
    showDialog(
        context: context,
        builder: (_) => _RatingFormDialog(selectionId: selectionId));
  }
}

class _RatingFormDialog extends StatefulWidget {
  const _RatingFormDialog({required this.selectionId});
  final String selectionId;

  @override
  State<_RatingFormDialog> createState() => _RatingFormDialogState();
}

class _RatingFormDialogState extends State<_RatingFormDialog> {
  int _stars = 5;
  final _feedbackController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _feedbackController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _submitting = true);
    try {
      await context.read<AppState>().trustSafety.submitRating(
            selectionId: widget.selectionId,
            starRating: _stars,
            writtenFeedback: _feedbackController.text.trim(),
          );
      if (mounted) Navigator.of(context).pop();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l10n.rateThanks)));
      }
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return AlertDialog(
      title: Text(l10n.rateDialogTitle),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              5,
              (i) => IconButton(
                icon: Icon(
                  i < _stars ? Icons.star : Icons.star_border,
                  color: Theme.of(context).colorScheme.primary,
                ),
                onPressed: () => setState(() => _stars = i + 1),
              ),
            ),
          ),
          TextField(
            controller: _feedbackController,
            decoration:
                InputDecoration(labelText: l10n.rateDialogFeedbackLabel),
            maxLines: 3,
          ),
        ],
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(l10n.commonCancel)),
        FilledButton(
            onPressed: _submitting ? null : _submit,
            child: Text(l10n.commonSubmit)),
      ],
    );
  }
}
