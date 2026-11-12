import React from 'react';

/**
 * SVG Definitions & Markers UML (flechas, diamantes composición/agregación,
 * herencia, dependencia y cruz no-navegable).
 *
 * Extraído del antiguo InteractiveStudioCanvas (bloque <defs> del SVG de
 * 200,000px). Componente PURE sin estado ni props: los markers se referencian
 * por id desde las líneas de relación (RelationLayer).
 *
 * Refactor 2026-09-26 · Fase 1 (legibilidad) · movido sin cambios de lógica.
 */
export const SvgDefs: React.FC = () => (
  <defs>
    <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    {/* Association Arrow */}
    <marker
      id="uml-arrow"
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="8"
      markerHeight="8"
      orient="auto-start-reverse"
    >
      <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--relation-line)" />
    </marker>

    {/* Composition Diamond (refX=15 para anclar la punta en el borde exterior sin invadir el card) */}
    <marker
      id="uml-diamond"
      viewBox="0 0 16 16"
      refX="15"
      refY="8"
      markerWidth="13"
      markerHeight="13"
      orient="auto-start-reverse"
    >
      <polygon points="1,8 8,2 15,8 8,14" fill="#e8c39e" stroke="#ffffff" strokeWidth="1.2" />
    </marker>

    {/* Aggregation Hollow Diamond (refX=15 para anclar la punta en el borde exterior sin invadir el card) */}
    <marker
      id="uml-diamond-hollow"
      viewBox="0 0 16 16"
      refX="15"
      refY="8"
      markerWidth="13"
      markerHeight="13"
      orient="auto-start-reverse"
    >
      <polygon points="1,8 8,2 15,8 8,14" fill="var(--bg-canvas, #060814)" stroke="#e8c39e" strokeWidth="1.5" />
    </marker>

    {/* Inheritance Hollow Triangle */}
    <marker
      id="uml-inheritance"
      viewBox="0 0 14 14"
      refX="12"
      refY="7"
      markerWidth="10"
      markerHeight="10"
      orient="auto"
    >
      <polygon points="1,1 12,7 1,13" fill="var(--bg-canvas)" stroke="var(--accent-secondary)" strokeWidth="1.5" />
    </marker>

    {/* Open Arrow (Dependency & directed navigation) */}
    <marker
      id="uml-arrow-open"
      viewBox="0 0 12 12"
      refX="10"
      refY="6"
      markerWidth="9"
      markerHeight="9"
      orient="auto"
    >
      <path d="M 2 2 L 10 6 L 2 10" fill="none" stroke="var(--relation-line)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </marker>

    {/* Non-Navigable Cross (✕) */}
    <marker
      id="uml-cross"
      viewBox="0 0 12 12"
      refX="10"
      refY="6"
      markerWidth="9"
      markerHeight="9"
      orient="auto"
    >
      <line x1="2" y1="2" x2="10" y2="10" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
      <line x1="10" y1="2" x2="2" y2="10" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
    </marker>
  </defs>
);
