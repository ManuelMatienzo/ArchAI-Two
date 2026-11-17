import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_flutter/api/auth_api.dart';
import 'package:mobile_flutter/api/rooms_api.dart';
import 'package:mobile_flutter/api/stomp_client.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stomp_dart_client/stomp_dart_client.dart';

class RealHttpOverrides extends HttpOverrides {}

void main() {
  LiveTestWidgetsFlutterBinding.ensureInitialized();
  test('Flutter recibe movimiento desde otro cliente STOMP', () async {
    await HttpOverrides.runWithHttpOverrides(() async {
    SharedPreferences.setMockInitialValues({'archai_backend_url': 'http://127.0.0.1:18080/api/v1'});
    final session = await AuthApi.login('carlos.criado@archai.io', 'password123');
    final projects = await RoomsApi.listUserProjects(session.user.id);
    expect(projects, isNotEmpty);
    final project = projects.firstWhere((p) => p.diagrams.isNotEmpty);
    final room = await RoomsApi.openDiagramRoom(project.diagrams.first.id, project.codigoAcceso);
    final roomId = room['roomId'] as String;
    final data = await RoomsApi.getRoomDiagram(roomId, project.id, project.diagrams.first.id);
    expect(data.classes, isNotEmpty);
    final received = Completer<Map>();
    final mobile = MobileStompClient.instance;
    final unsubscribe = mobile.subscribeRoomCollab(roomId, (event) {
      if (event is Map && event['tipo'] == 'nodo_mover' && !received.isCompleted) received.complete(event);
    });
    final peerConnected = Completer<void>();
    final peer = StompClient(config: StompConfig(
      url: 'ws://127.0.0.1:18080/ws-stomp',
      stompConnectHeaders: {'Authorization': 'Bearer ${session.token}'},
      webSocketConnectHeaders: {'Authorization': 'Bearer ${session.token}'},
      onConnect: (_) => peerConnected.complete(),
    ));
    try {
      await mobile.connect().timeout(const Duration(seconds: 10));
      peer.activate();
      await peerConnected.future.timeout(const Duration(seconds: 10));
      peer.send(destination: '/app/collab/$roomId', body: jsonEncode({
        'salaId': roomId, 'tipo': 'nodo_mover', 'emisorId': '${session.user.id}#web-test',
        'emisorNombre': 'Web', 'payload': {'classId': data.classes.first.id, 'x': 123, 'y': 456},
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      }));
      final event = await received.future.timeout(const Duration(seconds: 10));
      expect(event['payload']['classId'], data.classes.first.id);
      expect(event['payload']['x'], 123);
    } finally {
      unsubscribe();
      mobile.disconnect();
      peer.deactivate();
    }
    }, RealHttpOverrides());
  }, skip: Platform.environment['ARCHAI_LIVE_TEST'] != '1');
}

