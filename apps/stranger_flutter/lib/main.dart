import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'package:stranger_design_system/stranger_design_system.dart';
import 'core/session.dart';
import 'l10n/gen/app_localizations.dart';
import 'state/app_state.dart';
import 'screens/auth_screen.dart';
import 'screens/home_shell.dart';

// Release builds show no error UI by default, so an exception before the
// first frame (e.g. Session.load() failing) previously left a permanently
// blank screen with nothing in the OS logs pointing at why. Catch it here
// and render something instead of nothing.
void main() {
  // Required before any platform-channel call (SharedPreferences.getInstance()
  // in Session.load() below is one) made before runApp() — runApp() normally
  // does this implicitly, but Session.load() runs first here. Its absence is
  // what actually caused the original blank screen: ServicesBinding.instance
  // null-checks an uninitialized binding, and release mode swallows it silently.
  WidgetsFlutterBinding.ensureInitialized();
  ErrorWidget.builder = (details) =>
      _StartupErrorApp(error: details.exception, stackTrace: details.stack);
  runZonedGuarded(() async {
    try {
      final session = await Session.load();
      runApp(StrangerApp(session: session));
    } catch (error, stackTrace) {
      debugPrint('Startup failed: $error\n$stackTrace');
      runApp(_StartupErrorApp(error: error, stackTrace: stackTrace));
    }
  }, (error, stackTrace) {
    debugPrint('Uncaught zone error: $error\n$stackTrace');
  });
}

class _StartupErrorApp extends StatelessWidget {
  const _StartupErrorApp({required this.error, this.stackTrace});

  final Object error;
  final StackTrace? stackTrace;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Startup failed',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                Text('$error'),
                if (stackTrace != null) ...[
                  const SizedBox(height: 12),
                  const Text(
                    'Stack trace:',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  Expanded(
                    child: SingleChildScrollView(
                      child: SelectableText(
                        '$stackTrace',
                        style: const TextStyle(
                            fontFamily: 'monospace', fontSize: 11),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
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
            darkTheme: strangerDarkTheme,
            themeMode: ThemeMode.system,
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
            home:
                session.userId == null ? const AuthScreen() : const HomeShell(),
          );
        },
      ),
    );
  }
}
