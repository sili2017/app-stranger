import 'package:flutter/material.dart';

/// Shared Stranger theme. Individual screens should consume this instead of
/// defining their own [ThemeData] so mobile, tablet, and web stay visually
/// consistent (constitution §5's shared-UI-package intent).
final ThemeData strangerTheme = ThemeData(
  useMaterial3: true,
  colorSchemeSeed: const Color(0xFF6750A4),
);
