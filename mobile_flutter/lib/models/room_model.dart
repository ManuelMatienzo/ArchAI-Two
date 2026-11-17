class ProjectDiagramSummary {
  final String id;
  final String projectId;
  final String title;
  final int totalClasses;
  final int totalRelations;
  final String updatedAt;
  final dynamic data;

  ProjectDiagramSummary({
    required this.id,
    required this.projectId,
    required this.title,
    this.totalClasses = 0,
    this.totalRelations = 0,
    required this.updatedAt,
    this.data,
  });

  factory ProjectDiagramSummary.fromJson(Map<String, dynamic> json, [String fallbackProjectId = '']) {
    final rawClasses = json['classes'] is List ? (json['classes'] as List) : [];
    final rawRelations = json['relations'] is List
        ? (json['relations'] as List)
        : (json['relationships'] is List ? (json['relationships'] as List) : []);

    return ProjectDiagramSummary(
      id: json['id']?.toString() ?? 'diag-${DateTime.now().millisecondsSinceEpoch}',
      projectId: json['proyectoId']?.toString() ?? json['projectId']?.toString() ?? fallbackProjectId,
      title: json['title']?.toString() ?? json['titulo']?.toString() ?? json['name']?.toString() ?? 'Diagrama UML',
      totalClasses: (json['totalClases'] as num?)?.toInt() ?? rawClasses.length,
      totalRelations: (json['totalRelaciones'] as num?)?.toInt() ?? rawRelations.length,
      updatedAt: json['actualizadoEn']?.toString() ?? json['updatedAt']?.toString() ?? json['fechaActualizacion']?.toString() ?? 'Reciente',
      data: json,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'proyectoId': projectId,
      'title': title,
      'totalClases': totalClasses,
      'totalRelaciones': totalRelations,
      'actualizadoEn': updatedAt,
    };
  }
}

class ProjectMemberItem {
  final String id;
  final String userId;
  final String name;
  final String email;
  final String avatarColor;
  final String role; // 'PROPIETARIO', 'ADMINISTRADOR', 'EDITOR', 'LECTOR'
  final String addedAt;

  ProjectMemberItem({
    required this.id,
    required this.userId,
    required this.name,
    required this.email,
    this.avatarColor = '#38BDF8',
    this.role = 'EDITOR',
    this.addedAt = '',
  });

  factory ProjectMemberItem.fromJson(Map<String, dynamic> json) {
    return ProjectMemberItem(
      id: json['id']?.toString() ?? '',
      userId: json['usuarioId']?.toString() ?? json['userId']?.toString() ?? json['id']?.toString() ?? '',
      name: json['nombre']?.toString() ?? json['name']?.toString() ?? 'Colaborador',
      email: json['correo']?.toString() ?? json['email']?.toString() ?? '',
      avatarColor: json['avatarColor']?.toString() ?? '#38BDF8',
      role: json['rolProyecto']?.toString() ?? json['rol']?.toString() ?? json['role']?.toString() ?? 'EDITOR',
      addedAt: json['fechaAgregado']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'usuarioId': userId,
      'nombre': name,
      'correo': email,
      'avatarColor': avatarColor,
      'rolProyecto': role,
      'fechaAgregado': addedAt,
    };
  }
}

class ProjectItem {
  final String id;
  final String name;
  final String description;
  final String codigoAcceso;
  final String iconoColor;
  final String estado;
  final String propietarioId;
  final String ownerName;
  final String updatedAt;
  final bool isOwner;
  final int memberCount;
  final int totalDiagrams;
  final List<ProjectMemberItem> members;
  final List<ProjectDiagramSummary> diagrams;
  final bool diagramsLoaded;

  ProjectItem({
    required this.id,
    required this.name,
    required this.description,
    required this.codigoAcceso,
    this.iconoColor = '#38BDF8',
    this.estado = 'ACTIVO',
    this.propietarioId = '',
    this.ownerName = 'Propietario',
    required this.updatedAt,
    this.isOwner = false,
    this.memberCount = 1,
    this.totalDiagrams = 0,
    this.members = const [],
    this.diagrams = const [],
    this.diagramsLoaded = false,
  });

