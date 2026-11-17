import '../models/uml_model.dart';

class CodeLine {
  final int lineNumber;
  final String content;

  CodeLine({required this.lineNumber, required this.content});
}

class CodegenService {
  static List<CodeLine> formatCodeWithLineNumbers(String code) {
    final lines = code.split('\n');
    return List.generate(
      lines.length,
      (idx) => CodeLine(lineNumber: idx + 1, content: lines[idx]),
    );
  }

  static String generateJavaJpa(UmlClass umlClass) {
    final className = _sanitizeIdentifier(umlClass.name);
    final tableName = _sanitizeIdentifier(umlClass.tableName ?? '${_toSnakeCase(className)}s');

    final buffer = StringBuffer();
    buffer.writeln('package com.archai.domain.entity;\n');
    buffer.writeln('import jakarta.persistence.*;');
    buffer.writeln('import java.io.Serializable;');
    buffer.writeln('import java.math.BigDecimal;');
    buffer.writeln('import java.time.LocalDate;');
    buffer.writeln('import java.time.LocalDateTime;');
    buffer.writeln('import java.util.Objects;\n');

    buffer.writeln('/**');
    buffer.writeln(' * Entidad de dominio generada por ArchAI Studio (Modo Viaje).');
    buffer.writeln(' * Clase UML: $className');
    buffer.writeln(' * Tabla RDBMS: $tableName');
    buffer.writeln(' * Estereotipo: «${umlClass.stereotype}»');
    buffer.writeln(' */');
    buffer.writeln('@Entity');
    buffer.writeln('@Table(name = "$tableName")');
    buffer.writeln('public class $className implements Serializable {\n');
    buffer.writeln('    private static final long serialVersionUID = 1L;\n');

    UmlAttribute? pkAttr;
    for (final a in umlClass.attributes) {
      if (a.isPrimaryKey) {
        pkAttr = a;
        break;
      }
    }

    for (final attr in umlClass.attributes) {
      final javaType = _mapToJavaType(attr.type);
      final colName = _toSnakeCase(attr.name);

      if (attr.isPrimaryKey) {
        buffer.writeln('    @Id');
        buffer.writeln('    @GeneratedValue(strategy = GenerationType.IDENTITY)');
        buffer.writeln('    @Column(name = "$colName", updatable = false, nullable = false)');
      } else if (attr.isForeignKey) {
        buffer.writeln('    // Llave foránea hacia relación de modelo');
        buffer.writeln('    @Column(name = "$colName", nullable = false)');
      } else if (!attr.isNullable) {
        buffer.writeln('    @Column(name = "$colName", nullable = false)');
      } else {
        buffer.writeln('    @Column(name = "$colName")');
      }
      buffer.writeln('    private $javaType ${attr.name};\n');
    }

    // Default constructor
    buffer.writeln('    /**');
    buffer.writeln('     * Constructor por defecto requerido por el estándar JPA.');
    buffer.writeln('     */');
    buffer.writeln('    public $className() {\n    }\n');

    // Getters and setters
    buffer.writeln('    // ==========================================');
    buffer.writeln('    // Acceso Encapsulado (Getters y Setters)');
    buffer.writeln('    // ==========================================\n');

    for (final attr in umlClass.attributes) {
      final javaType = _mapToJavaType(attr.type);
      final capName = _capitalize(attr.name);

      buffer.writeln('    public $javaType get$capName() {');
      buffer.writeln('        return this.${attr.name};');
      buffer.writeln('    }\n');

      buffer.writeln('    public void set$capName($javaType ${attr.name}) {');
      buffer.writeln('        this.${attr.name} = ${attr.name};');
      buffer.writeln('    }\n');
    }

    // Methods
    if (umlClass.methods.isNotEmpty) {
      buffer.writeln('    // ==========================================');
      buffer.writeln('    // Métodos de Negocio UML');
      buffer.writeln('    // ==========================================\n');

      for (final m in umlClass.methods) {
        buffer.write(_generateJavaMethod(m));
      }
    }

    // equals & hashCode
    if (pkAttr != null) {
      buffer.writeln('    // ==========================================');
      buffer.writeln('    // Identidad y Comparación (equals / hashCode)');
      buffer.writeln('    // ==========================================\n');
      buffer.writeln('    @Override');
      buffer.writeln('    public boolean equals(Object o) {');
      buffer.writeln('        if (this == o) return true;');
      buffer.writeln('        if (!(o instanceof $className)) return false;');
      buffer.writeln('        $className that = ($className) o;');
      buffer.writeln('        return Objects.equals(this.${pkAttr.name}, that.${pkAttr.name});');
      buffer.writeln('    }\n');

      buffer.writeln('    @Override');
      buffer.writeln('    public int hashCode() {');
      buffer.writeln('        return Objects.hash(this.${pkAttr.name});');
      buffer.writeln('    }\n');
    }

    buffer.writeln('}');
    return buffer.toString();
  }

