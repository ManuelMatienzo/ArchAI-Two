import 'package:shared_preferences/shared_preferences.dart';

class AppConfig {
  static const String keyBackendUrl = 'archai_backend_url';
  static const String keyJwtToken = 'archai_jwt_token';
  static const String keyPushEnabled = 'archai_push_enabled';
  static const String keyPushToken = 'archai_push_token';

  // Configurable compile-time or Wi-Fi IP
  static const String defaultHost = String.fromEnvironment(
    'ARCHAI_HOST',
    defaultValue: '192.168.0.144',
  );

  static String getDefaultBackendUrl() {
    return 'http://$defaultHost:8000/api/v1';
  }

  static Future<String> getBackendUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final customUrl = prefs.getString(keyBackendUrl);
    if (customUrl != null && customUrl.trim().isNotEmpty) {
      return customUrl.trim();
    }
    return getDefaultBackendUrl();
  }

  static Future<String> getWsUrl() async {
    final baseUrl = await getBackendUrl();
    return baseUrl
        .replaceFirst('http://', 'ws://')
        .replaceFirst('https://', 'wss://')
        .replaceFirst('/api/v1', '/ws-stomp');
  }

  static Future<void> setBackendUrl(String url) async {
    var val = url.trim();
    while (val.endsWith('/')) {
      val = val.substring(0, val.length - 1);
    }
    if (!val.startsWith('http://') && !val.startsWith('https://')) {
      throw Exception('Ingresa una URL válida que empiece con http:// o https://');
    }
    if (!val.endsWith('/api/v1')) {
      val = '$val/api/v1';
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(keyBackendUrl, val);
  }

  static Future<bool> isPushEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(keyPushEnabled) ?? true;
  }

  static Future<void> setPushEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(keyPushEnabled, enabled);
  }

  static Future<String?> getPushToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(keyPushToken);
  }

  static Future<void> setPushToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(keyPushToken, token);
  }
}
