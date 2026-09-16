import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:provider/provider.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import '../config/api_config.dart';
import '../core/app_exception.dart';
import '../l10n/gen/app_localizations.dart';
import '../layout/responsive.dart';
import '../services/auth_api.dart';
import '../state/app_state.dart';
import '../widgets/async_state_views.dart';
import 'home_shell.dart';
import 'login_screen.dart';

/// Items 30/33: the real registration/login screen. Registration (item 33) collects
/// only a name and date of birth — the fastest possible path to actually using the
/// app — via Google/Facebook/Apple (one tap) or the "Create account" form; email and
/// password are a deferred, optional "secure your account" step from Profile (see
/// CompleteProfileScreen), not a signup requirement. The "Log in" tab still takes
/// email+password, for returning to an account that has since completed that step.
/// LoginScreen is still reachable from here for manual/dev testing (it backs the
/// seed-test-data.js named users, which have no email/password).
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

enum _AuthMode { login, register }

class _AuthScreenState extends State<AuthScreen> {
  // Item 33: default to the fast path — most first-time visitors here want to sign
  // up, not log in.
  _AuthMode _mode = _AuthMode.register;
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _firstNameController = TextEditingController();
  DateTime? _dateOfBirth;
  bool _submitting = false;
  String? _busyProvider;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _firstNameController.dispose();
    super.dispose();
  }

  Future<DateTime?> _pickDateOfBirth() async {
    final now = DateTime.now();
    var pending = _dateOfBirth ?? DateTime(now.year - 25, now.month, now.day);
    final l10n = AppLocalizations.of(context)!;
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Padding(
                  padding: const EdgeInsets.all(8),
                  child: TextButton(
                    onPressed: () => Navigator.of(sheetContext).pop(true),
                    child: Text(l10n.loginDobPickerDone),
                  ),
                ),
              ],
            ),
            SizedBox(
              height: 216,
              child: CupertinoDatePicker(
                mode: CupertinoDatePickerMode.date,
                initialDateTime: pending,
                minimumDate: DateTime(now.year - 100),
                maximumDate: now,
                onDateTimeChanged: (value) => pending = value,
              ),
            ),
          ],
        ),
      ),
    );
    return confirmed == true ? pending : null;
  }

  String _isoDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  void _goHome() {
    if (!mounted) return;
    Navigator.of(context)
        .pushReplacement(MaterialPageRoute(builder: (_) => const HomeShell()));
  }

  Future<void> _submitLogin() async {
    final l10n = AppLocalizations.of(context)!;
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    if (email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.loginMissingFields)));
      return;
    }

    setState(() => _submitting = true);
    final appState = context.read<AppState>();
    try {
      final result =
          await appState.auth.loginWithEmail(email: email, password: password);
      await appState.signInWithToken(result.userId, result.token, 'email');
      _goHome();
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  /// Item 33: name + date of birth only — see the class doc for why.
  Future<void> _submitRegister() async {
    final l10n = AppLocalizations.of(context)!;
    if (_firstNameController.text.trim().isEmpty || _dateOfBirth == null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.loginMissingFields)));
      return;
    }

    setState(() => _submitting = true);
    final appState = context.read<AppState>();
    try {
      final result = await appState.auth.registerQuick(
        firstName: _firstNameController.text.trim(),
        dateOfBirth: _isoDate(_dateOfBirth!),
      );
      await appState.signInWithToken(result.userId, result.token, 'quick');
      _goHome();
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  /// Items 30.1.1/30.1.2: shared flow for all three OAuth providers — obtain a token
  /// from the platform SDK, exchange it with the backend, and if this is a brand-new
  /// account the backend doesn't yet have a date of birth for, collect one (FR-016's
  /// 18+ gate applies no matter how someone signs up) and retry once.
  Future<void> _handleOAuth(String provider) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _busyProvider = provider);
    final appState = context.read<AppState>();
    try {
      final identity = await _obtainProviderToken(provider);
      if (identity == null) return; // not configured, or the user cancelled the picker
      final (token, firstName) = identity;

      Future<AuthResult> attempt({String? dateOfBirth}) => appState.auth.loginWithOAuth(
            provider: provider,
            token: token,
            dateOfBirth: dateOfBirth,
            firstName: firstName,
          );

      try {
        final result = await attempt();
        await appState.signInWithToken(result.userId, result.token, provider);
        _goHome();
      } on AppException catch (e) {
        if (e.code != 'DATE_OF_BIRTH_REQUIRED') rethrow;
        if (!mounted) return;
        final dob = await _pickDateOfBirth();
        if (dob == null) return;
        final result = await attempt(dateOfBirth: _isoDate(dob));
        await appState.signInWithToken(result.userId, result.token, provider);
        _goHome();
      }
    } on AppException catch (e) {
      if (!mounted) return;
      if (e.code == 'PROVIDER_NOT_CONFIGURED') {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l10n.loginProviderNotConfigured)));
      } else {
        showErrorSnackBar(context, e);
      }
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _busyProvider = null);
    }
  }

  /// Returns (token, firstName) for the backend exchange, or null if the provider
  /// isn't configured on this build (see AuthProviderConfig) or the user cancelled the
  /// platform sign-in sheet.
  Future<(String, String?)?> _obtainProviderToken(String provider) async {
    final l10n = AppLocalizations.of(context)!;
    switch (provider) {
      case 'google':
        if (AuthProviderConfig.googleWebClientId.isEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(l10n.loginProviderNotConfigured)));
          return null;
        }
        final googleSignIn =
            GoogleSignIn(clientId: AuthProviderConfig.googleWebClientId);
        final account = await googleSignIn.signIn();
        if (account == null) return null;
        final auth = await account.authentication;
        final idToken = auth.idToken;
        if (idToken == null) return null;
        return (idToken, account.displayName);

      case 'facebook':
        if (AuthProviderConfig.facebookAppId.isEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(l10n.loginProviderNotConfigured)));
          return null;
        }
        await FacebookAuth.instance.webAndDesktopInitialize(
          appId: AuthProviderConfig.facebookAppId,
          cookie: true,
          xfbml: true,
          version: 'v19.0',
        );
        final result = await FacebookAuth.instance
            .login(permissions: const ['public_profile', 'email']);
        if (result.status != LoginStatus.success) return null;
        final accessToken = result.accessToken?.tokenString;
        if (accessToken == null) return null;
        return (accessToken, null);

      case 'apple':
        if (AuthProviderConfig.appleServiceId.isEmpty ||
            AuthProviderConfig.appleRedirectUri.isEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(l10n.loginProviderNotConfigured)));
          return null;
        }
        final credential = await SignInWithApple.getAppleIDCredential(
          scopes: const [
            AppleIDAuthorizationScopes.email,
            AppleIDAuthorizationScopes.fullName,
          ],
          webAuthenticationOptions: WebAuthenticationOptions(
            clientId: AuthProviderConfig.appleServiceId,
            redirectUri: Uri.parse(AuthProviderConfig.appleRedirectUri),
          ),
        );
        final identityToken = credential.identityToken;
        if (identityToken == null) return null;
        // Apple only ever hands back a name on the very first authorization — never
        // again after that, even to the same client, so this is the one chance to
        // capture it for a brand-new account.
        final name = [credential.givenName, credential.familyName]
            .whereType<String>()
            .join(' ')
            .trim();
        return (identityToken, name.isEmpty ? null : name);

      default:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final isRegister = _mode == _AuthMode.register;
    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints:
                  BoxConstraints(minHeight: constraints.maxHeight - 48),
              child: Center(
                child: ResponsiveCenter(
                  maxWidth: 420,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Icon(Icons.handshake_outlined,
                          size: 56,
                          color: Theme.of(context).colorScheme.primary),
                      const SizedBox(height: 16),
                      Text(
                        l10n.appTitle,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        l10n.appTagline,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 32),
                      SegmentedButton<_AuthMode>(
                        segments: [
                          ButtonSegment(
                            value: _AuthMode.login,
                            label: Text(l10n.loginTabLogIn),
                          ),
                          ButtonSegment(
                            value: _AuthMode.register,
                            label: Text(l10n.loginTabRegister),
                          ),
                        ],
                        selected: {_mode},
                        onSelectionChanged: (s) =>
                            setState(() => _mode = s.first),
                      ),
                      const SizedBox(height: 16),
                      _oauthButton(
                        provider: 'google',
                        icon: Icons.g_mobiledata,
                        label: l10n.loginContinueWithGoogle,
                      ),
                      const SizedBox(height: 8),
                      _oauthButton(
                        provider: 'facebook',
                        icon: Icons.facebook_outlined,
                        label: l10n.loginContinueWithFacebook,
                      ),
                      const SizedBox(height: 8),
                      _oauthButton(
                        provider: 'apple',
                        icon: Icons.apple,
                        label: l10n.loginContinueWithApple,
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          const Expanded(child: Divider()),
                          Padding(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 8),
                            child: Text(l10n.loginOrDivider,
                                style: Theme.of(context).textTheme.bodySmall),
                          ),
                          const Expanded(child: Divider()),
                        ],
                      ),
                      const SizedBox(height: 16),
                      if (isRegister) ...[
                        // Item 33: just name + date of birth — no email/password at
                        // signup, that's a later, optional step from Profile.
                        TextField(
                          controller: _firstNameController,
                          decoration: InputDecoration(
                            labelText: l10n.editProfileNameLabel,
                            border: const OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          onPressed: () async {
                            final dob = await _pickDateOfBirth();
                            if (dob != null) setState(() => _dateOfBirth = dob);
                          },
                          icon: const Icon(Icons.cake_outlined),
                          label: Text(
                            _dateOfBirth == null
                                ? l10n.loginSelectDob
                                : l10n.loginDobLabel(_isoDate(_dateOfBirth!)),
                          ),
                        ),
                      ] else ...[
                        TextField(
                          controller: _emailController,
                          decoration: InputDecoration(
                            labelText: l10n.loginEmailLabel,
                            border: const OutlineInputBorder(),
                          ),
                          keyboardType: TextInputType.emailAddress,
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _passwordController,
                          decoration: InputDecoration(
                            labelText: l10n.loginPasswordLabel,
                            border: const OutlineInputBorder(),
                          ),
                          obscureText: true,
                          textInputAction: TextInputAction.done,
                          onSubmitted: (_) => _submitLogin(),
                        ),
                      ],
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: _submitting
                            ? null
                            : (isRegister ? _submitRegister : _submitLogin),
                        child: _submitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(isRegister
                                ? l10n.loginTabRegister
                                : l10n.loginTabLogIn),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        l10n.loginAuthDisclaimer,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 16),
                      TextButton(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(
                              builder: (_) => const LoginScreen()),
                        ),
                        child: Text(l10n.loginDevSignInLink),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _oauthButton({
    required String provider,
    required IconData icon,
    required String label,
  }) {
    final busy = _busyProvider == provider;
    return OutlinedButton.icon(
      onPressed: _busyProvider == null ? () => _handleOAuth(provider) : null,
      icon: busy
          ? const SizedBox(
              width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
          : Icon(icon),
      label: Text(label),
    );
  }
}
