class UmlAttribute {
  final String id;
  final String name;
  final String type;
  final String visibility;
  final bool isPrimaryKey;
  final bool isForeignKey;
  final bool isNullable;

  UmlAttribute({
    required this.id,
    required this.name,
    required this.type,
    this.visibility = '-',
    this.isPrimaryKey = false,
    this.isForeignKey = false,
    this.isNullable = true,
  });

  factory UmlAttribute.fromJson(Map<String, dynamic> json, [int idx = 0]) {
    final rawName = json['name']?.toString() ?? 'attr_$idx';
    final isPk = json['isPrimaryKey'] == true || 
                 rawName.toLowerCase() == 'id' || 
                 rawName.toLowerCase() == 'id_${rawName.toLowerCase()}';

    return UmlAttribute(
      id: json['id']?.toString() ?? 'attr-$idx-${DateTime.now().millisecondsSinceEpoch}',
      name: rawName,
      type: json['type']?.toString() ?? 'String',
      visibility: json['visibility']?.toString() ?? '-',
      isPrimaryKey: isPk,
      isForeignKey: json['isForeignKey'] == true,
      isNullable: json['isNullable'] ?? !isPk,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'type': type,
      'visibility': visibility,
      'isPrimaryKey': isPrimaryKey,
      'isForeignKey': isForeignKey,
      'isNullable': isNullable,
    };
  }
}

class UmlMethod {
  final String id;
  final String name;
  final String returnType;
  final String visibility;
  final String parameters;

  UmlMethod({
    required this.id,
    required this.name,
    this.returnType = 'void',
    this.visibility = '+',
    this.parameters = '',
  });

  factory UmlMethod.fromJson(Map<String, dynamic> json, [int idx = 0]) {
    var rawParams = json['parameters'];
    String paramsStr = '';
    if (rawParams is List) {
      paramsStr = rawParams.join(', ');
    } else if (rawParams != null) {
      paramsStr = rawParams.toString();
    }

    return UmlMethod(
      id: json['id']?.toString() ?? 'm-$idx-${DateTime.now().millisecondsSinceEpoch}',
      name: json['name']?.toString() ?? 'metodo_$idx',
      returnType: json['returnType']?.toString() ?? 'void',
      visibility: json['visibility']?.toString() ?? '+',
      parameters: paramsStr,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'returnType': returnType,
      'visibility': visibility,
      'parameters': parameters,
    };
  }
}

class UmlClass {
  final String id;
  final String name;
  final String stereotype;
  final String? tableName;
  double x;
  double y;
  final double width;
  final double height;
  final List<UmlAttribute> attributes;
  final List<UmlMethod> methods;

  UmlClass({
    required this.id,
    required this.name,
    this.stereotype = 'Entity',
    this.tableName,
    required this.x,
    required this.y,
    this.width = 220.0,
    this.height = 180.0,
    required this.attributes,
    required this.methods,
  });

  factory UmlClass.fromJson(Map<String, dynamic> json, [int index = 0]) {
    double posX = 60.0 + (index % 3) * 290.0;
    double posY = 80.0 + (index ~/ 3) * 260.0;

    if (json['position'] is Map) {
      posX = (json['position']['x'] as num?)?.toDouble() ?? posX;
      posY = (json['position']['y'] as num?)?.toDouble() ?? posY;
    } else {
      if (json['x'] is num) posX = (json['x'] as num).toDouble();
      if (json['y'] is num) posY = (json['y'] as num).toDouble();
    }

    final rawAttrs = json['attributes'];
    final List<UmlAttribute> attrs = [];
    if (rawAttrs is List) {
      for (int i = 0; i < rawAttrs.length; i++) {
        if (rawAttrs[i] is Map<String, dynamic>) {
          attrs.add(UmlAttribute.fromJson(rawAttrs[i], i));
        }
      }
    }

    final rawMethods = json['methods'];
    final List<UmlMethod> meths = [];
    if (rawMethods is List) {
      for (int i = 0; i < rawMethods.length; i++) {
        if (rawMethods[i] is Map<String, dynamic>) {
          meths.add(UmlMethod.fromJson(rawMethods[i], i));
        }
      }
    }

    final className = json['name']?.toString() ?? 'Clase_${index + 1}';
    final table = json['tableName']?.toString() ?? '${className.toLowerCase()}s';

    return UmlClass(
      id: json['id']?.toString() ?? 'c-$index',
      name: className,
      stereotype: json['stereotype']?.toString() ?? 'Entity',
      tableName: table,
      x: posX,
      y: posY,
      width: (json['width'] as num?)?.toDouble() ?? 220.0,
      height: (json['height'] as num?)?.toDouble() ?? 180.0,
      attributes: attrs,
      methods: meths,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'stereotype': stereotype,
      'tableName': tableName,
      'x': x,
      'y': y,
      'width': width,
      'height': height,
      'attributes': attributes.map((a) => a.toJson()).toList(),
      'methods': methods.map((m) => m.toJson()).toList(),
    };
  }

