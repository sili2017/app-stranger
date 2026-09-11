import 'package:flutter/material.dart';

/// T116: breakpoints shared by every screen so phone/tablet/desktop-browser widths adapt
/// without a duplicate per-platform screen (ADR-001's "adapt presentation to form factor
/// without changing business rules").
class Breakpoints {
  Breakpoints._();
  static const double tablet = 700;
  static const double desktop = 1100;
}

enum FormFactor { phone, tablet, desktop }

FormFactor formFactorOf(BuildContext context) {
  final width = MediaQuery.sizeOf(context).width;
  if (width >= Breakpoints.desktop) return FormFactor.desktop;
  if (width >= Breakpoints.tablet) return FormFactor.tablet;
  return FormFactor.phone;
}

/// Centers content with a readable max width on tablet/desktop; fills the screen on
/// phone. Every screen body should be wrapped in this instead of hand-rolling its own
/// width constraint.
class ResponsiveCenter extends StatelessWidget {
  const ResponsiveCenter({super.key, required this.child, this.maxWidth = 640});

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth), child: child),
    );
  }
}
