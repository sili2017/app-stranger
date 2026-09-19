import 'package:flutter/material.dart';
import 'tokens.dart';

const _seedColor = Color(0xFF6750A4);

/// Shared Stranger theme. Individual screens should consume this instead of
/// defining their own [ThemeData] so mobile, tablet, and web stay visually
/// consistent (constitution §5's shared-UI-package intent).
final ThemeData strangerTheme = _buildTheme(Brightness.light);
final ThemeData strangerDarkTheme = _buildTheme(Brightness.dark);

ThemeData _buildTheme(Brightness brightness) {
  final colorScheme = ColorScheme.fromSeed(
    seedColor: _seedColor,
    brightness: brightness,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: colorScheme.surface,
    textTheme: _textTheme,
    appBarTheme: AppBarTheme(
      backgroundColor: colorScheme.surface,
      foregroundColor: colorScheme.onSurface,
      surfaceTintColor: colorScheme.surfaceTint,
      elevation: 0,
      scrolledUnderElevation: 1,
      centerTitle: false,
      titleTextStyle: _textTheme.titleLarge?.copyWith(
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
      labelStyle: _textTheme.labelMedium,
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
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
          horizontal: AppSpacing.md, vertical: AppSpacing.sm),
    ),
    visualDensity: VisualDensity.standard,
  );
}

// A slightly more expressive type scale than Material's bare defaults —
// tighter letter spacing on headlines, a touch more weight on titles, so
// hierarchy reads clearly at a glance rather than everything looking like
// the same default size.
const _textTheme = TextTheme(
  headlineMedium: TextStyle(
      fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: -0.5),
  headlineSmall: TextStyle(
      fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.25),
  titleLarge: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
  titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
  titleSmall: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
  bodyLarge: TextStyle(fontSize: 16, height: 1.4),
  bodyMedium: TextStyle(fontSize: 14, height: 1.4),
  bodySmall: TextStyle(fontSize: 12, height: 1.3),
  labelLarge: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
  labelMedium: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
);
