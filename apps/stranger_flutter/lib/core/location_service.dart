import 'dart:async';

import 'package:flutter/foundation.dart' show kIsWeb, visibleForTesting;
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// T117: platform-abstracted location acquisition. `geolocator`'s federated plugin
/// resolves to the native GPS API on mobile and the browser Geolocation API on web
/// automatically. This class adds what neither gives us on its own: one shared
/// in-flight request, a short-lived reuse of a recent fix, and a last-known-location
/// fallback (FR-005) that also works on web, where the plugin has none.
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

const _nativeFixTimeout = Duration(seconds: 15);
const _nativeFallbackFixTimeout = Duration(seconds: 8);

/// Measured live in desktop Chrome: a cold first fix took ~10s, and later ones ~200ms.
/// Giving up at 5-17s and re-asking (the old behaviour) abandoned fixes that were
/// about to arrive; one patient request is what actually completes.
const _defaultWebFixTimeout = Duration(seconds: 35);

const _recentFixMaxAge = Duration(minutes: 2);
const _storedFixMaxAge = Duration(hours: 24);
const _prefLat = 'last_fix_lat';
const _prefLng = 'last_fix_lng';
const _prefAt = 'last_fix_at_ms';

class _Outcome {
  LocationResult? result;
  LocationFailureReason? reason;
}

class LocationService {
  /// [isWeb] and [webFixTimeout] default to the real platform / production value —
  /// overridable only so tests can exercise the web branch on the VM runner (where
  /// [kIsWeb] is always false) without waiting out the real timeout.
  LocationService({bool? isWeb, Duration? webFixTimeout})
      : _isWeb = isWeb ?? kIsWeb,
        _webFixTimeout = webFixTimeout ?? _defaultWebFixTimeout;

  final bool _isWeb;
  final Duration _webFixTimeout;

  static Future<_Outcome>? _inFlight;
  static (LocationResult, DateTime)? _recentFix;

  @visibleForTesting
  static void resetSharedState() {
    _inFlight = null;
    _recentFix = null;
  }

  /// Set after a failed [getCurrentLocation] call (cleared at the start of the next
  /// one) — read this when that call returns null to show a specific error.
  LocationFailureReason? lastFailureReason;

  /// Returns a live fix when permission is granted and a position is available;
  /// otherwise falls back to the last known position (FR-005), and returns null only
  /// when neither is available. Concurrent callers (e.g. the feed's 5s poll) share one
  /// request instead of each hitting the location provider, and a live fix under two
  /// minutes old is reused as is.
  Future<LocationResult?> getCurrentLocation() async {
    lastFailureReason = null;
    final recent = _recentFix;
    if (recent != null &&
        DateTime.now().difference(recent.$2) < _recentFixMaxAge) {
      return recent.$1;
    }
    final outcome =
        await (_inFlight ??= _acquire().whenComplete(() => _inFlight = null));
    lastFailureReason = outcome.reason;
    return outcome.result;
  }

  Future<_Outcome> _acquire() async {
    final out = _Outcome();
    if (await _ensurePermission(out)) {
      final live = _isWeb ? await _webFix(out) : await _nativeFix(out);
      if (live != null) {
        _recentFix = (live, DateTime.now());
        await _storeFix(live);
        out.result = live;
        return out;
      }
    }
    out.result = await _lastKnownFallback();
    return out;
  }

  /// Web: a single watch-style request, taking its first fix. Deliberately no retry
  /// loop and no `timeLimit`: geolocator_web 4.1.4 converts `timeLimit` with
  /// `.inMicroseconds` where the browser wants milliseconds (a 15s limit reaches the
  /// browser as ~4 hours), so our own timer below is the only timeout that works.
  Future<LocationResult?> _webFix(_Outcome out) async {
    final completer = Completer<Position>();
    final subscription = Geolocator.getPositionStream(
      locationSettings:
          const LocationSettings(accuracy: LocationAccuracy.medium),
    ).listen(
      (p) {
        if (!completer.isCompleted) completer.complete(p);
      },
      onError: (Object e, StackTrace s) {
        if (!completer.isCompleted) completer.completeError(e, s);
      },
      cancelOnError: true,
    );
    try {
      return _fromPosition(await completer.future.timeout(_webFixTimeout));
    } catch (e) {
      _recordFailureReason(e, out);
      return null;
    } finally {
      await subscription.cancel();
    }
  }

