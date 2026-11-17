import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AtributoUml, MetodoUml, Visibilidad } from '../../types/uml';

type Member = AtributoUml | MetodoUml;
interface Props {
  member: Member;
  kind: 'attribute' | 'method';
  onSave: (changes: Partial<AtributoUml & MetodoUml>) => void;
  onClose: () => void;
}

export function UmlMemberEditor({ member, kind, onSave, onClose }: Props) {
  const isAttribute = kind === 'attribute';
  const attr = member as AtributoUml;
  const method = member as MetodoUml;
  const [name, setName] = useState(member.name);
  const [type, setType] = useState(isAttribute ? attr.type : method.returnType);
  const [visibility, setVisibility] = useState<Visibilidad>(member.visibility);
  const [parameters, setParameters] = useState(method.parameters || '');
  const [isStatic, setStatic] = useState(!!member.isStatic);
  const [isAbstract, setAbstract] = useState(!!method.isAbstract);
  const [isDerived, setDerived] = useState(!!attr.isDerived);
  const [isReadOnly, setReadOnly] = useState(!!attr.isReadOnly);
  const [isQuery, setQuery] = useState(!!method.isQuery);
  const [multiplicity, setMultiplicity] = useState(attr.multiplicity || '');
  const [defaultValue, setDefaultValue] = useState(attr.defaultValue || '');
  const control: React.CSSProperties = { background: 'var(--glass-node-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border-color)', borderRadius: 6, padding: '8px', width: '100%', boxSizing: 'border-box' };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !type.trim()) return;
    const changes: Partial<AtributoUml & MetodoUml> = {};
    if (name.trim() !== member.name) changes.name = name.trim();
    if (visibility !== member.visibility) changes.visibility = visibility;
    if (isStatic !== !!member.isStatic) changes.isStatic = isStatic;
    if (isAttribute) {
      if (type.trim() !== attr.type) changes.type = type.trim();
      if (isDerived !== !!attr.isDerived) changes.isDerived = isDerived;
      if (isReadOnly !== !!attr.isReadOnly) changes.isReadOnly = isReadOnly;
      if (multiplicity !== (attr.multiplicity || '')) changes.multiplicity = multiplicity.trim();
      if (defaultValue !== (attr.defaultValue || '')) changes.defaultValue = defaultValue;
    } else {
      if (type.trim() !== method.returnType) changes.returnType = type.trim();
      if (parameters !== (method.parameters || '')) changes.parameters = parameters;
      if (isAbstract !== !!method.isAbstract) changes.isAbstract = isAbstract;
      if (isQuery !== !!method.isQuery) changes.isQuery = isQuery;
    }
    onSave(changes);
  };
  return createPortal(<div className="modal-backdrop" onMouseDown={onClose}
    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,20,.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <form role="dialog" aria-modal="true" aria-label={isAttribute ? 'Editar atributo' : 'Editar operación'}
      onMouseDown={e => e.stopPropagation()} onSubmit={save} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
      style={{ width: 'min(440px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--glass-modal-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-modal-border)', borderRadius: 12, padding: 20, boxShadow: '0 16px 50px rgba(0,0,0,.4)' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: '1rem' }}>{isAttribute ? 'Editar atributo' : 'Editar operación'}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label>Nombre<input style={control} value={name} onChange={e => setName(e.target.value)} autoFocus required /></label>
        <label>{isAttribute ? 'Tipo' : 'Tipo de retorno'}<input style={control} value={type} onChange={e => setType(e.target.value)} required /></label>
        <label>Visibilidad<select style={control} value={visibility} onChange={e => setVisibility(e.target.value as Visibilidad)}>
          <option value="+">+ Público</option><option value="-">- Privado</option><option value="#"># Protegido</option><option value="~">~ Paquete</option>
        </select></label>
        {isAttribute ? <label>Multiplicidad<input style={control} value={multiplicity} onChange={e => setMultiplicity(e.target.value)} placeholder="0..1" /></label>
          : <label>Parámetros<input style={control} value={parameters} onChange={e => setParameters(e.target.value)} placeholder="nombre: Tipo" /></label>}
        {isAttribute && <label style={{ gridColumn: '1 / -1' }}>Valor predeterminado<input style={control} value={defaultValue} onChange={e => setDefaultValue(e.target.value)} /></label>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 16 }}>
        <label><input type="checkbox" checked={isStatic} onChange={e => setStatic(e.target.checked)} /> Estático</label>
        {isAttribute ? <><label><input type="checkbox" checked={isDerived} onChange={e => setDerived(e.target.checked)} /> Derivado</label><label><input type="checkbox" checked={isReadOnly} onChange={e => setReadOnly(e.target.checked)} /> Solo lectura</label></>
          : <><label><input type="checkbox" checked={isAbstract} onChange={e => setAbstract(e.target.checked)} /> Abstracto</label><label><input type="checkbox" checked={isQuery} onChange={e => setQuery(e.target.checked)} /> Consulta</label></>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
        <button type="button" onClick={onClose} className="btn-studio-glass">Cancelar</button>
        <button type="submit" className="btn-studio-primary">Guardar</button>
      </div>
    </form></div>, document.body);
}
