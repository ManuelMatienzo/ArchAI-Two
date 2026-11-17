import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/app_config.dart';

class ApiError implements Exception {
  final int status;
  final String message;

  ApiError(this.status, this.message);

  @override
  String toString() => message;
}

class ApiClient {
  static const String keyJwtToken = 'archai_jwt_token';

  static String getDefaultBackendUrl() => AppConfig.getDefaultBackendUrl();
  static Future<String> getBackendUrl() => AppConfig.getBackendUrl();
  static Future<void> setBackendUrl(String url) => AppConfig.setBackendUrl(url);

  static Future<String?> getAuthToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(keyJwtToken);
  }

  static Future<void> setAuthToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(keyJwtToken, token);
  }

  static Future<void> clearAuthToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(keyJwtToken);
  }

  static Future<dynamic> request(
    String endpoint, {
    String method = 'GET',
    Map<String, String>? headers,
    dynamic body,
    Duration timeout = const Duration(seconds: 10),
  }) async {
    final baseUrl = await getBackendUrl();
    final token = await getAuthToken();

    final cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/$endpoint';
    final uri = Uri.parse('$baseUrl$cleanEndpoint');

    final requestHeaders = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...?headers,
    };

    if (token != null && token.isNotEmpty) {
      requestHeaders['Authorization'] = 'Bearer $token';
    }

    http.Response response;
    try {
      final reqBody = body != null ? (body is String ? body : jsonEncode(body)) : null;

      switch (method.toUpperCase()) {
        case 'POST':
          response = await http.post(uri, headers: requestHeaders, body: reqBody).timeout(timeout);
          break;
        case 'PUT':
          response = await http.put(uri, headers: requestHeaders, body: reqBody).timeout(timeout);
          break;
        case 'DELETE':
          response = await http.delete(uri, headers: requestHeaders, body: reqBody).timeout(timeout);
          break;
        case 'GET':
        default:
          response = await http.get(uri, headers: requestHeaders).timeout(timeout);
          break;
      }
    } on SocketException {
      throw ApiError(0, 'No se pudo conectar con el servidor. Revisa tu conexión de red.');
    } on http.ClientException {
      throw ApiError(0, 'No se pudo conectar con el servidor. Revisa tu conexión de red.');
    } catch (e) {
      if (e is ApiError) rethrow;
      throw ApiError(0, 'Error de conexión: $e');
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.statusCode == 204 || response.body.isEmpty) {
        return null;
      }
      try {
        return jsonDecode(utf8.decode(response.bodyBytes));
      } catch (_) {
        return response.body;
      }
    }

    String errorMsg = 'Error ${response.statusCode}';
    try {
      final errJson = jsonDecode(utf8.decode(response.bodyBytes));
      if (errJson is Map) {
        errorMsg = errJson['message'] ?? errJson['mensaje'] ?? errJson['error'] ?? errorMsg;
      }
    } catch (_) {
      if (response.body.isNotEmpty) {
        errorMsg = response.body;
      }
    }

    throw ApiError(response.statusCode, errorMsg);
  }
}