  static String generateSqlDdl(UmlClass umlClass) {
    final className = _sanitizeIdentifier(umlClass.name);
    final tableName = _sanitizeIdentifier(umlClass.tableName ?? '${_toSnakeCase(className)}s');

    final buffer = StringBuffer();
    buffer.writeln('-- =========================================================');
    buffer.writeln('-- Esquema DDL para: $className ($tableName)');
    buffer.writeln('-- Generado por ArchAI Studio · Compatible con PostgreSQL');
    buffer.writeln('-- =========================================================\n');

    buffer.writeln('CREATE TABLE $tableName (');

    final columnLines = <String>[];
    for (final attr in umlClass.attributes) {
      final colName = _toSnakeCase(attr.name);
      final sqlType = _mapToSqlType(attr.type, attr.isPrimaryKey);

      var line = '    $colName $sqlType';
      if (attr.isPrimaryKey) {
        line += ' PRIMARY KEY';
      } else {
        if (!attr.isNullable) line += ' NOT NULL';
      }
      columnLines.add(line);
    }

    buffer.writeln(columnLines.join(',\n'));
    buffer.writeln(');\n');

    buffer.writeln("COMMENT ON TABLE $tableName IS 'Entidad $className generada desde el modelo de arquitectura ArchAI';\n");

    final foreignKeys = umlClass.attributes.where((a) => a.isForeignKey).toList();
    if (foreignKeys.isNotEmpty) {
      buffer.writeln('-- Índices de aceleración para relaciones de clave foránea');
      for (final fk in foreignKeys) {
        final col = _toSnakeCase(fk.name);
        buffer.writeln('CREATE INDEX idx_${tableName}_$col ON $tableName($col);');
      }
    }

    return buffer.toString();
  }

  static String _generateJavaMethod(UmlMethod method) {
    final visibility = method.visibility == '+'
        ? 'public'
        : (method.visibility == '#' ? 'protected' : 'private');
    final returnType = _mapToJavaType(method.returnType);
    final methodName = method.name.isNotEmpty ? method.name : 'ejecutarOperacion';

    final buffer = StringBuffer();
    buffer.writeln('    $visibility $returnType $methodName() {');
    buffer.writeln('        // Regla de negocio especificada en el modelo UML');

    if (returnType == 'void') {
      buffer.writeln('        // Operación de procedimiento sin retorno');
    } else if (returnType == 'boolean' || returnType == 'Boolean') {
      buffer.writeln('        return true;');
    } else if (returnType == 'BigDecimal') {
      buffer.writeln('        return BigDecimal.ZERO;');
    } else if (returnType == 'Long' || returnType == 'Integer') {
      buffer.writeln('        return 0L;');
    } else if (returnType == 'String') {
      buffer.writeln('        return "";');
    } else {
      buffer.writeln('        return null;');
    }

    buffer.writeln('    }\n');
    return buffer.toString();
  }

  static String _mapToJavaType(String type) {
    final clean = type.toLowerCase().trim();
    if (clean.contains('long') || clean.contains('bigint')) return 'Long';
    if (clean.contains('int')) return 'Integer';
    if (clean.contains('decimal') || clean.contains('numeric') || clean.contains('float') || clean.contains('double')) {
      return 'BigDecimal';
    }
    if (clean.contains('bool')) return 'Boolean';
    if (clean.contains('date') && !clean.contains('time')) return 'LocalDate';
    if (clean.contains('time') || clean.contains('timestamp')) return 'LocalDateTime';
    if (clean == 'void') return 'void';
    return 'String';
  }

  static String _mapToSqlType(String type, bool isPk) {
    final clean = type.toLowerCase().trim();
    if (isPk) return 'BIGSERIAL';
    if (clean.contains('long') || clean.contains('bigint')) return 'BIGINT';
    if (clean.contains('int')) return 'INTEGER';
    if (clean.contains('decimal') || clean.contains('numeric') || clean.contains('float') || clean.contains('double')) {
      return 'NUMERIC(12, 2)';
    }
    if (clean.contains('bool')) return 'BOOLEAN';
    if (clean.contains('date') && !clean.contains('time')) return 'DATE';
    if (clean.contains('time') || clean.contains('timestamp')) {
      return 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
    }
    return 'VARCHAR(150)';
  }

  static String _toSnakeCase(String str) {
    return str
        .replaceAllMapped(RegExp(r'([A-Z])'), (m) => '_${m[1]}')
        .toLowerCase()
        .replaceFirst(RegExp(r'^_'), '');
  }

  static String _capitalize(String str) {
    if (str.isEmpty) return '';
    return str[0].toUpperCase() + str.substring(1);
  }

  static String _sanitizeIdentifier(String name) {
    return name.replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '');
  }
}
