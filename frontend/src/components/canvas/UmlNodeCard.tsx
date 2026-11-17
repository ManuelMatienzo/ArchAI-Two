import React, { useState, useMemo } from 'react';
import {
  Zap,
  Link2,
  Key,
  Check,
  X,
  Trash2,
  Edit2,
  Sparkles,
} from 'lucide-react';
import { ModeloDiagrama, ClaseUml, AtributoUml, MetodoUml, Visibilidad, TipoRelacion } from '../../types/uml';
import { UmlMemberEditor } from './UmlMemberEditor';
import './umlCanvas.css';
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

export interface UmlNodeCardProps {
  proposedDeletion?: boolean;
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
  // Medición de dimensiones reales del nodo
  nodeDimensionsRef: React.MutableRefObject<Map<string, { w: number; h: number }>>;
  setDimensionTick: React.Dispatch<React.SetStateAction<number>>;
  // ─── Handlers estables (useCallback en el padre) ───
  onMouseDown: (e: React.MouseEvent, cls: ClaseUml) => void;
  onStartEditingClass: (cls: ClaseUml, e: React.MouseEvent) => void;
  onSaveEditingClass: (classId: string, e?: React.FormEvent | React.MouseEvent) => void;
  onDeleteClass: (classId: string) => void;
  onDeleteAttribute: (classId: string, attrId: string) => void;
  onEditMember: (classId: string, kind: 'attribute' | 'method', memberId: string, changes: Partial<AtributoUml & MetodoUml>) => void;
  onDeleteMethod?: (classId: string, methodId: string) => void;
  onSaveAttribute: (e: React.FormEvent, classId: string) => void;
  onSaveMethod: (e: React.FormEvent, classId: string) => void;
  onAddAttributePreset: (classId: string, presetName: string, presetType: AtributoUml['type'], isPk?: boolean) => void;
  onAddAuditFields: (classId: string) => void;
  onFastLinkSubmit: (sourceClassId: string, srcMult?: string, tgtMult?: string) => void;
  onStartCanvasLinking: (classId: string, event?: React.MouseEvent<HTMLButtonElement>) => void;
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
  proposedDeletion=false,
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
  nodeDimensionsRef,
  setDimensionTick,
  onMouseDown,
  onStartEditingClass,
  onSaveEditingClass,
  onDeleteClass,
  onDeleteAttribute,
  onEditMember,
  onDeleteMethod,
  onSaveAttribute,
  onSaveMethod,
  onAddAttributePreset,
  onAddAuditFields,
  onStartCanvasLinking,
  onAutoCompletarClase,
  setEditingClassStereotype,
  setEditingClassName,
  setEditingClassId,
  setAddingAttrClassId,
  setAttrName,
  setAttrType,
  setAttrVis,
  setAttrIsPk,
  setAddingMethodClassId,
  setMethodName,
  setMethodReturnType,
  setMethodParams: _setMethodParams,
  setMethodVis
}) {
  const [editingMember, setEditingMember] = useState<{ kind: 'attribute' | 'method'; id: string } | null>(null);
  const member = editingMember ? (editingMember.kind === 'attribute' ? cls.attributes : cls.methods).find(item => item.id === editingMember.id) : undefined;
  const stereotype = cls.stereotype || 'Entity';
  const pos = cls.position || { x: 120, y: 120 };


  // Estado local para cardinalidades en el enlazador rápido
  const [_fastLinkSrcMult, _setFastLinkSrcMult] = useState<string>('1');
  const [_fastLinkTgtMult, _setFastLinkTgtMult] = useState<string>('0..*');
  // Madurez calculada internamente: solo se recalcula cuando cambian los props
  // reales de esta tarjeta (cls o diagrama), no en cada render del lienzo.
  const madurez = useMemo(
    () => calcularMadurezClase(cls, diagram.relations, diagram.classes),
    [cls, diagram.relations, diagram.classes]
  );

  return (
    <div
      key={cls.id}
      data-class-id={cls.id}
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
      className={`uml-class-node ${proposedDeletion?'proposal-delete-node':''} ${draft ? 'proposal-ghost-node' : ''} ${isSelected ? 'node-selected' : ''} ${isDragging ? 'dragging' : ''} ${isRemoteDragging ? 'remote-dragging' : ''}`}
      onMouseDown={e => onMouseDown(e, cls)}
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: '330px',
        borderRadius: '2px',
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
      {canEdit && !draft && ['top', 'right', 'bottom', 'left'].map(side => (
        <button key={side} type="button" className={`uml-connection-handle uml-connection-handle--${side}`}
          aria-label={`Crear relación desde ${cls.name}`} title="Arrastra hacia otra clase, o haz clic y elige el destino"
          onMouseDown={e => { if (e.button === 0) { e.preventDefault(); e.stopPropagation(); onStartCanvasLinking(cls.id, e); } }}
          onClick={e => { e.stopPropagation(); if (e.detail === 0) onStartCanvasLinking(cls.id); }} />
      ))}
      {editingMember && member && canEdit && <UmlMemberEditor key={`${editingMember.kind}-${editingMember.id}`} kind={editingMember.kind} member={member}
        onClose={() => setEditingMember(null)} onSave={changes => { onEditMember(cls.id, editingMember.kind, editingMember.id, changes); setEditingMember(null); }} />}
      {draft && <span className="proposal-ghost-label">Propuesta IA</span>}
      {proposedDeletion&&<span className="proposal-ghost-label proposal-delete-label">Eliminación pendiente de confirmar</span>}
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
      {/* ==================== COMPARTIMENTO 1: NOMBRE DE CLASE (UML 2.5+) ==================== */}
      <div
        className="uml-compartment-name"
        style={{
          background: 'var(--glass-node-header-bg)',
          padding: '8px 12px',
          borderBottom: '2px solid var(--glass-node-header-border)',
          borderTopLeftRadius: '1px',
          borderTopRightRadius: '1px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
          minHeight: '42px'
        }}
      >
        {/* Icono de estereotipo + nombre centrado */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: 0,
          flex: 1,
          overflow: 'hidden'
        }}>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              {/* Estereotipo entre guillemets UML 2.5 */}
              {stereotype !== 'Class' && <div style={{
                fontSize: '0.62rem',
                color: 'var(--glass-node-stereo-color)',
                fontWeight: 800,
                letterSpacing: '0.05em',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginBottom: '1px',
                textAlign: isSelected ? 'left' : 'center'
              }}>
                &laquo;{stereotype}&raquo;
              </div>}

              {/* Renombrado Inline de Clase */}
              {editingClassId === cls.id && canEdit ? (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}
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
                      fontSize: '0.64rem',
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
                      fontSize: '0.86rem',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      width: '110px'
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: isSelected ? 'flex-start' : 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                  <h3
                    onDoubleClick={e => { if (canEdit) onStartEditingClass(cls, e); }}
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: '0.92rem',
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
                  {canEdit && isSelected && (
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
                        flexShrink: 0,
                        marginLeft: '4px'
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
        </div>

        {/* Acciones de la cabecera: Enlazar y Eliminar */}
        <div style={{ display: isSelected ? 'flex' : 'none', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
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

      {/* ==================== COMPARTIMENTO 2: ATRIBUTOS (UML 2.5+) ==================== */}
      <div
        className="uml-compartment-attrs"
        style={{
          padding: '9px 12px',
          borderBottom: '2px solid var(--glass-node-attr-border)',
          background: 'var(--glass-node-bg)',
          minHeight: '34px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px'
        }}
      >
        {/* Encabezado de atributos solo si hay atributos o se puede editar */}
        {cls.attributes.length > 0 || canEdit ? (
          <div style={{
            display: isSelected ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '4px'
          }}>
            <span style={{
              fontSize: '0.64rem',
              color: 'var(--text-muted)',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              flexShrink: 0
            }}>
              {isSelected ? `Atributos (${cls.attributes.length})` : ''}
            </span>

            {canEdit && isSelected && (
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
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {cls.attributes.map(attr => (
            <div
              key={attr.id}
              onDoubleClick={e => { e.stopPropagation(); if (canEdit) setEditingMember({ kind: 'attribute', id: attr.id }); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.76rem',
                fontFamily: 'var(--font-mono)',
                padding: '2px 6px',
                borderRadius: '3px',
                background: 'transparent',
                border: '1px solid transparent',
                minHeight: '20px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                {/* Visibilidad UML 2.5: + - # ~ */}
                <span style={{
                  color: 'rgba(232, 195, 158, 0.85)',
                  fontWeight: 900,
                  flexShrink: 0,
                  minWidth: '14px',
                  textAlign: 'center'
                }}>
                  {attr.visibility}
                </span>
                <span style={{
                  color: 'var(--glass-node-attr-text)',
                  textDecoration: attr.isStatic ? 'underline' : undefined,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0
                }} title={attr.name}>
                  {attr.isDerived ? '/' : ''}{attr.name}
                </span>
                {attr.isPrimaryKey && (
                  <span title="Clave Primaria (PK)" style={{ flexShrink: 0, marginLeft: '4px' }}>
                    <Key size={10} color="#e8c39e" />
                  </span>
                )}
                {/* Separador de dos puntos UML */}
                <span style={{ color: 'var(--text-subtle)', flexShrink: 0, marginLeft: '4px' }}>:</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0, marginLeft: '2px' }}>{attr.type}{attr.multiplicity ? ` [${attr.multiplicity}]` : ''}{attr.defaultValue ? ` = ${attr.defaultValue}` : ''}{attr.isReadOnly ? ' {readOnly}' : ''}</span>
              </div>

              {canEdit && isSelected && <button type="button" title="Editar atributo" aria-label={`Editar atributo ${attr.name}`} onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setEditingMember({ kind: 'attribute', id: attr.id }); }} style={{ background: 'transparent', border: 0, color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}><Edit2 size={11} /></button>}
              {canEdit && isSelected && (
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
                    padding: '1px',
                    flexShrink: 0
                  }}
                  title={attr.isPrimaryKey ? "Eliminar clave primaria (PK)" : "Eliminar atributo"}
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}

          {/* Inline Add Attribute Form */}
          {addingAttrClassId === cls.id && (
            <form
              onSubmit={e => onSaveAttribute(e, cls.id)}
              style={{
                marginTop: '6px',
                padding: '8px',
                background: 'var(--glass-surface-hover)',
                borderRadius: '6px',
                border: '1px solid var(--glass-border-color)'
              }}
            >
              {/* Chips de campos comunes en 1 clic */}
              <div style={{ marginBottom: '6px' }}>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Zap size={9} color="var(--accent-primary)" /> Presets en 1 Clic:</div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
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
                        borderRadius: '3px',
                        padding: '2px 5px',
                        fontSize: '0.64rem',
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
                      borderRadius: '3px',
                      padding: '2px 5px',
                      fontSize: '0.64rem',
                      color: '#f5e1ce',
                      cursor: 'pointer',
                      fontWeight: 800
                    }}
                    title="Añadir creadoEn, actualizadoEn, creadoPor y activo"
                  >
                    + <Zap size={10} color="var(--accent-primary)" style={{ verticalAlign: '-1px' }} /> 4 Auditoría
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                <select
                  value={attrVis}
                  onChange={e => setAttrVis(e.target.value as Visibilidad)}
                  style={{
                    background: 'var(--glass-node-bg)',
                    border: '1px solid var(--glass-border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '3px',
                    padding: '3px 5px',
                    fontSize: '0.70rem',
                    minWidth: '70px'
                  }}
                >
                  <option value="-">- Privado</option>
                  <option value="+">+ Público</option>
                  <option value="#"># Protegido</option>
                  <option value="~">~ Paquete</option>
                </select>
                <input
                  type="text"
                  placeholder="nombreAtributo"
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
                    borderRadius: '3px',
                    padding: '3px 7px',
                    fontSize: '0.70rem',
                    fontFamily: 'var(--font-mono)'
                  }}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '3px' }}>
                <select
                  value={attrType}
                  onChange={e => setAttrType(e.target.value as any)}
                  style={{
                    flex: 1,
                    background: 'var(--glass-node-bg)',
                    border: '1px solid var(--glass-border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '3px',
                    padding: '3px 5px',
                    fontSize: '0.70rem',
                    minWidth: '90px'
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
                    borderRadius: '3px',
                    padding: '3px 9px',
                    fontSize: '0.70rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                >
                  <Check size={11} /> Guardar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ==================== COMPARTIMENTO 3: MÉTODOS / OPERACIONES (UML 2.5+) ==================== */}
      <div
        className="uml-compartment-methods"
        style={{
          padding: '9px 12px',
          background: 'var(--glass-node-method-bg)',
          borderBottomLeftRadius: '1px',
          borderBottomRightRadius: '1px',
          minHeight: '34px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}
      >
        <div style={{
          display: isSelected ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '4px'
        }}>
          <span style={{
            fontSize: '0.64rem',
            color: 'var(--text-muted)',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            flexShrink: 0
          }}>
            {isSelected ? `Operaciones (${cls.methods.length})` : ''}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {canEdit && isSelected && madurez.porcentaje < 100 && onAutoCompletarClase && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  onAutoCompletarClase(cls.id);
                }}
                style={{
                  background: '#2f2c79',
                  border: '1px solid #171a4a',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  color: '#f5e1ce',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  transition: 'all 0.15s ease'
                }}
                title={`Sugerir y autocompletar métodos de negocio con IA`}
              >
                <Zap size={9} />
                <span>+ Lógica IA</span>
              </button>
            )}

            {canEdit && isSelected && (
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
              onDoubleClick={e => { e.stopPropagation(); if (canEdit) setEditingMember({ kind: 'method', id: m.id }); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.74rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
                padding: '1px 4px',
                borderRadius: '2px',
                minHeight: '18px'
              }}
            >
              <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={`${m.name}(${m.parameters || ''}): ${m.returnType}`}>
                {/* Visibilidad UML 2.5 */}
                <span style={{
                  color: 'rgba(232, 195, 158, 0.85)',
                  fontWeight: 900,
                  flexShrink: 0,
                  minWidth: '14px',
                  textAlign: 'center',
                  marginRight: '4px'
                }}>
                  {m.visibility}
                </span>
                <span style={{ color: 'var(--glass-node-attr-text)', fontWeight: 600, textDecoration: m.isStatic ? 'underline' : undefined, fontStyle: m.isAbstract ? 'italic' : undefined }}>{m.name}({m.parameters || ''}): {m.returnType}{m.isQuery ? ' {query}' : ''}</span>
              </div>

              {canEdit && isSelected && <button type="button" title="Editar operación" aria-label={`Editar operación ${m.name}`} onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setEditingMember({ kind: 'method', id: m.id }); }} style={{ background: 'transparent', border: 0, color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}><Edit2 size={11} /></button>}
              {onDeleteMethod && canEdit && isSelected && (
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
                    padding: '1px',
                    flexShrink: 0
                  }}
                  title="Eliminar método"
                >
                  <X size={9} />
                </button>
              )}
            </div>
          ))}

          {/* Inline Add Method Form */}
          {addingMethodClassId === cls.id && (
            <form
              onSubmit={e => onSaveMethod(e, cls.id)}
              style={{
                marginTop: '6px',
                padding: '7px',
                background: 'var(--glass-surface-hover)',
                borderRadius: '5px',
                border: '1px solid var(--glass-border-color)'
              }}
            >
              <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                <select
                  value={methodVis}
                  onChange={e => setMethodVis(e.target.value as Visibilidad)}
                  style={{
                    background: 'var(--glass-node-bg)',
                    border: '1px solid var(--glass-border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '3px',
                    padding: '3px 5px',
                    fontSize: '0.70rem',
                    minWidth: '70px'
                  }}
                >
                  <option value="+">+ Público</option>
                  <option value="-">- Privado</option>
                  <option value="#"># Protegido</option>
                  <option value="~">~ Paquete</option>
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
                    borderRadius: '3px',
                    padding: '3px 7px',
                    fontSize: '0.70rem',
                    fontFamily: 'var(--font-mono)'
                  }}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '3px' }}>
                <input
                  type="text"
                  placeholder="TipoRetorno"
                  value={methodReturnType}
                  onChange={e => setMethodReturnType(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'var(--glass-node-bg)',
                    border: '1px solid var(--glass-border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '3px',
                    padding: '3px 7px',
                    fontSize: '0.70rem',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
                <input
                  type="text"
                  placeholder="Parámetros"
                  value={_methodParams}
                  onChange={e => _setMethodParams(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'var(--glass-node-bg)',
                    border: '1px solid var(--glass-border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '3px',
                    padding: '3px 7px',
                    fontSize: '0.70rem',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    background: 'var(--accent-primary)',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '3px',
                    padding: '3px 9px',
                    fontSize: '0.70rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                >
                  <Check size={11} /> Guardar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>


    </div>
  );
});
