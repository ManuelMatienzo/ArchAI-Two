import { UmlClass, UmlRelationship } from '../types/uml';

export interface ComputedRelationshipPath {
  id: string;
  pathD: string;
  type: 'association' | 'inheritance' | 'composition' | 'aggregation' | 'dependency';
  sourceId: string;
  targetId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  /** Punto de giro/medio para la etiqueta (líneas ortogonales) */
  midX: number;
  midY: number;
  sourceMultiplicity: string;
  targetMultiplicity: string;
  srcMultX: number;
  srcMultY: number;
  tgtMultX: number;
  tgtMultY: number;
  name?: string;
  isGhostDraft?: boolean;
  angle: number;
  markerType: 'arrow' | 'diamond' | 'diamond-hollow' | 'inheritance';
}

/**
 * Calcula la altura real aproximada de una tarjeta de clase según sus atributos visibles.
 * UML 2.5+: 3 compartimentos (nombre | atributos | operaciones).
 */
export function getEstimatedClassHeight(c: UmlClass): number {
  const attrCount = Math.min(Array.isArray(c.attributes) ? c.attributes.length : 0, 4);
  const methodCount = Math.min(Array.isArray(c.methods) ? c.methods.length : 0, 4);
  // Cabecera + atributos + operaciones + padding
  return 60 + attrCount * 20 + methodCount * 18 + 30;
}

type Side = 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';

/**
 * Motor geométrico de relaciones UML 2.5+.
 * Genera líneas ortogonales (solo segmentos rectos con ángulos de 90°)
 * sin curvas Bézier, conforme al estándar UML 2.5+.
 */
