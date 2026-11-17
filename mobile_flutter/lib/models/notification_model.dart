class TeamNotification {
  final String id;
  final String roomId;
  final String diagramId;
  final String type;
  final String title;
  final String body;
  final DateTime createdAt;
  final DateTime? readAt;
  final String target; // 'chat' | 'diagram'
  final String? proposalId;
  final String? focusClassId;

  TeamNotification({
    required this.id,
    required this.roomId,
    required this.diagramId,
    required this.type,
    required this.title,
    required this.body,
    required this.createdAt,
    this.readAt,
    this.target = 'diagram',
    this.proposalId,
    this.focusClassId,
  });

  bool get isRead => readAt != null;

  factory TeamNotification.fromJson(Map<String, dynamic> json) {
    DateTime created;
    try {
      created = json['createdAt'] != null
          ? DateTime.parse(json['createdAt'].toString())
          : DateTime.now();
    } catch (_) {
      created = DateTime.now();
    }

    DateTime? read;
    if (json['readAt'] != null) {
      try {
        read = DateTime.parse(json['readAt'].toString());
      } catch (_) {}
    }

    return TeamNotification(
      id: json['id']?.toString() ?? 'notif-${DateTime.now().millisecondsSinceEpoch}',
      roomId: json['roomId']?.toString() ?? json['salaId']?.toString() ?? '',
      diagramId: json['diagramId']?.toString() ?? '',
      type: json['type']?.toString() ?? json['tipo']?.toString() ?? 'ACTIVIDAD',
      title: json['title']?.toString() ?? json['titulo']?.toString() ?? 'Novedad del proyecto',
      body: json['body']?.toString() ?? json['mensaje']?.toString() ?? json['cuerpo']?.toString() ?? '',
      createdAt: created,
      readAt: read,
      target: json['target']?.toString() ?? (json['tipo'] == 'chat' ? 'chat' : 'diagram'),
      proposalId: json['proposalId']?.toString(),
      focusClassId: json['focusClassId']?.toString() ?? json['claseId']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'roomId': roomId,
      'diagramId': diagramId,
      'type': type,
      'title': title,
      'body': body,
      'createdAt': createdAt.toIso8601String(),
      'readAt': readAt?.toIso8601String(),
      'target': target,
      'proposalId': proposalId,
      'focusClassId': focusClassId,
    };
  }
}