  factory ProjectItem.fromJson(Map<String, dynamic> json, [String? currentUserId]) {
    final rawCodigo = json['codigoAcceso']?.toString() ??
        json['codigo']?.toString() ??
        json['code']?.toString() ??
        '';

    final propId = json['propietarioId']?.toString() ?? json['ownerId']?.toString() ?? '';
    final isOwn = (currentUserId != null && currentUserId == propId) ||
        json['isOwner'] == true ||
        json['esPropietario'] == true;

    final membersList = json['miembros'] is List ? (json['miembros'] as List) : null;
    final parsedMembers = membersList != null
        ? membersList
            .whereType<Map<String, dynamic>>()
            .map((m) => ProjectMemberItem.fromJson(m))
            .toList()
        : <ProjectMemberItem>[];

    final mCount = parsedMembers.isNotEmpty
        ? parsedMembers.length
        : ((json['memberCount'] as num?)?.toInt() ?? (json['totalMiembros'] as num?)?.toInt() ?? 1);

    final rawDiags = json['diagramas'] is List ? (json['diagramas'] as List) : null;
    final parsedDiags = rawDiags != null
        ? rawDiags
            .whereType<Map<String, dynamic>>()
            .map((d) => ProjectDiagramSummary.fromJson(d, json['id']?.toString() ?? ''))
            .toList()
        : <ProjectDiagramSummary>[];

    return ProjectItem(
      id: json['id']?.toString() ?? 'proj-${DateTime.now().millisecondsSinceEpoch}',
      name: json['name']?.toString() ?? json['nombre']?.toString() ?? 'Proyecto sin título',
      description: json['description']?.toString() ?? json['descripcion']?.toString() ?? 'Sin descripción',
      codigoAcceso: rawCodigo.isNotEmpty ? rawCodigo : (json['id']?.toString() ?? 'ARC-PROJ'),
      iconoColor: json['iconoColor']?.toString() ?? json['color']?.toString() ?? '#38BDF8',
      estado: json['estado']?.toString() ?? 'ACTIVO',
      propietarioId: propId,
      ownerName: json['ownerName']?.toString() ?? json['propietarioNombre']?.toString() ?? json['creador']?.toString() ?? 'Propietario',
      updatedAt: json['fechaActualizacion']?.toString() ?? json['updatedAt']?.toString() ?? 'Reciente',
      isOwner: isOwn,
      memberCount: mCount,
      totalDiagrams: (json['totalDiagramas'] as num?)?.toInt() ?? parsedDiags.length,
      members: parsedMembers,
      diagrams: parsedDiags,
      diagramsLoaded: rawDiags != null,
    );
  }

  ProjectItem copyWith({
    String? id,
    String? name,
    String? description,
    String? codigoAcceso,
    String? iconoColor,
    String? estado,
    String? propietarioId,
    String? ownerName,
    String? updatedAt,
    bool? isOwner,
    int? memberCount,
    int? totalDiagrams,
    List<ProjectMemberItem>? members,
    List<ProjectDiagramSummary>? diagrams,
    bool? diagramsLoaded,
  }) {
    return ProjectItem(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      codigoAcceso: codigoAcceso ?? this.codigoAcceso,
      iconoColor: iconoColor ?? this.iconoColor,
      estado: estado ?? this.estado,
      propietarioId: propietarioId ?? this.propietarioId,
      ownerName: ownerName ?? this.ownerName,
      updatedAt: updatedAt ?? this.updatedAt,
      isOwner: isOwner ?? this.isOwner,
      memberCount: memberCount ?? this.memberCount,
      totalDiagrams: totalDiagrams ?? this.totalDiagrams,
      members: members ?? this.members,
      diagrams: diagrams ?? this.diagrams,
      diagramsLoaded: diagramsLoaded ?? this.diagramsLoaded,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'codigoAcceso': codigoAcceso,
      'iconoColor': iconoColor,
      'estado': estado,
      'propietarioId': propietarioId,
      'ownerName': ownerName,
      'updatedAt': updatedAt,
      'isOwner': isOwner,
      'memberCount': memberCount,
      'totalDiagrams': totalDiagrams,
      'miembros': members.map((m) => m.toJson()).toList(),
      'diagramas': diagrams.map((d) => d.toJson()).toList(),
    };
  }
}

