import React, { useState, useMemo } from 'react';
import {
  Box,
  Database,
  Layers,
  FileCode,
  Server,
  CircleDot,
  Code2,
  ListFilter,
  PackageOpen,
  StickyNote,
  FolderOpen,
  Boxes,
  Hash,
  Zap,
  Link as LinkIcon,
  Link2,
  Key,
  Check,
  X,
  Trash2,
  Edit2,
  Sparkles,
  Crosshair
} from 'lucide-react';
import { ModeloDiagrama, ClaseUml, AtributoUml, Visibilidad, TipoRelacion } from '../../types/uml';
import { calcularMadurezClase } from '../../services/softwareMaturity';

/** Helper para inferir tipo reactivamente según el nombre del atributo (extraído al mover la tarjeta). */
const inferirTipoAtributo = (nombre: string): AtributoUml['type'] => {
  const n = nombre.toLowerCase().trim();
  if (/^(id|codigo|cod)$/i.test(n) || /id$/i.test(n)) return 'Long';
  if (/precio|total|monto|saldo|costo|subtotal|iva|tarifa|comision|arancel/i.test(n)) return 'Double';
  if (/cantidad|stock|edad|numero|num|orden|mes|anio|year|prioridad|puntos|intentos|semestre/i.test(n)) return 'Integer';
  if (/fecha|nacimiento|fec|periodo/i.test(n)) return 'LocalDate';
  if (/hora|tiempo|creado|actualizado|timestamp|horario|registro|expiracion/i.test(n)) return 'LocalDateTime';
  if (/activo|habilitado|es|tiene|borrado|vigente|valido|pagado|completado|bloqueado/i.test(n)) return 'Boolean';
  return 'String';
};

/** Iconos por estereotipo (constante de módulo para no recrearla por render). */
const STEREO_ICONS: Record<string, { icon: React.ReactNode }> = {
  Class: { icon: <Box size={13} color="currentColor" /> },
  Entity: { icon: <Database size={13} color="currentColor" /> },
  Service: { icon: <Layers size={13} color="currentColor" /> },
  Controller: { icon: <FileCode size={13} color="currentColor" /> },
  Repository: { icon: <Server size={13} color="currentColor" /> },
  Interface: { icon: <CircleDot size={13} color="currentColor" /> },
  Abstract: { icon: <Code2 size={13} color="currentColor" /> },
  Enum: { icon: <ListFilter size={13} color="currentColor" /> },
  DTO: { icon: <PackageOpen size={13} color="currentColor" /> },
  Component: { icon: <Box size={13} color="currentColor" /> },
  Note: { icon: <StickyNote size={13} color="currentColor" /> },
  Template: { icon: <Code2 size={13} color="currentColor" /> },
  Package: { icon: <FolderOpen size={13} color="currentColor" /> },
  Instance: { icon: <CircleDot size={13} color="currentColor" /> },
  DataType: { icon: <Boxes size={13} color="currentColor" /> },
  Primitive: { icon: <Hash size={13} color="currentColor" /> },
  Signal: { icon: <Zap size={13} color="currentColor" /> },
  AssociationClass: { icon: <Link2 size={13} color="currentColor" /> }
};

export interface UmlNodeCardProps {
  draft?: boolean;
  cls: ClaseUml;
  diagram: ModeloDiagrama;
  isSelected: boolean;
  isConnectingSource: boolean;
  isConnectingTarget?: boolean;
  isDragging: boolean;
  isRemoteDragging: boolean;
  remoteDragInfo?: { name: string; color: string };
  canEdit: boolean;
  // Renombrado Inline de Clase
  editingClassId: string | null;
  editingClassName: string;
  editingClassStereotype: ClaseUml['stereotype'];
  // Enlazador Rápido (Fast Linker Popover)
  cardFastLinkerClassId: string | null;
  fastLinkTargetClassId: string;
  fastLinkRelType: TipoRelacion;
  fastLinkLabel: string;
  // Adding Attribute inline
  addingAttrClassId: string | null;
  attrName: string;
  attrType: AtributoUml['type'];
  attrVis: Visibilidad;
  attrIsPk: boolean;
  // Adding Method inline
  addingMethodClassId: string | null;
  methodName: string;
  methodReturnType: string;
  methodParams: string;
  methodVis: Visibilidad;
  // Relación seleccionada (highlight en lista de conexiones)
  selectedRelationId: string | null;
  // Medición de dimensiones reales del nodo
  nodeDimensionsRef: React.MutableRefObject<Map<string, { w: number; h: number }>>;
  setDimensionTick: React.Dispatch<React.SetStateAction<number>>;
  // ─── Handlers estables (useCallback en el padre) ───
  onMouseDown: (e: React.MouseEvent, cls: ClaseUml) => void;
  onStartEditingClass: (cls: ClaseUml, e: React.MouseEvent) => void;
  onSaveEditingClass: (classId: string, e?: React.FormEvent | React.MouseEvent) => void;
  onDeleteClass: (classId: string) => void;
  onDeleteAttribute: (classId: string, attrId: string) => void;
  onDeleteMethod?: (classId: string, methodId: string) => void;
  onSaveAttribute: (e: React.FormEvent, classId: string) => void;
  onSaveMethod: (e: React.FormEvent, classId: string) => void;
  onAddAttributePreset: (classId: string, presetName: string, presetType: AtributoUml['type'], isPk?: boolean) => void;
  onAddAuditFields: (classId: string) => void;
  onFastLinkSubmit: (sourceClassId: string, srcMult?: string, tgtMult?: string) => void;
  onStartCanvasLinking: (classId: string) => void;
  onDeleteRelation: (relationId: string) => void;
  onAutoCompletarClase?: (classId: string) => void;
  // ─── Setters reactivos (estables de useState) ───
  setEditingClassStereotype: React.Dispatch<React.SetStateAction<ClaseUml['stereotype']>>;
  setEditingClassName: React.Dispatch<React.SetStateAction<string>>;
  setEditingClassId: React.Dispatch<React.SetStateAction<string | null>>;
  setCardFastLinkerClassId: React.Dispatch<React.SetStateAction<string | null>>;
  setFastLinkTargetClassId: React.Dispatch<React.SetStateAction<string>>;
  setFastLinkRelType: React.Dispatch<React.SetStateAction<TipoRelacion>>;
  setFastLinkLabel: React.Dispatch<React.SetStateAction<string>>;
  setAddingAttrClassId: React.Dispatch<React.SetStateAction<string | null>>;
  setAttrName: React.Dispatch<React.SetStateAction<string>>;
  setAttrType: React.Dispatch<React.SetStateAction<AtributoUml['type']>>;
  setAttrVis: React.Dispatch<React.SetStateAction<Visibilidad>>;
  setAttrIsPk: React.Dispatch<React.SetStateAction<boolean>>;
  setAddingMethodClassId: React.Dispatch<React.SetStateAction<string | null>>;
  setMethodName: React.Dispatch<React.SetStateAction<string>>;
  setMethodReturnType: React.Dispatch<React.SetStateAction<string>>;
  setMethodParams: React.Dispatch<React.SetStateAction<string>>;
  setMethodVis: React.Dispatch<React.SetStateAction<Visibilidad>>;
  setSelectedRelationId: React.Dispatch<React.SetStateAction<string | null>>;
  setNameTagReset?: () => void;
}

