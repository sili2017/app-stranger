import 'package:geolocator/geolocator.dart';

/// T117: platform-abstracted location acquisition. `geolocator`'s federated plugin
/// resolves to the native GPS API on mobile and the browser Geolocation API on web
/// automatically — this class only adds the FR-005 last-known-location fallback that
/// both platforms share, so callers never branch on `kIsWeb` themselves.
class LocationResult {
  LocationResult(
      {required this.lat, required this.lng, required this.isLiveFix});
  final double lat;
  final double lng;
  final bool isLiveFix;
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
  unavailable,
}

class LocationService {
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

    try {
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
      return LocationResult(
          lat: position.latitude, lng: position.longitude, isLiveFix: true);
    } catch (e) {
      _recordFailureReason(e);
      return _lastKnownFallback();
    }
  }

  Future<LocationResult?> _lastKnownFallback() async {
    try {
      final last = await Geolocator.getLastKnownPosition();
      if (last == null) return null;
      return LocationResult(
          lat: last.latitude, lng: last.longitude, isLiveFix: false);
    } catch (_) {
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

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.always ||
          permission == LocationPermission.whileInUse) {
        return true;
      }
      lastFailureReason = LocationFailureReason.permissionDenied;
      return false;
    } catch (e) {
      _recordFailureReason(e);
      return false;
    }
  }

  /// Browsers don't expose a typed exception for this — `navigator.geolocation`
  /// rejects with a plain `PositionError` whose `message` is this literal English
  /// string (verified live via Chrome DevTools against this exact origin), so pattern
  /// match on it rather than a `code`, which is also `1` for a real permission denial.
  void _recordFailureReason(Object e) {
    final message = e.toString().toLowerCase();
    if (message.contains('secure origin')) {
      lastFailureReason = LocationFailureReason.insecureOrigin;
    } else if (message.contains('denied')) {
      lastFailureReason = LocationFailureReason.permissionDenied;
    } else {
      lastFailureReason ??= LocationFailureReason.unavailable;
    }
  }
}