class RoomParticipant {
  final String id;
  final String name;
  final String role;
  final bool isHost;
  final String avatarColor;
  final String clientType; // 'WEB' | 'MOBILE' | 'AI_AGENT'

  RoomParticipant({
    required this.id,
    required this.name,
    required this.role,
    this.isHost = false,
    this.avatarColor = '#38BDF8',
    this.clientType = 'MOBILE',
  });

  factory RoomParticipant.fromJson(Map<String, dynamic> json) {
    return RoomParticipant(
      id: json['id']?.toString() ?? json['userId']?.toString() ?? 'p-anon',
      name: json['name']?.toString() ?? json['nombre']?.toString() ?? 'Colaborador',
      role: json['role']?.toString() ?? json['rol']?.toString() ?? 'Desarrollador',
      isHost: json['isHost'] == true || json['anfitrion'] == true,
      avatarColor: json['avatarColor']?.toString() ?? json['color']?.toString() ?? '#38BDF8',
      clientType: json['clientType']?.toString() ?? json['tipoCliente']?.toString() ?? 'MOBILE',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'role': role,
      'isHost': isHost,
      'avatarColor': avatarColor,
      'clientType': clientType,
    };
  }
}

class CodeSnippet {
  final String language; // 'java' | 'sql'
  final String code;
  final String title;

  CodeSnippet({
    required this.language,
    required this.code,
    required this.title,
  });

  factory CodeSnippet.fromJson(Map<String, dynamic> json) {
    return CodeSnippet(
      language: json['language']?.toString() ?? 'sql',
      code: json['code']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Código generado',
    );
  }

  Map<String, dynamic> toJson() => {
    'language': language,
    'code': code,
    'title': title,
  };
}

class CollabMessage {
  final String id;
  final String sender;
  final String text;
  final DateTime timestamp;
  final bool isAi;
  final bool isSystem;
  final String? proposalId;
  final String? senderRole;
  final CodeSnippet? codeSnippet;
  final String? targetClassId;
  final Map<String, dynamic>? payload;

  CollabMessage({
    required this.id,
    required this.sender,
    required this.text,
    required this.timestamp,
    this.isAi = false,
    this.isSystem = false,
    this.proposalId,
    this.senderRole,
    this.codeSnippet,
    this.targetClassId,
    this.payload,
  });

  factory CollabMessage.fromJson(Map<String, dynamic> json) {
    DateTime ts;
    try {
      final raw = json['createdAt'] ?? json['timestamp'];
      ts = raw is num ? DateTime.fromMillisecondsSinceEpoch(raw.toInt())
          : raw != null ? DateTime.parse(raw.toString()).toLocal() : DateTime.now();
    } catch (_) {
      ts = DateTime.now();
    }

    CodeSnippet? snippet;
    if (json['codeSnippet'] is Map<String, dynamic>) {
      snippet = CodeSnippet.fromJson(json['codeSnippet']);
    }

    return CollabMessage(
      id: json['id']?.toString() ?? 'msg-${DateTime.now().millisecondsSinceEpoch}',
      sender: json['authorName']?.toString() ?? json['sender']?.toString() ?? json['usuario']?.toString() ?? 'Anónimo',
      text: json['text']?.toString() ?? json['mensaje']?.toString() ?? json['content']?.toString() ?? '',
      timestamp: ts,
      isAi: json['isAi'] == true || json['esIa'] == true || json['role'] == 'ai',
      isSystem: json['isSystem'] == true || json['esSistema'] == true || json['role'] == 'system',
      proposalId: json['proposalId']?.toString(),
      senderRole: json['senderRole']?.toString() ?? json['rol']?.toString(),
      codeSnippet: snippet,
      targetClassId: json['targetClassId']?.toString(),
      payload: json['payload'] is Map<String, dynamic> ? json['payload'] : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'sender': sender,
      'text': text,
      'timestamp': timestamp.toIso8601String(),
      'isAi': isAi,
      'isSystem': isSystem,
      'proposalId': proposalId,
      if (senderRole != null) 'senderRole': senderRole,
      if (codeSnippet != null) 'codeSnippet': codeSnippet!.toJson(),
      if (targetClassId != null) 'targetClassId': targetClassId,
      if (payload != null) 'payload': payload,
    };
  }
}
