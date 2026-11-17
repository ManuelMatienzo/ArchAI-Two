import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../models/uml_model.dart';
import '../theme/app_colors.dart';

class GhostDraftBanner extends StatelessWidget {
  final GhostDraftProposal proposal;
  final VoidCallback onReview;
  final VoidCallback onDismiss;

  const GhostDraftBanner({
    super.key,
    required this.proposal,
    required this.onReview,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceGhost,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.accentEmerald.withAlpha(180), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: AppColors.accentEmerald.withAlpha(50),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.accentEmerald.withAlpha(40),
              shape: BoxShape.circle,
            ),
            child: const Icon(LucideIcons.sparkles, size: 20, color: AppColors.accentEmerald),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Sugerencia de Arquitectura IA',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: AppColors.accentEmerald,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  proposal.title.isNotEmpty ? proposal.title : 'Nuevas clases propuestas',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accentEmerald,
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: onReview,
            child: const Text('Revisar', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 4),
          IconButton(
            icon: const Icon(LucideIcons.x, size: 18, color: AppColors.textMuted),
            onPressed: onDismiss,
            tooltip: 'Ocultar sugerencia',
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
        ],
      ),
    );
  }
}
