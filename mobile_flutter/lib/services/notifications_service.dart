import 'dart:async';
import '../api/client.dart';
import '../config/app_config.dart';
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

  Future<void> markNotificationRead(String id) async {
    try {
      await ApiClient.request(
        '/notificaciones/${Uri.encodeComponent(id)}/leida',
        method: 'PUT',
      );
    } catch (_) {}
  }

  Future<bool> registerPushToken({
    required String token,
    String? userId,
    String? roomId,
    String? projectId,
  }) async {
    try {
      await ApiClient.request(
        '/push/register',
        method: 'POST',
        body: {
          'token': token,
          'usuarioId': userId,
          'salaId': roomId,
          'proyectoId': projectId,
          'plataforma': 'mobile-flutter-android',
          'dispositivo': 'Android-Device',
        },
      );
      await AppConfig.setPushToken(token);
      await AppConfig.setPushEnabled(true);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> unregisterPushToken({String? token, String? userId}) async {
    try {
      final savedToken = token ?? await AppConfig.getPushToken();
      final payload = <String, dynamic>{};
      if (savedToken != null) payload['token'] = savedToken;
      if (userId != null) payload['usuarioId'] = userId;

      await ApiClient.request(
        '/push/unregister',
        method: 'POST',
        body: payload,
      );
      await AppConfig.setPushEnabled(false);
      return true;
    } catch (_) {
      return false;
    }
  }
}
