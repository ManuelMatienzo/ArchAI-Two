import '../models/auth_model.dart';
import '../models/room_model.dart';
import '../models/uml_model.dart';
import 'client.dart';

class DiagramData {
  final List<UmlClass> classes;
  final List<UmlRelationship> relationships;

  DiagramData({required this.classes, required this.relationships});
}

class RoomsApi {
  static String normalizeRelationType(String? type) {
    final clean = (type ?? '').toLowerCase();
    if (clean.contains('inherit') || clean.contains('generaliz')) return 'INHERITANCE';
    if (clean.contains('composit')) return 'COMPOSITION';
    if (clean.contains('aggregat')) return 'AGGREGATION';
    return 'ASSOCIATION_1_N';
  }

  static String toSnakeCase(String str) {
    return str
        .replaceAllMapped(RegExp(r'([A-Z])'), (m) => '_${m[1]}')
        .toLowerCase()
        .replaceFirst(RegExp(r'^_'), '');
  }

  static DiagramData parseBackendDiagram(dynamic dto) {
    if (dto == null || dto is! Map<String, dynamic>) {
      return DiagramData(classes: [], relationships: []);
    }

    final rawClasses = dto['classes'] is List ? dto['classes'] as List : [];
    final rawRelations = dto['relations'] is List
        ? dto['relations'] as List
        : (dto['relationships'] is List ? dto['relationships'] as List : []);

    final List<UmlClass> classes = [];
    for (int i = 0; i < rawClasses.length; i++) {
      final c = rawClasses[i];
      if (c is Map<String, dynamic>) {
        classes.add(UmlClass.fromJson(c, i));
      }
    }

    final validIds = classes.map((c) => c.id).toSet();
    final List<UmlRelationship> relationships = [];

    for (int i = 0; i < rawRelations.length; i++) {
      final r = rawRelations[i];
      if (r is Map<String, dynamic>) {
        final sId = r['sourceClassId']?.toString() ?? r['sourceId']?.toString() ?? '';
        final tId = r['targetClassId']?.toString() ?? r['targetId']?.toString() ?? '';
        if (sId.isNotEmpty && tId.isNotEmpty && validIds.contains(sId) && validIds.contains(tId)) {
          relationships.add(UmlRelationship(
            id: r['id']?.toString() ?? 'rel-$i',
            sourceId: sId,
            targetId: tId,
            type: normalizeRelationType(r['type']?.toString()),
            sourceMultiplicity: r['sourceMultiplicity']?.toString() ?? '1',
            targetMultiplicity: r['targetMultiplicity']?.toString() ?? '0..*',
            label: r['label']?.toString() ?? r['name']?.toString(),
          ));
        }
      }
    }

    return DiagramData(classes: classes, relationships: relationships);
  }

  static Future<List<ProjectItem>> listUserProjects(String userId) async {
    try {
      if (userId.isEmpty) return [];
      final res = await ApiClient.request('/proyectos?usuarioId=${Uri.encodeComponent(userId)}');
      if (res is! List) return [];

      final rawProjects = res
          .whereType<Map<String, dynamic>>()
          .map((item) => ProjectItem.fromJson(item, userId))
          .toList();

      // Populate diagrams for each project in parallel
      final enriched = await Future.wait(rawProjects.map((proj) async {
        try {
          final diags = await listProjectDiagrams(proj.id);
          return proj.copyWith(
            diagrams: diags,
            totalDiagrams: diags.isNotEmpty ? diags.length : proj.totalDiagrams,
          );
        } catch (_) {
          return proj;
        }
      }));

      return enriched;
    } catch (_) {
      return [];
    }
  }

