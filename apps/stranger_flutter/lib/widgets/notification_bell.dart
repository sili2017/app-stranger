import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/gen/app_localizations.dart';
import '../screens/notifications_screen.dart';
import '../state/app_state.dart';

/// Feature 22: a bell + count badge for "someone's interested"/other in-app
/// notifications, self-contained so it can live on any tab's AppBar (originally only
/// on Discover's — a creator who lives on My Offers never saw it there). Each instance
/// owns its own poll timer, consistent with home_shell.dart's "no IndexedStack, every
/// tab reruns initState" design.
class NotificationBell extends StatefulWidget {
  const NotificationBell({super.key});

  @override
  State<NotificationBell> createState() => _NotificationBellState();
}

class _NotificationBellState extends State<NotificationBell> {
  int _count = 0;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _load();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _load());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final notifications =
          await context.read<AppState>().notifications.listInApp();
      if (!mounted) return;
      setState(() => _count = notifications.length);
    } catch (_) {
      // Best-effort — a failed notification-count fetch shouldn't block the host screen.
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    // Convergence T134 (ADQ-008, WCAG 2.1 AA): axe-core flagged this button as having
    // no accessible name — Badge wrapping the icon appears to interfere with
    // IconButton's usual tooltip-to-semantics-label behavior on web. An explicit outer
    // Semantics label fixes it regardless of Badge's own behavior.
    return Semantics(
      label: l10n.notificationsTooltip,
      child: IconButton(
        icon: Badge(
          label: Text('$_count'),
          isLabelVisible: _count > 0,
          child: const Icon(Icons.notifications_outlined),
        ),
        tooltip: l10n.notificationsTooltip,
        onPressed: () => Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => const NotificationsScreen()))
            .then((_) => _load()),
      ),
    );
  }
}
