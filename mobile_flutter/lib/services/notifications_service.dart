import 'dart:async';
import '../api/client.dart';
import '../models/notification_model.dart';

class NotificationsService {
  static final NotificationsService instance = NotificationsService._internal();
  NotificationsService._internal();

  final StreamController<TeamNotification> _liveNotificationsController =
      StreamController<TeamNotification>.broadcast();

  Stream<TeamNotification> get liveNotificationsStream => _liveNotificationsController.stream;

  void emitLiveNotification(TeamNotification notification) {
    _liveNotificationsController.add(notification);
  }

  Future<List<TeamNotification>> listNotifications([String? roomId]) async {
    try {
      final query = roomId != null && roomId.isNotEmpty
          ? '?roomId=${Uri.encodeComponent(roomId)}'
          : '';
      final res = await ApiClient.request('/notificaciones$query');
      if (res is List) {
        return res
            .whereType<Map<String, dynamic>>()
            .map((item) => TeamNotification.fromJson(item))
            .toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

}
