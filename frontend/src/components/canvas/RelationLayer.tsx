import React from 'react';
import { RelacionUml } from '../../types/uml';

export interface RelationPathData {
  id: string; pathD: string; label: string;
  srcMultiplicity: string; tgtMultiplicity: string;
  sourceRole?: string; targetRole?: string;
  type: RelacionUml['type']; sourceClassId: string; targetClassId: string;
  startX: number; startY: number; endX: number; endY: number;
  midX: number; midY: number; srcMultX: number; srcMultY: number;
  tgtMultX: number; tgtMultY: number; assocClassPathD?: string; associationClassId?: string;
}

interface RelationLayerProps {
  deletionIds?: Set<string>; draftIds?: Set<string>; paths: RelationPathData[];
  selectedRelationId: string | null; hoveredRelationId: string | null;
  onSelectRelation: (relationId: string) => void;
  onHoverRelation: (relationId: string | null) => void;
  onDeleteRelation: (relationId: string) => void;
  onClearClassSelection: () => void;
  onCycleMultiplicity?: (relationId: string, end: 'source' | 'target') => void;
}

function relationStyle(type: RelacionUml['type']) {
  switch (type) {
    case 'COMPOSITION': return { marker: 'url(#uml-diamond)', dash: undefined };
    case 'AGGREGATION': return { marker: 'url(#uml-diamond-hollow)', dash: undefined };
    case 'INHERITANCE': return { marker: 'url(#uml-inheritance)', dash: undefined };
    case 'REALIZATION': return { marker: 'url(#uml-inheritance)', dash: '6 4' };
    case 'DEPENDENCY': case 'USAGE': case 'PACKAGE_IMPORT':
      return { marker: 'url(#uml-arrow-open)', dash: '6 4' };
    case 'NON_NAVIGABLE': return { marker: 'url(#uml-cross)', dash: undefined };
    default: return { marker: undefined, dash: undefined };
  }
}

const noMultiplicity = new Set(['INHERITANCE', 'REALIZATION', 'DEPENDENCY', 'USAGE', 'PACKAGE_IMPORT']);

export const RelationLayer: React.FC<RelationLayerProps> = React.memo(function RelationLayer({
  deletionIds, draftIds, paths, selectedRelationId, hoveredRelationId,
  onSelectRelation, onHoverRelation, onClearClassSelection
}) {
  return <>{paths.map(r => {
    const selected = !draftIds?.has(r.id) && selectedRelationId === r.id;
    const hovered = !draftIds?.has(r.id) && hoveredRelationId === r.id;
    const { marker, dash } = relationStyle(r.type);
    const select = (e: React.MouseEvent) => {
      e.stopPropagation(); onSelectRelation(r.id); onClearClassSelection();
    };
    const endpoint = (value: string, role: string | undefined, x: number, y: number, anchorX: number) =>
      (value || role) && <g transform={`translate(${x}, ${y})`} className="uml-multiplicity-badge"
        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        onMouseDown={e => e.stopPropagation()} onClick={select}>
        <rect x={x < anchorX ? -Math.max(30, `${value} ${role || ''}`.length * 8) : -8} y="-15" width={Math.max(30, `${value} ${role || ''}`.length * 8)} height="24" fill="transparent" />
        <text textAnchor={x < anchorX ? "end" : "start"} y="0" fill="var(--text-primary)" fontSize="11" fontFamily="monospace"
          style={{ userSelect: 'none', pointerEvents: 'none' }}>{[value, role].filter(Boolean).join(' ')}</text>
        <title>Seleccionar relación para editar sus propiedades</title>
      </g>;
    return <g key={r.id} className={`uml-relation-interactive ${deletionIds?.has(r.id) ? 'proposal-delete-relation' : ''} ${draftIds?.has(r.id) ? 'proposal-ghost-relation' : ''}`}
      onMouseEnter={() => onHoverRelation(r.id)} onMouseLeave={() => onHoverRelation(null)}>
      <path d={r.pathD} fill="none" stroke="transparent" strokeWidth="24" style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onMouseDown={select} onClick={select} />
      <path d={r.pathD} fill="none" stroke={selected ? 'var(--accent-cyan)' : 'var(--relation-line)'}
        strokeWidth={selected || hovered ? 2.5 : 1.5} strokeDasharray={dash} markerEnd={marker}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onMouseDown={select} onClick={select} />
      {r.assocClassPathD && <path d={r.assocClassPathD} fill="none" stroke="var(--relation-line)" strokeWidth="1.5" strokeDasharray="5 4" pointerEvents="none" />}
      {r.label && <text x={r.midX} y={r.midY - 7} fill="var(--text-primary)" fontSize="11"
        textAnchor="middle" style={{ pointerEvents: 'none', userSelect: 'none' }}>{r.label}</text>}
      {!noMultiplicity.has(r.type) && endpoint(r.srcMultiplicity, r.sourceRole, r.srcMultX, r.srcMultY, r.startX)}
      {!noMultiplicity.has(r.type) && endpoint(r.tgtMultiplicity, r.targetRole, r.tgtMultX, r.tgtMultY, r.endX)}
    </g>;
  })}</>;
});
export type { RelationLayerProps };
