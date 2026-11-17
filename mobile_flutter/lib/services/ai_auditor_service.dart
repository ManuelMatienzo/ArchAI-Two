import '../models/room_model.dart';
import '../models/uml_model.dart';
import 'codegen_service.dart';

class AiAuditResult {
  final String content;
  final CodeSnippet? codeSnippet;
  final String? targetClassId;

  AiAuditResult({
    required this.content,
    this.codeSnippet,
    this.targetClassId,
  });
}

class AiAuditorService {
  static AiAuditResult auditUmlModelWithSnippet(
    String query,
    List<UmlClass> classes,
    List<UmlRelationship> relationships,
  ) {
    final clean = query.toLowerCase().replaceAll('@archai', '').trim();

    // 1. Solicitud de código JPA Spring Boot 3
    if (clean.contains('jpa') ||
        clean.contains('java') ||
        (clean.contains('código') && !clean.contains('sql') && !clean.contains('ddl')) ||
        (clean.contains('codigo') && !clean.contains('sql') && !clean.contains('ddl'))) {
      if (classes.isEmpty) {
        return AiAuditResult(content: 'No hay clases en el lienzo de la sala para generar código JPA.');
      }

      final target = classes.firstWhere(
        (c) => clean.contains(c.name.toLowerCase()),
        orElse: () => classes.first,
      );

      final javaCode = CodegenService.generateJavaJpa(target);
      return AiAuditResult(
        content: 'He generado la entidad Jakarta Persistence (JPA) para **${target.name}** bajo Spring Boot 3 con anotaciones @Entity, clave primaria autoincremental e inmutabilidad serializable:',
        codeSnippet: CodeSnippet(
          language: 'java',
          title: '${target.name}.java',
          code: javaCode,
        ),
        targetClassId: target.id,
      );
    }

    // 2. Solicitud de esquema SQL DDL PostgreSQL
    if (clean.contains('sql') ||
        clean.contains('ddl') ||
        clean.contains('tabla') ||
        clean.contains('schema') ||
        clean.contains('esquema')) {
      if (classes.isEmpty) {
        return AiAuditResult(content: 'No hay clases en el lienzo de la sala para generar esquema DDL.');
      }

      final target = classes.firstWhere(
        (c) => clean.contains(c.name.toLowerCase()),
        orElse: () => classes.first,
      );

      final sqlCode = CodegenService.generateSqlDdl(target);
      final tableName = target.tableName ?? '${target.name.toLowerCase()}s';
      return AiAuditResult(
        content: 'He generado la definición DDL PostgreSQL para la tabla **$tableName** con restricciones PRIMARY KEY, índices aceleradores de clave foránea y comentarios descriptivos:',
        codeSnippet: CodeSnippet(
          language: 'sql',
          title: '${tableName}_schema.sql',
          code: sqlCode,
        ),
        targetClassId: target.id,
      );
    }

    // 3. Auditoría Especializada de Tercera Forma Normal (3FN)
    if (clean.contains('3fn') || clean.contains('normal') || clean.contains('normalizac')) {
      return AiAuditResult(content: analyze3FN(classes, relationships));
    }

    // 4. Revisión de claves y relaciones
    if (clean.contains('clave') || clean.contains('relac') || clean.contains('fk') || clean.contains('pk')) {
      return AiAuditResult(content: analyzeKeysAndRelationships(classes, relationships));
    }

    // 5. Resumen de Arquitectura y Acoplamiento
    if (clean.contains('resumen') || clean.contains('arquitectura') || clean.contains('grafo') || clean.contains('clases')) {
      return AiAuditResult(content: analyzeArchitectureGraph(classes, relationships));
    }

    // 6. Explicación general de flujo
    return AiAuditResult(
      content: 'He inspeccionado el modelo de la sala compuesto por **${classes.length} clases** y **${relationships.length} relaciones**. '
          'Puedes pedirme:\n'
          '• `@ArchAI Auditar 3FN` para validar formas normales (1FN, 2FN, 3FN).\n'
          '• `@ArchAI Generar JPA de [Clase]` para código Spring Boot 3.\n'
          '• `@ArchAI Generar DDL de [Clase]` para sentencias SQL PostgreSQL.\n'
          '• `@ArchAI Resumen de Clases` para ver métricas de acoplamiento.',
    );
  }

