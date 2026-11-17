import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../theme/app_colors.dart';

class CanvasHeader extends StatelessWidget {
  final String roomName;
  final String roomId;
  final int participantsCount;
  final int unreadChatCount;
  final bool isSearchOpen;
  final VoidCallback onBack;
  final VoidCallback onToggleSearch;
  final VoidCallback onOpenChat;
  final VoidCallback onOpenParticipants;
  final VoidCallback? onOpenNotifications;

  const CanvasHeader({
    super.key,
    required this.roomName,
    required this.roomId,
    required this.participantsCount,
    this.unreadChatCount = 0,
    required this.isSearchOpen,
    required this.onBack,
    required this.onToggleSearch,
    required this.onOpenChat,
    required this.onOpenParticipants,
    this.onOpenNotifications,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        top: MediaQuery.of(context).padding.top + 8,
        bottom: 12,
        left: 12,
        right: 12,
      ),
      decoration: BoxDecoration(
        color: AppColors.surfaceGlass.withAlpha(240),
        border: const Border(
          bottom: BorderSide(color: AppColors.borderGlass, width: 1),
        ),
      ),
      child: Row(
        children: [
          // Back button
          IconButton(
            icon: const Icon(LucideIcons.arrowLeft, size: 20, color: AppColors.textPrimary),
            onPressed: onBack,
            tooltip: 'Volver a Salas',
          ),

          // Room info & PIN
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  roomName,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                GestureDetector(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: roomId));
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('PIN $roomId copiado al portapapeles'),
                        duration: const Duration(seconds: 2),
                        backgroundColor: AppColors.surfaceLight,
                      ),
                    );
                  },
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withAlpha(35),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: AppColors.primary.withAlpha(90), width: 1),
                        ),
                        child: Text(
                          roomId,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(LucideIcons.copy, size: 12, color: AppColors.textMuted),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Participants pill
          GestureDetector(
            onTap: onOpenParticipants,
            child: Container(
              margin: const EdgeInsets.only(right: 4),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.surfaceLight,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.borderGlass),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(LucideIcons.users, size: 14, color: AppColors.secondary),
                  const SizedBox(width: 4),
                  Text(
                    '$participantsCount',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Search button
          IconButton(
            icon: Icon(
              isSearchOpen ? LucideIcons.x : LucideIcons.search,
              size: 20,
              color: isSearchOpen ? AppColors.primary : AppColors.textPrimary,
            ),
            onPressed: onToggleSearch,
            tooltip: 'Buscar clase',
          ),

          // Notifications button
          if (onOpenNotifications != null)
            IconButton(
              icon: const Icon(LucideIcons.bell, size: 20, color: AppColors.textPrimary),
              onPressed: onOpenNotifications,
              tooltip: 'Actividad del equipo',
            ),

          // Chat button with badge
          Stack(
            clipBehavior: Clip.none,
            children: [
              IconButton(
                icon: const Icon(LucideIcons.messageSquare, size: 20, color: AppColors.textPrimary),
                onPressed: onOpenChat,
                tooltip: 'Chat del equipo',
              ),
              if (unreadChatCount > 0)
                Positioned(
                  top: 6,
                  right: 6,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: AppColors.accentRose,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      '$unreadChatCount',
                      style: const TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
