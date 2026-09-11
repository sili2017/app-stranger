import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/gen/app_localizations.dart';
import '../layout/responsive.dart';
import '../models/chat.dart';
import '../state/app_state.dart';
import '../widgets/async_state_views.dart';
import '../widgets/rate_meetup_sheet.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({
    super.key,
    required this.chatId,
    required this.offerId,
    required this.title,
    required this.isActive,
  });

  final String chatId;
  final String offerId;
  final String title;
  final bool isActive;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  List<ChatMessage>? _messages;
  Object? _error;
  Timer? _pollTimer;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
    _pollTimer =
        Timer.periodic(const Duration(seconds: 3), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    try {
      final messages =
          await context.read<AppState>().messaging.listMessages(widget.chatId);
      if (!mounted) return;
      setState(() {
        _messages = messages;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      if (!silent) setState(() => _error = e);
    }
  }

  Future<void> _send() async {
    final body = _controller.text.trim();
    if (body.isEmpty) return;
    setState(() => _sending = true);
    try {
      await context.read<AppState>().messaging.sendMessage(widget.chatId, body);
      _controller.clear();
      await _load();
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final myUserId = context.watch<AppState>().userId;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          IconButton(
            icon: const Icon(Icons.star_outline),
            tooltip: l10n.chatRateTooltip,
            onPressed: () => showRateMeetupSheet(context, widget.offerId),
          ),
        ],
      ),
      body: ResponsiveCenter(
        maxWidth: 760,
        child: Column(
          children: [
            Expanded(
              child: _error != null
                  ? ErrorView(error: _error!, onRetry: _load)
                  : _messages == null
                      ? const LoadingView()
                      : _messages!.isEmpty
                          ? EmptyView(
                              message: l10n.chatSayHello,
                              icon: Icons.chat_outlined)
                          : ListView.builder(
                              controller: _scrollController,
                              padding: const EdgeInsets.all(12),
                              itemCount: _messages!.length,
                              itemBuilder: (context, i) {
                                final m = _messages![i];
                                final isMine = m.senderId == myUserId;
                                return Align(
                                  alignment: isMine
                                      ? Alignment.centerRight
                                      : Alignment.centerLeft,
                                  child: Container(
                                    margin:
                                        const EdgeInsets.symmetric(vertical: 4),
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 12, vertical: 8),
                                    constraints:
                                        const BoxConstraints(maxWidth: 420),
                                    decoration: BoxDecoration(
                                      color: isMine
                                          ? Theme.of(context)
                                              .colorScheme
                                              .primaryContainer
                                          : Theme.of(context)
                                              .colorScheme
                                              .surfaceContainerHighest,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        if (!isMine)
                                          Text(m.senderId,
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .labelSmall),
                                        Text(m.body),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
            ),
            if (!widget.isActive)
              Padding(
                padding: const EdgeInsets.all(8),
                child: Text(l10n.chatArchivedNotice),
              )
            else
              Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        decoration: InputDecoration(
                          hintText: l10n.chatMessageHint,
                          border: const OutlineInputBorder(),
                        ),
                        onSubmitted: (_) => _send(),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      onPressed: _sending ? null : _send,
                      icon: const Icon(Icons.send),
                      tooltip: l10n.chatSendTooltip,
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
