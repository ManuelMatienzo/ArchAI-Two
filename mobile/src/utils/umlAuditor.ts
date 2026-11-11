import { UmlClass, UmlRelationship, CodeSnippet } from '../types/uml';
import { analyze3FN } from '../services/ai/uml3FNEngine';
import { analyzeArchitectureGraph } from '../services/ai/umlArchitectureEngine';
import { generateJavaJpa, generateSqlDdl } from '../services/codegen/codeGenerators';

export interface AiAuditResult {
  content: string;
  codeSnippet?: CodeSnippet;
}

/**
 * Orquestador Analitico de Consultas de @ArchAI para Movil (100% Solo Lectura).
 * Enruta consultas del chat colaborativo hacia los motores especializados de 3FN,
 * Arquitectura, Generacion de Codigo y Propuestas Colaborativas.
 */
export function auditUmlModelWithSnippet(
  query: string,
  classes: UmlClass[],
  relationships: UmlRelationship[] = []
): AiAuditResult {
  const normalizedQuery = query.toLowerCase();

  // 1. Solicitud de Generacion de Codigo JPA Spring Boot 3
  if (
    normalizedQuery.includes('jpa') ||
    normalizedQuery.includes('java') ||
    (normalizedQuery.includes('codigo') && !normalizedQuery.includes('sql'))
  ) {
    if (classes.length === 0) {
      return { content: 'No hay clases disponibles en la sala para generar codigo JPA.' };
    }
    // Buscar si menciona una clase especifica
    const target = classes.find((c) => normalizedQuery.includes(c.name.toLowerCase())) || classes[0];
    const javaCode = generateJavaJpa(target);
    return {
      content: `He generado la entidad Jakarta Persistence (JPA) para **${target.name}** bajo Spring Boot 3 con llaves primarias, columnas tipadas y encapsulamiento:`,
      codeSnippet: {
        language: 'java',
        title: `${target.name}.java`,
        code: javaCode,
      },
    };
  }

  // 2. Solicitud de Generacion de Esquema DDL SQL PostgreSQL
  if (
    normalizedQuery.includes('sql') ||
    normalizedQuery.includes('ddl') ||
    normalizedQuery.includes('tabla') ||
    normalizedQuery.includes('schema')
  ) {
    if (classes.length === 0) {
      return { content: 'No hay clases disponibles en la sala para generar DDL SQL.' };
    }
    const target = classes.find((c) => normalizedQuery.includes(c.name.toLowerCase())) || classes[0];
    const sqlCode = generateSqlDdl(target);
    return {
      content: `He generado la definicion DDL PostgreSQL para la tabla **${target.tableName || target.name.toLowerCase()}** con restricciones de integridad y sus indices asociados:`,
      codeSnippet: {
        language: 'sql',
        title: `${target.tableName || target.name.toLowerCase()}_schema.sql`,
        code: sqlCode,
      },
    };
  }

  // 3. Auditoria Especializada de Tercera Forma Normal (3FN)
  if (
    normalizedQuery.includes('3fn') ||
    normalizedQuery.includes('normal') ||
    normalizedQuery.includes('normalizacion')
  ) {
    return { content: analyze3FN(classes, relationships).formattedReport };
  }

  // 4. Estado de Propuestas Colaborativas IA (CU-15, CU-16, CU-17)
  if (
    normalizedQuery.includes('propuesta') ||
    normalizedQuery.includes('borrador') ||
    normalizedQuery.includes('draft') ||
    normalizedQuery.includes('colabora') ||
    normalizedQuery.includes('ia') && (normalizedQuery.includes('estado') || normalizedQuery.includes('como'))
  ) {
    const classCount = classes.length;
    const relCount = relationships.length;
    return {
      content: `El subsistema de propuestas colaborativas de IA (CU-15 a CU-17) se encuentra activo en esta sala. El modelo actual consta de **${classCount} clases** y **${relCount} relaciones** sincronizadas. Las propuestas generadas desde la nube (Claude / Gemini) o cliente web son difundidas por STOMP e inspeccionables en el visor en Modo Viaje.`,
    };
  }

  // 5. Resumen Arquitectonico, Estereotipos y Acoplamiento
  if (
    normalizedQuery.includes('resumen') ||
    normalizedQuery.includes('arquitectura') ||
    normalizedQuery.includes('clases') ||
    normalizedQuery.includes('estructura')
  ) {
    return { content: analyzeArchitectureGraph(classes, relationships).summaryReport };
  }

  // 6. Revision de Claves Primarias y Foraneas (PK / FK)
  if (
    normalizedQuery.includes('pk') ||
    normalizedQuery.includes('fk') ||
    normalizedQuery.includes('llave') ||
    normalizedQuery.includes('clave')
  ) {
    return { content: analyzeArchitectureGraph(classes, relationships).keysReport };
  }

  // 7. Explicacion del Flujo de Datos
  if (
    normalizedQuery.includes('flujo') ||
    normalizedQuery.includes('explicar') ||
    normalizedQuery.includes('proceso') ||
    normalizedQuery.includes('datos')
  ) {
    return { content: analyzeArchitectureGraph(classes, relationships).dataFlowReport };
  }

  // 8. Consulta Analitica General
  return { content: generateGeneralAiResponse(query, classes) };
}

export function auditUmlModel(
  query: string,
  classes: UmlClass[],
  relationships: UmlRelationship[] = []
): string {
  return auditUmlModelWithSnippet(query, classes, relationships).content;
}

function generateGeneralAiResponse(query: string, classes: UmlClass[]): string {
  const classNames = classes.map((c) => c.name).join(', ');
  return `He evaluado tu consulta: "${query}". El modelo en esta sala cuenta con las entidades [${classNames}]. Como cliente movil (Modo Viaje), las mutaciones de lienzo estan restringidas a solo lectura; puedes auditar la 3FN, generar codigo JPA / SQL, revisar llaves o inspeccionar las propuestas en el lienzo.`;
}
