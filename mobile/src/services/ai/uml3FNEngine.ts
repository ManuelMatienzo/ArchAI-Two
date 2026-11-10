import { UmlClass, UmlRelationship } from '../../types/uml';

export interface Audit3FNResult {
  score: number; // 0 a 100
  verdict: 'OPTIMO_3FN' | 'ADVERTENCIAS_3FN' | 'NO_CUMPLE_3FN';
  verdictTitle: string;
  firstNormalForm: {
    passed: boolean;
    findings: string[];
    details: string;
  };
  secondNormalForm: {
    passed: boolean;
    findings: string[];
    details: string;
  };
  thirdNormalForm: {
    passed: boolean;
    findings: string[];
    details: string;
  };
  recommendations: string[];
  formattedReport: string;
}

/**
 * Motor Heurístico Especializado en Normalización de Base de Datos y Tercera Forma Normal (3FN).
 * Diseñado para operar en cliente en Modo Viaje (100% Solo Lectura).
 */
export function analyze3FN(
  classes: UmlClass[],
  relationships: UmlRelationship[] = []
): Audit3FNResult {
  if (!classes || classes.length === 0) {
    return {
      score: 0,
      verdict: 'NO_CUMPLE_3FN',
      verdictTitle: 'SIN ENTIDADES CARGADAS',
      firstNormalForm: { passed: false, findings: ['No hay clases en el diagrama.'], details: '' },
      secondNormalForm: { passed: false, findings: ['No hay clases en el diagrama.'], details: '' },
      thirdNormalForm: { passed: false, findings: ['No hay clases en el diagrama.'], details: '' },
      recommendations: ['Carga o sincroniza un modelo de clases UML en la sala.'],
      formattedReport: '⚠️ Auditoría 3FN: No se detectaron entidades en el lienzo para evaluar.',
    };
  }

  const findings1FN: string[] = [];
  const findings2FN: string[] = [];
  const findings3FN: string[] = [];
  const recommendations: string[] = [];

  let penaltyPoints = 0;

  // 1. ANÁLISIS DE PRIMERA FORMA NORMAL (1FN): Atomicidad de columnas
  const nonAtomicPatterns = ['csv', 'lista', 'array', 'telefonos', 'tags', 'correos', 'direcciones'];
  classes.forEach((cls) => {
    const suspectAttrs = cls.attributes.filter((attr) =>
      nonAtomicPatterns.some((pattern) => attr.name.toLowerCase().includes(pattern))
    );

    if (suspectAttrs.length > 0) {
      suspectAttrs.forEach((attr) => {
        findings1FN.push(
          `Clase «${cls.name}»: El atributo "${attr.name}" sugiere datos multivaluados no atómicos.`
        );
      });
      penaltyPoints += 15;
    }
  });

  // 2. ANÁLISIS DE SEGUNDA FORMA NORMAL (2FN): Dependencia funcional completa de la PK
  classes.forEach((cls) => {
    const pkAttrs = cls.attributes.filter((a) => a.isPrimaryKey);

    if (pkAttrs.length === 0) {
      findings2FN.push(
        `Clase «${cls.name}»: No tiene clave primaria (@Id) designada. Viola 2FN para persistencia relacional.`
      );
      penaltyPoints += 25;
    } else if (pkAttrs.length > 1) {
      // Clave primaria compuesta: advertir sobre dependencias parciales
      findings2FN.push(
        `Clase «${cls.name}»: Posee clave primaria compuesta ([${pkAttrs.map((a) => a.name).join(', ')}]). Validar que todos los atributos dependan de la clave completa.`
      );
      penaltyPoints += 5;
    }
  });

  // 3. ANÁLISIS DE TERCERA FORMA NORMAL (3FN): Cero dependencias transitivas
  const calculatedPatterns = [
    { pattern: 'subtotal', fix: 'Calcular dinámicamente o persistir como snapshot fiscal inmutable' },
    { pattern: 'total', fix: 'Derivar mediante agregación SUM() en capa de servicios' },
    { pattern: 'edad', fix: 'Calcular a partir de fechaNacimiento para evitar inconsistencias temporales' },
    { pattern: 'descuento_aplicado', fix: 'Verificar que dependa de la transacción y no del producto maestro' },
  ];

  classes.forEach((cls) => {
    cls.attributes.forEach((attr) => {
      const match = calculatedPatterns.find((p) => attr.name.toLowerCase().includes(p.pattern));
      if (match) {
        findings3FN.push(
          `Clase «${cls.name}»: Atributo derivable "${attr.name}". ${match.fix}.`
        );
        penaltyPoints += 10;
      }
    });

    // Validar integridad de Foreign Keys con asociaciones
    const fks = cls.attributes.filter((a) => a.isForeignKey);
    fks.forEach((fk) => {
      const hasMatchingRel = relationships.some(
        (rel) => rel.sourceId === cls.id || rel.targetId === cls.id
      );
      if (!hasMatchingRel && relationships.length > 0) {
        findings3FN.push(
          `Clase «${cls.name}»: Clave foránea "${fk.name}" no cuenta con asociación visual explícita en el lienzo.`
        );
        penaltyPoints += 5;
      }
    });
  });

  // Cálculo de Score Final (Clamped 0 - 100)
  const finalScore = Math.max(0, 100 - penaltyPoints);

  let verdict: 'OPTIMO_3FN' | 'ADVERTENCIAS_3FN' | 'NO_CUMPLE_3FN' = 'OPTIMO_3FN';
  let verdictTitle = '100% NORMALIZADO EN 3FN';

  if (findings2FN.some((f) => f.includes('No tiene clave primaria')) || finalScore < 60) {
    verdict = 'NO_CUMPLE_3FN';
    verdictTitle = 'NO CUMPLE 3FN · REQUIERE CORRECCIÓN';
  } else if (finalScore < 100) {
    verdict = 'ADVERTENCIAS_3FN';
    verdictTitle = 'CUMPLE 3FN CON RECOMENDACIONES TÉCNICAS';
  }

  // Generar recomendaciones de arquitectura
  if (findings1FN.length > 0) {
    recommendations.push('Descomponer atributos multivaluados en tablas secundarias con relación 1..*.');
  }
  if (findings2FN.length > 0) {
    recommendations.push('Asignar @Id autoincremental (BIGSERIAL en PostgreSQL) a todas las entidades maestras.');
  }
  if (findings3FN.length > 0) {
    recommendations.push('Evitar redundancia de datos calculables y congelar snapshots de precios fiscales en detalle.');
  }
  if (recommendations.length === 0) {
    recommendations.push('El modelo actual es óptimo para generación de esquemas DDL e integración JPA sin riesgos de redundancia.');
  }

  // Construir Reporte Formateado para el Chat Colaborativo
  let report = `📋 AUDITORÍA 3FN (@ArchAI Studio)\n`;
  report += `Veredicto: ${verdict === 'OPTIMO_3FN' ? '✅' : '⚠️'} ${verdictTitle} (Score: ${finalScore}/100)\n\n`;

  report += `• 1FN (Atomicidad):\n  ${
    findings1FN.length === 0
      ? `Cumple. Los atributos de las ${classes.length} entidades presentan tipos primitivos escalares.`
      : findings1FN.join('\n  ')
  }\n\n`;

  report += `• 2FN (Dependencia funcional completa):\n  ${
    findings2FN.length === 0
      ? `Cumple. Todas las tablas poseen identificador único @Id sin dependencias parciales.`
      : findings2FN.join('\n  ')
  }\n\n`;

  report += `• 3FN (Ausencia de dependencias transitivas):\n  ${
    findings3FN.length === 0
      ? `Cumple. Cero atributos derivables entre columnas no clave.`
      : findings3FN.join('\n  ')
  }\n\n`;

  report += `💡 Recomendación Arquitectónica:\n  ${recommendations.join('\n  ')}`;

  return {
    score: finalScore,
    verdict,
    verdictTitle,
    firstNormalForm: {
      passed: findings1FN.length === 0,
      findings: findings1FN,
      details: findings1FN.length === 0 ? 'Valores atómicos en todas las tuplas' : 'Campos no atómicos detectados',
    },
    secondNormalForm: {
      passed: findings2FN.length === 0,
      findings: findings2FN,
      details: findings2FN.length === 0 ? 'Todas las entidades tienen PK designada' : 'Falta de claves primarias',
    },
    thirdNormalForm: {
      passed: findings3FN.length === 0,
      findings: findings3FN,
      details: findings3FN.length === 0 ? 'Sin dependencias transitivas' : 'Atributos derivables detectados',
    },
    recommendations,
    formattedReport: report,
  };
}