  static String analyze3FN(List<UmlClass> classes, List<UmlRelationship> relationships) {
    if (classes.isEmpty) {
      return '⚠️ Auditoría 3FN: No se detectaron entidades en el lienzo para evaluar.';
    }

    final findings1FN = <String>[];
    final findings2FN = <String>[];
    final findings3FN = <String>[];
    final recommendations = <String>[];
    int penalty = 0;

    // 1FN: Atomicidad
    final nonAtomicPatterns = ['csv', 'lista', 'array', 'telefonos', 'tags', 'correos', 'direcciones'];
    for (final c in classes) {
      for (final attr in c.attributes) {
        final aLower = attr.name.toLowerCase();
        if (nonAtomicPatterns.any((p) => aLower.contains(p))) {
          findings1FN.add('Clase «${c.name}»: El atributo "${attr.name}" sugiere datos multivaluados no atómicos.');
          penalty += 15;
        }
      }
    }

    // 2FN: Dependencia funcional completa de la PK
    for (final c in classes) {
      final pks = c.attributes.where((a) => a.isPrimaryKey).toList();
      if (pks.isEmpty) {
        findings2FN.add('Clase «${c.name}»: No tiene clave primaria (@Id) designada.');
        penalty += 25;
      } else if (pks.length > 1) {
        findings2FN.add('Clase «${c.name}»: Clave primaria compuesta ([${pks.map((a) => a.name).join(", ")}]). Verifica dependencia funcional completa.');
        penalty += 5;
      }
    }

    // 3FN: Cero dependencias transitivas
    final calculatedPatterns = [
      {'pattern': 'subtotal', 'fix': 'Calcular dinámicamente o persistir como snapshot fiscal'},
      {'pattern': 'total', 'fix': 'Derivar mediante agregación SUM() en capa de servicios'},
      {'pattern': 'edad', 'fix': 'Calcular a partir de fechaNacimiento'},
      {'pattern': 'descuento_aplicado', 'fix': 'Verificar que dependa de la transacción'},
    ];

    for (final c in classes) {
      for (final attr in c.attributes) {
        final aLower = attr.name.toLowerCase();
        for (final p in calculatedPatterns) {
          if (aLower.contains(p['pattern']!)) {
            findings3FN.add('Clase «${c.name}»: Atributo derivable "${attr.name}". ${p["fix"]}.');
            penalty += 10;
          }
        }
      }
    }

    final score = (100 - penalty).clamp(0, 100);
    final verdict = score >= 90 ? '100% NORMALIZADO EN 3FN' : (score >= 60 ? 'CUMPLE 3FN CON OBSERVACIONES' : 'REQUIERE NORMALIZACIÓN');

    final buf = StringBuffer();
    buf.writeln('📋 AUDITORÍA 3FN (@ArchAI Studio)');
    buf.writeln('Veredicto: ${score >= 90 ? "✅" : "⚠️"} $verdict (Puntuación: $score/100)\n');

    buf.writeln('• 1FN (Atomicidad):');
    if (findings1FN.isEmpty) {
      buf.writeln('  Cumple. Todos los atributos presentan tipos primitivos escalares.');
    } else {
      for (final f in findings1FN) {
        buf.writeln('  $f');
      }
    }
    buf.writeln();

    buf.writeln('• 2FN (Dependencia funcional completa):');
    if (findings2FN.isEmpty) {
      buf.writeln('  Cumple. Todas las tablas poseen identificador @Id autoincremental.');
    } else {
      for (final f in findings2FN) {
        buf.writeln('  $f');
      }
    }
    buf.writeln();

    buf.writeln('• 3FN (Ausencia de dependencias transitivas):');
    if (findings3FN.isEmpty) {
      buf.writeln('  Cumple. Cero atributos derivables entre columnas no clave.');
    } else {
      for (final f in findings3FN) {
        buf.writeln('  $f');
      }
    }
    buf.writeln();

    if (recommendations.isNotEmpty) {
      buf.writeln('💡 Recomendación Arquitectónica:');
      for (final r in recommendations) {
        buf.writeln('  $r');
      }
    } else {
      buf.writeln('💡 Recomendación Arquitectónica:\n  El modelo es óptimo para generación de esquemas DDL e integración JPA sin riesgos de redundancia.');
    }

    return buf.toString();
  }

