import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../models/uml_model.dart';
import '../theme/app_colors.dart';

class ClassCardWidget extends StatelessWidget {
  final UmlClass model;
  final bool isGhost;
  final bool isHighlighted;
  final String? remoteDraggingUser;
  final VoidCallback onTap;

  const ClassCardWidget({
    super.key,
    required this.model,
    this.isGhost = false,
    this.isHighlighted = false,
    this.remoteDraggingUser,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isMoving = remoteDraggingUser != null && remoteDraggingUser!.isNotEmpty;
    final stereotype = model.stereotype.isNotEmpty ? model.stereotype : 'Entity';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: model.width > 0 ? model.width : 220.0,
        decoration: BoxDecoration(
          color: isGhost ? AppColors.surfaceGhost : AppColors.surfaceGlass,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isHighlighted
                ? AppColors.primary
                : (isMoving
                    ? AppColors.secondary
                    : (isGhost ? AppColors.ghostBorder : AppColors.borderGlass)),
            width: isHighlighted || isMoving ? 2.0 : 1.0,
          ),
          boxShadow: [
            if (isHighlighted)
              BoxShadow(
                color: AppColors.primary.withAlpha(120),
                blurRadius: 18,
                spreadRadius: 2,
              )
            else
              BoxShadow(
                color: Colors.black.withAlpha(90),
                blurRadius: 10,
                offset: const Offset(0, 5),
              ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Remote dragging banner if someone else is moving it
            if (isMoving)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: const BoxDecoration(
                  color: AppColors.secondary,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(11)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(LucideIcons.move, size: 11, color: Colors.black),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        '$remoteDraggingUser moviendo...',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Colors.black,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),

            // COMPARTMENT 1: STEREOTYPE & CLASS NAME
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.surfaceLight.withAlpha(60),
                borderRadius: isMoving
                    ? BorderRadius.zero
                    : const BorderRadius.vertical(top: Radius.circular(11)),
              ),
              child: Column(
                children: [
                  Text(
                    '«$stereotype»',
                    style: TextStyle(
                      fontSize: 10,
                      letterSpacing: 0.8,
                      fontWeight: FontWeight.w600,
                      color: isGhost ? AppColors.accentEmerald : AppColors.secondary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    model.name,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),

            const Divider(height: 1, thickness: 1, color: AppColors.borderGlass),

            // COMPARTMENT 2: ATTRIBUTES
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (model.attributes.isEmpty)
                    const Text(
                      'sin atributos',
                      style: TextStyle(
                        fontSize: 10,
                        fontStyle: FontStyle.italic,
                        color: AppColors.textMuted,
                      ),
                    )
                  else
                    ...model.attributes.take(5).map((attr) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 1.5),
                        child: Row(
                          children: [
                            if (attr.isPrimaryKey)
                              const Padding(
                                padding: EdgeInsets.only(right: 4),
                                child: Text(
                                  'PK',
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primary,
                                  ),
                                ),
                              )
                            else if (attr.isForeignKey)
                              const Padding(
                                padding: EdgeInsets.only(right: 4),
                                child: Text(
                                  'FK',
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.secondary,
                                  ),
                                ),
                              )
                            else
                              Text(
                                attr.visibility,
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontFamily: 'monospace',
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            const SizedBox(width: 3),
                            Expanded(
                              child: Text(
                                '${attr.name}: ${attr.type}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontFamily: 'monospace',
                                  color: AppColors.textPrimary,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  if (model.attributes.length > 5)
                    Text(
                      '+${model.attributes.length - 5} más...',
                      style: const TextStyle(fontSize: 9, color: AppColors.textMuted),
                    ),
                ],
              ),
            ),

            const Divider(height: 1, thickness: 1, color: AppColors.borderGlass),

            // COMPARTMENT 3: METHODS
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (model.methods.isEmpty)
                    const Text(
                      'sin métodos',
                      style: TextStyle(
                        fontSize: 10,
                        fontStyle: FontStyle.italic,
                        color: AppColors.textMuted,
                      ),
                    )
                  else
                    ...model.methods.take(3).map((m) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 1.5),
                        child: Row(
                          children: [
                            Text(
                              m.visibility,
                              style: const TextStyle(
                                fontSize: 10,
                                fontFamily: 'monospace',
                                color: AppColors.accentEmerald,
                              ),
                            ),
                            const SizedBox(width: 3),
                            Expanded(
                              child: Text(
                                '${m.name}(): ${m.returnType}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontFamily: 'monospace',
                                  color: AppColors.textSecondary,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                  if (model.methods.length > 3)
                    Text(
                      '+${model.methods.length - 3} más...',
                      style: const TextStyle(fontSize: 9, color: AppColors.textMuted),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