  /// Android/iOS: this app only needs city/km-band-level precision, so `.medium`
  /// (network/WiFi as well as GPS) with one quicker retry at the lowest tier. The
  /// Dart-side timer is the backstop if the platform never calls back.
  Future<LocationResult?> _nativeFix(_Outcome out) async {
    for (final attempt in [
      (LocationAccuracy.medium, _nativeFixTimeout),
      (LocationAccuracy.lowest, _nativeFallbackFixTimeout),
    ]) {
      try {
        final position = await Geolocator.getCurrentPosition(
          desiredAccuracy: attempt.$1,
          timeLimit: attempt.$2,
        ).timeout(attempt.$2 + const Duration(seconds: 2));
        return _fromPosition(position);
      } catch (e) {
        _recordFailureReason(e, out);
      }
    }
    return null;
  }

  LocationResult _fromPosition(Position p) => LocationResult(
        lat: p.latitude,
        lng: p.longitude,
        isLiveFix: true,
        accuracyMeters: p.accuracy > 0 ? p.accuracy : null,
      );

  Future<LocationResult?> _lastKnownFallback() async {
    try {
      final last = await Geolocator.getLastKnownPosition();
      if (last != null) {
        return LocationResult(
            lat: last.latitude, lng: last.longitude, isLiveFix: false);
      }
    } catch (_) {
      // Expected on web: geolocator_web has no OS-cached fix and always throws
      // UnsupportedError here. Fall through to the fix we stored ourselves.
    }
    return _storedFix();
  }

  Future<void> _storeFix(LocationResult fix) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setDouble(_prefLat, fix.lat);
      await prefs.setDouble(_prefLng, fix.lng);
      await prefs.setInt(_prefAt, DateTime.now().millisecondsSinceEpoch);
    } catch (_) {
      // Best-effort: failing to remember a fix must never fail getting one.
    }
  }

  Future<LocationResult?> _storedFix() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final lat = prefs.getDouble(_prefLat);
      final lng = prefs.getDouble(_prefLng);
      final at = prefs.getInt(_prefAt);
      if (lat == null || lng == null || at == null) return null;
      final age =
          DateTime.now().difference(DateTime.fromMillisecondsSinceEpoch(at));
      if (age > _storedFixMaxAge) return null;
      return LocationResult(lat: lat, lng: lng, isLiveFix: false);
    } catch (_) {
      return null;
    }
  }

  Future<bool> _ensurePermission(_Outcome out) async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        out.reason = LocationFailureReason.serviceDisabled;
        return false;
      }

      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.always ||
          permission == LocationPermission.whileInUse) {
        return true;
      }
      if (permission == LocationPermission.deniedForever) {
        out.reason = LocationFailureReason.permissionDenied;
        return false;
      }

      // `denied` (not yet decided) or, on web only, `unableToDetermine` (browsers
      // without the Permissions API, notably the Safari family).
      if (_isWeb) {
        // geolocator_web's requestPermission() is just a getCurrentPosition() call with
        // no timeout whose result it throws away, and it maps any failure to a
        // permanent "denied". The position request in _webFix triggers the same
        // browser prompt and keeps the fix, so there is nothing to ask separately.
        return true;
      }

      final requested = await Geolocator.requestPermission();
      if (requested == LocationPermission.always ||
          requested == LocationPermission.whileInUse) {
        return true;
      }
      out.reason = LocationFailureReason.permissionDenied;
      return false;
    } catch (e) {
      _recordFailureReason(e, out);
      return false;
    }
  }

  /// Checks geolocator's own typed exceptions first. Browsers don't expose a typed
  /// exception of their own, though: `navigator.geolocation` rejects with a plain
  /// `PositionError` whose `message` is a literal English string (verified live via
  /// Chrome DevTools against this exact origin) — hence the string-matching fallback,
  /// matched on content rather than a `code`, which is also `1` for a real denial.
  void _recordFailureReason(Object e, _Outcome out) {
    if (e is TimeoutException) {
      out.reason = LocationFailureReason.timedOut;
      return;
    }
    if (e is PermissionDeniedException) {
      out.reason = LocationFailureReason.permissionDenied;
      return;
    }
    if (e is LocationServiceDisabledException) {
      out.reason = LocationFailureReason.serviceDisabled;
      return;
    }
    final message = e.toString().toLowerCase();
    if (message.contains('secure origin')) {
      out.reason = LocationFailureReason.insecureOrigin;
    } else if (message.contains('denied')) {
      out.reason = LocationFailureReason.permissionDenied;
    } else if (message.contains('timeout') || message.contains('timed out')) {
      out.reason = LocationFailureReason.timedOut;
    } else {
      out.reason ??= LocationFailureReason.unavailable;
    }
  }
}
