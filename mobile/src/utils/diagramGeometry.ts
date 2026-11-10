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
  c1X: number;
  c1Y: number;
  c2X: number;
  c2Y: number;
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
 */
export function getEstimatedClassHeight(c: UmlClass): number {
  const attrCount = Math.min(Array.isArray(c.attributes) ? c.attributes.length : 0, 4);
  // Cabecera (~58px) + relleno atributos (16px + attrCount * 22px) + pie inspección (~26px)
  return 58 + 16 + attrCount * 22 + 26;
}

type Side = 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';

/**
 * Motor geométrico de relaciones UML:
 * Calcula tangencias, puntos de contacto en el perímetro exterior de las cajas
 * y curvas Bézier cúbicas suaves sin cruces indeseados.
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

    // Descarta nodos con coordenadas no finitas: evita `NaN` en `pathD` y en
    // atributos SVG (react-native-svg puede abortar el proceso nativo en Android).
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

    // Relación a sí misma (Auto-asociación en bucle exterior)
    if (src.id === tgt.id) {
      const startX = src.x + srcW;
      const startY = src.y + 40;
      const endX = src.x + srcW - 40;
      const endY = src.y;

      const c1X = src.x + srcW + 65;
      const c1Y = src.y + 10;
      const c2X = src.x + srcW - 10;
      const c2Y = src.y - 60;

      const pathD = `M ${startX} ${startY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${endX} ${endY}`;
      const midX = src.x + srcW + 30;
      const midY = src.y - 20;

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
        c1X,
        c1Y,
        c2X,
        c2Y,
        midX,
        midY,
        sourceMultiplicity: rel.sourceMultiplicity || '1',
        targetMultiplicity: rel.targetMultiplicity || '0..*',
        srcMultX: startX + 8,
        srcMultY: startY + 14,
        tgtMultX: endX - 10,
        tgtMultY: endY - 14,
        name: rel.name,
        isGhostDraft: rel.isGhostDraft,
        angle: Math.atan2(endY - c2Y, endX - c2X),
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
    let sDirX = 0;
    let sDirY = 0;

    if (srcSide === 'RIGHT') {
      startX = src.x + srcW;
      startY = Math.max(src.y + 24, Math.min(src.y + srcH - 24, srcCy));
      sDirX = 1;
    } else if (srcSide === 'LEFT') {
      startX = src.x;
      startY = Math.max(src.y + 24, Math.min(src.y + srcH - 24, srcCy));
      sDirX = -1;
    } else if (srcSide === 'BOTTOM') {
      startX = Math.max(src.x + 24, Math.min(src.x + srcW - 24, srcCx));
      startY = src.y + srcH;
      sDirY = 1;
    } else if (srcSide === 'TOP') {
      startX = Math.max(src.x + 24, Math.min(src.x + srcW - 24, srcCx));
      startY = src.y;
      sDirY = -1;
    }

    let endX = tgtCx;
    let endY = tgtCy;
    let tDirX = 0;
    let tDirY = 0;

    if (tgtSide === 'LEFT') {
      endX = tgt.x;
      endY = Math.max(tgt.y + 24, Math.min(tgt.y + tgtH - 24, tgtCy));
      tDirX = -1;
    } else if (tgtSide === 'RIGHT') {
      endX = tgt.x + tgtW;
      endY = Math.max(tgt.y + 24, Math.min(tgt.y + tgtH - 24, tgtCy));
      tDirX = 1;
    } else if (tgtSide === 'TOP') {
      endX = Math.max(tgt.x + 24, Math.min(tgt.x + tgtW - 24, tgtCx));
      endY = tgt.y;
      tDirY = -1;
    } else if (tgtSide === 'BOTTOM') {
      endX = Math.max(tgt.x + 24, Math.min(tgt.x + tgtW - 24, tgtCx));
      endY = tgt.y + tgtH;
      tDirY = 1;
    }

    // Puntos de control Bézier con curvatura proporcional
    const distance = Math.hypot(endX - startX, endY - startY);
    const dist = Math.max(35, Math.min(150, distance * 0.42));

    const c1X = startX + sDirX * dist;
    const c1Y = startY + sDirY * dist;
    const c2X = endX + tDirX * dist;
    const c2Y = endY + tDirY * dist;

    const pathD = `M ${startX} ${startY} C ${c1X} ${c1Y}, ${c2X} ${c2Y}, ${endX} ${endY}`;

    // Punto medio exacto de la curva (t = 0.5)
    const midX = 0.125 * startX + 0.375 * c1X + 0.375 * c2X + 0.125 * endX;
    const midY = 0.125 * startY + 0.375 * c1Y + 0.375 * c2Y + 0.125 * endY;

    // Posicionamiento de multiplicidades en los extremos
    const srcMultX = startX + sDirX * 18 + (sDirY !== 0 ? 12 : 0);
    const srcMultY = startY + sDirY * 18 - 8;

    const tgtMultX = endX + tDirX * 18 + (tDirY !== 0 ? 12 : 0);
    const tgtMultY = endY + tDirY * 18 - 8;

    // Ángulo en el extremo destino para dibujar el marcador
    const angle = Math.atan2(endY - c2Y, endX - c2X);

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
      c1X,
      c1Y,
      c2X,
      c2Y,
      midX,
      midY,
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

  // Última barrera: descarta cualquier relación con geometría no finita para que
  // react-native-svg nunca reciba `NaN` en `d`, `points` o coordenadas.
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
