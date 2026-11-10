import type { UmlClass, GhostDraftProposal } from '../types/uml';

/**
 * Utilidades puras de saneamiento de datos del diagrama.
 * Se mantienen fuera de la pantalla para poder ejecutarlas y probarlas sin
 * arrancar React Native (ver `scripts/verify-canvas-data.js`).
 */

export function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Sanea una clase UML proveniente del backend o de una propuesta remota:
 * garantiza coordenadas y dimensiones numéricas finitas (evita `NaN` en SVG),
 * y asegura que `attributes`/`methods` siempre sean arrays.
 */
export function sanitizeClass(raw: UmlClass, index: number): UmlClass {
  const safe = raw || ({} as UmlClass);
  return {
    ...safe,
    id: safe.id || `c-${index}`,
    name: safe.name || `Clase_${index + 1}`,
    x: toFiniteNumber(safe.x, 60 + (index % 3) * 290),
    y: toFiniteNumber(safe.y, 80 + Math.floor(index / 3) * 260),
    width: toFiniteNumber(safe.width, 190),
    height: toFiniteNumber(safe.height, 175),
    attributes: Array.isArray(safe.attributes) ? safe.attributes : [],
    methods: Array.isArray(safe.methods) ? safe.methods : [],
  };
}

/**
 * Normaliza las coordenadas del diagrama si existen nodos en cuadrantes negativos
 * (por ejemplo, tras arrastres libres en el cliente Web).
 * Desplaza todas las clases hacia el espacio positivo con margen de 60px para evitar
 * cualquier corte en SVG o desbordamiento de memoria OpenGL en Android.
 */
export function normalizeDiagramCoordinates(rawClasses: UmlClass[]): {
  classes: UmlClass[];
  offsetX: number;
  offsetY: number;
} {
  if (!Array.isArray(rawClasses) || rawClasses.length === 0) {
    return { classes: [], offsetX: 0, offsetY: 0 };
  }

  // Descarta entradas nulas y blinda coordenadas no finitas antes de calcular mínimos.
  const safeClasses = rawClasses
    .filter((c) => !!c)
    .map((c, index) => sanitizeClass(c, index));

  if (safeClasses.length === 0) {
    return { classes: [], offsetX: 0, offsetY: 0 };
  }

  const minX = Math.min(...safeClasses.map((c) => c.x));
  const minY = Math.min(...safeClasses.map((c) => c.y));

  const offsetX = Number.isFinite(minX) && minX < 60 ? 60 - minX : 0;
  const offsetY = Number.isFinite(minY) && minY < 80 ? 80 - minY : 0;

  if (offsetX === 0 && offsetY === 0) {
    return { classes: safeClasses, offsetX: 0, offsetY: 0 };
  }

  const normalized = safeClasses.map((c) => ({
    ...c,
    x: Math.round(c.x + offsetX),
    y: Math.round(c.y + offsetY),
  }));

  return { classes: normalized, offsetX, offsetY };
}

/**
 * Normaliza una propuesta de copiloto fantasma (@ArchAI) garantizando
 * que `classes` y `relationships` sean siempre arrays antes de renderizar.
 */
export function normalizeGhostDraft(proposal: any): GhostDraftProposal | null {
  if (!proposal || typeof proposal !== 'object') return null;
  const classes = Array.isArray(proposal.classes)
    ? proposal.classes.filter(Boolean).map((c: UmlClass, i: number) => sanitizeClass(c, i))
    : [];
  const relationships = Array.isArray(proposal.relationships) ? proposal.relationships : [];
  if (classes.length === 0 && relationships.length === 0) return null;
  return { ...proposal, classes, relationships };
}