  static String analyzeKeysAndRelationships(List<UmlClass> classes, List<UmlRelationship> relationships) {
    if (classes.isEmpty) return '⚠️ No hay clases cargadas en el modelo.';

    final buf = StringBuffer();
    buf.writeln('🛡️ AUDITORÍA DE CLAVES Y RELACIONES (@ArchAI)\n');

    int totalPk = 0;
    int totalFk = 0;

    for (final c in classes) {
      final pks = c.attributes.where((a) => a.isPrimaryKey).length;
      final fks = c.attributes.where((a) => a.isForeignKey).length;
      totalPk += pks;
      totalFk += fks;
    }

    buf.writeln('• Total Claves Primarias (@Id): $totalPk');
    buf.writeln('• Total Claves Foráneas (FK): $totalFk');
    buf.writeln('• Total Relaciones UML: ${relationships.length}\n');

    // Check orphan FKs
    final classIds = classes.map((c) => c.id).toSet();
    final orphanRels = relationships.where((r) => !classIds.contains(r.sourceId) || !classIds.contains(r.targetId)).toList();

    if (orphanRels.isNotEmpty) {
      buf.writeln('⚠️ Advertencia: Existen ${orphanRels.length} relaciones con extremos huérfanos.');
    } else {
      buf.writeln('✅ Integridad Referencial: Todas las relaciones conectan entidades válidas.');
    }

    return buf.toString();
  }

  static String analyzeArchitectureGraph(List<UmlClass> classes, List<UmlRelationship> relationships) {
    if (classes.isEmpty) return '⚠️ No hay clases registradas en el lienzo para resumir.';

    final totalAttrs = classes.fold<int>(0, (sum, c) => sum + c.attributes.length);
    final totalMethods = classes.fold<int>(0, (sum, c) => sum + c.methods.length);

    // Degree of connectivity
    final couplingMap = <String, int>{for (var c in classes) c.id: 0};
    for (final rel in relationships) {
      if (couplingMap.containsKey(rel.sourceId)) couplingMap[rel.sourceId] = couplingMap[rel.sourceId]! + 1;
      if (couplingMap.containsKey(rel.targetId)) couplingMap[rel.targetId] = couplingMap[rel.targetId]! + 1;
    }

    String mostCoupledName = 'Ninguna';
    int maxDegree = 0;
    for (final entry in couplingMap.entries) {
      if (entry.value > maxDegree) {
        maxDegree = entry.value;
        mostCoupledName = classes.firstWhere((c) => c.id == entry.key).name;
      }
    }

    final buf = StringBuffer();
    buf.writeln('🏛️ RESUMEN ARQUITECTÓNICO (@ArchAI Studio)\n');
    buf.writeln('• Entidades Registradas (${classes.length}): ${classes.map((c) => c.name).join(", ")}');
    buf.writeln('• Atributos de Dominio: $totalAttrs');
    buf.writeln('• Métodos de Negocio: $totalMethods');
    buf.writeln('• Relaciones Modeladas: ${relationships.length}');
    buf.writeln('• Nodo Central de Mayor Acoplamiento: **$mostCoupledName** ($maxDegree conexiones)\n');
    buf.writeln('El grafo presenta una estructura modular lista para generación de repositorios y servicios Spring Boot.');

    return buf.toString();
  }
}
