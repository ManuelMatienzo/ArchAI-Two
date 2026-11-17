import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/auth_model.dart';
import 'client.dart';

class AuthApi {
  static const String keyUserSession = 'archai_user_session';

  static Future<UserSession> login(String email, String password) async {
    final response = await ApiClient.request(
      '/auth/login',
      method: 'POST',
      body: {
        'usuario': email.trim(),
        'contrasena': password.trim(),
      },
    );

    if (response == null || response['token'] == null) {
      throw ApiError(401, 'Credenciales inválidas o respuesta del servidor incompleta.');
    }

    final token = response['token'].toString();
    await ApiClient.setAuthToken(token);

    final rawUser = response['user'] ?? response['currentUser'] ?? {};
    final user = UserModel(
      id: rawUser['id']?.toString() ?? 'usr-${DateTime.now().millisecondsSinceEpoch}',
      name: rawUser['nombre']?.toString() ?? rawUser['name']?.toString() ?? email.split('@')[0],
      email: rawUser['correo']?.toString() ?? rawUser['email']?.toString() ?? email,
      role: rawUser['rol']?.toString() ?? rawUser['role']?.toString() ?? 'Arquitecto de Software',
      avatarColor: rawUser['avatarColor']?.toString() ?? '#38BDF8',
      isHost: false,
    );

    final rawSession = response['session'] ?? {};
    final roomId = rawSession['roomId']?.toString() ?? 'ARC-GRUPO04';

    final session = UserSession(token: token, user: user, roomId: roomId);
    await saveSession(session);
    return session;
  }

  static Future<UserSession> loginOffline(String email, [String role = 'Arquitecto de Software']) async {
    final user = UserModel(
      id: 'usr-offline-${DateTime.now().millisecondsSinceEpoch}',
      name: email.isNotEmpty ? email.split('@')[0] : 'Ing. Carlos Criado',
      email: email.isNotEmpty ? email : 'carlos.criado@archai.io',
      role: role,
      avatarColor: '#E8C39E',
      isHost: true,
    );

    final session = UserSession(
      token: 'mock-offline-token',
      user: user,
      roomId: 'ARC-OFFLINE',
    );
    await saveSession(session);
    return session;
  }

  static Future<void> register(String name, String email, String password, String role) async {
    await ApiClient.request(
      '/auth/registro',
      method: 'POST',
      body: {
        'nombre': name.trim(),
        'nombreUsuario': email.trim().split('@')[0],
        'correo': email.trim(),
        'contrasena': password.trim(),
        'rol': role,
      },
    );
  }

  static Future<void> saveSession(UserSession session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(keyUserSession, jsonEncode(session.toJson()));
  }

  static Future<UserSession?> getSavedSession() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString(keyUserSession);
    if (jsonStr == null || jsonStr.isEmpty) return null;
    try {
      final map = jsonDecode(jsonStr);
      final session = UserSession.fromJson(map);
      // Las sesiones locales antiguas no identifican a un usuario del servidor.
      if (session.token == 'mock-offline-token') {
        await logout();
        return null;
      }
      return session;
    } catch (_) {
      return null;
    }
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(keyUserSession);
    await ApiClient.clearAuthToken();
  }
}
