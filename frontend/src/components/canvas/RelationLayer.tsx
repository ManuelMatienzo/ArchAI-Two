import React from 'react';
import { RelacionUml } from '../../types/uml';

export interface RelationPathData {
  id: string;
  pathD: string;
  label: string;
  srcMultiplicity: string;
  tgtMultiplicity: string;
  type: RelacionUml['type'];
  sourceClassId: string;
  targetClassId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  midX: number;
  midY: number;
  srcMultX: number;
  srcMultY: number;
  tgtMultX: number;
  tgtMultY: number;
  assocClassPathD?: string;
  associationClassId?: string;
}

interface RelationLayerProps {
  deletionIds?:Set<string>;
  draftIds?: Set<string>;
  paths: RelationPathData[];
  selectedRelationId: string | null;
  hoveredRelationId: string | null;
  /** Estable: selecciona la relación y limpia la selección de clase */
  onSelectRelation: (relationId: string) => void;
  onHoverRelation: (relationId: string | null) => void;
  onDeleteRelation: (relationId: string) => void;
  onClearClassSelection: () => void;
  onCycleMultiplicity?: (relationId: string, end: 'source' | 'target') => void;
}

function relationDefaults(r: RelationPathData) {
  let markerEnd: string | undefined = 'url(#uml-arrow)';
  let strokeDash = 'none';
  let strokeColor: string | undefined = undefined;

  switch (r.type) {
    case 'COMPOSITION':
      markerEnd = 'url(#uml-diamond)';
      break;
    case 'AGGREGATION':
      markerEnd = 'url(#uml-diamond-hollow)';
      break;
    case 'INHERITANCE':
      markerEnd = 'url(#uml-inheritance)';
      break;
    case 'REALIZATION':
      markerEnd = 'url(#uml-inheritance)';
      strokeDash = '6 4';
      break;
    case 'DEPENDENCY':
    case 'USAGE':
      markerEnd = 'url(#uml-arrow-open)';
      strokeDash = '6 4';
      break;
    case 'PACKAGE_IMPORT':
      markerEnd = 'url(#uml-arrow-open)';
      strokeDash = '8 4 2 4';
      break;
    case 'ASSOCIATION_1_1':
    case 'ASSOCIATION_N_M':
    case 'ASSOCIATION_BINARY':
      markerEnd = undefined;
      break;
    case 'ASSOCIATION_CLASS':
      markerEnd = undefined;
      strokeDash = '4 4';
      strokeColor = '#e8c39e';
      break;
    case 'NON_NAVIGABLE':
      markerEnd = 'url(#uml-cross)';
      strokeColor = '#f43f5e';
      break;
    default:
      markerEnd = 'url(#uml-arrow)';
  }

  return { markerEnd, strokeDash, strokeColor };
}

/**
 * Capa SVG de líneas de relación (render de `relationPaths`).
 *
 * Extraído del antiguo InteractiveStudioCanvas (map de relationPaths).
 * El 60 FPS del arrastre lo protege `React.memo` + handlers estables en el
 * padre: solo se re-renderiza cuando los paths cambian (nodo movido en
 * tiempo real) o el hover/selección.
 *
 * Refactor 2026-09-26 · Fase 1 (legibilidad + rendimiento) · sin cambios de lógica.
 */