  UmlClass copyWith({
    String? id,
    String? name,
    String? stereotype,
    String? tableName,
    double? x,
    double? y,
    double? width,
    double? height,
    List<UmlAttribute>? attributes,
    List<UmlMethod>? methods,
  }) {
    return UmlClass(
      id: id ?? this.id,
      name: name ?? this.name,
      stereotype: stereotype ?? this.stereotype,
      tableName: tableName ?? this.tableName,
      x: x ?? this.x,
      y: y ?? this.y,
      width: width ?? this.width,
      height: height ?? this.height,
      attributes: attributes ?? this.attributes,
      methods: methods ?? this.methods,
    );
  }
}

class UmlRelationship {
  final String id;
  final String sourceId;
  final String targetId;
  final String type;
  final String sourceMultiplicity;
  final String targetMultiplicity;
  final String? label;

  UmlRelationship({
    required this.id,
    required this.sourceId,
    required this.targetId,
    required this.type,
    this.sourceMultiplicity = '1',
    this.targetMultiplicity = '0..*',
    this.label,
  });

  factory UmlRelationship.fromJson(Map<String, dynamic> json, [int index = 0]) {
    final sId = json['sourceClassId']?.toString() ?? json['sourceId']?.toString() ?? '';
    final tId = json['targetClassId']?.toString() ?? json['targetId']?.toString() ?? '';
    
    return UmlRelationship(
      id: json['id']?.toString() ?? 'rel-$index',
      sourceId: sId,
      targetId: tId,
      type: json['type']?.toString() ?? 'ASSOCIATION_1_N',
      sourceMultiplicity: json['sourceMultiplicity']?.toString() ?? '1',
      targetMultiplicity: json['targetMultiplicity']?.toString() ?? '0..*',
      label: json['label']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'sourceClassId': sourceId,
      'targetClassId': targetId,
      'type': type,
      'sourceMultiplicity': sourceMultiplicity,
      'targetMultiplicity': targetMultiplicity,
      'label': label,
    };
  }
}

class GhostDraftProposal {
  final String id;
  final String title;
  final String description;
  final String reasoning;
  final String status;
  final List<UmlClass> classes;
  final List<UmlRelationship> relationships;

  GhostDraftProposal({
    required this.id,
    required this.title,
    required this.description,
    required this.reasoning,
    this.status = 'PENDING',
    required this.classes,
    required this.relationships,
  });

  factory GhostDraftProposal.fromJson(Map<String, dynamic> json) {
    final rawClasses = json['classes'] as List? ?? [];
    final rawRels = json['relationships'] as List? ?? json['relations'] as List? ?? [];

    return GhostDraftProposal(
      id: json['id']?.toString() ?? 'proposal-${DateTime.now().millisecondsSinceEpoch}',
      title: json['title']?.toString() ?? 'Propuesta de Arquitectura IA',
      description: json['description']?.toString() ?? '',
      reasoning: json['reasoning']?.toString() ?? json['explicacion']?.toString() ?? '',
      status: json['status']?.toString() ?? 'PENDING',
      classes: rawClasses.asMap().entries.map((e) => UmlClass.fromJson(e.value, e.key)).toList(),
      relationships: rawRels.asMap().entries.map((e) => UmlRelationship.fromJson(e.value, e.key)).toList(),
    );
  }
}
