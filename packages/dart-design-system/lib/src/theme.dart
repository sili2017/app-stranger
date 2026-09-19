import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'tokens.dart';

/// A selectable color palette — Profile > Appearance lets the user pick one
/// independently of light/dark mode (which stays the system [ThemeMode]).
/// `seedColor` drives Material 3's tonal palette generation for most
/// palettes; [pride] additionally overrides secondary/tertiary explicitly
/// so it reads as genuinely multi-hue rather than another single-seed tint.
enum AppPalette {
  classic('Classic', Color(0xFF6750A4)),
  pink('Pink', Color(0xFFE0218A)),
  ocean('Ocean', Color(0xFF00838F)),
  sunset('Sunset', Color(0xFFFF6D3F)),
  pride('Pride', Color(0xFF7C3AED));

  const AppPalette(this.label, this.seedColor);
  final String label;
  final Color seedColor;
}

/// Shared Stranger theme. Individual screens should consume this instead of
/// defining their own [ThemeData] so mobile, tablet, and web stay visually
/// consistent (constitution §5's shared-UI-package intent).
final ThemeData strangerTheme = buildStrangerTheme(
  AppPalette.classic,
  Brightness.light,
);
final ThemeData strangerDarkTheme = buildStrangerTheme(
  AppPalette.classic,
  Brightness.dark,
);

ThemeData buildStrangerTheme(AppPalette palette, Brightness brightness) {
  var colorScheme = ColorScheme.fromSeed(
    seedColor: palette.seedColor,
    brightness: brightness,
  );
  if (palette == AppPalette.pride) {
    final accent = ColorScheme.fromSeed(
      seedColor: const Color(0xFFEC4899),
      brightness: brightness,
    );
    final highlight = ColorScheme.fromSeed(
      seedColor: const Color(0xFFF59E0B),
      brightness: brightness,
    );
    colorScheme = colorScheme.copyWith(
      secondary: accent.primary,
      onSecondary: accent.onPrimary,
      secondaryContainer: accent.primaryContainer,
      onSecondaryContainer: accent.onPrimaryContainer,
      tertiary: highlight.primary,
      onTertiary: highlight.onPrimary,
      tertiaryContainer: highlight.primaryContainer,
      onTertiaryContainer: highlight.onPrimaryContainer,
    );
  }

  final textTheme = GoogleFonts.plusJakartaSansTextTheme(_baseTextTheme);

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: colorScheme.surface,
    textTheme: textTheme,
    appBarTheme: AppBarTheme(
      backgroundColor: colorScheme.surface,
      foregroundColor: colorScheme.onSurface,
      surfaceTintColor: colorScheme.surfaceTint,
      elevation: 0,
      scrolledUnderElevation: 1,
      centerTitle: false,
      titleTextStyle: textTheme.titleLarge?.copyWith(
        color: colorScheme.onSurface,
        fontWeight: FontWeight.w600,
      ),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: colorScheme.surfaceContainerLow,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      margin: EdgeInsets.zero,
    ),
    chipTheme: ChipThemeData(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      side: BorderSide.none,
      backgroundColor: colorScheme.surfaceContainerHigh,
      labelStyle: textTheme.labelMedium,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.sm,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.sm,
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: colorScheme.surfaceContainerLow,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.sm),
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
    ),
    visualDensity: VisualDensity.standard,
  );
}

// A slightly more expressive type scale than Material's bare defaults —
// tighter letter spacing on headlines, a touch more weight on titles, so
// hierarchy reads clearly at a glance rather than everything looking like
// the same default size. Fed into GoogleFonts.*TextTheme() above, which
// keeps these sizes/weights but swaps every style's font family at once.
const _baseTextTheme = TextTheme(
  headlineMedium: TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.5,
  ),
  headlineSmall: TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.25,
  ),
  titleLarge: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
  titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
  titleSmall: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
  bodyLarge: TextStyle(fontSize: 16, height: 1.4),
  bodyMedium: TextStyle(fontSize: 14, height: 1.4),
  bodySmall: TextStyle(fontSize: 12, height: 1.3),
  labelLarge: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
  labelMedium: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
);
