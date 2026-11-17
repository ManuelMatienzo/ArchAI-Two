import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:stomp_dart_client/stomp_dart_client.dart';
import '../config/app_config.dart';
import '../models/auth_model.dart';
import '../models/notification_model.dart';
import '../models/room_model.dart';
import '../services/notifications_service.dart';
import 'client.dart';

enum StompStatus { desconectado, conectando, conectado, error }

typedef MessageCallback = void Function(dynamic data);

class QueuedMessage {
  final List<String> destinations;
  final String body;

  QueuedMessage({required this.destinations, required this.body});
}

class MobileStompClient {
  static final MobileStompClient instance = MobileStompClient._internal();
  MobileStompClient._internal();

  // Unique instance token to differentiate this mobile instance from web tabs
  // and avoid silent echo discarding (Obsidian 02 - Fallo 1)
  final String instanceId = 'mobile-${DateTime.now().millisecondsSinceEpoch}-${math.Random().nextInt(99999)}';

  StompClient? _client;
  StompStatus _status = StompStatus.desconectado;
  final Map<String, StompUnsubscribe> _subscriptions = {};
  final Map<String, Set<MessageCallback>> _listeners = {};
  final Set<void Function(StompStatus status)> _statusListeners = {};
  final List<QueuedMessage> _offlineQueue = [];
  String? _currentRoomId;
  Completer<void>? _connectCompleter;

  StompStatus get status => _status;
  bool get isConnected => _status == StompStatus.conectado && (_client?.connected ?? false);

  String getCompositeSenderId(String userId) => '$userId#$instanceId';

  bool isMyOwnInstanceEcho(String? emisorId, String userId) {
    if (emisorId == null) return false;
    return emisorId == getCompositeSenderId(userId);
  }

  void addStatusListener(void Function(StompStatus status) listener) {
    _statusListeners.add(listener);
    listener(_status);
  }

  void removeStatusListener(void Function(StompStatus status) listener) {
    _statusListeners.remove(listener);
  }

  void _notifyStatus(StompStatus newStatus) {
    _status = newStatus;
    for (final listener in _statusListeners) {
      try {
        listener(newStatus);
      } catch (_) {}
    }
  }

  Future<void> connect({void Function()? onConnect, void Function(dynamic err)? onError}) async {
    if (isConnected) {
      onConnect?.call();
      return;
    }

    if (_connectCompleter != null) {
      try {
        await _connectCompleter!.future;
        if (isConnected) onConnect?.call();
      } catch (err) {
        onError?.call(err);
      }
      return;
    }

    if (_client != null) {
      try {
        _client!.deactivate();
      } catch (_) {}
      _client = null;
    }

    _notifyStatus(StompStatus.conectando);

    final wsUrl = await AppConfig.getWsUrl();
    final token = await ApiClient.getAuthToken();
    final Map<String, String> connectHeaders = {};
    if (token != null && token.isNotEmpty) {
      connectHeaders['Authorization'] = 'Bearer $token';
    }

    final completer = Completer<void>();
    _connectCompleter = completer;

    _client = StompClient(
      config: StompConfig(
        url: wsUrl,
        stompConnectHeaders: connectHeaders,
        webSocketConnectHeaders: connectHeaders,
        reconnectDelay: const Duration(seconds: 3),
        heartbeatIncoming: const Duration(seconds: 4),
        heartbeatOutgoing: const Duration(seconds: 4),
        onConnect: (frame) {
          _notifyStatus(StompStatus.conectado);
          _resubscribeAll();
          _drainOfflineQueue();
          if (!completer.isCompleted) completer.complete();
          onConnect?.call();
        },
        onWebSocketError: (err) {
          _notifyStatus(StompStatus.error);
          if (!completer.isCompleted) completer.completeError(err);
          onError?.call(err);
        },
        onStompError: (frame) {
          _notifyStatus(StompStatus.error);
          if (!completer.isCompleted) completer.completeError(frame);
          onError?.call(frame);
        },
        onDisconnect: (frame) {
          _notifyStatus(StompStatus.desconectado);
        },
      ),
    );

    _client!.activate();

    // Timeout protection: 10s
    Timer(const Duration(seconds: 10), () {
      if (!completer.isCompleted && !isConnected) {
        _notifyStatus(StompStatus.error);
        completer.completeError('Timeout al conectar STOMP');
      }
    });

    try {
      await completer.future;
    } finally {
      _connectCompleter = null;
    }
  }

