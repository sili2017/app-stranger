import 'dart:async';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:geolocator/geolocator.dart';

/// T117: platform-abstracted location acquisition. `geolocator`'s federated plugin
/// resolves to the native GPS API on mobile and the browser Geolocation API on web
/// automatically — this class only adds the FR-005 last-known-location fallback that
/// both platforms share, so callers never branch on `kIsWeb` themselves.
class LocationResult {
  LocationResult({
    required this.lat,
    required this.lng,
    required this.isLiveFix,
    this.accuracyMeters,
  });
  final double lat;
  final double lng;
  final bool isLiveFix;

  /// Null for a last-known fix, or when the platform reports no accuracy (0).
  final double? accuracyMeters;
}

/// Why [LocationService.getCurrentLocation] returned null — distinct from a plain
/// "unavailable" so the UI can tell a user something they can actually act on, rather
/// than a generic "could not get your location". `insecureOrigin` in particular was a
/// real, reproducible failure caught live: the browser Geolocation API throws
/// "Only secure origins are allowed" on any page served over plain HTTP that isn't
/// localhost (e.g. a LAN IP like `http://192.168.1.x:8765`) — no permission prompt is
/// even shown, so without this the button just silently "didn't work".
enum LocationFailureReason {
  insecureOrigin,
  permissionDenied,
  serviceDisabled,
  timedOut,
  unavailable,
}

/// How long to wait for a fix before giving up — belt-and-braces alongside
/// [Geolocator.getCurrentPosition]'s own `timeLimit`. Verified live (via CDP against
/// this exact browser/origin) that a stalled OS-level location provider can leave the
/// browser's `getCurrentPosition` never invoking either callback at all — not even its
/// own explicit `timeout` option fires — so relying on the platform alone left the
/// button spinning forever. This wraps the call in a plain Dart timer that always
/// completes, regardless of what the platform does underneath.
const _fixTimeout = Duration(seconds: 15);
const _fallbackFixTimeout = Duration(seconds: 8);

/// Bounds `geolocator_web`'s `requestPermission()` — see the `kIsWeb` branch in
/// [LocationService._ensurePermission] for why that call needs a timeout of its own on
/// web specifically, unlike every other platform's real, native permission dialog.
const _webPermissionProbeTimeout = Duration(seconds: 12);

class LocationService {
  /// [isWeb] defaults to the real [kIsWeb] — overridable only so tests can exercise the
  /// web-specific branch in [_ensurePermission] on the VM test runner, where [kIsWeb] is
  /// always false.
  LocationService({bool? isWeb}) : _isWeb = isWeb ?? kIsWeb;

  final bool _isWeb;

  /// Set after a failed [getCurrentLocation] call (cleared at the start of the next
  /// one) — read this when that call returns null to show a specific error.
  LocationFailureReason? lastFailureReason;

  /// Returns a live fix when permission is granted and a position is available;
  /// otherwise falls back to the last known position (FR-005) if the platform has one
  /// cached, and returns null only when neither is available at all.
  Future<LocationResult?> getCurrentLocation() async {
    lastFailureReason = null;
    final permission = await _ensurePermission();
    if (!permission) {
      return _lastKnownFallback();
    }

    // This app only needs city/km-band-level precision (see the distance-band
    // filter — <1km/1-5km/5-15km/15km+), never turn-by-turn accuracy, so
    // `.high` (GPS-satellite-grade, can take 30s+ to lock indoors/without sky
    // view) was demanding far more than needed and regularly timing out with
    // nothing to fall back to on a device that had never gotten a fix before.
    // `.medium` resolves via network/WiFi positioning too, not just GPS, and
    // is dramatically faster in practice; if that still fails, one more quick
    // attempt at the lowest accuracy tier before giving up on a live fix.
    for (final attempt in [
      (LocationAccuracy.medium, _fixTimeout),
      (LocationAccuracy.lowest, _fallbackFixTimeout),
    ]) {
      try {
        final position = await Geolocator.getCurrentPosition(
          desiredAccuracy: attempt.$1,
          timeLimit: _isWeb ? _webCompensatedTimeLimit(attempt.$2) : attempt.$2,
        ).timeout(attempt.$2 + const Duration(seconds: 2));
        return LocationResult(
          lat: position.latitude,
          lng: position.longitude,
          isLiveFix: true,
          accuracyMeters: position.accuracy > 0 ? position.accuracy : null,
        );
      } catch (e) {
        _recordFailureReason(e);
      }
    }
    return _lastKnownFallback();
  }

