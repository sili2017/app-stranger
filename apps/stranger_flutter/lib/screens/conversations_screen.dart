import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/gen/app_localizations.dart';
import '../layout/responsive.dart';
import '../models/chat.dart';
import '../state/app_state.dart';
import '../widgets/async_state_views.dart';
import 'chat_screen.dart';

/// Story 3: the one shared group chat created automatically once the creator selects a
/// recipient (FR-009) — this screen lists every chat the signed-in user is a member of.
class ConversationsScreen extends StatefulWidget {
  const ConversationsScreen({super.key});

  @override
  State<ConversationsScreen> createState() => _ConversationsScreenState();
}

class _ConversationsScreenState extends State<ConversationsScreen> {
  List<Chat>? _chats;
  final Map<String, String> _titles = {};
  Object? _error;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _load();
    // A chat is created asynchronously by Messaging consuming the selection event (see
    // participation.service.ts's select()) — a one-shot load can run before that read
    // model has caught up. Poll like FeedScreen/ChatScreen/OfferDetailScreen do, so the
    // new chat appears without the user needing to pull-to-refresh.
    _pollTimer =
        Timer.periodic(const Duration(seconds: 5), (_) => _load(silent: true));
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _error = null);
    final appState = context.read<AppState>();
    try {
      final chats = await appState.messaging.listConversations();
      for (final chat in chats) {
        if (_titles.containsKey(chat.id)) continue;
        try {
          final offer = await appState.offer.getOffer(chat.offerId);
          _titles[chat.id] = offer.activityText;
        } catch (_) {
          _titles[chat.id] = chat.offerId;
        }
      }
      if (!mounted) return;
      setState(() => _chats = chats);
    } catch (e) {
      if (!mounted) return;
      if (silent) {
        return; // best-effort — don't surface a transient poll failure
      }
      setState(() => _error = e);
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.chatsTitle)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ResponsiveCenter(
          maxWidth: 760,
          child: _error != null
              ? ErrorView(error: _error!, onRetry: _load)
              : _chats == null
                  ? const LoadingView()
                  : _chats!.isEmpty
                      ? EmptyView(
                          message: l10n.chatsEmpty,
                          icon: Icons.chat_bubble_outline)
                      : ListView(
                          padding: const EdgeInsets.all(16),
                          children: _chats!
                              .map(
                                (chat) => Card(
                                  child: ListTile(
                                    leading: Icon(chat.isActive
                                        ? Icons.chat_bubble
                                        : Icons.archive_outlined),
                                    title:
                                        Text(_titles[chat.id] ?? chat.offerId),
                                    subtitle: Text(chat.isActive
                                        ? l10n.chatsActive
                                        : l10n.chatsArchived),
                                    onTap: () => Navigator.of(context)
                                        .push(
                                          MaterialPageRoute(
                                            builder: (_) => ChatScreen(
                                              chatId: chat.id,
                                              offerId: chat.offerId,
                                              title: _titles[chat.id] ??
                                                  chat.offerId,
                                              isActive: chat.isActive,
                                            ),
                                          ),
                                          // Refresh on return — a cancellation or a chat
                                          // archiving while viewing it should be reflected
                                          // here immediately, matching the other list
                                          // screens' refresh-on-return fix.
                                        )
                                        .then((_) => _load()),
                                  ),
                                ),
                              )
                              .toList(),
                        ),
        ),
      ),
    );
  }
}