  static Future<ProjectItem?> getProjectDetails(String projectId, [String? currentUserId]) async {
    try {
      final res = await ApiClient.request('/proyectos/${Uri.encodeComponent(projectId)}');
      if (res is Map<String, dynamic>) {
        final proj = ProjectItem.fromJson(res, currentUserId);
        final diags = await listProjectDiagrams(projectId);
        return proj.copyWith(diagrams: diags, totalDiagrams: diags.isNotEmpty ? diags.length : proj.totalDiagrams);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  static Future<List<ProjectDiagramSummary>> listProjectDiagrams(String projectId) async {
    try {
      final res = await ApiClient.request('/diagramas?proyectoId=${Uri.encodeComponent(projectId)}');
      if (res is List) {
        return res
            .whereType<Map<String, dynamic>>()
            .map((item) => ProjectDiagramSummary.fromJson(item, projectId))
            .toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  static Future<ProjectDiagramSummary> createDiagram({
    required String projectId,
    required String title,
    required String userId,
  }) async {
    final res = await ApiClient.request(
      '/diagramas',
      method: 'POST',
      body: {
        'title': title.trim(),
        'proyectoId': projectId,
        'creadorId': userId,
        'classes': [],
        'relations': [],
      },
    );
    return ProjectDiagramSummary.fromJson(res as Map<String, dynamic>, projectId);
  }

  static Future<bool> deleteDiagram(String diagramId) async {
    try {
      await ApiClient.request(
        '/diagramas/${Uri.encodeComponent(diagramId)}',
        method: 'DELETE',
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<ProjectMemberItem> inviteMember({
    required String projectId,
    required String emailOrUsername,
    String role = 'EDITOR',
  }) async {
    final res = await ApiClient.request(
      '/proyectos/${Uri.encodeComponent(projectId)}/miembros',
      method: 'POST',
      body: {
        'correoOUsuario': emailOrUsername.trim(),
        'rolProyecto': role,
      },
    );
    return ProjectMemberItem.fromJson(res as Map<String, dynamic>);
  }

  static Future<bool> removeMember(String projectId, String userId) async {
    try {
      await ApiClient.request(
        '/proyectos/${Uri.encodeComponent(projectId)}/miembros/${Uri.encodeComponent(userId)}',
        method: 'DELETE',
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<ProjectItem> createProject({
    required String name,
    required String description,
    required String ownerId,
    String? color,
  }) async {
    final res = await ApiClient.request(
      '/proyectos',
      method: 'POST',
      body: {
        'nombre': name.trim(),
        'descripcion': description.trim(),
        'iconoColor': color ?? '#38BDF8',
        'propietarioId': ownerId,
      },
    );
    return ProjectItem.fromJson(res as Map<String, dynamic>, ownerId);
  }

  static Future<bool> deleteProject(String projectId) async {
    try {
      await ApiClient.request(
        '/proyectos/${Uri.encodeComponent(projectId)}',
        method: 'DELETE',
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> leaveProject(String projectId, String userId) async {
    try {
      await ApiClient.request(
        '/proyectos/${Uri.encodeComponent(projectId)}/miembros/${Uri.encodeComponent(userId)}',
        method: 'DELETE',
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<ProjectItem> joinProjectByCode(String code, String userId) async {
    final res = await ApiClient.request(
      '/proyectos/unirse',
      method: 'POST',
      body: {
        'codigoAcceso': code.trim().toUpperCase(),
        'usuarioId': userId.trim(),
      },
    );
    return ProjectItem.fromJson(res as Map<String, dynamic>, userId);
  }

  static Future<List<Map<String, dynamic>>> listActiveRooms([String? userId]) async {
    try {
      final query = userId != null && userId.isNotEmpty ? '?usuarioId=${Uri.encodeComponent(userId)}' : '';
      final res = await ApiClient.request('/colaboracion/salas$query');
      if (res is! List) return [];

      final List<Map<String, dynamic>> rooms = [];
      for (final item in res) {
        final pin = item.toString();
        try {
          final info = await ApiClient.request('/colaboracion/salas/${Uri.encodeComponent(pin)}');
          rooms.add({
            'id': info['roomId']?.toString() ?? pin,
            'name': info['roomName']?.toString() ?? 'Sala $pin',
            'activeUsers': (info['participants'] as List?)?.length ?? 1,
            'lastUpdated': info['createdAt'] != null ? 'Creada ${info['createdAt']}' : 'En vivo',
            'hostName': info['hostName']?.toString() ?? 'Anfitrión',
            'pin': pin,
          });
        } catch (_) {
          rooms.add({
            'id': pin,
            'name': 'Sala $pin',
            'activeUsers': 1,
            'lastUpdated': 'En vivo',
            'pin': pin,
          });
        }
      }
      return rooms;
    } catch (_) {
      return [];
    }
  }

  static Future<Map<String, dynamic>?> getRoomDetails(String pin) async {
    try {
      final res = await ApiClient.request('/colaboracion/salas/${Uri.encodeComponent(pin)}');
      if (res is Map<String, dynamic>) return res;
      return null;
    } catch (_) {
      return null;
    }
  }

  static Future<Map<String, dynamic>> createRoom(String roomName, UserModel host, [String? pin]) async {
    final res = await ApiClient.request(
      '/colaboracion/salas',
      method: 'POST',
      body: {
        'nombreSala': roomName.trim().isNotEmpty ? roomName.trim() : 'Nueva Sala de Arquitectura',
        'anfitrion': {
          'id': host.id,
          'name': host.name,
          'email': host.email,
          'role': host.role,
        },
        if (pin != null && pin.trim().isNotEmpty) 'pin': pin.trim().toUpperCase(),
      },
    );
    return res as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> joinRoom(String pin, UserModel user) async {
    final res = await ApiClient.request(
      '/colaboracion/salas/unirse',
      method: 'POST',
      body: {
        'pin': pin.trim().toUpperCase(),
        'usuario': {
          'id': user.id,
          'name': user.name,
          'email': user.email,
          'role': user.role,
        },
      },
    );
    return res as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> openDiagramRoom(String diagramId, String roomId) async {
    final result = await ApiClient.request('/colaboracion/salas/abrir', method: 'POST', body: {
      'diagramId': diagramId,
      'roomId': roomId,
    });
    return Map<String, dynamic>.from(result as Map);
  }

  static Future<bool> leaveRoom(String pin, String userId) async {
    try {
      await ApiClient.request(
        '/colaboracion/salas/${Uri.encodeComponent(pin)}/salir?usuarioId=${Uri.encodeComponent(userId)}',
        method: 'POST',
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<DiagramData> getProjectDiagram(String projectId) async {
    try {
      final diagrams = await ApiClient.request('/diagramas?proyectoId=${Uri.encodeComponent(projectId)}');
      if (diagrams is List && diagrams.isNotEmpty) {
        final target = diagrams.firstWhere(
          (d) => d is Map && d['classes'] is List && (d['classes'] as List).isNotEmpty,
          orElse: () => diagrams.first,
        );
        return parseBackendDiagram(target);
      }
      return DiagramData(classes: [], relationships: []);
    } catch (_) {
      return DiagramData(classes: [], relationships: []);
    }
  }

  static Future<DiagramData> getRoomDiagram(String pin, [String? projectId, String? diagramId]) async {
    // An explicitly selected diagram must never fall back to another diagram.
    if (diagramId != null && diagramId.isNotEmpty) {
      final data = await ApiClient.request('/diagramas/${Uri.encodeComponent(diagramId)}');
      if (data is! Map || data['classes'] is! List) throw const FormatException('Diagrama inválido');
      return parseBackendDiagram(data);
    }
    if (projectId != null && projectId.isNotEmpty) {
      final diagrams = await ApiClient.request('/diagramas?proyectoId=${Uri.encodeComponent(projectId)}');
      if (diagrams is! List) throw const FormatException('Lista de diagramas inválida');
      if (diagrams.isNotEmpty) return parseBackendDiagram(diagrams.first);
    }
    final data = await ApiClient.request('/colaboracion/salas/${Uri.encodeComponent(pin)}/diagrama');
    if (data is! Map || data['classes'] is! List) throw const FormatException('Diagrama inválido');
    return parseBackendDiagram(data);
  }

  static Future<List<GhostDraftProposal>> getGhostDrafts(String roomId) async {
    try {
      final res = await ApiClient.request('/ia/ghost-drafts/${Uri.encodeComponent(roomId)}');
      if (res is List) {
        return res.map((item) => GhostDraftProposal.fromJson(item as Map<String, dynamic>)).toList();
      }
      return [];
    } catch (_) {
      return [];
    }
  }
}
