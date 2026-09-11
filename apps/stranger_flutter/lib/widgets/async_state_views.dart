import 'package:flutter/material.dart';
import '../core/app_exception.dart';
import '../l10n/gen/app_localizations.dart';

/// Small, repeated-everywhere views so screens don't each hand-roll a spinner/error UI.
class LoadingView extends StatelessWidget {
  const LoadingView({super.key});
  @override
  Widget build(BuildContext context) =>
      const Center(child: CircularProgressIndicator());
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, this.onRetry});
  final Object error;
  final VoidCallback? onRetry;

  String _message(AppLocalizations l10n) {
    if (error is AppException) {
      return (error as AppException).localizedMessage(l10n);
    }
    if (error is NetworkException) {
      return l10n.errorNetwork((error as NetworkException).message);
    }
    return error.toString();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline,
                color: Theme.of(context).colorScheme.error, size: 40),
            const SizedBox(height: 12),
            Text(_message(l10n), textAlign: TextAlign.center),
            if (onRetry != null) ...[
              const SizedBox(height: 12),
              FilledButton(onPressed: onRetry, child: Text(l10n.commonRetry)),
            ],
          ],
        ),
      ),
    );
  }
}

class EmptyView extends StatelessWidget {
  const EmptyView(
      {super.key, required this.message, this.icon = Icons.inbox_outlined});
  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: Theme.of(context).colorScheme.outline),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: Theme.of(context).colorScheme.outline),
            ),
          ],
        ),
      ),
    );
  }
}

/// Shows an [AppException]/[NetworkException] as a dismissible snackbar — for actions
/// (button presses) rather than whole-screen load failures.
void showErrorSnackBar(BuildContext context, Object error) {
  final l10n = AppLocalizations.of(context)!;
  final message = error is AppException
      ? error.localizedMessage(l10n)
      : error is NetworkException
          ? l10n.errorNetworkSnackbar(error.message)
          : error.toString();
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}
