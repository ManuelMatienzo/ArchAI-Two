import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../models/auth_model.dart';
import '../models/notification_model.dart';
import '../services/notifications_service.dart';
import '../theme/app_colors.dart';
import 'canvas_viewer_screen.dart';

class NotificationsScreen extends StatefulWidget {
  final UserSession session;
  final String? roomId;

  const NotificationsScreen({
    super.key,
    required this.session,
    this.roomId,
  });

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<TeamNotification> _notifications = [];
  bool _isLoading = false;
  bool _onlyUnread = false;
  Timer? _refreshTimer;
  StreamSubscription<TeamNotification>? _liveSub;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
    _refreshTimer = Timer.periodic(const Duration(seconds: 15), (_) => _loadNotifications(silent: true));

    // Listen to live critical notifications
    _liveSub = NotificationsService.instance.liveNotificationsStream.listen((notif) {
      if (mounted) {
        setState(() {
          _notifications.insert(0, notif);
        });
      }
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _liveSub?.cancel();
    super.dispose();
  }

  Future<void> _loadNotifications({bool silent = false}) async {
    if (!silent) setState(() => _isLoading = true);
    try {
      final list = await NotificationsService.instance.listNotifications(widget.roomId);
      if (mounted) {
        setState(() {
          _notifications = list;
        });
      }
    } finally {
      if (!silent && mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleTapNotification(TeamNotification notif) async {
    await NotificationsService.instance.markNotificationRead(notif.id);
    _loadNotifications(silent: true);

    if (!mounted) return;

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CanvasViewerScreen(
          session: widget.session,
          roomId: notif.roomId,
          roomName: 'Sala ${notif.roomId}',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _onlyUnread
        ? _notifications.where((n) => !n.isRead).toList()
        : _notifications;

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceGlass,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft, size: 20, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Actividad del Equipo',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
        ),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.refreshCw, size: 20, color: AppColors.textSecondary),
            onPressed: () => _loadNotifications(),
            tooltip: 'Actualizar',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Subtitle & filter chips
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Propuestas, decisiones y cambios en tus proyectos',
                      style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                    ),
                  ),
                  FilterChip(
                    label: const Text('Solo no leídas'),
                    selected: _onlyUnread,
                    onSelected: (val) => setState(() => _onlyUnread = val),
                    selectedColor: AppColors.primary,
                    backgroundColor: AppColors.surfaceLight,
                    labelStyle: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: _onlyUnread ? Colors.black : AppColors.textSecondary,
                    ),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    side: BorderSide(color: _onlyUnread ? AppColors.primary : AppColors.borderGlass),
                  ),
                ],
              ),
            ),

            // Notification List
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => _loadNotifications(),
                color: AppColors.primary,
                child: _isLoading && _notifications.isEmpty
                    ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                    : (filtered.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(LucideIcons.bell, size: 48, color: AppColors.textMuted.withAlpha(100)),
                                const SizedBox(height: 12),
                                const Text(
                                  'No hay novedades registradas',
                                  style: TextStyle(fontSize: 13, color: AppColors.textMuted),
                                ),
                              ],
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            itemCount: filtered.length,
                            separatorBuilder: (context, index) => const SizedBox(height: 8),
                            itemBuilder: (context, idx) {
                              final notif = filtered[idx];
                              return _buildNotificationCard(notif);
                            },
                          )),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNotificationCard(TeamNotification notif) {
    final isUnread = !notif.isRead;
    final timeStr = DateFormat('dd/MM HH:mm').format(notif.createdAt);

    return InkWell(
      onTap: () => _handleTapNotification(notif),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surfaceGlass,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isUnread ? AppColors.primary : AppColors.borderGlass,
            width: isUnread ? 1.5 : 1.0,
          ),
          boxShadow: [
            if (isUnread)
              BoxShadow(
                color: AppColors.primary.withAlpha(20),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (isUnread)
                  Container(
                    width: 8,
                    height: 8,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                Expanded(
                  child: Text(
                    notif.title,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: isUnread ? FontWeight.bold : FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    notif.roomId,
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.secondary),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              notif.body,
              style: const TextStyle(fontSize: 12, height: 1.4, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  timeStr,
                  style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                ),
                Row(
                  children: [
                    Icon(
                      notif.target == 'chat' ? LucideIcons.messageSquare : LucideIcons.layers,
                      size: 13,
                      color: AppColors.textMuted,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      notif.target == 'chat' ? 'Abrir Chat' : 'Abrir Lienzo',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
