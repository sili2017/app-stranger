import 'package:flutter/material.dart';
import 'package:stranger_design_system/stranger_design_system.dart';
import '../core/app_exception.dart';
import '../l10n/gen/app_localizations.dart';

/// Small, repeated-everywhere views so screens don't each hand-roll a spinner/error UI.
class LoadingView extends StatelessWidget {
  const LoadingView({super.key});
  @override
  Widget build(BuildContext context) =>
      const Center(child: CircularProgressIndicator());
}

/// A column of shimmering list-tile placeholders — use instead of
/// [LoadingView] wherever the loaded content is a list, so the screen reads
/// as "already loading your content" rather than a bare spinner.
class SkeletonListView extends StatelessWidget {
  const SkeletonListView({super.key, this.count = 5});
  final int count;

  @override
  Widget build(BuildContext context) => Column(
        children: List.generate(count, (_) => const SkeletonListTile()),
      );
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
    return AppEmptyState(
      icon: Icons.error_outline,
      title: _message(l10n),
      action: onRetry == null
          ? null
          : FilledButton(onPressed: onRetry, child: Text(l10n.commonRetry)),
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
    return AppEmptyState(icon: icon, title: message);
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
