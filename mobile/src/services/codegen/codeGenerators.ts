import { UmlClass, UmlMethod } from '../../types/uml';

export interface CodeLine {
  lineNumber: number;
  content: string;
}

/**
 * Divide el código fuente en líneas numeradas para su representación en el visor de código.
 */
export function formatCodeWithLineNumbers(code: string): CodeLine[] {
  return code.split('\n').map((content, idx) => ({
    lineNumber: idx + 1,
    content,
  }));
}

/**
 * Generador sintáctico determinista de entidades Java Spring Boot 3 con Jakarta Persistence (JPA).
 * Diseñado para la inspección y consulta en Modo Viaje (100% Solo Lectura).
 */
export function generateJavaJpa(umlClass: UmlClass): string {
  const className = sanitizeIdentifier(umlClass.name || 'Entidad');
  const tableName = sanitizeIdentifier(umlClass.tableName || toSnakeCase(className) + 's');

  const imports = [
    'package com.archai.domain.entity;',
    '',
    'import jakarta.persistence.*;',
    'import java.io.Serializable;',
    'import java.math.BigDecimal;',
    'import java.time.LocalDate;',
    'import java.time.LocalDateTime;',
    'import java.util.Objects;',
    '',
  ];

  let code = imports.join('\n');

  // Docstring de cabecera
  code += `/**\n`;
  code += ` * Entidad de dominio generada por ArchAI Studio (Modo Viaje).\n`;
  code += ` * Clase UML: ${className}\n`;
  code += ` * Tabla RDBMS: ${tableName}\n`;
  code += ` * Estereotipo: «${umlClass.stereotype || 'Entity'}»\n`;
  code += ` */\n`;
  code += `@Entity\n`;
  code += `@Table(name = "${tableName}")\n`;
  code += `public class ${className} implements Serializable {\n\n`;
  code += `    private static final long serialVersionUID = 1L;\n\n`;

  // Atributos y anotaciones JPA
  const pkAttr = umlClass.attributes.find((a) => a.isPrimaryKey);

  umlClass.attributes.forEach((attr) => {
    const javaType = mapToJavaType(attr.type);
    const columnName = toSnakeCase(attr.name);

    if (attr.isPrimaryKey) {
      code += `    @Id\n`;
      code += `    @GeneratedValue(strategy = GenerationType.IDENTITY)\n`;
      code += `    @Column(name = "${columnName}", updatable = false, nullable = false)\n`;
    } else if (attr.isForeignKey) {
      code += `    // Llave foránea hacia relación de modelo\n`;
      code += `    @Column(name = "${columnName}", nullable = false)\n`;
    } else if (attr.isUnique) {
      code += `    @Column(name = "${columnName}", unique = true, nullable = false)\n`;
    } else {
      code += `    @Column(name = "${columnName}")\n`;
    }

    code += `    private ${javaType} ${attr.name};\n\n`;
  });

  // Constructor sin argumentos (Requerido por JPA)
  code += `    /**\n     * Constructor por defecto requerido por el estándar JPA.\n     */\n`;
  code += `    public ${className}() {\n    }\n\n`;

  // Getters y Setters
  code += `    // ==========================================\n`;
  code += `    // Acceso Encapsulado (Getters y Setters)\n`;
  code += `    // ==========================================\n\n`;

  umlClass.attributes.forEach((attr) => {
    const javaType = mapToJavaType(attr.type);
    const capName = capitalize(attr.name);

    code += `    public ${javaType} get${capName}() {\n`;
    code += `        return this.${attr.name};\n`;
    code += `    }\n\n`;

    code += `    public void set${capName}(${javaType} ${attr.name}) {\n`;
    code += `        this.${attr.name} = ${attr.name};\n`;
    code += `    }\n\n`;
  });

  // Métodos de Negocio definidos en el modelo UML
  if (umlClass.methods && umlClass.methods.length > 0) {
    code += `    // ==========================================\n`;
    code += `    // Métodos de Negocio UML\n`;
    code += `    // ==========================================\n\n`;

    umlClass.methods.forEach((method) => {
      code += generateJavaMethod(method);
    });
  }

  // equals y hashCode basados en la clave primaria
  if (pkAttr) {
    const capPk = capitalize(pkAttr.name);
    code += `    // ==========================================\n`;
    code += `    // Identidad y Comparación (equals / hashCode)\n`;
    code += `    // ==========================================\n\n`;
    code += `    @Override\n`;
    code += `    public boolean equals(Object o) {\n`;
    code += `        if (this == o) return true;\n`;
    code += `        if (!(o instanceof ${className})) return false;\n`;
    code += `        ${className} that = (${className}) o;\n`;
    code += `        return Objects.equals(this.${pkAttr.name}, that.${pkAttr.name});\n`;
    code += `    }\n\n`;

    code += `    @Override\n`;
    code += `    public int hashCode() {\n`;
    code += `        return Objects.hash(this.${pkAttr.name});\n`;
    code += `    }\n\n`;
  }

  code += `}\n`;
  return code;
}

