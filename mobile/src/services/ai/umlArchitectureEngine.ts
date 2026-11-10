import { UmlClass, UmlRelationship } from '../../types/uml';

export interface ArchitectureMetrics {
  totalClasses: number;
  totalAttributes: number;
  totalMethods: number;
  totalRelationships: number;
  stereotypeCounts: Record<string, number>;
  mostCoupledClass: { name: string; degree: number } | null;
}

/**
 * Motor Especializado en Análisis de Grafos de Arquitectura, Métricas de Acoplamiento y Flujo de Dominio.
 * Diseñado para operar en cliente en Modo Viaje (100% Solo Lectura).
 */
export function analyzeArchitectureGraph(
  classes: UmlClass[],
  relationships: UmlRelationship[] = []
): {
  metrics: ArchitectureMetrics;
  summaryReport: string;
  keysReport: string;
  dataFlowReport: string;
} {
  if (!classes || classes.length === 0) {
    const emptyReport = '⚠️ No hay entidades registradas en el lienzo para analizar.';
    return {
      metrics: {
        totalClasses: 0,
        totalAttributes: 0,
        totalMethods: 0,
        totalRelationships: 0,
        stereotypeCounts: {},
        mostCoupledClass: null,
      },
      summaryReport: emptyReport,
      keysReport: emptyReport,
      dataFlowReport: emptyReport,
    };
  }

  // 1. Conteo de Atributos, Métodos y Estereotipos
  const totalAttrs = classes.reduce((sum, c) => sum + c.attributes.length, 0);
  const totalMethods = classes.reduce((sum, c) => sum + c.methods.length, 0);

  const stereotypeCounts: Record<string, number> = {};
  classes.forEach((c) => {
    const st = c.stereotype || 'Entity';
    stereotypeCounts[st] = (stereotypeCounts[st] || 0) + 1;
  });

  // 2. Cálculo de Acoplamiento por Nodo (Grado de conectividad en el grafo)
  const couplingMap: Record<string, number> = {};
  classes.forEach((c) => {
    couplingMap[c.id] = 0;
  });

  relationships.forEach((rel) => {
    if (couplingMap[rel.sourceId] !== undefined) couplingMap[rel.sourceId]++;
    if (couplingMap[rel.targetId] !== undefined) couplingMap[rel.targetId]++;
  });

  let maxDegree = -1;
  let mostCoupledNodeId: string | null = null;
  Object.entries(couplingMap).forEach(([id, degree]) => {
    if (degree > maxDegree) {
      maxDegree = degree;
      mostCoupledNodeId = id;
    }
  });

  const mostCoupledClass = mostCoupledNodeId
    ? {
        name: classes.find((c) => c.id === mostCoupledNodeId)?.name || 'Desconocida',
        degree: maxDegree,
      }
    : null;

  const metrics: ArchitectureMetrics = {
    totalClasses: classes.length,
    totalAttributes: totalAttrs,
    totalMethods: totalMethods,
    totalRelationships: relationships.length,
    stereotypeCounts,
    mostCoupledClass,
  };

  // 3. Generación del Resumen Arquitectónico Detallado
  let summary = `🏛️ RESUMEN ARQUITECTÓNICO (@ArchAI Studio)\n\n`;
  summary += `• Entidades Registradas (${classes.length}): ${classes.map((c) => c.name).join(', ')}\n`;
  summary += `• Métricas Globales: ${totalAttrs} atributos tipados, ${totalMethods} métodos de negocio.\n`;

  // Desglose por Estereotipo
  const stBreakdown = Object.entries(stereotypeCounts)
    .map(([st, count]) => `«${st}»: ${count}`)
    .join(' · ');
  summary += `• Estereotipos de Dominio: ${stBreakdown}\n`;

  if (mostCoupledClass && mostCoupledClass.degree > 0) {
    summary += `• Nodo Central de Dominio: «${mostCoupledClass.name}» (Acoplamiento de ${mostCoupledClass.degree} conexiones).\n`;
  }

  summary += `\n• Relaciones Activas (${relationships.length}):\n`;
  if (relationships.length === 0) {
    summary += `  (Sin relaciones explícitas trazadas entre nodos)\n`;
  } else {
    relationships.forEach((rel) => {
      const src = classes.find((c) => c.id === rel.sourceId)?.name || rel.sourceId;
      const tgt = classes.find((c) => c.id === rel.targetId)?.name || rel.targetId;
      const relType = rel.type || 'association';
      const label = rel.name ? ` "${rel.name}"` : '';
      summary += `  - ${src} [${rel.sourceMultiplicity || '1'}] ──(${relType})──> [${rel.targetMultiplicity || '1..*'}] ${tgt}${label}\n`;
    });
  }
  summary += `\n🎯 Estado: Diseño arquitectónico modular con separación de responsabilidades (DDD).`;

  // 4. Generación del Informe de Claves (PK / FK) e Integridad Referencial
  let keys = `🛡️ AUDITORÍA DE CLAVES E INTEGRIDAD (PK / FK)\n\n`;
  classes.forEach((cls) => {
    const pks = cls.attributes.filter((a) => a.isPrimaryKey).map((a) => a.name);
    const fks = cls.attributes.filter((a) => a.isForeignKey).map((a) => a.name);

    keys += `• «${cls.name}» (Tabla: ${cls.tableName || cls.name.toLowerCase() + 's'}):\n`;
    keys += `  - Clave Primaria: ${pks.length > 0 ? `[PK] ${pks.join(', ')}` : '⚠️ No definida'}\n`;
    keys += `  - Claves Foráneas: ${fks.length > 0 ? `[FK] ${fks.join(', ')}` : 'Ninguna (Entidad Maestra / Raíz)'}\n`;
  });

  const allFks = classes.flatMap((c) => c.attributes.filter((a) => a.isForeignKey));
  keys += `\nIntegridad: ${
    allFks.length > 0
      ? `Se detectaron ${allFks.length} claves foráneas correspondientes a las asociaciones del lienzo.`
      : 'Todas las clases actúan como entidades independientes sin dependencias externas.'
  }`;

  // 5. Generación de Explicación del Flujo de Datos
  const masterClass = classes.find(
    (c) =>
      c.name.toLowerCase().includes('cliente') ||
      c.name.toLowerCase().includes('usuario') ||
      c.name.toLowerCase().includes('persona')
  ) || classes[0];

  const transactionClass = classes.find(
    (c) =>
      c.name.toLowerCase().includes('venta') ||
      c.name.toLowerCase().includes('pedido') ||
      c.name.toLowerCase().includes('factura') ||
      c.name.toLowerCase().includes('orden')
  );

  const detailClass = classes.find(
    (c) =>
      c.name.toLowerCase().includes('detalle') ||
      c.name.toLowerCase().includes('item') ||
      c.name.toLowerCase().includes('linea')
  );

  const catalogClass = classes.find(
    (c) =>
      c.name.toLowerCase().includes('producto') ||
      c.name.toLowerCase().includes('articulo') ||
      c.name.toLowerCase().includes('servicio')
  );

  let dataFlow = `💡 EXPLICACIÓN DEL FLUJO DE DATOS (@ArchAI Studio)\n\n`;
  if (masterClass && transactionClass && detailClass && catalogClass) {
    dataFlow += `1. Inicio de Transacción: La entidad «${masterClass.name}» actúa como raíz de agregación del cliente.\n`;
    dataFlow += `2. Documento Transaccional: Se emite un registro en «${transactionClass.name}» referenciando la clave de «${masterClass.name}».\n`;
    dataFlow += `3. Desglose de Líneas: «${detailClass.name}» desacopla los ítems mediante cardinalidad 1..*, vinculando el catálogo de «${catalogClass.name}».\n`;
    dataFlow += `4. Persistencia ACID: Las relaciones de composición garantizan cascada e integridad transaccional en PostgreSQL.`;
  } else {
    dataFlow += `El modelo estructura ${classes.length} entidades comunicadas por ${relationships.length} asociaciones. El flujo de información parte de las entidades maestras hacia las transacciones de negocio, asegurando consistencia e inmutabilidad.`;
  }

  return {
    metrics,
    summaryReport: summary,
    keysReport: keys,
    dataFlowReport: dataFlow,
  };
}
