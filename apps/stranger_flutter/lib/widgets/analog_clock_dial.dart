import 'dart:math' as math;
import 'package:flutter/material.dart';

/// A small analog clock face whose single hand points at `minutes` on a 60-minute
/// dial (a real minute hand: 5 minutes = one tick, a full lap = 60) — used in place of
/// a plain number for the publish form's lifetime slider, so the remaining-time value
/// reads at a glance rather than as a number that changes as you drag.
class AnalogClockDial extends StatelessWidget {
  const AnalogClockDial({super.key, required this.minutes, this.size = 32});

  final int minutes;
  final double size;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _ClockPainter(minutes: minutes, color: scheme.primary),
      ),
    );
  }
}

class _ClockPainter extends CustomPainter {
  _ClockPainter({required this.minutes, required this.color});

  final int minutes;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;

    canvas.drawCircle(
      center,
      radius - 1,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );

    final tickPaint = Paint()
      ..color = color
      ..strokeWidth = 1;
    for (var i = 0; i < 12; i++) {
      final angle = (i / 12) * 2 * math.pi;
      final direction = Offset(math.sin(angle), -math.cos(angle));
      canvas.drawLine(
        center + direction * (radius - 2),
        center + direction * (radius - 5),
        tickPaint,
      );
    }

    final handAngle = (minutes % 60) / 60 * 2 * math.pi;
    final handDirection = Offset(math.sin(handAngle), -math.cos(handAngle));
    canvas.drawLine(
      center,
      center + handDirection * (radius * 0.7),
      Paint()
        ..color = color
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round,
    );

    canvas.drawCircle(center, 1.5, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant _ClockPainter oldDelegate) =>
      oldDelegate.minutes != minutes || oldDelegate.color != color;
}
