import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_flutter/api/auth_api.dart';
import 'package:mobile_flutter/config/app_config.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('descarta sesiones locales antiguas sin borrar otros ajustes', () async {
    SharedPreferences.setMockInitialValues({
      AuthApi.keyUserSession: jsonEncode({
        'token': 'mock-offline-token',
        'user': {'id': 'offline', 'name': 'Usuario'},
      }),
      'archai_jwt_token': 'old-token',
      AppConfig.keyBackendUrl: 'https://example.test/api/v1',
    });
    expect(await AuthApi.getSavedSession(), isNull);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString(AuthApi.keyUserSession), isNull);
    expect(prefs.getString('archai_jwt_token'), isNull);
    expect(await AppConfig.getBackendUrl(), 'https://example.test/api/v1');
  });
}