/**
 * Tarjeta de Clase UML memoizada (extraída de InteractiveStudioCanvas).
 *
 * Refactor 2026-09-26 · Fase 1 + rendimiento:
 * - `React.memo` + handlers estables (`useCallback` en el padre): al arrastrar
 *   una clase, solo ESA tarjeta re-renderiza; el resto queda congelado (60 FPS).
 * - La madurez de clase se calcula DENTRO con `useMemo` (evita crear el objeto
 *   `madurez` nuevo en cada render del padre, lo que rompería la memoización).
 * - El JSX es el mismo que estaba en el lienzo (movido sin cambios de lógica).
 */
export const UmlNodeCard: React.FC<UmlNodeCardProps> = React.memo(function UmlNodeCard({
  draft = false,
  cls,
  diagram,
  isSelected,
  isConnectingSource,
  isConnectingTarget = false,
  isDragging,
  isRemoteDragging,
  remoteDragInfo,
  canEdit,
  editingClassId,
  editingClassName,
  editingClassStereotype,
  cardFastLinkerClassId,
  fastLinkTargetClassId,
  fastLinkRelType,
  fastLinkLabel,
  addingAttrClassId,
  attrName,
  attrType,
  attrVis,
  attrIsPk: _attrIsPk,
  addingMethodClassId,
  methodName,
  methodReturnType,
  methodParams: _methodParams,
  methodVis,
  selectedRelationId,
  nodeDimensionsRef,
  setDimensionTick,
  onMouseDown,
  onStartEditingClass,
  onSaveEditingClass,
  onDeleteClass,
  onDeleteAttribute,
  onDeleteMethod,
  onSaveAttribute,
  onSaveMethod,
  onAddAttributePreset,
  onAddAuditFields,
  onFastLinkSubmit,
  onStartCanvasLinking,
  onDeleteRelation,
  onAutoCompletarClase,
  setEditingClassStereotype,
  setEditingClassName,
  setEditingClassId,
  setCardFastLinkerClassId,
  setFastLinkTargetClassId,
  setFastLinkRelType,
  setFastLinkLabel,
  setAddingAttrClassId,
  setAttrName,
  setAttrType,
  setAttrVis,
  setAttrIsPk,
  setAddingMethodClassId,
  setMethodName,
  setMethodReturnType,
  setMethodParams: _setMethodParams,
  setMethodVis,
  setSelectedRelationId
}) {
  const stereotype = cls.stereotype || 'Entity';
  const pos = cls.position || { x: 120, y: 120 };

  const activeStereo = STEREO_ICONS[stereotype] || STEREO_ICONS.Entity;

  // Estado local para cardinalidades en el enlazador rápido
  const [fastLinkSrcMult, setFastLinkSrcMult] = useState<string>('1');
  const [fastLinkTgtMult, setFastLinkTgtMult] = useState<string>('0..*');

  // Madurez calculada internamente: solo se recalcula cuando cambian los props
  // reales de esta tarjeta (cls o diagrama), no en cada render del lienzo.
  const madurez = useMemo(
    () => calcularMadurezClase(cls, diagram.relations, diagram.classes),
    [cls, diagram.relations, diagram.classes]
  );

  return (
    <div
      key={cls.id}
      ref={el => {
        if (el) {
          const w = el.offsetWidth || 330;
          const h = el.offsetHeight || 200;
          const prev = nodeDimensionsRef.current.get(cls.id);
          if (!prev || Math.abs(prev.h - h) > 3 || Math.abs(prev.w - w) > 3) {
            nodeDimensionsRef.current.set(cls.id, { w, h });
            setDimensionTick(t => t + 1);
          }
        }
      }}
      className={`uml-class-node ${draft ? 'proposal-ghost-node' : ''} ${isSelected ? 'node-selected' : ''} ${isDragging ? 'dragging' : ''} ${isRemoteDragging ? 'remote-dragging' : ''}`}
      onMouseDown={e => onMouseDown(e, cls)}
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: '330px',
        borderRadius: '12px',
        pointerEvents: 'auto',
        outline: isConnectingSource
          ? '2px dashed var(--accent-cyan)'
          : isConnectingTarget
          ? '2px dashed #10b981'
          : isRemoteDragging
          ? `2px solid ${remoteDragInfo?.color || 'var(--accent-cyan)'}`
          : 'none',
        boxShadow: isConnectingSource
          ? '0 0 25px rgba(56, 189, 248, 0.75)'
          : isConnectingTarget
          ? '0 0 25px rgba(16, 185, 129, 0.65)'
          : isRemoteDragging
          ? `0 0 20px ${remoteDragInfo?.color || 'var(--accent-cyan)'}88, 0 12px 30px rgba(0,0,0,0.18)`
          : undefined,
        cursor: isConnectingTarget ? 'pointer' : undefined
      }}
    >
      {draft && <span className="proposal-ghost-label">Propuesta IA</span>}
      {/* Badge flotante: Origen de conexión */}
      {isConnectingSource && (
        <div
          style={{
            position: 'absolute',
            top: '-26px',
            left: '6px',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#f0f9ff',
            fontSize: '0.68rem',
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            padding: '2px 9px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 4px 12px rgba(56, 189, 248, 0.5)',
            zIndex: 60,
            pointerEvents: 'none'
          }}
        >
          <Link2 size={11} />
          <span>Origen de conexión...</span>
        </div>
      )}

      {/* Badge flotante: Destino de conexión */}
      {isConnectingTarget && (
        <div
          style={{
            position: 'absolute',
            top: '-26px',
            left: '6px',
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            color: '#ecfdf5',
            fontSize: '0.68rem',
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            padding: '2px 9px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.6)',
            zIndex: 60,
            pointerEvents: 'none'
          }}
        >
          <Sparkles size={11} color="#a7f3d0" />
          <span>Clic para conectar como Destino</span>
        </div>
      )}

      {/* Badge flotante que indica qué compañero está moviendo la tabla en vivo */}
      {isRemoteDragging && remoteDragInfo && (
        <div
          style={{
            position: 'absolute',
            top: '-26px',
            left: '6px',
            background: remoteDragInfo.color,
            color: '#ffffff',
            fontSize: '0.68rem',
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            padding: '2px 9px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: `0 4px 12px ${remoteDragInfo.color}88`,
            zIndex: 60,
            pointerEvents: 'none'
          }}
        >
          <Sparkles size={11} />
          <span>{remoteDragInfo.name} moviendo...</span>
        </div>
      )}
      {/* Card Header (Functional HUD - Glassmorphic with Distinct Stereotype Accent) */}
      <div
        style={{
          background: 'var(--glass-node-header-bg)',
          padding: '8px 10px',
          borderBottom: '1px solid var(--glass-node-header-border)',
          borderTop: '3px solid var(--glass-node-header-accent)',
          borderTopLeftRadius: '11px',
          borderTopRightRadius: '11px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <div style={{
            width: '22px',
            height: '22px',
            borderRadius: '5px',
            background: 'var(--glass-node-icon-bg)',
            border: '1px solid var(--glass-node-header-border)',
            color: 'var(--glass-node-icon-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {activeStereo.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <div style={{
              fontSize: '0.64rem',
              color: 'var(--glass-node-stereo-color)',
              fontWeight: 800,
              letterSpacing: '0.04em',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              &laquo;{stereotype}&raquo;
            </div>

            {/* Renombrado Inline de Clase */}
            {editingClassId === cls.id && canEdit ? (
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
              >
                <select
                  value={editingClassStereotype}
                  onChange={e => setEditingClassStereotype(e.target.value as any)}
                  style={{
                    background: 'var(--glass-node-bg)',
                    border: '1px solid var(--glass-border-color)',
                    borderRadius: '4px',
                    padding: '2px 4px',
                    fontSize: '0.66rem',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="Class">Class</option>
                  <option value="Entity">Entity</option>
                  <option value="Service">Service</option>
                  <option value="Controller">Controller</option>
                  <option value="Repository">Repository</option>
                  <option value="Interface">Interface</option>
                  <option value="Abstract">Abstract</option>
                  <option value="Enum">Enum</option>
                  <option value="DTO">DTO</option>
                  <option value="Component">Component</option>
                  <option value="Note">Note</option>
                  <optgroup label="── UML 2.5+ ──">
                    <option value="Template">Template (Genérica)</option>
                    <option value="Package">Package (Paquete)</option>
                    <option value="Instance">Instance (Objeto)</option>
                    <option value="DataType">DataType</option>
                    <option value="Primitive">Primitive</option>
                    <option value="Signal">Signal (Señal)</option>
                    <option value="AssociationClass">AssociationClass</option>
                  </optgroup>
                </select>
                <input
                  type="text"
                  value={editingClassName}
                  onChange={e => setEditingClassName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') onSaveEditingClass(cls.id);
                    if (e.key === 'Escape') setEditingClassId(null);
                  }}
                  autoFocus
                  style={{
                    background: 'var(--glass-node-bg)',
                    border: '1px solid var(--accent-cyan)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '0.84rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    width: '105px'
                  }}
                />
                <button
                  onClick={e => onSaveEditingClass(cls.id, e)}
                  style={{
                    background: 'var(--accent-emerald)',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '3px 6px',
                    cursor: 'pointer'
                  }}
                  title="Guardar nombre"
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setEditingClassId(null); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    padding: '2px 4px',
                    cursor: 'pointer'
                  }}
                  title="Cancelar"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, overflow: 'hidden' }}>
                <h3
                  onDoubleClick={e => { if (canEdit) onStartEditingClass(cls, e); }}
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    color: 'var(--glass-node-header-text)',
                    fontStyle: (stereotype === 'Interface' || stereotype === 'Abstract' || cls.isInterface || cls.isAbstract) ? 'italic' : 'normal',
                    letterSpacing: '-0.01em',
                    cursor: canEdit ? 'pointer' : 'default',
                    margin: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0,
                    flexShrink: 1
                  }}
                  title={canEdit ? `Doble clic o lápiz para renombrar (${cls.name})` : cls.name}
                >
                  {cls.name}
                </h3>
                {/* Badge de Madurez de la Clase */}
                <span
                  title={`Madurez: ${madurez.porcentaje}% (${madurez.nivel.replace('_', ' ')})\n${madurez.sugerencias.join('\n')}`}
                  style={{
                    fontSize: '0.60rem',
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: '999px',
                    background: `${madurez.color}22`,
                    color: madurez.color,
                    border: `1px solid ${madurez.color}55`,
                    cursor: 'help',
                    flexShrink: 0
                  }}
                >
                  {madurez.porcentaje}%
                </span>
                {canEdit && (
                  <button
                    onClick={e => onStartEditingClass(cls, e)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--glass-node-stereo-color)',
                      cursor: 'pointer',
                      padding: '1px',
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0
                    }}
                    title="Renombrar clase / cambiar estereotipo"
                  >
                    <Edit2 size={10} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Acciones de la cabecera: Enlazar y Eliminar (Limpias y sin desbordamiento) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {canEdit && (
            <button
              onClick={e => {
                e.stopPropagation();
                onStartCanvasLinking(cls.id);
              }}
              style={{
                background: isConnectingSource ? 'rgba(56, 189, 248, 0.35)' : 'var(--glass-node-btn-bg)',
                border: isConnectingSource ? '1px solid #38bdf8' : '1px solid var(--glass-node-btn-border)',
                borderRadius: '6px',
                padding: '2px 6px',
                color: isConnectingSource ? '#38bdf8' : 'var(--glass-node-btn-text)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                fontSize: '0.67rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              title="Conexión rápida en lienzo: haz clic aquí y luego clic en la tabla destino"
            >
              <Crosshair size={11} color={isConnectingSource ? '#38bdf8' : 'currentColor'} />
            </button>
          )}

          {canEdit && (
            <button
              onClick={e => {
                e.stopPropagation();
                const willOpen = cardFastLinkerClassId !== cls.id;
                setCardFastLinkerClassId(willOpen ? cls.id : null);
                if (willOpen) {
                  const others = diagram.classes.filter(c => c.id !== cls.id);
                  if (others.length > 0 && (!fastLinkTargetClassId || fastLinkTargetClassId === cls.id)) {
                    setFastLinkTargetClassId(others[0].id);
                  }
                }
              }}
              style={{
                background: cardFastLinkerClassId === cls.id ? 'var(--accent-primary)' : 'var(--glass-node-btn-bg)',
                border: cardFastLinkerClassId === cls.id ? '1px solid var(--accent-primary)' : '1px solid var(--glass-node-btn-border)',
                borderRadius: '6px',
                padding: '2px 7px',
                color: cardFastLinkerClassId === cls.id ? '#ffffff' : 'var(--glass-node-btn-text)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '0.67rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              title="Enlazar con otra tabla UML (selector directo o lienzo)"
            >
              <Link2 size={11} />
              <span>Enlazar</span>
            </button>
          )}

          {canEdit && (
            <button
              onClick={e => {
                e.stopPropagation();
                onDeleteClass(cls.id);
              }}
              style={{
                background: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.28)',
                borderRadius: '6px',
                padding: '3px 4px',
                color: '#fb7185',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              title="Eliminar entidad"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Barra de progreso de madurez de la clase (con track visible para evitar sensación de corte) */}
      <div
        style={{
          width: '100%',
          height: '3px',
          background: 'rgba(255, 255, 255, 0.12)',
          position: 'relative',
          overflow: 'hidden'
        }}
        title={`Nivel de madurez del software: ${madurez.porcentaje}% (${madurez.nivel.replace('_', ' ')})`}
      >
        <div
          style={{
            width: `${madurez.porcentaje}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${madurez.color}cc, ${madurez.color})`,
            boxShadow: `0 0 8px ${madurez.color}99`,
            borderRadius: '0 2px 2px 0',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        />
      </div>

      {/* Fast Linker Popover integrado en la tarjeta */}
      {cardFastLinkerClassId === cls.id && (
        <div
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          style={{
            background: 'var(--popover-bg)',
            borderBottom: '2px solid var(--accent-cyan)',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Link2 size={14} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Enlazar <strong>{cls.name}</strong> con:
              </span>
            </div>
            <button
              onClick={() => setCardFastLinkerClassId(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
            >
              <X size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Tabla Destino:</label>
            <select
              value={fastLinkTargetClassId}
              onChange={e => setFastLinkTargetClassId(e.target.value)}
              style={{
                background: 'var(--glass-node-bg)',
                border: '1px solid var(--glass-border-color)',
                borderRadius: '6px',
                padding: '5px 8px',
                fontSize: '0.74rem',
                color: 'var(--text-primary)'
              }}
            >
              <option value="" disabled>Selecciona tabla destino...</option>
              {diagram.classes.filter(c => c.id !== cls.id).map(target => (
                <option key={target.id} value={target.id}>
                  {target.name} ({target.stereotype || 'Entity'})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Tipo de Relación:</label>
              <select
                value={fastLinkRelType}
                onChange={e => {
                  const val = e.target.value as TipoRelacion;
                  setFastLinkRelType(val);
                  if (val === 'ASSOCIATION_1_N') { setFastLinkSrcMult('1'); setFastLinkTgtMult('0..*'); }
                  else if (val === 'ASSOCIATION_1_1') { setFastLinkSrcMult('1'); setFastLinkTgtMult('1'); }
                  else if (val === 'ASSOCIATION_N_M') { setFastLinkSrcMult('*'); setFastLinkTgtMult('*'); }
                  else if (val === 'COMPOSITION') { setFastLinkSrcMult('1'); setFastLinkTgtMult('1..*'); }
                  else if (val === 'AGGREGATION') { setFastLinkSrcMult('1'); setFastLinkTgtMult('0..*'); }
                  else if (['INHERITANCE', 'REALIZATION', 'DEPENDENCY', 'USAGE', 'PACKAGE_IMPORT', 'ASSOCIATION_BINARY'].includes(val)) {
                    setFastLinkSrcMult(''); setFastLinkTgtMult('');
                  }
                }}
                style={{
                  background: 'var(--glass-node-bg)',
                  border: '1px solid var(--glass-border-color)',
                  borderRadius: '6px',
                  padding: '5px 6px',
                  fontSize: '0.72rem',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="ASSOCIATION_1_N">1:N (Uno a Muchos)</option>
                <option value="ASSOCIATION_1_1">1:1 (Uno a Uno)</option>
                <option value="ASSOCIATION_N_M">N:M (Muchos a Muchos)</option>
                <option value="ASSOCIATION_BINARY">Binaria (sin multiplicidad)</option>
                <option value="COMPOSITION">Composición (Contenedor-Parte)</option>
                <option value="AGGREGATION">Agregación</option>
                <option value="INHERITANCE">Herencia (Extiende)</option>
                <option value="REALIZATION">Realización (Implementa)</option>
                <option value="DEPENDENCY">Dependencia</option>
                <option value="USAGE">«use» (Uso)</option>
                <option value="PACKAGE_IMPORT">«import» (Importación)</option>
                <option value="NON_NAVIGABLE">No Navegable ✕</option>
              </select>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Etiqueta (opcional):</label>
              <input
                type="text"
                placeholder="ej. tiene, compone"
                value={fastLinkLabel}
                onChange={e => setFastLinkLabel(e.target.value)}
                style={{
                  background: 'var(--glass-node-bg)',
                  border: '1px solid var(--glass-border-color)',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  fontSize: '0.72rem',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>

          {/* Selectores de cardinalidad para la relación rápida */}
          {!['INHERITANCE', 'REALIZATION', 'DEPENDENCY', 'USAGE', 'PACKAGE_IMPORT', 'ASSOCIATION_BINARY'].includes(fastLinkRelType) && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Card. Origen:</label>
                <select
                  value={fastLinkSrcMult}
                  onChange={e => setFastLinkSrcMult(e.target.value)}
                  style={{
                    background: 'var(--glass-node-bg)',
                    border: '1px solid var(--glass-border-color)',
                    borderRadius: '6px',
                    padding: '4px 6px',
                    fontSize: '0.72rem',
                    color: 'var(--accent-cyan)',
                    fontFamily: 'monospace',
                    fontWeight: 700
                  }}
                >
                  <option value="1">1 (Exactamente 1)</option>
                  <option value="0..1">0..1 (Opcional)</option>
                  <option value="*">* (Muchos)</option>
                  <option value="0..*">0..* (Cero a muchos)</option>
                  <option value="1..*">1..* (Uno a muchos)</option>
                </select>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Card. Destino:</label>
                <select
                  value={fastLinkTgtMult}
                  onChange={e => setFastLinkTgtMult(e.target.value)}
                  style={{
                    background: 'var(--glass-node-bg)',
                    border: '1px solid var(--glass-border-color)',
                    borderRadius: '6px',
                    padding: '4px 6px',
                    fontSize: '0.72rem',
                    color: 'var(--accent-cyan)',
                    fontFamily: 'monospace',
                    fontWeight: 700
                  }}
                >
                  <option value="*">* (Muchos)</option>
                  <option value="0..*">0..* (Cero a muchos)</option>
                  <option value="1..*">1..* (Uno a muchos)</option>
                  <option value="1">1 (Exactamente 1)</option>
                  <option value="0..1">0..1 (Opcional)</option>
                </select>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
            <button
              type="button"
              onClick={() => onStartCanvasLinking(cls.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-cyan)',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 0'
              }}
              title="Conectar haciendo clic en otra clase directamente en el lienzo"
            >
              <LinkIcon size={11} />
              <span>Clic en lienzo</span>
            </button>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setCardFastLinkerClassId(null)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--glass-border-color)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => onFastLinkSubmit(cls.id, fastLinkSrcMult, fastLinkTgtMult)}
                disabled={!fastLinkTargetClassId}
                className="btn-studio-primary"
                style={{
                  padding: '4px 12px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  opacity: fastLinkTargetClassId ? 1 : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: (fastLinkRelType === 'ASSOCIATION_N_M' || (fastLinkSrcMult === '*' && fastLinkTgtMult === '*'))
                    ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)'
                    : undefined,
                  border: (fastLinkRelType === 'ASSOCIATION_N_M' || (fastLinkSrcMult === '*' && fastLinkTgtMult === '*'))
                    ? '1px solid #a855f7'
                    : undefined
                }}
                title={
                  (fastLinkRelType === 'ASSOCIATION_N_M' || (fastLinkSrcMult === '*' && fastLinkTgtMult === '*'))
                    ? 'Crea automáticamente una tabla asociativa intermedia con dos relaciones 1:N (Regla 3FN / UML 2.5)'
                    : 'Establecer conexión entre ambas clases'
                }
              >
                {(fastLinkRelType === 'ASSOCIATION_N_M' || (fastLinkSrcMult === '*' && fastLinkTgtMult === '*')) ? (
                  <>
                    <Sparkles size={12} color="#fef08a" />
                    <span><Zap size={12} color="var(--accent-primary)" /> Crear Tabla Intermedia (N:M)</span>
                  </>
                ) : (
                  <>
                    <Check size={12} />
                    <span>Conectar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {(fastLinkRelType === 'ASSOCIATION_N_M' || (fastLinkSrcMult === '*' && fastLinkTgtMult === '*')) && (
            <div style={{ marginTop: '8px', padding: '4px 8px', background: 'rgba(124, 58, 237, 0.12)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '6px', fontSize: '0.64rem', color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Sparkles size={11} color="#fef08a" style={{ flexShrink: 0 }} />
              <span><strong>UML 2.5 / 3FN:</strong> Se generará una tabla asociativa con PK, 2 FKs y dos relaciones 1:N.</span>
            </div>
          )}
        </div>
      )}

      {/* Attributes / Fields List */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--glass-node-attr-border)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '6px'
        }}>
          <span style={{
            fontSize: '0.66rem',
            color: 'var(--text-muted)',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            Atributos ({cls.attributes.length})
          </span>

          {canEdit && (
            <button
              onClick={e => {
                e.stopPropagation();
                setAddingAttrClassId(addingAttrClassId === cls.id ? null : cls.id);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-cyan)',
                fontSize: '0.68rem',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              + Atributo
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {cls.attributes.map(attr => (
            <div
              key={attr.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-mono)',
                padding: '3px 6px',
                borderRadius: '4px',
                background: 'var(--glass-node-attr-item-bg)',
                border: '1px solid var(--glass-node-attr-item-border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                <span style={{
                  color: 'rgba(232, 195, 158, 0.75)',
                  fontWeight: 800,
                  flexShrink: 0
                }}>
                  {attr.visibility}
                </span>
                <span style={{
                  color: 'var(--glass-node-attr-text)',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }} title={attr.name}>
                  {attr.name}
                </span>
                {attr.isPrimaryKey && (
                  <span title="Clave Primaria (PK)" style={{ flexShrink: 0 }}>
                    <Key size={11} color="#e8c39e" />
                  </span>
                )}
                <span style={{ color: 'var(--text-subtle)', flexShrink: 0 }}>:</span>
                <span style={{ color: '#e8c39e', fontWeight: 600, flexShrink: 0 }}>{attr.type}</span>
              </div>

              {canEdit && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onDeleteAttribute(cls.id, attr.id);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '1px'
                  }}
                  title={attr.isPrimaryKey ? "Eliminar clave primaria (PK)" : "Eliminar atributo"}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Inline Add Attribute Form con Chips Rápidos e Inferencia Reactiva */}
        {addingAttrClassId === cls.id && (
          <form
            onSubmit={e => onSaveAttribute(e, cls.id)}
            style={{
              marginTop: '8px',
              padding: '10px',
              background: 'var(--glass-surface-hover)',
              borderRadius: '8px',
              border: '1px solid var(--glass-border-color)'
            }}
          >
            {/* Chips de campos comunes en 1 clic */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Zap size={10} color="var(--accent-primary)" /> Presets en 1 Clic:</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {[
                  { label: '+ id (PK)', name: 'id', type: 'Long' as const, isPk: true },
                  { label: '+ nombre', name: 'nombre', type: 'String' as const, isPk: false },
                  { label: '+ descripcion', name: 'descripcion', type: 'String' as const, isPk: false },
                  { label: '+ correo', name: 'email', type: 'String' as const, isPk: false },
                  { label: '+ precio', name: 'precio', type: 'Double' as const, isPk: false },
                  { label: '+ total', name: 'total', type: 'Double' as const, isPk: false },
                  { label: '+ cantidad', name: 'cantidad', type: 'Integer' as const, isPk: false },
                  { label: '+ fecha', name: 'fechaRegistro', type: 'LocalDate' as const, isPk: false },
                  { label: '+ activo', name: 'activo', type: 'Boolean' as const, isPk: false }
                ].map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onAddAttributePreset(cls.id, preset.name, preset.type, preset.isPk)}
                    style={{
                      background: 'var(--glass-surface)',
                      border: '1px solid var(--glass-border-color)',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '0.66rem',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                    title={`Añadir campo ${preset.name} (${preset.type})`}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onAddAuditFields(cls.id)}
                  style={{
                    background: '#2f2c79',
                    border: '1px solid #171a4a',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '0.66rem',
                    color: '#f5e1ce',
                    cursor: 'pointer',
                    fontWeight: 800
                  }}
                  title="Añadir creadoEn, actualizadoEn, creadoPor y activo"
                >
                  + <Zap size={11} color="var(--accent-primary)" style={{ verticalAlign: '-1px' }} /> 4 Auditoría
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
              <select
                value={attrVis}
                onChange={e => setAttrVis(e.target.value as Visibilidad)}
                style={{
                  background: 'var(--glass-node-bg)',
                  border: '1px solid var(--glass-border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  padding: '4px 6px',
                  fontSize: '0.72rem'
                }}
              >
                <option value="-">- Privado</option>
                <option value="+">+ Público</option>
                <option value="#"># Protegido</option>
              </select>
              <input
                type="text"
                placeholder="nombreAtributo (auto-detecta tipo)"
                value={attrName}
                onChange={e => {
                  const val = e.target.value;
                  setAttrName(val);
                  const inf = inferirTipoAtributo(val);
                  setAttrType(inf);
                  if (/^id$/i.test(val.trim())) {
                    setAttrIsPk(true);
                  }
                }}
                style={{
                  flex: 1,
                  background: 'var(--glass-node-bg)',
                  border: '1px solid var(--glass-border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)'
                }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <select
                value={attrType}
                onChange={e => setAttrType(e.target.value as any)}
                style={{
                  flex: 1,
                  background: 'var(--glass-node-bg)',
                  border: '1px solid var(--glass-border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  padding: '4px 6px',
                  fontSize: '0.72rem'
                }}
              >
                <option value="String">String</option>
                <option value="Long">Long</option>
                <option value="Integer">Integer</option>
                <option value="Double">Double</option>
                <option value="Boolean">Boolean</option>
                <option value="LocalDate">LocalDate</option>
                <option value="LocalDateTime">LocalDateTime</option>
                <option value="BigDecimal">BigDecimal</option>
              </select>
              <button
                type="submit"
                style={{
                  background: 'var(--accent-primary)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Check size={12} /> Guardar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Methods & Operations */}
      <div style={{
        padding: '10px 14px',
        background: 'var(--glass-node-method-bg)',
        borderBottomLeftRadius: '11px',
        borderBottomRightRadius: '11px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '6px'
        }}>
          <span style={{
            fontSize: '0.66rem',
            color: 'var(--text-muted)',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            Métodos ({cls.methods.length})
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {canEdit && madurez.porcentaje < 100 && onAutoCompletarClase && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  onAutoCompletarClase(cls.id);
                }}
                style={{
                  background: '#2f2c79',
                  border: '1px solid #171a4a',
                  borderRadius: '5px',
                  padding: '2px 7px',
                  color: '#f5e1ce',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  transition: 'all 0.15s ease'
                }}
                title={`Sugerir y autocompletar métodos de negocio con IA (${madurez.sugerencias[0] || 'Lógica'})`}
              >
                <Zap size={10} />
                <span>+ Lógica IA</span>
              </button>
            )}

            {canEdit && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  setAddingMethodClassId(addingMethodClassId === cls.id ? null : cls.id);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.68rem',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                + Método
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {cls.methods.map(m => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.76rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                padding: '2px 4px',
                borderRadius: '4px'
              }}
            >
              <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${m.name}(${m.parameters || ''}): ${m.returnType}`}>
                <span style={{ color: 'rgba(232, 195, 158, 0.75)', fontWeight: 800 }}>{m.visibility} </span>
                <span style={{ color: 'var(--glass-node-attr-text)', fontWeight: 600 }}>{m.name}({m.parameters || ''})</span>: <span style={{ color: '#e8c39e', fontWeight: 700 }}>{m.returnType}</span>
              </div>

              {onDeleteMethod && canEdit && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onDeleteMethod(cls.id, m.id);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '1px'
                  }}
                  title="Eliminar método"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Inline Add Method Form */}
        {addingMethodClassId === cls.id && (
          <form
            onSubmit={e => onSaveMethod(e, cls.id)}
            style={{
              marginTop: '8px',
              padding: '8px',
              background: 'var(--glass-surface-hover)',
              borderRadius: '8px',
              border: '1px solid var(--glass-border-color)'
            }}
          >
            <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
              <select
                value={methodVis}
                onChange={e => setMethodVis(e.target.value as Visibilidad)}
                style={{
                  background: 'var(--glass-node-bg)',
                  border: '1px solid var(--glass-border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  padding: '4px 6px',
                  fontSize: '0.72rem'
                }}
              >
                <option value="+">+ Público</option>
                <option value="-">- Privado</option>
                <option value="#"># Protegido</option>
              </select>
              <input
                type="text"
                placeholder="nombreMetodo"
                value={methodName}
                onChange={e => setMethodName(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--glass-node-bg)',
                  border: '1px solid var(--glass-border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)'
                }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="text"
                placeholder="TipoRetorno (ej. void, List<Product>)"
                value={methodReturnType}
                onChange={e => setMethodReturnType(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--glass-node-bg)',
                  border: '1px solid var(--glass-border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)'
                }}
              />
              <button
                type="submit"
                style={{
                  background: 'var(--accent-primary)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Check size={12} /> Guardar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Conexiones de la tabla con otras clases (gestión manual directa) */}
      {(() => {
        const classRels = diagram.relations.filter(r => r.sourceClassId === cls.id || r.targetClassId === cls.id || r.associationClassId === cls.id);
        if (classRels.length === 0) return null;

        return (
          <div
            style={{
              padding: '6px 12px 8px 12px',
              borderTop: '1px solid var(--glass-node-attr-border)',
              background: 'rgba(0, 0, 0, 0.04)',
              borderBottomLeftRadius: '11px',
              borderBottomRightRadius: '11px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Conexiones ({classRels.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {classRels.map(rel => {
                const isAssocLink = rel.associationClassId === cls.id;
                const isSource = rel.sourceClassId === cls.id;
                const isSelectedRel = selectedRelationId === rel.id;

                if (isAssocLink) {
                  const sCls = diagram.classes.find(c => c.id === rel.sourceClassId);
                  const tCls = diagram.classes.find(c => c.id === rel.targetClassId);
                  const pairName = `${sCls?.name || 'A'} ↔ ${tCls?.name || 'B'}`;

                  return (
                    <div
                      key={rel.id}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedRelationId(rel.id);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.70rem',
                        padding: '3px 6px',
                        borderRadius: '5px',
                        background: isSelectedRel ? 'rgba(244, 63, 94, 0.18)' : 'rgba(232, 195, 158, 0.08)',
                        border: isSelectedRel ? '1px solid rgba(244, 63, 94, 0.5)' : '1px solid rgba(232, 195, 158, 0.25)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      title="Enlace en T reglamentario (UML 2.5): Haz clic para seleccionar la asociación principal"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ color: '#e8c39e', fontWeight: 800 }}>⊥</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pairName}</span>
                        <span style={{
                          fontSize: '0.60rem',
                          fontFamily: 'var(--font-mono)',
                          background: 'rgba(232, 195, 158, 0.2)',
                          color: '#e8c39e',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: 700
                        }}>
                          {rel.sourceMultiplicity || '*'} ↔ {rel.targetMultiplicity || '1..*'}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.63rem' }}>
                          (Línea en T)
                        </span>
                      </div>
                      {canEdit && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onDeleteRelation(rel.id);
                          }}
                          title={`Eliminar asociación entre ${pairName}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#fb7185',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px'
                          }}
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  );
                }

                const otherId = isSource ? rel.targetClassId : rel.sourceClassId;
                const otherCls = diagram.classes.find(c => c.id === otherId);
                const otherName = otherCls ? otherCls.name : 'Desconocida';
                const assocCls = rel.associationClassId ? diagram.classes.find(c => c.id === rel.associationClassId) : null;
                return (
                  <div
                    key={rel.id}
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedRelationId(rel.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.70rem',
                      padding: '3px 6px',
                      borderRadius: '5px',
                      background: isSelectedRel ? 'rgba(244, 63, 94, 0.18)' : 'var(--glass-surface)',
                      border: isSelectedRel ? '1px solid rgba(244, 63, 94, 0.5)' : '1px solid var(--glass-border-color)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title="Haz clic para seleccionar o presiona el icono de papelera para eliminar la conexión"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: isSource ? 'var(--accent-primary)' : '#60a5fa', fontWeight: 800 }}>
                        {isSource ? '➔' : '⬅'}
                      </span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{otherName}</span>
                      {Boolean(rel.sourceMultiplicity || rel.targetMultiplicity) && (
                        <span style={{
                          fontSize: '0.62rem',
                          fontFamily: 'var(--font-mono)',
                          background: 'rgba(232, 195, 158, 0.16)',
                          color: '#e8c39e',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: 700
                        }}>
                          {isSource
                            ? `${rel.sourceMultiplicity || '1'} ➔ ${rel.targetMultiplicity || '*'}`
                            : `${rel.targetMultiplicity || '*'} ⬅ ${rel.sourceMultiplicity || '1'}`}
                        </span>
                      )}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.63rem' }}>
                        ({rel.label || rel.type.replace('ASSOCIATION_', '').replace('_', ':')}{assocCls ? ` · ${assocCls.name}` : ''})
                      </span>
                    </div>
                    {canEdit && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onDeleteRelation(rel.id);
                        }}
                        title={`Eliminar conexión con ${otherName}`}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#fb7185',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px'
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
});