import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator_platform_interface/geolocator_platform_interface.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stranger_flutter/core/location_service.dart';

Position _fakePosition({double lat = 12.9, double lng = 77.6}) => Position(
      latitude: lat,
      longitude: lng,
      timestamp: DateTime.now(),
      accuracy: 47,
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
  LocationPermission requestPermissionResult = LocationPermission.whileInUse;
  int requestPermissionCalls = 0;

  Position? currentPosition;
  Object? currentPositionError;
  int getCurrentPositionCalls = 0;
  List<LocationSettings?> receivedLocationSettings = [];

  /// Web path. null position + no error means "never answers" (a stalled provider).
  Position? streamPosition;
  Object? streamError;
  Duration streamDelay = Duration.zero;
  bool streamStalls = false;
  int streamListens = 0;
  int streamCancels = 0;

  Position? lastKnownPosition;
  Object? lastKnownPositionError;

  @override
  Future<bool> isLocationServiceEnabled() async => serviceEnabled;

  @override
  Future<LocationPermission> checkPermission() async => checkPermissionResult;

  @override
  Future<LocationPermission> requestPermission() async {
    requestPermissionCalls++;
    return requestPermissionResult;
  }

  @override
  Future<Position> getCurrentPosition(
      {LocationSettings? locationSettings}) async {
    getCurrentPositionCalls++;
    receivedLocationSettings.add(locationSettings);
    if (currentPositionError != null) throw currentPositionError!;
    return currentPosition!;
  }

  @override
  Stream<Position> getPositionStream({LocationSettings? locationSettings}) {
    late StreamController<Position> controller;
    controller = StreamController<Position>(
      onListen: () async {
        streamListens++;
        if (streamStalls) return;
        await Future<void>.delayed(streamDelay);
        if (controller.isClosed) return;
        if (streamError != null) {
          controller.addError(streamError!);
        } else {
          controller.add(streamPosition!);
        }
      },
      onCancel: () => streamCancels++,
    );
    return controller.stream;
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
    SharedPreferences.setMockInitialValues({});
    LocationService.resetSharedState();
  });

  group('non-web (native permission dialog)', () {
    test('returns a live fix when already granted', () async {
      fake.currentPosition = _fakePosition();

      final result = await LocationService(isWeb: false).getCurrentLocation();

      expect(result?.isLiveFix, true);
      expect(result?.lat, 12.9);
      expect(result?.accuracyMeters, 47);
    });

    test('prompts via requestPermission() when not yet decided, then fetches',
        () async {
      fake.checkPermissionResult = LocationPermission.denied;
      fake.currentPosition = _fakePosition();

      final result = await LocationService(isWeb: false).getCurrentLocation();

      expect(fake.requestPermissionCalls, 1);
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

    test('passes the native timeLimit through unchanged', () async {
      fake.currentPosition = _fakePosition();

      await LocationService(isWeb: false).getCurrentLocation();

      expect(fake.receivedLocationSettings.single!.timeLimit,
          const Duration(seconds: 15));
    });
  });

  group('web (single patient watch request)', () {
    test('returns the first fix from the stream and stops watching', () async {
      fake.streamPosition = _fakePosition();

      final result = await LocationService(isWeb: true).getCurrentLocation();

      expect(result?.isLiveFix, true);
      expect(fake.getCurrentPositionCalls, 0);
      expect(fake.streamCancels, 1);
    });

    test('waits out a slow first fix instead of retrying', () async {
      fake.streamPosition = _fakePosition();
      fake.streamDelay = const Duration(milliseconds: 300);

      final result = await LocationService(
        isWeb: true,
        webFixTimeout: const Duration(seconds: 5),
      ).getCurrentLocation();

      expect(result?.isLiveFix, true);
      expect(fake.streamListens, 1);
    });

    test(
        'never calls requestPermission() on web: the fix request itself raises '
        'the browser prompt', () async {
      fake.checkPermissionResult = LocationPermission.denied;
      fake.streamPosition = _fakePosition();

      final result = await LocationService(isWeb: true).getCurrentLocation();

      expect(fake.requestPermissionCalls, 0);
      expect(result?.isLiveFix, true);
    });

    test('checkPermission() == unableToDetermine (Safari-family) still fetches',
        () async {
      fake.checkPermissionResult = LocationPermission.unableToDetermine;
      fake.streamPosition = _fakePosition();

      final result = await LocationService(isWeb: true).getCurrentLocation();

      expect(result?.isLiveFix, true);
    });

    test('a stalled provider times out, reports it, and cancels the watch',
        () async {
      fake.streamStalls = true;

      final service = LocationService(
        isWeb: true,
        webFixTimeout: const Duration(milliseconds: 200),
      );
      final result = await service.getCurrentLocation();

      expect(result, isNull);
      expect(service.lastFailureReason, LocationFailureReason.timedOut);
      expect(fake.streamCancels, 1);
    });

    test('a real denial from the browser is reported as such', () async {
      fake.checkPermissionResult = LocationPermission.denied;
      fake.streamError = const PermissionDeniedException('user said no');

      final service = LocationService(isWeb: true);
      final result = await service.getCurrentLocation();

      expect(result, isNull);
      expect(service.lastFailureReason, LocationFailureReason.permissionDenied);
    });

    test('a stall after an earlier good fix falls back to that fix, not-live',
        () async {
      fake.streamPosition = _fakePosition(lat: 18.6, lng: 73.8);
      await LocationService(isWeb: true).getCurrentLocation();

      LocationService.resetSharedState();
      fake.streamPosition = null;
      fake.streamStalls = true;
      final result = await LocationService(
        isWeb: true,
        webFixTimeout: const Duration(milliseconds: 200),
      ).getCurrentLocation();

      expect(result?.isLiveFix, false);
      expect(result?.lat, 18.6);
      expect(result?.lng, 73.8);
    });

    test('a stored fix older than 24h is not used', () async {
      final old = DateTime.now()
          .subtract(const Duration(hours: 25))
          .millisecondsSinceEpoch;
      SharedPreferences.setMockInitialValues({
        'last_fix_lat': 1.0,
        'last_fix_lng': 2.0,
        'last_fix_at_ms': old,
      });
      fake.streamStalls = true;

      final result = await LocationService(
        isWeb: true,
        webFixTimeout: const Duration(milliseconds: 200),
      ).getCurrentLocation();

      expect(result, isNull);
    });
  });

  group('request sharing and reuse', () {
    test('concurrent callers share one request', () async {
      fake.streamPosition = _fakePosition();
      fake.streamDelay = const Duration(milliseconds: 200);

      final results = await Future.wait([
        LocationService(isWeb: true).getCurrentLocation(),
        LocationService(isWeb: true).getCurrentLocation(),
        LocationService(isWeb: true).getCurrentLocation(),
      ]);

      expect(fake.streamListens, 1);
      expect(results.every((r) => r?.isLiveFix == true), true);
    });

    test('a live fix under two minutes old is reused without a new request',
        () async {
      fake.streamPosition = _fakePosition();

      await LocationService(isWeb: true).getCurrentLocation();
      final again = await LocationService(isWeb: true).getCurrentLocation();

      expect(fake.streamListens, 1);
      expect(again?.isLiveFix, true);
    });

    test('a failure is shared with every waiting caller', () async {
      fake.streamStalls = true;

      final a = LocationService(
          isWeb: true, webFixTimeout: const Duration(milliseconds: 200));
      final b = LocationService(
          isWeb: true, webFixTimeout: const Duration(milliseconds: 200));
      await Future.wait([a.getCurrentLocation(), b.getCurrentLocation()]);

      expect(a.lastFailureReason, LocationFailureReason.timedOut);
      expect(b.lastFailureReason, LocationFailureReason.timedOut);
    });
  });
}
