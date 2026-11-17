import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_flutter/api/client.dart';
import 'package:mobile_flutter/api/rooms_api.dart';
import 'package:mobile_flutter/models/room_model.dart';
import 'package:mobile_flutter/models/auth_model.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _RealHttpOverrides extends HttpOverrides {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('el hub abre el modelo activo asociado al proyecto', () async {
    await HttpOverrides.runWithHttpOverrides(() async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((request) async {
        request.response.headers.contentType = ContentType.json;
        if (request.uri.path == '/api/v1/colaboracion/salas/BANCO-123') {
          request.response.write(jsonEncode({'roomId': 'ARC-BANCO-123', 'projectId': 'p', 'diagramId': 'd'}));
        } else if (request.uri.path.endsWith('/BANCO-123/diagrama')) {
          request.response.write(jsonEncode({'title': 'Banco', 'classes': [{'id': 'c', 'name': 'Cuenta'}], 'relations': []}));
        } else {
          request.response.statusCode = 404;
        }
        await request.response.close();
      });
      SharedPreferences.setMockInitialValues({'archai_backend_url': 'http://127.0.0.1:${server.port}/api/v1'});
      try {
        final project = ProjectItem(id: 'p', name: 'Banco', description: '', codigoAcceso: 'BANCO-123', updatedAt: '');
        final entry = await RoomsApi.prepareProjectViewer(project);
        expect(entry!.roomId, 'BANCO-123');
        expect(entry.diagram.id, 'd');
        expect(entry.data.classes.single.name, 'Cuenta');
        expect(entry.live, isTrue);
      } finally {
        await server.close(force: true);
      }
    }, _RealHttpOverrides());
  });

  test('entrar con el PIN normalizado utiliza el canal de la web', () async {
    await HttpOverrides.runWithHttpOverrides(() async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((request) async {
        request.response.headers.contentType = ContentType.json;
        if (request.uri.path.endsWith('/salas/unirse')) {
          request.response.write(jsonEncode({'roomId': 'ARC-BANCO-123', 'projectId': 'p'}));
        } else if (request.uri.path.endsWith('/proyectos/p')) {
          request.response.write(jsonEncode({'codigoAcceso': 'BANCO-123'}));
        } else {
          request.response.statusCode = 404;
        }
        await request.response.close();
      });
      SharedPreferences.setMockInitialValues({'archai_backend_url': 'http://127.0.0.1:${server.port}/api/v1'});
      try {
        final user = UserModel(id: 'u', name: 'Ana', email: '', role: 'LECTOR');
        final room = await RoomsApi.joinRoom('ARC-BANCO-123', user);
        expect(room['roomId'], 'BANCO-123');
      } finally {
        await server.close(force: true);
      }
    }, _RealHttpOverrides());
  });

  test('reintenta la lista fallida y abre el diagrama real del proyecto', () async {
    await HttpOverrides.runWithHttpOverrides(() async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      var diagramRequests = 0;
      final methods = <String>[];
      server.listen((request) async {
        methods.add(request.method);
        request.response.headers.contentType = ContentType.json;
        if (request.uri.path == '/api/v1/proyectos') {
          request.response.write(jsonEncode([{'id': 'project-1', 'name': 'Proyecto', 'totalDiagramas': 1}]));
        } else if (request.uri.path == '/api/v1/diagramas') {
          expect(request.uri.queryParameters['proyectoId'], 'project-1');
          expect(request.headers.value('authorization'), 'Bearer test-token');
          diagramRequests++;
          if (diagramRequests == 1) {
            request.response.statusCode = 503;
            request.response.write(jsonEncode({'message': 'No disponible'}));
          } else {
            request.response.write(jsonEncode([{'id': 'diagram-real', 'title': 'Modelo', 'classes': []}]));
          }
        } else {
          request.response.statusCode = 404;
        }
        await request.response.close();
      });
      SharedPreferences.setMockInitialValues({
        'archai_backend_url': 'http://127.0.0.1:${server.port}/api/v1',
        'archai_jwt_token': 'test-token',
      });
      try {
        final projects = await RoomsApi.listUserProjects('user-1');
        expect(projects.single.diagrams, isEmpty);
        expect(projects.single.diagramsLoaded, isFalse);
        final resolved = await RoomsApi.resolveProjectDiagram(projects.single);
        expect(resolved?.id, 'diagram-real');
        expect(diagramRequests, 2);
        expect(methods, everyElement('GET'));
      } finally {
        await server.close(force: true);
      }
    }, _RealHttpOverrides());
  });

  test('un proyecto vacío es distinto de un error de consulta', () async {
    await HttpOverrides.runWithHttpOverrides(() async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      var shouldFail = false;
      server.listen((request) async {
        request.response.headers.contentType = ContentType.json;
        if (shouldFail) request.response.statusCode = 403;
        request.response.write(shouldFail ? '{"message":"Acceso denegado"}' : '[]');
        await request.response.close();
      });
      SharedPreferences.setMockInitialValues({'archai_backend_url': 'http://127.0.0.1:${server.port}/api/v1'});
      final project = ProjectItem(id: 'project', name: 'Proyecto', description: '', codigoAcceso: 'CODE', updatedAt: '');
      try {
        expect(await RoomsApi.resolveProjectDiagram(project), isNull);
        shouldFail = true;
        await expectLater(RoomsApi.resolveProjectDiagram(project), throwsA(isA<ApiError>()));
        final selected = ProjectDiagramSummary(id: 'exact', projectId: 'project', title: 'Modelo', updatedAt: '');
        expect((await RoomsApi.resolveProjectDiagram(project, selected))?.id, 'exact');
      } finally {
        await server.close(force: true);
      }
    }, _RealHttpOverrides());
  });
  test('abre el diagrama autorizado aunque la sala tenga otro diagrama', () async {
    await HttpOverrides.runWithHttpOverrides(() async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      final requests = <String>[];
      server.listen((request) async {
        requests.add('${request.method} ${request.uri.path}');
        request.response.headers.contentType = ContentType.json;
        if (request.uri.path == '/api/v1/diagramas/selected') {
          request.response.write(jsonEncode({'id': 'selected', 'classes': [
            {'id': 'c1', 'name': 'Clase correcta', 'attributes': [], 'methods': []}
          ], 'relations': []}));
        } else if (request.uri.path == '/api/v1/colaboracion/salas/abrir') {
          request.response.statusCode = 409;
          request.response.write('{"message":"La sala pertenece a otro diagrama"}');
        } else {
          request.response.statusCode = 404;
          request.response.write('{}');
        }
        await request.response.close();
      });
      SharedPreferences.setMockInitialValues({'archai_backend_url': 'http://127.0.0.1:${server.port}/api/v1'});
      final project = ProjectItem(id: 'p', name: 'Proyecto', description: '', codigoAcceso: 'CODE', updatedAt: '');
      final selected = ProjectDiagramSummary(id: 'selected', projectId: 'p', title: 'Diagrama', updatedAt: '');
      try {
        final entry = await RoomsApi.prepareProjectViewer(project, selected);
        expect(entry!.diagram.id, 'selected');
        expect(entry.data.classes.single.name, 'Clase correcta');
        expect(entry.live, isFalse);
        expect(requests, ['GET /api/v1/diagramas/selected', 'POST /api/v1/colaboracion/salas/abrir']);
      } finally {
        await server.close(force: true);
      }
    }, _RealHttpOverrides());
  });

}
