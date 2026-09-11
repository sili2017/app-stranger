import 'package:flutter/material.dart';
import '../l10n/gen/app_localizations.dart';
import '../layout/responsive.dart';
import 'feed_screen.dart';
import 'publish_screen.dart';
import 'my_offers_screen.dart';
import 'conversations_screen.dart';
import 'profile_screen.dart';

/// T116: the one responsive shell every story lives inside — a bottom nav bar on phone,
/// a side rail on tablet/desktop, same five destinations either way.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  // Publish (index 1) is the default landing tab — publishing an offer is the app's
  // primary action, so it should be what a user sees the moment they sign in, rather
  // than making them navigate to it from Discover every time.
  int _index = 1;

  static const _icons = [
    (icon: Icons.explore_outlined, selectedIcon: Icons.explore),
    (icon: Icons.add_circle_outline, selectedIcon: Icons.add_circle),
    (icon: Icons.campaign_outlined, selectedIcon: Icons.campaign),
    (icon: Icons.chat_bubble_outline, selectedIcon: Icons.chat_bubble),
    (icon: Icons.person_outline, selectedIcon: Icons.person),
  ];

  static const _screens = [
    FeedScreen(),
    PublishScreen(),
    MyOffersScreen(),
    ConversationsScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final labels = [
      l10n.navDiscover,
      l10n.navPublish,
      l10n.navMyOffers,
      l10n.navChats,
      l10n.navProfile,
    ];
    final formFactor = formFactorOf(context);
    // Deliberately NOT an IndexedStack: that builds every tab once up front and keeps
    // it alive, so e.g. My Offers/Chats would show whatever they fetched at app
    // startup forever, never noticing a publish/selection that happened since — a real
    // staleness bug caught while testing this live. Rebuilding the selected screen on
    // every switch means each one's initState (and its fetch) reruns on every visit.
    final body = KeyedSubtree(key: ValueKey(_index), child: _screens[_index]);

    if (formFactor == FormFactor.phone) {
      return Scaffold(
        body: body,
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (i) => setState(() => _index = i),
          destinations: List.generate(
            _icons.length,
            (i) => NavigationDestination(
              icon: Icon(_icons[i].icon),
              selectedIcon: Icon(_icons[i].selectedIcon),
              label: labels[i],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: _index,
            onDestinationSelected: (i) => setState(() => _index = i),
            // NavigationRail asserts labelType is null/none whenever extended is true
            // (an extended rail always shows labels inline) — setting both unconditionally
            // threw on first render at desktop width.
            labelType: formFactor == FormFactor.desktop
                ? null
                : NavigationRailLabelType.all,
            extended: formFactor == FormFactor.desktop,
            destinations: List.generate(
              _icons.length,
              (i) => NavigationRailDestination(
                icon: Icon(_icons[i].icon),
                selectedIcon: Icon(_icons[i].selectedIcon),
                label: Text(labels[i]),
              ),
            ),
          ),
          const VerticalDivider(width: 1),
          Expanded(child: body),
        ],
      ),
    );
  }
}