export const RelationLayer: React.FC<RelationLayerProps> = React.memo(function RelationLayer({
  deletionIds,
  draftIds,
  paths,
  selectedRelationId,
  hoveredRelationId,
  onSelectRelation,
  onHoverRelation,
  onDeleteRelation,
  onClearClassSelection,
  onCycleMultiplicity
}) {
  return (
    <>
      {paths.map(r => {
        if (!r) return null;

        const { markerEnd, strokeDash, strokeColor } = relationDefaults(r);

        const isHovered = !draftIds?.has(r.id) && hoveredRelationId === r.id;
        const isSelected = !draftIds?.has(r.id) && selectedRelationId === r.id;
        const isHighlighted = isHovered || isSelected;
        const activeStrokeColor = isSelected ? '#f43f5e' : isHovered ? '#38bdf8' : strokeColor;

        const selectHandlers = {
          onMouseDown: (e: React.MouseEvent) => {
            e.stopPropagation();
            onSelectRelation(r.id);
            onClearClassSelection();
          },
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            onSelectRelation(r.id);
            onClearClassSelection();
          }
        };

        return (
          <g
            key={r.id}
            className={`uml-relation-interactive ${deletionIds?.has(r.id)?'proposal-delete-relation':''} ${draftIds?.has(r.id) ? 'proposal-ghost-relation' : ''}`}
            style={{ cursor: 'pointer' }}
            onMouseDown={selectHandlers.onMouseDown}
            onClick={selectHandlers.onClick}
            onMouseEnter={() => onHoverRelation(r.id)}
            onMouseLeave={() => onHoverRelation(null)}
          >
            {/* Invisible wider hit-test area for clicking and hovering (32px hitbox) */}
            <path
              d={r.pathD}
              fill="none"
              stroke="rgba(0, 0, 0, 0.001)"
              strokeWidth="32"
              strokeLinecap="round"
              className="uml-relation-interactive"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              {...selectHandlers}
            />

            {/* Outer soft glow line */}
            <path
              d={r.pathD}
              fill="none"
              stroke={isHighlighted ? (isSelected ? 'rgba(244, 63, 94, 0.6)' : 'rgba(56, 189, 248, 0.5)') : (strokeColor ? `${strokeColor}44` : 'var(--relation-glow)')}
              strokeWidth={isHighlighted ? 12 : 6}
              strokeLinecap="round"
              className="uml-relation-interactive"
              style={{ pointerEvents: 'stroke', cursor: 'pointer', transition: 'stroke-width 0.15s ease' }}
              {...selectHandlers}
            />

            {/* Core connection line */}
            <path
              d={r.pathD}
              fill="none"
              stroke={activeStrokeColor || 'var(--relation-line)'}
              strokeWidth={isHighlighted ? 4 : 2}
              strokeDasharray={isSelected ? '8 4' : strokeDash}
              markerEnd={markerEnd}
              className="uml-relation-interactive"
              style={{ pointerEvents: 'stroke', cursor: 'pointer', transition: 'stroke 0.15s ease' }}
              {...selectHandlers}
            />

            {/* Dotted association class connector line (UML 2.5) */}
            {r.assocClassPathD && (
              <g className="uml-association-class-connector" style={{ pointerEvents: 'none' }}>
                <path
                  d={r.assocClassPathD}
                  fill="none"
                  stroke={isHighlighted ? (isSelected ? 'rgba(244, 63, 94, 0.35)' : 'rgba(56, 189, 248, 0.35)') : 'rgba(232, 195, 158, 0.18)'}
                  strokeWidth={isHighlighted ? 8 : 4}
                  strokeLinecap="round"
                />
                <path
                  d={r.assocClassPathD}
                  fill="none"
                  stroke={isSelected ? '#f43f5e' : isHovered ? '#38bdf8' : '#e8c39e'}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
                <circle
                  cx={r.midX}
                  cy={r.midY}
                  r="3.5"
                  fill={isSelected ? '#f43f5e' : '#e8c39e'}
                  stroke="var(--canvas-bg, #0b1120)"
                  strokeWidth="1.5"
                />
              </g>
            )}

            {/* Relation Label & Interactive Delete Badge at Center */}
            {(() => {
              const labelText = r.label || (
                r.type === 'COMPOSITION' ? 'compone' :
                r.type === 'AGGREGATION' ? 'agrega' :
                r.type === 'INHERITANCE' ? 'extiende' :
                r.type === 'REALIZATION' ? 'implementa' :
                r.type === 'DEPENDENCY' ? '«use»' :
                r.type === 'ASSOCIATION_1_1' ? '1:1' :
                r.type === 'ASSOCIATION_N_M' ? 'N:M' :
                r.type === 'ASSOCIATION_CLASS' ? 'asocia' :
                '1:N'
              );
              // Si la relación está seleccionada, expandir ancho para alojar el botón (X); si no, pastilla compacta y limpia
              const badgeWidth = isSelected
                ? Math.max(94, labelText.length * 7.5 + 46)
                : Math.max(68, labelText.length * 7.5 + 22);
              const badgeHeight = 26;
              const badgeX = r.midX - badgeWidth / 2;
              const badgeY = r.midY - badgeHeight / 2;

              return (
                <g
                  transform={`translate(${badgeX}, ${badgeY})`}
                  className="uml-relation-interactive"
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  onMouseDown={selectHandlers.onMouseDown}
                  onClick={selectHandlers.onClick}
                  onMouseEnter={() => onHoverRelation(r.id)}
                  onMouseLeave={() => onHoverRelation(null)}
                >
                  {/* Badge Background Pill */}
                  <rect
                    width={badgeWidth}
                    height={badgeHeight}
                    rx="13"
                    fill={isSelected ? 'rgba(244, 63, 94, 0.25)' : 'var(--relation-badge-bg)'}
                    stroke={isSelected ? '#f43f5e' : (isHovered ? '#38bdf8' : 'var(--relation-badge-border)')}
                    strokeWidth={isSelected || isHovered ? 2 : 1}
                    filter={isHighlighted ? 'url(#glow-cyan)' : undefined}
                  />

                  {/* Text Label (centrado si no hay botón X; desplazado a la izquierda si la X está visible) */}
                  <text
                    x={isSelected ? badgeWidth / 2 - 11 : badgeWidth / 2}
                    y="17"
                    fill={isSelected ? '#fca5a5' : 'var(--relation-badge-text)'}
                    fontSize="10.5"
                    fontFamily="Outfit, sans-serif"
                    fontWeight="700"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {labelText}
                  </text>

                  {/* Quick Delete Button Pill Right — SOLO visible cuando la relación está seleccionada */}
                  {isSelected && (
                    <g
                      transform={`translate(${badgeWidth - 15}, 13)`}
                      className="uml-relation-interactive"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onDeleteRelation(r.id);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteRelation(r.id);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Invisible larger hit circle for effortless clicking */}
                      <circle r="14" fill="rgba(0, 0, 0, 0.001)" />
                      <circle r="8.5" fill="#f43f5e" />
                      <line x1="-3" y1="-3" x2="3" y2="3" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
                      <line x1="3" y1="-3" x2="-3" y2="3" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
                      <title>Eliminar conexión</title>
                    </g>
                  )}
                </g>
              );
            })()}

            {/* Cardinalidad Origen Interactiva */}
            {Boolean(r.srcMultiplicity) && (
              <g
                className="uml-multiplicity-badge"
                transform={`translate(${r.srcMultX}, ${r.srcMultY})`}
                style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectRelation(r.id);
                  onCycleMultiplicity?.(r.id, 'source');
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <rect
                  x="-4"
                  y="-11"
                  width={Math.max(18, r.srcMultiplicity.length * 7.5 + 8)}
                  height="16"
                  rx="4"
                  fill="rgba(15, 23, 42, 0.88)"
                  stroke={isSelected ? '#f43f5e' : isHovered ? '#38bdf8' : 'rgba(148, 163, 184, 0.45)'}
                  strokeWidth={isSelected ? 1.8 : 1}
                />
                <text
                  x={Math.max(18, r.srcMultiplicity.length * 7.5 + 8) / 2 - 4}
                  y="1"
                  fill={isSelected ? '#fca5a5' : '#e2e8f0'}
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="800"
                  textAnchor="middle"
                  style={{ userSelect: 'none' }}
                >
                  {r.srcMultiplicity}
                </text>
                <title>Cardinalidad Origen ({r.srcMultiplicity}) — Clic para alternar (1 ➔ 0..1 ➔ * ➔ 1..* ➔ 0..*)</title>
              </g>
            )}

            {/* Cardinalidad Destino Interactiva */}
            {Boolean(r.tgtMultiplicity) && (
              <g
                className="uml-multiplicity-badge"
                transform={`translate(${r.tgtMultX}, ${r.tgtMultY})`}
                style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectRelation(r.id);
                  onCycleMultiplicity?.(r.id, 'target');
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <rect
                  x="-4"
                  y="-11"
                  width={Math.max(18, r.tgtMultiplicity.length * 7.5 + 8)}
                  height="16"
                  rx="4"
                  fill="rgba(15, 23, 42, 0.88)"
                  stroke={isSelected ? '#f43f5e' : isHovered ? '#38bdf8' : 'rgba(148, 163, 184, 0.45)'}
                  strokeWidth={isSelected ? 1.8 : 1}
                />
                <text
                  x={Math.max(18, r.tgtMultiplicity.length * 7.5 + 8) / 2 - 4}
                  y="1"
                  fill={isSelected ? '#fca5a5' : '#e2e8f0'}
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="800"
                  textAnchor="middle"
                  style={{ userSelect: 'none' }}
                >
                  {r.tgtMultiplicity}
                </text>
                <title>Cardinalidad Destino ({r.tgtMultiplicity}) — Clic para alternar (1 ➔ 0..1 ➔ * ➔ 1..* ➔ 0..*)</title>
              </g>
            )}
          </g>
        );
      })}
    </>
  );
});

// Mantiene la firma de limpieza de selección de clase como prop opcional
// (usada por el banner/barra de relación) para no cambiar la semántica.
export type { RelationLayerProps };
