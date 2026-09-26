import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator_platform_interface/geolocator_platform_interface.dart';
import 'package:stranger_flutter/core/location_service.dart';

Position _fakePosition({double lat = 12.9, double lng = 77.6}) => Position(
      latitude: lat,
      longitude: lng,
      timestamp: DateTime.now(),
      accuracy: 10,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );

/// Drives [LocationService] against a scripted double of the platform channel, so its
/// permission/timeout/fallback logic can be verified without a real device, browser, or
/// GPS fix — every branch is set up explicitly per test via the fields below.
class FakeGeolocatorPlatform extends GeolocatorPlatform {
  bool serviceEnabled = true;
  LocationPermission checkPermissionResult = LocationPermission.whileInUse;

  /// null means "throw", matching geolocator_web's requestPermission() swallowing a
  /// real error (e.g. a slow fix) into a permission-shaped failure.
  LocationPermission? requestPermissionResult = LocationPermission.whileInUse;
  Object? requestPermissionError;
  Future<void> Function()? onRequestPermission;

  Position? currentPosition;
  Object? currentPositionError;
  int getCurrentPositionCalls = 0;

  Position? lastKnownPosition;
  Object? lastKnownPositionError;

  @override
  Future<bool> isLocationServiceEnabled() async => serviceEnabled;

  @override
  Future<LocationPermission> checkPermission() async => checkPermissionResult;

  @override
  Future<LocationPermission> requestPermission() async {
    if (onRequestPermission != null) await onRequestPermission!();
    if (requestPermissionError != null) throw requestPermissionError!;
    return requestPermissionResult!;
  }

  @override
  Future<Position> getCurrentPosition(
      {LocationSettings? locationSettings}) async {
    getCurrentPositionCalls++;
    if (currentPositionError != null) throw currentPositionError!;
    return currentPosition!;
  }

  @override
  Future<Position?> getLastKnownPosition(
      {bool forceLocationManager = false}) async {
    if (lastKnownPositionError != null) throw lastKnownPositionError!;
    return lastKnownPosition;
  }
}

void main() {
  late FakeGeolocatorPlatform fake;

  setUp(() {
    fake = FakeGeolocatorPlatform();
    GeolocatorPlatform.instance = fake;
  });

  group('non-web (native permission dialog)', () {
    test('returns a live fix when already granted', () async {
      fake.checkPermissionResult = LocationPermission.whileInUse;
      fake.currentPosition = _fakePosition();

      final result = await LocationService(isWeb: false).getCurrentLocation();

      expect(result?.isLiveFix, true);
      expect(result?.lat, 12.9);
    });

    test('prompts via requestPermission() when not yet decided, then fetches',
        () async {
      fake.checkPermissionResult = LocationPermission.denied;
      fake.requestPermissionResult = LocationPermission.whileInUse;
      fake.currentPosition = _fakePosition();

      final result = await LocationService(isWeb: false).getCurrentLocation();

      expect(result?.isLiveFix, true);
    });

    test(
        'a real permanent denial falls back to last-known without ever fetching',
        () async {
      fake.checkPermissionResult = LocationPermission.deniedForever;
      fake.lastKnownPosition = _fakePosition(lat: 1, lng: 2);

      final service = LocationService(isWeb: false);
      final result = await service.getCurrentLocation();

      expect(result?.isLiveFix, false);
      expect(fake.getCurrentPositionCalls, 0);
      expect(service.lastFailureReason, LocationFailureReason.permissionDenied);
    });

    test('a disabled location service is reported distinctly', () async {
      fake.serviceEnabled = false;

      final service = LocationService(isWeb: false);
      final result = await service.getCurrentLocation();

      expect(result, isNull);
      expect(service.lastFailureReason, LocationFailureReason.serviceDisabled);
    });
  });

  group('web (geolocator_web requestPermission() is unreliable)', () {
    test(
        'a slow-but-real fix during the permission probe is not treated as a denial '
        '— falls through to the timed fetch loop and still returns a live fix',
        () async {
      fake.checkPermissionResult = LocationPermission.denied;
      // Mirrors geolocator_web: any failure from its internal getCurrentPosition() call
      // — not just a real "no" — comes back through requestPermission() as
      // deniedForever.
      fake.requestPermissionError =
          const PositionUpdateException('network hiccup');
      fake.currentPosition = _fakePosition();

      final service = LocationService(isWeb: true);
      final result = await service.getCurrentLocation();

      expect(result?.isLiveFix, true);
      expect(fake.getCurrentPositionCalls, 1);
    });

    test(
        'checkPermission() == unableToDetermine (Safari-family) still attempts a fetch',
        () async {
      fake.checkPermissionResult = LocationPermission.unableToDetermine;
      fake.currentPosition = _fakePosition();

      final result = await LocationService(isWeb: true).getCurrentLocation();

      expect(result?.isLiveFix, true);
      expect(fake.getCurrentPositionCalls, 1);
    });

    test(
        'a stalled permission probe is bounded by a timeout rather than hanging forever',
        () async {
      fake.checkPermissionResult = LocationPermission.denied;
      fake.onRequestPermission =
          () => Completer<void>().future; // never completes
      fake.currentPosition = _fakePosition();

      final result = await LocationService(isWeb: true).getCurrentLocation();

      expect(result?.isLiveFix, true);
    }, timeout: const Timeout(Duration(seconds: 20)));

    test(
        'a real denial from the actual fetch (not the probe) is still reported',
        () async {
      fake.checkPermissionResult = LocationPermission.denied;
      fake.requestPermissionError = const PositionUpdateException('nope');
      fake.currentPositionError =
          const PermissionDeniedException('user said no');

      final service = LocationService(isWeb: true);
      final result = await service.getCurrentLocation();

      expect(result, isNull);
      expect(service.lastFailureReason, LocationFailureReason.permissionDenied);
    });
  });
}