/**
 * Generador sintáctico de sentencias DDL para PostgreSQL 14+.
 */
export function generateSqlDdl(umlClass: UmlClass): string {
  const className = sanitizeIdentifier(umlClass.name || 'Entidad');
  const tableName = sanitizeIdentifier(umlClass.tableName || toSnakeCase(className) + 's');

  let ddl = `-- =========================================================\n`;
  ddl += `-- Esquema DDL para: ${className} (${tableName})\n`;
  ddl += `-- Generado por ArchAI Studio · Compatible con PostgreSQL\n`;
  ddl += `-- =========================================================\n\n`;

  ddl += `CREATE TABLE ${tableName} (\n`;

  const columnLines: string[] = [];

  umlClass.attributes.forEach((attr) => {
    const columnName = toSnakeCase(attr.name);
    const sqlType = mapToSqlType(attr.type, attr.isPrimaryKey);

    let line = `    ${columnName} ${sqlType}`;

    if (attr.isPrimaryKey) {
      line += ' PRIMARY KEY';
    } else {
      if (attr.isUnique) line += ' UNIQUE';
      line += ' NOT NULL';
    }

    columnLines.push(line);
  });

  ddl += columnLines.join(',\n');
  ddl += `\n);\n\n`;

  // Comentarios SQL para autodocumentación
  ddl += `COMMENT ON TABLE ${tableName} IS 'Entidad ${className} generada desde el modelo de arquitectura ArchAI';\n`;

  // Índices sugeridos para claves foráneas y columnas únicas
  const foreignKeys = umlClass.attributes.filter((a) => a.isForeignKey);
  if (foreignKeys.length > 0) {
    ddl += `\n-- Índices de aceleración para relaciones de clave foránea\n`;
    foreignKeys.forEach((fk) => {
      const col = toSnakeCase(fk.name);
      ddl += `CREATE INDEX idx_${tableName}_${col} ON ${tableName}(${col});\n`;
    });
  }

  return ddl;
}

function generateJavaMethod(method: UmlMethod): string {
  const visibility = method.visibility === '+' ? 'public' : method.visibility === '#' ? 'protected' : 'private';
  const returnType = mapToJavaType(method.returnType || 'void');
  const methodName = method.name || 'ejecutarOperacion';

  let stub = `    ${visibility} ${returnType} ${methodName}() {\n`;
  stub += `        // Regla de negocio especificada en el modelo UML\n`;

  if (returnType === 'void') {
    stub += `        // Operación de procedimiento sin retorno\n`;
  } else if (returnType === 'boolean' || returnType === 'Boolean') {
    stub += `        return true;\n`;
  } else if (returnType === 'BigDecimal') {
    stub += `        return BigDecimal.ZERO;\n`;
  } else if (returnType === 'Long' || returnType === 'Integer') {
    stub += `        return 0L;\n`;
  } else if (returnType === 'String') {
    stub += `        return "";\n`;
  } else {
    stub += `        return null;\n`;
  }

  stub += `    }\n\n`;
  return stub;
}

function mapToJavaType(type: string): string {
  const clean = (type || 'string').toLowerCase().trim();
  if (clean.includes('long') || clean.includes('bigint')) return 'Long';
  if (clean.includes('int')) return 'Integer';
  if (clean.includes('decimal') || clean.includes('numeric') || clean.includes('float') || clean.includes('double')) return 'BigDecimal';
  if (clean.includes('bool')) return 'Boolean';
  if (clean.includes('date') && !clean.includes('time')) return 'LocalDate';
  if (clean.includes('time') || clean.includes('timestamp')) return 'LocalDateTime';
  if (clean === 'void') return 'void';
  return 'String';
}

function mapToSqlType(type: string, isPk?: boolean): string {
  const clean = (type || 'string').toLowerCase().trim();
  if (isPk) return 'BIGSERIAL';
  if (clean.includes('long') || clean.includes('bigint')) return 'BIGINT';
  if (clean.includes('int')) return 'INTEGER';
  if (clean.includes('decimal') || clean.includes('numeric') || clean.includes('float') || clean.includes('double')) return 'NUMERIC(12, 2)';
  if (clean.includes('bool')) return 'BOOLEAN';
  if (clean.includes('date') && !clean.includes('time')) return 'DATE';
  if (clean.includes('time') || clean.includes('timestamp')) return 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
  return 'VARCHAR(150)';
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '');
}
