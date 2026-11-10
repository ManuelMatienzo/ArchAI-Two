import { UmlClass, UmlRelationship } from '../types/uml';
import { analyze3FN } from '../services/ai/uml3FNEngine';
import { analyzeArchitectureGraph } from '../services/ai/umlArchitectureEngine';

/**
 * Orquestador Analítico de Consultas de @ArchAI para Móvil (100% Solo Lectura).
 * Enruta consultas del chat colaborativo hacia los motores especializados de 3FN y Arquitectura.
 */
export function auditUmlModel(
  query: string,
  classes: UmlClass[],
  relationships: UmlRelationship[] = []
): string {
  const normalizedQuery = query.toLowerCase();

  // 1. Auditoría Especializada de Tercera Forma Normal (3FN)
  if (
    normalizedQuery.includes('3fn') ||
    normalizedQuery.includes('normal') ||
    normalizedQuery.includes('normalizacion')
  ) {
    return analyze3FN(classes, relationships).formattedReport;
  }

  // 2. Resumen Arquitectónico, Estereotipos y Acoplamiento
  if (
    normalizedQuery.includes('resumen') ||
    normalizedQuery.includes('arquitectura') ||
    normalizedQuery.includes('clases') ||
    normalizedQuery.includes('estructura')
  ) {
    return analyzeArchitectureGraph(classes, relationships).summaryReport;
  }

  // 3. Revisión de Claves Primarias y Foráneas (PK / FK)
  if (
    normalizedQuery.includes('pk') ||
    normalizedQuery.includes('fk') ||
    normalizedQuery.includes('llave') ||
    normalizedQuery.includes('clave')
  ) {
    return analyzeArchitectureGraph(classes, relationships).keysReport;
  }

  // 4. Explicación del Flujo de Datos
  if (
    normalizedQuery.includes('flujo') ||
    normalizedQuery.includes('explicar') ||
    normalizedQuery.includes('proceso') ||
    normalizedQuery.includes('datos')
  ) {
    return analyzeArchitectureGraph(classes, relationships).dataFlowReport;
  }

  // 5. Consulta Analítica General
  return generateGeneralAiResponse(query, classes);
}

function generateGeneralAiResponse(query: string, classes: UmlClass[]): string {
  const classNames = classes.map((c) => c.name).join(', ');
  return `He evaluado tu consulta: "${query}". El modelo en esta sala cuenta con las entidades [${classNames}]. Como cliente móvil (Modo Viaje), las mutaciones de lienzo están restringidas a solo lectura; puedes auditar la 3FN, revisar llaves o inspeccionar el código JPA generado desde la hoja de detalles.`;
}
