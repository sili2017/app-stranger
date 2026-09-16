import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'package:stranger_design_system/stranger_design_system.dart';
import 'core/session.dart';
import 'l10n/gen/app_localizations.dart';
import 'state/app_state.dart';
import 'screens/auth_screen.dart';
import 'screens/home_shell.dart';

Future<void> main() async {
  final session = await Session.load();
  runApp(StrangerApp(session: session));
}

/// Root widget. lib/layout/ holds the responsive shell (T116). Localization (T107,
/// FR-040): default language derives from the device locale, with a user override
/// (Profile > Language) and an English fallback when neither the device nor the user
/// picked a locale this app ships a translation for.
class StrangerApp extends StatelessWidget {
  const StrangerApp({super.key, required this.session});

  final Session session;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AppState(session),
      child: Consumer<AppState>(
        builder: (context, appState, _) {
          final override = appState.languageOverride;
          return MaterialApp(
            title: 'Stranger',
            debugShowCheckedModeBanner: false,
            theme: strangerTheme,
            locale: override == null ? null : Locale(override),
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            // Flutter's default resolution already does "first supported locale that
            // matches a device-preferred one, else the first supportedLocale" — but our
            // first supportedLocale must always be English specifically (never whichever
            // ARB file happens to sort first) to satisfy FR-040's "English fallback" when
            // the device locale isn't one we ship a translation for.
            localeResolutionCallback: (deviceLocale, supported) {
              if (deviceLocale != null) {
                for (final locale in supported) {
                  if (locale.languageCode == deviceLocale.languageCode) {
                    return locale;
                  }
                }
              }
              return const Locale('en');
            },
            home: session.userId == null
                ? const AuthScreen()
                : const HomeShell(),
          );
        },
      ),
    );
  }
}