  void _resubscribeAll() {
    if (!isConnected) return;

    _listeners.forEach((dest, callbacks) {
      if (callbacks.isEmpty) return;
      try {
        _subscriptions[dest]?.call();
        final unsub = _client!.subscribe(
          destination: dest,
          callback: (frame) {
            _handleFrameMessage(dest, frame);
          },
        );
        _subscriptions[dest] = unsub;
      } catch (_) {}
    });
  }

  void _handleFrameMessage(String dest, StompFrame frame) {
    if (frame.body == null) return;
    dynamic payload;
    try {
      payload = jsonDecode(frame.body!);
    } catch (_) {
      payload = frame.body;
    }

    // Check if critical event to notify in-app
    if (payload is Map<String, dynamic>) {
      final tipo = payload['tipo']?.toString().toLowerCase();
      if (tipo == 'alerta_critica' || tipo == 'cambio_critico' || tipo == 'ghost_draft') {
        final p = payload['payload'] is Map<String, dynamic> ? payload['payload'] as Map<String, dynamic> : {};
        NotificationsService.instance.emitLiveNotification(
          TeamNotification(
            id: 'live-${DateTime.now().millisecondsSinceEpoch}',
            roomId: payload['salaId']?.toString() ?? '',
            diagramId: '',
            type: tipo ?? 'CRITICO',
            title: p['titulo']?.toString() ?? 'Cambio crítico en la sala',
            body: p['mensaje']?.toString() ?? payload['emisorNombre']?.toString() ?? 'Actualización del modelo',
            createdAt: DateTime.now(),
          ),
        );
      }
    }

    final listeners = _listeners[dest];
    if (listeners != null) {
      for (final cb in listeners) {
        try {
          cb(payload);
        } catch (_) {}
      }
    }
  }

  void _drainOfflineQueue() {
    if (!isConnected || _offlineQueue.isEmpty) return;

    final copy = List<QueuedMessage>.from(_offlineQueue);
    _offlineQueue.clear();

    for (final item in copy) {
      for (final dest in item.destinations) {
        try {
          _client!.send(destination: dest, body: item.body);
        } catch (_) {}
      }
    }
  }

  void Function() genericSubscribe(String dest, MessageCallback callback) {
    _listeners.putIfAbsent(dest, () => <MessageCallback>{}).add(callback);

    if (isConnected && !_subscriptions.containsKey(dest)) {
      final unsub = _client!.subscribe(
        destination: dest,
        callback: (frame) {
          _handleFrameMessage(dest, frame);
        },
      );
      _subscriptions[dest] = unsub;
    }

    return () {
      final set = _listeners[dest];
      if (set != null) {
        set.remove(callback);
        if (set.isEmpty) {
          _listeners.remove(dest);
          _subscriptions[dest]?.call();
          _subscriptions.remove(dest);
        }
      }
    };
  }

  void Function() subscribeRoomCollab(String roomId, MessageCallback callback) {
    _currentRoomId = roomId;
    return genericSubscribe('/topic/collab/$roomId', callback);
  }

  void Function() subscribeGhostDrafts(String roomId, MessageCallback callback) {
    return genericSubscribe('/topic/room/$roomId/ghost-draft', callback);
  }

  void Function() subscribePresence(String roomId, MessageCallback callback) {
    return genericSubscribe('/topic/room/$roomId/presence', callback);
  }

  void Function() subscribeChat(String roomId, MessageCallback callback) {
    _currentRoomId = roomId;

    void chatHandler(dynamic data) {
      if (data == null) return;
      if (data is Map<String, dynamic>) {
        if (data.containsKey('sender') && data.containsKey('text')) {
          callback(CollabMessage.fromJson(data));
          return;
        }

        final tipo = data['tipo']?.toString();
        if ((tipo == 'chat' || tipo == 'chat_message') && data['payload'] is Map) {
          final p = data['payload'] as Map<String, dynamic>;
          final msg = CollabMessage(
            id: p['id']?.toString() ?? 'msg-${DateTime.now().millisecondsSinceEpoch}',
            sender: p['authorName']?.toString() ?? p['sender']?.toString() ?? 'Compañero',
            text: p['text']?.toString() ?? p['content']?.toString() ?? '',
            timestamp: DateTime.now(),
            isAi: p['isAi'] == true || p['role'] == 'ai' || p['isAiResponse'] == true,
            isSystem: p['isSystemNotification'] == true,
            proposalId: p['proposalId']?.toString(),
            payload: p,
          );
          callback(msg);
        }
      }
    }

    final unsub1 = genericSubscribe('/topic/room/$roomId/chat', chatHandler);
    final unsub2 = genericSubscribe('/topic/collab/$roomId', chatHandler);

    return () {
      unsub1();
      unsub2();
    };
  }

