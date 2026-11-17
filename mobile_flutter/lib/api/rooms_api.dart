import '../models/auth_model.dart';
import '../models/room_model.dart';
import '../models/uml_model.dart';
import 'client.dart';

class DiagramData {
  final List<UmlClass> classes;
  final List<UmlRelationship> relationships;

  DiagramData({required this.classes, required this.relationships});
}

class ProjectViewerEntry {
  final ProjectDiagramSummary diagram;
  final DiagramData data;
  final String roomId;
  final bool live;

  ProjectViewerEntry({required this.diagram, required this.data, required this.roomId, required this.live});
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
    {
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
            totalDiagrams: diags.length,
            diagramsLoaded: true,
          );
        } catch (_) {
          return proj.copyWith(diagramsLoaded: false);
        }
      }));

      return enriched;
    }
  }

  static Future<ProjectItem?> getProjectDetails(String projectId, [String? currentUserId]) async {
    try {
      final res = await ApiClient.request('/proyectos/${Uri.encodeComponent(projectId)}');
      if (res is Map<String, dynamic>) {
        final proj = ProjectItem.fromJson(res, currentUserId);
        final diags = await listProjectDiagrams(projectId);
        return proj.copyWith(diagrams: diags, totalDiagrams: diags.length, diagramsLoaded: true);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  static Future<List<ProjectDiagramSummary>> listProjectDiagrams(String projectId) async {
    final res = await ApiClient.request(
      '/diagramas?proyectoId=${Uri.encodeComponent(projectId)}',
      timeout: const Duration(seconds: 20),
    );
    if (res is! List) throw const FormatException('Lista de diagramas inválida');
    return res.whereType<Map<String, dynamic>>()
        .where((item) => item['id'] != null && item['id'].toString().isNotEmpty)
        .map((item) => ProjectDiagramSummary.fromJson(item, projectId)).toList();
  }

  /// An empty or unavailable summary is reloaded before choosing a diagram.
  static Future<ProjectDiagramSummary?> resolveProjectDiagram(
    ProjectItem project, [ProjectDiagramSummary? selected]
  ) async {
    if (selected != null) return selected;
    final diagrams = await listProjectDiagrams(project.id);
    return diagrams.isEmpty ? null : diagrams.first;
  }

  /// Load the selected saved model first. A room conflict must not prevent viewing it.
  static Future<ProjectViewerEntry?> prepareProjectViewer(
    ProjectItem project, [ProjectDiagramSummary? selected]
  ) async {
    final roomId = project.codigoAcceso.isNotEmpty ? project.codigoAcceso : project.id;
    if (selected == null) {
      // El botón del proyecto abre el modelo activo, también antes de su guardado.
      final room = await getRoomDetails(roomId);
      if (room != null && room['projectId']?.toString() == project.id) {
        try {
          final live = await ApiClient.request('/colaboracion/salas/${Uri.encodeComponent(roomId)}/diagrama');
          if (live is Map<String, dynamic> && live['classes'] is List) {
            return ProjectViewerEntry(
              diagram: ProjectDiagramSummary(id: room['diagramId']?.toString() ?? '', projectId: project.id,
                  title: live['title']?.toString() ?? project.name, updatedAt: ''),
              data: parseBackendDiagram(live), roomId: roomId, live: true,
            );
          }
        } catch (_) {
          // La lista guardada sigue siendo una alternativa si la sala no responde.
        }
      }
    }
    final diagram = await resolveProjectDiagram(project, selected);
    if (diagram == null) return null;
    final data = await getRoomDiagram(roomId, project.id, diagram.id);
    try {
      final room = await openDiagramRoom(diagram.id, roomId);
      return ProjectViewerEntry(diagram: diagram, data: data,
          roomId: room['roomId']?.toString() ?? roomId, live: true);
    } catch (_) {
      // The project room can already belong to a different diagram. Viewing the
      // authorized saved model must not switch that room or display another model.
      return ProjectViewerEntry(diagram: diagram, data: data, roomId: roomId, live: false);
    }
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
    final room = Map<String, dynamic>.from(res as Map);
    final projectId = room['projectId']?.toString();
    if (projectId != null && projectId.isNotEmpty) {
      try {
        final project = await ApiClient.request('/proyectos/${Uri.encodeComponent(projectId)}');
        if (project is Map) {
          final code = (project['codigoAcceso'] ?? project['codigo'] ?? project['code'])?.toString().trim().toUpperCase();
          final normalizedPin = pin.trim().toUpperCase();
          String normalized(String value) => value.startsWith('ARC-') ? value : 'ARC-$value';
          if (code != null && code.isNotEmpty && normalized(code) == normalized(normalizedPin)) {
            room['roomId'] = code;
          }
        }
      } catch (_) {
        // Los invitados por PIN pueden no tener acceso al detalle del proyecto.
      }
    }
    return room;
  }

  static Future<Map<String, dynamic>> openDiagramRoom(String diagramId, String roomId) async {
    final result = await ApiClient.request('/colaboracion/salas/abrir', method: 'POST', body: {
      'diagramId': diagramId,
      'roomId': roomId,
    });
    return Map<String, dynamic>.from(result as Map);
  }

  static Future<DiagramData> getRoomDiagram(String pin, [String? projectId, String? diagramId]) async {
    // An explicitly selected diagram must never fall back to another diagram.
    if (diagramId != null && diagramId.isNotEmpty) {
      final data = await ApiClient.request('/diagramas/${Uri.encodeComponent(diagramId)}');
      if (data is! Map || data['classes'] is! List) throw const FormatException('Diagrama inválido');
      return parseBackendDiagram(data);
    }
    try {
      final live = await ApiClient.request('/colaboracion/salas/${Uri.encodeComponent(pin)}/diagrama');
      if (live is Map && live['classes'] is List) return parseBackendDiagram(live);
    } catch (_) {
      // Una sala aún no disponible puede tener un diagrama guardado.
    }
    if (projectId != null && projectId.isNotEmpty) {
      final diagrams = await ApiClient.request('/diagramas?proyectoId=${Uri.encodeComponent(projectId)}');
      if (diagrams is! List) throw const FormatException('Lista de diagramas inválida');
      if (diagrams.isNotEmpty) return parseBackendDiagram(diagrams.first);
    }
    throw const FormatException('Diagrama no disponible');
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