  /// Compensates a real bug in `geolocator_web` 4.1.4 (`HtmlGeolocationManager.
  /// getCurrentPosition`, verified by reading its source and then confirmed live —
  /// instrumenting `navigator.geolocation.getCurrentPosition` against this exact
  /// deployed build showed it): it converts the `timeLimit` Duration to the browser's
  /// millisecond-based `PositionOptions.timeout` via `.inMicroseconds` instead of
  /// `.inMilliseconds`, so a 15-second `timeLimit` reaches the browser as
  /// ~15,000,000ms (~4.2 hours). That silently disables the one safety net the
  /// browser itself would otherwise provide if the OS/network location lookup
  /// stalls — precisely the "not even its own explicit timeout option fires" failure
  /// mode this file's own `.timeout()` wrapper below exists to catch, which makes that
  /// wrapper load-bearing rather than belt-and-braces on web: it's the only timeout
  /// that reliably fires. Passing a Duration exactly 1000x smaller than intended
  /// exploits that same bug to cancel it out — once wrongly read via
  /// `.inMicroseconds`, the browser ends up with the millisecond value this service
  /// actually meant. Android/iOS are unaffected and get the real Duration unchanged.
  Duration _webCompensatedTimeLimit(Duration intended) =>
      Duration(microseconds: intended.inMilliseconds);

  Future<LocationResult?> _lastKnownFallback() async {
    try {
      final last = await Geolocator.getLastKnownPosition();
      if (last == null) return null;
      return LocationResult(
          lat: last.latitude, lng: last.longitude, isLiveFix: false);
    } catch (_) {
      // Expected on web: geolocator_web has no concept of an OS-cached last-known fix
      // and always throws UnsupportedError here — that's "nothing cached", not a real
      // failure, so it's folded into the same null result as an empty cache elsewhere.
      return null;
    }
  }

  Future<bool> _ensurePermission() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        lastFailureReason = LocationFailureReason.serviceDisabled;
        return false;
      }

      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.always ||
          permission == LocationPermission.whileInUse) {
        return true;
      }
      if (permission == LocationPermission.deniedForever) {
        lastFailureReason = LocationFailureReason.permissionDenied;
        return false;
      }

      // Reached for LocationPermission.denied (not yet decided either way) and, on web
      // only, .unableToDetermine — returned instead whenever a browser doesn't
      // implement the Permissions API at all (notably the Safari family, desktop and
      // iOS), which checkPermission() would otherwise misreport as a hard denial
      // without ever trying to get a fix.
      if (_isWeb) {
        // geolocator_web's requestPermission() doesn't just surface the browser's
        // permission prompt — verified by reading its source (geolocator_web 4.1.4):
        // it calls the browser's getCurrentPosition() itself to *trigger* that prompt,
        // with no timeout of its own, and maps ANY failure from that call — a slow
        // fix, a network-positioning hiccup, anything, not just a real "no" — to
        // LocationPermission.deniedForever. Two live-reproduced failure modes follow
        // from that: (1) a user who genuinely grants permission but whose first fix is
        // slow gets permanently misreported as having denied it, and the fix that call
        // already obtained is thrown away; (2) with nothing bounding that wait, a
        // stalled network-positioning lookup leaves the button spinning forever — the
        // exact failure class the timeouts elsewhere in this file exist to prevent.
        // So: bound the call, but never trust its verdict either way — always fall
        // through to this service's own timed getCurrentPosition() loop below, which
        // triggers that identical browser prompt (that's how
        // navigator.geolocation.getCurrentPosition behaves when permission is
        // undecided) under a timeout this service controls, with failures classified
        // by this service's own, more accurate _recordFailureReason.
        try {
          await Geolocator.requestPermission()
              .timeout(_webPermissionProbeTimeout);
        } catch (_) {
          // Deliberately ignored — see above.
        }
        return true;
      }

      final requested = await Geolocator.requestPermission();
      if (requested == LocationPermission.always ||
          requested == LocationPermission.whileInUse) {
        return true;
      }
      lastFailureReason = LocationFailureReason.permissionDenied;
      return false;
    } catch (e) {
      _recordFailureReason(e);
      return false;
    }
  }

  /// Checks geolocator's own typed exceptions first (used natively on Android/iOS, and
  /// by this service's own timed fetch loop on web). Browsers don't expose a typed
  /// exception of their own, though: `navigator.geolocation` rejects with a plain
  /// `PositionError` whose `message` is a literal English string (verified live via
  /// Chrome DevTools against this exact origin) — hence the string-matching fallback,
  /// matched on content rather than a `code`, which is also `1` for a real denial.
  void _recordFailureReason(Object e) {
    if (e is TimeoutException) {
      lastFailureReason = LocationFailureReason.timedOut;
      return;
    }
    if (e is PermissionDeniedException) {
      lastFailureReason = LocationFailureReason.permissionDenied;
      return;
    }
    if (e is LocationServiceDisabledException) {
      lastFailureReason = LocationFailureReason.serviceDisabled;
      return;
    }
    final message = e.toString().toLowerCase();
    if (message.contains('secure origin')) {
      lastFailureReason = LocationFailureReason.insecureOrigin;
    } else if (message.contains('denied')) {
      lastFailureReason = LocationFailureReason.permissionDenied;
    } else if (message.contains('timeout') || message.contains('timed out')) {
      lastFailureReason = LocationFailureReason.timedOut;
    } else {
      lastFailureReason ??= LocationFailureReason.unavailable;
    }
  }
}
