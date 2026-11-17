import { useEffect, useState } from 'react';

import { isValidUmlMultiplicity } from './umlMultiplicity';

export function UmlMultiplicityInput({ value, label, onCommit }: { value: string; label: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setDraft(value); setInvalid(false); }, [value]);
  const commit = () => {
    const clean = draft.trim();
    if (!isValidUmlMultiplicity(clean)) { setInvalid(true); return; }
    setInvalid(false);
    if (clean !== value) onCommit(clean);
  };
  return <input aria-label={label} aria-invalid={invalid} title={invalid ? 'Usa un número, * o un intervalo como 0..1 o 2..*' : label}
    value={draft} onChange={e => { setDraft(e.target.value); setInvalid(false); }} onBlur={commit}
    onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } if (e.key === 'Escape') { setDraft(value); setInvalid(false); } }}
    style={{ width: 68, background: 'rgba(15,23,42,.75)', border: `1px solid ${invalid ? '#fb7185' : 'rgba(232,195,158,.35)'}`, color: '#e8c39e', borderRadius: 6, padding: '4px 6px', fontSize: '.74rem', fontFamily: 'monospace' }} />;
}
