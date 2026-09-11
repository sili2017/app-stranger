import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/push_notification_service.dart';
import '../l10n/gen/app_localizations.dart';
import '../l10n/notification_text.dart';
import '../layout/responsive.dart';
import '../services/notifications_api.dart';
import '../state/app_state.dart';
import '../widgets/async_state_views.dart';

/// FR-006/T108: the in-app live feed — the universal fallback every signed-in user gets
/// regardless of push permission, so nothing is ever silently missed.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<NotificationJob>? _notifications;
  Object? _error;
  bool _enablingPush = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final notifications =
          await context.read<AppState>().notifications.listInApp();
      if (!mounted) return;
      setState(() => _notifications = notifications);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
  }

  Future<void> _enablePush() async {
    setState(() => _enablingPush = true);
    final appState = context.read<AppState>();
    final push = PushNotificationService();
    final token = await push.requestPermissionAndGetToken();
    if (token != null) {
      try {
        await appState.notifications
            .registerPushToken(token, push.currentPlatform);
        await appState.markPushEnabled();
      } catch (_) {
        // Registration failing server-side is no worse than push never having been
        // available — the in-app feed above is unaffected either way.
      }
    }
    if (mounted) {
      setState(() => _enablingPush = false);
      final l10n = AppLocalizations.of(context)!;
      if (token != null) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.notificationsPushEnabled)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final pushEnabled = context.watch<AppState>().pushEnabled;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.notificationsTitle)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ResponsiveCenter(
          maxWidth: 760,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (!pushEnabled) _pushBanner(l10n),
              if (_error != null)
                SizedBox(
                    height: 300,
                    child: ErrorView(error: _error!, onRetry: _load))
              else if (_notifications == null)
                const SizedBox(height: 300, child: LoadingView())
              else if (_notifications!.isEmpty)
                SizedBox(
                  height: 300,
                  child: EmptyView(
                    message: l10n.notificationsEmpty,
                    icon: Icons.notifications_none,
                  ),
                )
              else
                ..._notifications!.map(
                  (n) => Card(
                    child: ListTile(
                      leading: const Icon(Icons.notifications_outlined),
                      title: Text(notificationText(l10n, n)),
                      subtitle: Text(_relativeTime(l10n, n.createdAt)),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _pushBanner(AppLocalizations l10n) {
    return Card(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Icon(Icons.notifications_active_outlined,
                color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 12),
            Expanded(child: Text(l10n.notificationsPushBanner)),
            const SizedBox(width: 8),
            _enablingPush
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : FilledButton(
                    onPressed: _enablePush,
                    child: Text(l10n.notificationsEnablePush)),
          ],
        ),
      ),
    );
  }

  String _relativeTime(AppLocalizations l10n, DateTime time) {
    final diff = DateTime.now().difference(time);
    if (diff.inMinutes < 1) return l10n.timeJustNow;
    if (diff.inMinutes < 60) return l10n.timeMinutesAgo(diff.inMinutes);
    if (diff.inHours < 24) return l10n.timeHoursAgo(diff.inHours);
    return l10n.timeDaysAgo(diff.inDays);
  }
}