  void sendJoin(String roomId, UserModel user) {
    if (roomId.isEmpty || roomId == 'SANDBOX-OFFLINE' || roomId == 'ARC-OFFLINE') return;
    final body = jsonEncode({
      'salaId': roomId,
      'tipo': 'join',
      'emisorId': getCompositeSenderId(user.id),
      'emisorNombre': user.name,
      'payload': {'usuario': user.toJson()},
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });

    _sendOrQueue('/app/collab/$roomId', body);
  }

  void sendSolicitarDiagrama(String roomId, UserModel? user) {
    if (roomId.isEmpty || roomId == 'SANDBOX-OFFLINE' || roomId == 'ARC-OFFLINE') return;
    final userId = user?.id ?? 'usr-mobile';
    final body = jsonEncode({
      'salaId': roomId,
      'tipo': 'solicitar_diagrama',
      'emisorId': getCompositeSenderId(userId),
      'emisorNombre': user?.name ?? 'Móvil',
      'payload': {},
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });

    _sendOrQueue('/app/collab/$roomId', body);
  }

  void sendLeave(String roomId, UserModel user) {
    if (roomId.isEmpty || roomId == 'SANDBOX-OFFLINE' || roomId == 'ARC-OFFLINE') return;
    final body = jsonEncode({
      'salaId': roomId,
      'tipo': 'leave',
      'emisorId': getCompositeSenderId(user.id),
      'emisorNombre': user.name,
      'payload': {'usuarioId': user.id},
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });

    if (isConnected) {
      try {
        _client!.send(destination: '/app/collab/$roomId', body: body);
      } catch (_) {}
    }
  }

  void sendNodoMover(String roomId, String nodoId, double x, double y, UserModel user) {
    if (roomId.isEmpty || roomId == 'SANDBOX-OFFLINE' || roomId == 'ARC-OFFLINE') return;
    final body = jsonEncode({
      'salaId': roomId,
      'tipo': 'nodo_mover',
      'emisorId': getCompositeSenderId(user.id),
      'emisorNombre': user.name,
      'payload': {
        'id': nodoId,
        'nodoId': nodoId,
        'x': x,
        'y': y,
        'usuario': user.name,
      },
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });

    _sendOrQueue('/app/collab/$roomId', body);
  }

  void sendChatMessage(String roomId, CollabMessage message, [UserModel? user]) {
    final senderId = user != null ? getCompositeSenderId(user.id) : message.sender;
    final backendPayload = jsonEncode({
      'salaId': roomId,
      'tipo': 'chat',
      'emisorId': senderId,
      'emisorNombre': message.sender,
      'payload': {...message.toJson(), 'content': message.text, 'senderId': user?.id ?? senderId},
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });

    _sendOrQueue('/app/collab/$roomId', backendPayload);
  }

  void _sendOrQueue(String destination, String body) {
    if (isConnected) {
      try {
        _client!.send(destination: destination, body: body);
      } catch (_) {
        _offlineQueue.add(QueuedMessage(destinations: [destination], body: body));
      }
    } else {
      _offlineQueue.add(QueuedMessage(destinations: [destination], body: body));
    }
  }

  void unsubscribeRoom(String roomId) {
    final toRemove = [
      '/topic/collab/$roomId',
      '/topic/room/$roomId/ghost-draft',
      '/topic/room/$roomId/chat',
      '/topic/room/$roomId/presence',
    ];
    for (final dest in toRemove) {
      _subscriptions[dest]?.call();
      _subscriptions.remove(dest);
      _listeners.remove(dest);
    }
    if (_currentRoomId == roomId) {
      _currentRoomId = null;
    }
  }

  void disconnect() {
    for (final unsub in _subscriptions.values) {
      try {
        unsub.call();
      } catch (_) {}
    }
    _subscriptions.clear();
    _listeners.clear();
    _offlineQueue.clear();
    _currentRoomId = null;

    if (_client != null) {
      _client!.deactivate();
      _client = null;
    }
    _notifyStatus(StompStatus.desconectado);
  }
}
