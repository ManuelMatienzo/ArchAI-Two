import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../models/uml_model.dart';
import '../theme/app_colors.dart';

class CanvasRelationPainter extends CustomPainter {
  final List<UmlClass> classes;
  final List<UmlRelationship> relationships;
  final bool isGhost;

  CanvasRelationPainter({
    required this.classes,
    required this.relationships,
    this.isGhost = false,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (classes.isEmpty || relationships.isEmpty) return;

    final classMap = {for (var c in classes) c.id: c};

    final linePaint = Paint()
      ..color = isGhost ? AppColors.accentEmerald : AppColors.primary
      ..strokeWidth = 1.8
      ..style = PaintingStyle.stroke;

    final fillPaint = Paint()
      ..color = isGhost ? AppColors.accentEmerald : AppColors.primary
      ..style = PaintingStyle.fill;

    final hollowPaint = Paint()
      ..color = AppColors.background
      ..style = PaintingStyle.fill;

    for (final rel in relationships) {
      final src = classMap[rel.sourceId];
      final tgt = classMap[rel.targetId];
      if (src == null || tgt == null) continue;

      // Approximate heights based on attributes & methods
      final srcH = 50.0 + (src.attributes.length.clamp(0, 5)) * 16.0 + (src.methods.length.clamp(0, 3)) * 16.0 + 30.0;
      final tgtH = 50.0 + (tgt.attributes.length.clamp(0, 5)) * 16.0 + (tgt.methods.length.clamp(0, 3)) * 16.0 + 30.0;

      final srcW = src.width > 0 ? src.width : 220.0;
      final tgtW = tgt.width > 0 ? tgt.width : 220.0;

      final srcCx = src.x + srcW / 2;
      final srcCy = src.y + srcH / 2;
      final tgtCx = tgt.x + tgtW / 2;
      final tgtCy = tgt.y + tgtH / 2;

      // Self-relation
      if (src.id == tgt.id) {
        final startX = src.x + srcW;
        final startY = src.y + 40.0;
        final loopSize = 45.0;

        final path = Path()
          ..moveTo(startX, startY)
          ..lineTo(startX + loopSize, startY)
          ..lineTo(startX + loopSize, startY - loopSize)
          ..lineTo(src.x + srcW - 30.0, startY - loopSize)
          ..lineTo(src.x + srcW - 30.0, src.y);

        canvas.drawPath(path, linePaint);
        _drawMultiplicity(canvas, rel.sourceMultiplicity, Offset(startX + 8, startY + 4));
        _drawMultiplicity(canvas, rel.targetMultiplicity, Offset(src.x + srcW - 25, src.y - 14));
        continue;
      }

      // Determine optimal sides
      final dx = tgtCx - srcCx;
      final dy = tgtCy - srcCy;

      double startX, startY, endX, endY;
      double midX, midY;
      bool horizontalFirst = true;

      if (dx.abs() > dy.abs()) {
        // Source and target are horizontally separated
        horizontalFirst = true;
        if (dx > 0) {
          startX = src.x + srcW;
          startY = srcCy;
          endX = tgt.x;
          endY = tgtCy;
        } else {
          startX = src.x;
          startY = srcCy;
          endX = tgt.x + tgtW;
          endY = tgtCy;
        }
        midX = (startX + endX) / 2;
        midY = endY;
      } else {
        // Vertically separated
        horizontalFirst = false;
        if (dy > 0) {
          startX = srcCx;
          startY = src.y + srcH;
          endX = tgtCx;
          endY = tgt.y;
        } else {
          startX = srcCx;
          startY = src.y;
          endX = tgtCx;
          endY = tgt.y + tgtH;
        }
        midX = endX;
        midY = (startY + endY) / 2;
      }

      // Draw 90-degree orthogonal stepped line
      final path = Path()..moveTo(startX, startY);
      if (horizontalFirst) {
        path.lineTo(midX, startY);
        path.lineTo(midX, endY);
        path.lineTo(endX, endY);
      } else {
        path.lineTo(startX, midY);
        path.lineTo(endX, midY);
        path.lineTo(endX, endY);
      }
      canvas.drawPath(path, linePaint);

      // Draw Multiplicities
      _drawMultiplicity(
        canvas,
        rel.sourceMultiplicity,
        Offset(startX + (dx > 0 ? 6 : -24), startY + (dy > 0 ? -16 : 6)),
      );
      _drawMultiplicity(
        canvas,
        rel.targetMultiplicity,
        Offset(endX + (dx > 0 ? -24 : 6), endY + (dy > 0 ? -16 : 6)),
      );

      // Draw Marker at endX, endY
      final typeUpper = rel.type.toUpperCase();
      final angle = horizontalFirst ? (dx > 0 ? 0.0 : math.pi) : (dy > 0 ? math.pi / 2 : -math.pi / 2);

      canvas.save();
      canvas.translate(endX, endY);
      canvas.rotate(angle);

      if (typeUpper.contains('INHERIT') || typeUpper.contains('GENERALIZ')) {
        // Hollow triangle for Inheritance
        final markerPath = Path()
          ..moveTo(0, 0)
          ..lineTo(-12, -7)
          ..lineTo(-12, 7)
          ..close();
        canvas.drawPath(markerPath, hollowPaint);
        canvas.drawPath(markerPath, linePaint);
      } else if (typeUpper.contains('COMPOSIT')) {
        // Solid diamond for Composition
        final markerPath = Path()
          ..moveTo(0, 0)
          ..lineTo(-8, -5)
          ..lineTo(-16, 0)
          ..lineTo(-8, 5)
          ..close();
        canvas.drawPath(markerPath, fillPaint);
        canvas.drawPath(markerPath, linePaint);
      } else if (typeUpper.contains('AGGREGAT')) {
        // Hollow diamond for Aggregation
        final markerPath = Path()
          ..moveTo(0, 0)
          ..lineTo(-8, -5)
          ..lineTo(-16, 0)
          ..lineTo(-8, 5)
          ..close();
        canvas.drawPath(markerPath, hollowPaint);
        canvas.drawPath(markerPath, linePaint);
      } else {
        // Open arrow for directed association
        final markerPath = Path()
          ..moveTo(-10, -6)
          ..lineTo(0, 0)
          ..lineTo(-10, 6);
        canvas.drawPath(markerPath, linePaint);
      }

      canvas.restore();
    }
  }

  void _drawMultiplicity(Canvas canvas, String text, Offset offset) {
    if (text.isEmpty) return;
    final textSpan = TextSpan(
      text: text,
      style: const TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.bold,
        color: AppColors.primary,
        backgroundColor: Colors.black54,
      ),
    );
    final textPainter = TextPainter(
      text: textSpan,
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(canvas, offset);
  }

  @override
  bool shouldRepaint(covariant CanvasRelationPainter oldDelegate) {
    return oldDelegate.classes != classes ||
        oldDelegate.relationships != relationships ||
        oldDelegate.isGhost != isGhost;
  }
}
