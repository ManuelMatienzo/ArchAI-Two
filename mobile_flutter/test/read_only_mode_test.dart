import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_flutter/api/client.dart';
import 'package:mobile_flutter/models/room_model.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _RealHttpOverrides extends HttpOverrides {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('bloquea cambios y permite consultar y entrar a una sala', () async {
    await HttpOverrides.runWithHttpOverrides(() async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      final requests = <String>[];
      server.listen((request) async {
        requests.add('${request.method} ${request.uri.path}');
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode({'ok': true}));
        await request.response.close();
      });
      SharedPreferences.setMockInitialValues({
        'archai_backend_url': 'http://127.0.0.1:${server.port}/api/v1',
      });
      try {
        for (final request in <(String, String)>[
          ('POST', '/proyectos'),
          ('PUT', '/diagramas/diagram-1'),
          ('DELETE', '/proyectos/project-1'),
          ('POST', '/colaboracion/salas/room-1/mensajes?diagramId=diagram-1'),
        ]) {
          await expectLater(
            ApiClient.request(request.$2, method: request.$1),
            throwsA(isA<ApiError>().having((error) => error.status, 'status', 403)),
          );
        }
        await ApiClient.request('/proyectos');
        await ApiClient.request('/colaboracion/salas/abrir', method: 'POST');
        expect(requests, [
          'GET /api/v1/proyectos',
          'POST /api/v1/colaboracion/salas/abrir',
        ]);
      } finally {
        await server.close(force: true);
      }
    }, _RealHttpOverrides());
  });

  test('interpreta los mensajes de la sala para mostrarlos', () {
    final message = CollabMessage.fromJson({
      'id': 'message-1',
      'authorName': 'María',
      'text': 'Diagrama actualizado',
      'createdAt': '2026-11-17T12:00:00Z',
    });
    expect(message.id, 'message-1');
    expect(message.sender, 'María');
    expect(message.text, 'Diagrama actualizado');
    expect(message.timestamp.toUtc(), DateTime.utc(2026, 11, 17, 12));
  });
}
