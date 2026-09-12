import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../l10n/gen/app_localizations.dart';
import '../layout/responsive.dart';
import '../models/profile.dart';
import '../state/app_state.dart';
import '../widgets/async_state_views.dart';

/// Story 5: remaining free allowance, subscription state, and the purchase/subscribe
/// actions that unblock publishing once the free allowance is exhausted (FR-030-FR-037).
/// Uses the dev-only mock payment verifier (ADQ-004) — any non-empty receipt token
/// succeeds, matching the backend's MockPaymentVerifier.
class EntitlementsScreen extends StatefulWidget {
  const EntitlementsScreen({super.key});

  @override
  State<EntitlementsScreen> createState() => _EntitlementsScreenState();
}

class _EntitlementsScreenState extends State<EntitlementsScreen> {
  Entitlements? _entitlements;
  Object? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final entitlements =
          await context.read<AppState>().entitlements.getEntitlements();
      if (!mounted) return;
      setState(() => _entitlements = entitlements);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e);
    }
  }

  Future<void> _purchase() async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _busy = true);
    try {
      await context.read<AppState>().entitlements.purchaseOneTimeBroadcast();
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.entitlementsPurchased)));
      }
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _subscribe(String plan) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _busy = true);
    try {
      await context.read<AppState>().entitlements.subscribe(plan);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(
            SnackBar(content: Text(l10n.entitlementsSubscribed(plan))));
      }
    } catch (e) {
      if (mounted) showErrorSnackBar(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.entitlementsTitle)),
      body: ResponsiveCenter(
        child: _error != null
            ? ErrorView(error: _error!, onRetry: _load)
            : _entitlements == null
                ? const LoadingView()
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                l10n.entitlementsFreeRemaining,
                                style: Theme.of(context).textTheme.labelLarge,
                              ),
                              Text(
                                // Convergence T136: the backend sends `null` for this
                                // once a subscription is active — the free-allowance
                                // concept doesn't apply while it covers unlimited
                                // publishing (a real crash here, found by T136's E2E
                                // test, is what surfaced this in the first place).
                                _entitlements!.hasActiveSubscription
                                    ? l10n.entitlementsUnlimitedSubscribed
                                    : '${_entitlements!.remainingFreeAllowanceThisMonth}',
                                style:
                                    Theme.of(context).textTheme.headlineMedium,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                _entitlements!.hasActiveSubscription
                                    ? l10n.entitlementsActiveSubscription(
                                        _entitlements!.subscriptionPlan ?? '',
                                        _entitlements!.subscriptionStatus ?? '',
                                      )
                                    : l10n.entitlementsNoSubscription,
                              ),
                              Text(
                                l10n.entitlementsOneTimeAvailable(
                                  _entitlements!.availableOneTimePurchases,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(l10n.entitlementsBuyMore,
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 8),
                      FilledButton.icon(
                        onPressed: _busy ? null : _purchase,
                        icon: const Icon(Icons.add_shopping_cart),
                        label: Text(l10n.entitlementsOneTimeBroadcast),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        children: [
                          OutlinedButton(
                            onPressed:
                                _busy ? null : () => _subscribe('weekly'),
                            child: Text(l10n.entitlementsSubscribeWeekly),
                          ),
                          OutlinedButton(
                            onPressed:
                                _busy ? null : () => _subscribe('monthly'),
                            child: Text(l10n.entitlementsSubscribeMonthly),
                          ),
                          OutlinedButton(
                            onPressed:
                                _busy ? null : () => _subscribe('yearly'),
                            child: Text(l10n.entitlementsSubscribeYearly),
                          ),
                        ],
                      ),
                    ],
                  ),
      ),
    );
  }
}