export function computeDiagramRelationships(
  classes: UmlClass[],
  relationships: UmlRelationship[]
): ComputedRelationshipPath[] {
  const classMap = new Map<string, UmlClass>();
  classes.forEach((c) => classMap.set(c.id, c));

  const results: ComputedRelationshipPath[] = [];

  relationships.forEach((rel) => {
    const src = classMap.get(rel.sourceId);
    const tgt = classMap.get(rel.targetId);
    if (!src || !tgt) return;

    if (
      !Number.isFinite(src.x) ||
      !Number.isFinite(src.y) ||
      !Number.isFinite(tgt.x) ||
      !Number.isFinite(tgt.y)
    ) {
      return;
    }

    const srcW = src.width || 200;
    const srcH = getEstimatedClassHeight(src);
    const srcCx = src.x + srcW / 2;
    const srcCy = src.y + srcH / 2;

    const tgtW = tgt.width || 200;
    const tgtH = getEstimatedClassHeight(tgt);
    const tgtCx = tgt.x + tgtW / 2;
    const tgtCy = tgt.y + tgtH / 2;

    // Relación a sí misma (Auto-asociación en bucle ortogonal)
    if (src.id === tgt.id) {
      const loopSize = 55;
      const startX = src.x + srcW;
      const startY = src.y + 45;
      const cornerX = startX + loopSize;
      const cornerY = startY - loopSize;
      const endX = src.x + srcW - 45;
      const endY = src.y;

      const pathD = `M ${startX} ${startY} L ${cornerX} ${startY} L ${cornerX} ${cornerY} L ${endX} ${cornerY} L ${endX} ${endY}`;
      const midX = cornerX;
      const midY = cornerY - 15;

      results.push({
        id: rel.id,
        pathD,
        type: rel.type || 'association',
        sourceId: rel.sourceId,
        targetId: rel.targetId,
        startX,
        startY,
        endX,
        endY,
        midX,
        midY,
        sourceMultiplicity: rel.sourceMultiplicity || '1',
        targetMultiplicity: rel.targetMultiplicity || '0..*',
        srcMultX: startX + 10,
        srcMultY: startY + 16,
        tgtMultX: endX - 10,
        tgtMultY: endY - 14,
        name: rel.name,
        isGhostDraft: rel.isGhostDraft,
        angle: -Math.PI / 2,
        markerType: getMarkerType(rel.type),
      });
      return;
    }

    // Detección de caras óptimas según la posición relativa
    const dx = tgtCx - srcCx;
    const dy = tgtCy - srcCy;

    const gapRight = tgt.x - (src.x + srcW);
    const gapLeft = src.x - (tgt.x + tgtW);
    const gapBottom = tgt.y - (src.y + srcH);
    const gapTop = src.y - (tgt.y + tgtH);

    let srcSide: Side;
    let tgtSide: Side;

    if (gapRight > 15 && gapRight >= Math.max(gapBottom, gapTop)) {
      srcSide = 'RIGHT';
      tgtSide = 'LEFT';
    } else if (gapLeft > 15 && gapLeft >= Math.max(gapBottom, gapTop)) {
      srcSide = 'LEFT';
      tgtSide = 'RIGHT';
    } else if (gapBottom > 15 && gapBottom >= Math.max(gapRight, gapLeft)) {
      srcSide = 'BOTTOM';
      tgtSide = 'TOP';
    } else if (gapTop > 15 && gapTop >= Math.max(gapRight, gapLeft)) {
      srcSide = 'TOP';
      tgtSide = 'BOTTOM';
    } else {
      const normX = Math.abs(dx) / ((srcW + tgtW) / 2);
      const normY = Math.abs(dy) / ((srcH + tgtH) / 2);

      if (normX >= normY) {
        if (dx >= 0) {
          srcSide = 'RIGHT';
          tgtSide = 'LEFT';
        } else {
          srcSide = 'LEFT';
          tgtSide = 'RIGHT';
        }
      } else {
        if (dy >= 0) {
          srcSide = 'BOTTOM';
          tgtSide = 'TOP';
        } else {
          srcSide = 'TOP';
          tgtSide = 'BOTTOM';
        }
      }
    }

    // Puntos de anclaje perimetrales
    let startX = srcCx;
    let startY = srcCy;

    if (srcSide === 'RIGHT') {
      startX = src.x + srcW;
      startY = Math.max(src.y + 24, Math.min(src.y + srcH - 24, srcCy));
    } else if (srcSide === 'LEFT') {
      startX = src.x;
      startY = Math.max(src.y + 24, Math.min(src.y + srcH - 24, srcCy));
    } else if (srcSide === 'BOTTOM') {
      startX = Math.max(src.x + 24, Math.min(src.x + srcW - 24, srcCx));
      startY = src.y + srcH;
    } else if (srcSide === 'TOP') {
      startX = Math.max(src.x + 24, Math.min(src.x + srcW - 24, srcCx));
      startY = src.y;
    }

    let endX = tgtCx;
    let endY = tgtCy;

    if (tgtSide === 'LEFT') {
      endX = tgt.x;
      endY = Math.max(tgt.y + 24, Math.min(tgt.y + tgtH - 24, tgtCy));
    } else if (tgtSide === 'RIGHT') {
      endX = tgt.x + tgtW;
      endY = Math.max(tgt.y + 24, Math.min(tgt.y + tgtH - 24, tgtCy));
    } else if (tgtSide === 'TOP') {
      endX = Math.max(tgt.x + 24, Math.min(tgt.x + tgtW - 24, tgtCx));
      endY = tgt.y;
    } else if (tgtSide === 'BOTTOM') {
      endX = Math.max(tgt.x + 24, Math.min(tgt.x + tgtW - 24, tgtCx));
      endY = tgt.y + tgtH;
    }

    // ========================================================================
    // LÍNEAS ORTOGONALES UML 2.5+
    // Solo segmentos rectos con ángulos de 90°.
    // Un solo escalón intermedio cuando hay desnivel.
    // ========================================================================

    let pathD: string;
    let labelMidX: number;
    let labelMidY: number;

    // Casos opuestos horizontales: RIGHT->LEFT o LEFT->RIGHT
    if (
      (srcSide === 'RIGHT' && tgtSide === 'LEFT') ||
      (srcSide === 'LEFT' && tgtSide === 'RIGHT')
    ) {
      if (Math.abs(startY - endY) < 2) {
        // Misma altura: línea recta horizontal
        pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
        labelMidX = (startX + endX) / 2;
        labelMidY = startY;
      } else {
        // Escalón: horizontal -> vertical -> horizontal en punto medio X
        const midXStep = (startX + endX) / 2;
        pathD = `M ${startX} ${startY} L ${midXStep} ${startY} L ${midXStep} ${endY} L ${endX} ${endY}`;
        labelMidX = midXStep;
        labelMidY = (startY + endY) / 2;
      }
    }
    // Casos opuestos verticales: BOTTOM->TOP o TOP->BOTTOM
    else if (
      (srcSide === 'BOTTOM' && tgtSide === 'TOP') ||
      (srcSide === 'TOP' && tgtSide === 'BOTTOM')
    ) {
      if (Math.abs(startX - endX) < 2) {
        // Misma vertical: línea recta vertical
        pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
        labelMidX = startX;
        labelMidY = (startY + endY) / 2;
      } else {
        // Escalón: vertical -> horizontal -> vertical en punto medio Y
        const midYStep = (startY + endY) / 2;
        pathD = `M ${startX} ${startY} L ${startX} ${midYStep} L ${endX} ${midYStep} L ${endX} ${endY}`;
        labelMidX = (startX + endX) / 2;
        labelMidY = midYStep;
      }
    }
    // Lados adyacentes: giro en L con un solo ángulo de 90°
    else {
      // Elegir el punto de giro: salir horizontalmente del origen, luego girar
      const cornerX = endX;
      const cornerY = startY;
      pathD = `M ${startX} ${startY} L ${cornerX} ${cornerY} L ${endX} ${endY}`;
      labelMidX = (startX + cornerX + endX) / 3;
      labelMidY = (startY + cornerY + endY) / 3;
    }

    // Ángulo en el extremo destino para dibujar el marcador
    const angle = Math.atan2(endY - startY, endX - startX);

    // Posicionamiento de multiplicidades (ajustado para líneas ortogonales)
    const srcMultX = startX + (srcSide === 'RIGHT' ? 10 : srcSide === 'LEFT' ? -22 : 10);
    const srcMultY = startY + (srcSide === 'RIGHT' || srcSide === 'LEFT' ? -8 : srcSide === 'BOTTOM' ? 16 : -10);

    const tgtMultX = endX + (tgtSide === 'LEFT' ? -22 : tgtSide === 'RIGHT' ? 10 : 10);
    const tgtMultY = endY + (tgtSide === 'LEFT' || tgtSide === 'RIGHT' ? -8 : tgtSide === 'TOP' ? -10 : 16);

    results.push({
      id: rel.id,
      pathD,
      type: rel.type || 'association',
      sourceId: rel.sourceId,
      targetId: rel.targetId,
      startX,
      startY,
      endX,
      endY,
      midX: labelMidX,
      midY: labelMidY,
      sourceMultiplicity: rel.sourceMultiplicity || '1',
      targetMultiplicity: rel.targetMultiplicity || '1..*',
      srcMultX,
      srcMultY,
      tgtMultX,
      tgtMultY,
      name: rel.name,
      isGhostDraft: rel.isGhostDraft,
      angle,
      markerType: getMarkerType(rel.type),
    });
  });

  // Última barrera: descarta cualquier relación con geometría no finita
  return results.filter(
    (r) =>
      Number.isFinite(r.startX) &&
      Number.isFinite(r.startY) &&
      Number.isFinite(r.endX) &&
      Number.isFinite(r.endY) &&
      Number.isFinite(r.midX) &&
      Number.isFinite(r.midY) &&
      Number.isFinite(r.angle)
  );
}

function getMarkerType(type?: string): 'arrow' | 'diamond' | 'diamond-hollow' | 'inheritance' {
  const clean = (type || '').toLowerCase();
  if (clean.includes('inherit') || clean.includes('generaliz')) return 'inheritance';
  if (clean.includes('composit')) return 'diamond';
  if (clean.includes('aggregat')) return 'diamond-hollow';
  return 'arrow';
}
