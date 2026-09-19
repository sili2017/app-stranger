/// Shared spacing/radius scale — every screen should reach for these instead
/// of picking its own one-off numbers, so padding/gaps/corners stay
/// consistent across the app (constitution §5's shared-UI-package intent).
class AppSpacing {
  AppSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
  static const double xxl = 48;
}

class AppRadius {
  AppRadius._();

  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double pill = 999;
}

/// Standard entrance/transition durations so motion feels consistent rather
/// than every screen picking its own speed.
class AppMotion {
  AppMotion._();

  static const Duration fast = Duration(milliseconds: 150);
  static const Duration standard = Duration(milliseconds: 250);
  static const Duration slow = Duration(milliseconds: 400);
}
