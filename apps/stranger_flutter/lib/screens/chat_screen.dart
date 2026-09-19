import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:stranger_design_system/stranger_design_system.dart';
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
  int _lastMessageCount = 0;
  // Item 36: senderId -> first name, for the "who sent this" label on each bubble.
  Map<String, String> _senderNames = {};

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
      final appState = context.read<AppState>();
      final messages = await appState.messaging.listMessages(widget.chatId);
      if (!mounted) return;
      final grew = messages.length > _lastMessageCount;
      setState(() {
        _messages = messages;
        _error = null;
        _lastMessageCount = messages.length;
      });
      if (grew) _scrollToBottom();
      // Best-effort, fire-and-forget: clears this chat's contribution to the Chats-tab
      // unread badge. Called on every load (not just initState) so a message arriving
      // while the chat is already open is marked read too, not just on first open.
      unawaited(appState.messaging.markRead(widget.chatId).catchError((_) {}));
      final names =
          await appState.displayNames(messages.map((m) => m.senderId));
      if (!mounted) return;
      setState(() => _senderNames = names);
    } catch (e) {
      if (!mounted) return;
      if (!silent) setState(() => _error = e);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: AppMotion.standard,
        curve: Curves.easeOut,
      );
    });
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
                      ? const Padding(
                          padding: EdgeInsets.all(AppSpacing.md),
                          child: SkeletonListView(count: 6),
                        )
                      : _messages!.isEmpty
                          ? EmptyView(
                              message: l10n.chatSayHello,
                              icon: Icons.chat_outlined)
                          : ListView.builder(
                              controller: _scrollController,
                              padding: const EdgeInsets.all(AppSpacing.md),
                              itemCount: _messages!.length,
                              itemBuilder: (context, i) {
                                final m = _messages![i];
                                final isMine = m.senderId == myUserId;
                                final showAvatar = !isMine;
                                return Padding(
                                  padding: const EdgeInsets.only(
                                      bottom: AppSpacing.sm),
                                  child: FadeSlideIn(
                                    offset: 8,
                                    child: _MessageBubble(
                                      message: m,
                                      isMine: isMine,
                                      showAvatar: showAvatar,
                                      senderName:
                                          _senderNames[m.senderId] ??
                                              m.senderId,
                                    ),
                                  ),
                                );
                              },
                            ),
            ),
            if (!widget.isActive)
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: AppCard(
                  color: Theme.of(context).colorScheme.surfaceContainerHigh,
                  child: Row(
                    children: [
                      Icon(Icons.archive_outlined,
                          size: 18,
                          color: Theme.of(context).colorScheme.onSurfaceVariant),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(child: Text(l10n.chatArchivedNotice)),
                    ],
                  ),
                ),
              )
            else
              Padding(
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        minLines: 1,
                        maxLines: 5,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: InputDecoration(
                          hintText: l10n.chatMessageHint,
                          border: OutlineInputBorder(
                            borderRadius:
                                BorderRadius.circular(AppRadius.lg),
                            borderSide: BorderSide.none,
                          ),
                        ),
                        onSubmitted: (_) => _send(),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    AnimatedSwitcher(
                      duration: AppMotion.fast,
                      child: _sending
                          ? const SizedBox(
                              width: 40,
                              height: 40,
                              child: Padding(
                                padding: EdgeInsets.all(8),
                                child: CircularProgressIndicator(
                                    strokeWidth: 2),
                              ),
                            )
                          : IconButton.filled(
                              onPressed: _send,
                              icon: const Icon(Icons.send),
                              tooltip: l10n.chatSendTooltip,
                            ),
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

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.isMine,
    required this.showAvatar,
    required this.senderName,
  });

  final ChatMessage message;
  final bool isMine;
  final bool showAvatar;
  final String senderName;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final bubble = Container(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      constraints: const BoxConstraints(maxWidth: 320),
      decoration: BoxDecoration(
        color: isMine ? scheme.primary : scheme.surfaceContainerHigh,
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(AppRadius.md),
          topRight: const Radius.circular(AppRadius.md),
          bottomLeft: Radius.circular(isMine ? AppRadius.md : AppRadius.sm),
          bottomRight: Radius.circular(isMine ? AppRadius.sm : AppRadius.md),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!isMine)
            Text(senderName,
                style: textTheme.labelSmall
                    ?.copyWith(color: scheme.onSurfaceVariant)),
          Text(
            message.body,
            style: textTheme.bodyMedium?.copyWith(
              color: isMine ? scheme.onPrimary : scheme.onSurface,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            DateFormat.Hm().format(message.createdAt.toLocal()),
            style: textTheme.bodySmall?.copyWith(
              color: (isMine ? scheme.onPrimary : scheme.onSurfaceVariant)
                  .withValues(alpha: 0.7),
              fontSize: 10,
            ),
          ),
        ],
      ),
    );

    return Row(
      mainAxisAlignment:
          isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (showAvatar) ...[
          CircleAvatar(
            radius: 14,
            backgroundColor: scheme.secondaryContainer,
            child: Text(
              senderName.isNotEmpty ? senderName[0].toUpperCase() : '?',
              style: TextStyle(
                  fontSize: 12, color: scheme.onSecondaryContainer),
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
        ],
        Flexible(child: bubble),
      ],
    );
  }
}
