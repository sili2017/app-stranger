import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/gen/app_localizations.dart';
import '../state/app_state.dart';

/// FR-005 UX nudge: shown once per device, right before the very first location
/// request, so the browser/OS permission prompt that follows doesn't come out of
/// nowhere — motivates granting it rather than just explaining what it's for.
Future<void> showLocationRationaleOnce(BuildContext context) async {
  final appState = context.read<AppState>();
  if (appState.hasSeenLocationRationale) return;
  final l10n = AppLocalizations.of(context)!;
  await showDialog<void>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      icon: const Icon(Icons.explore_outlined, size: 40),
      title: Text(l10n.locationRationaleTitle),
      content: Text(l10n.locationRationaleBody),
      actions: [
        FilledButton(
          onPressed: () => Navigator.of(dialogContext).pop(),
          child: Text(l10n.locationRationaleContinue),
        ),
      ],
    ),
  );
  await appState.markLocationRationaleSeen();
}
