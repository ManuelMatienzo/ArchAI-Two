import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, Pencil, X, MessageSquare, AlertCircle } from 'lucide-react';
import { ProposalReview } from './useProposalReview';
import { DraftDiagram } from '../../services/proposalDraft';
import { GlassModal } from '../glass/GlassModal';
import { ChatMarkdown } from './ChatMarkdown';

export function ProposalToolbar({ review: r, onInspect }: { review: ProposalReview; onInspect: () => void }) {
  if (!r.active) return null;
  return (
    <>
      <div className="proposal-toolbar" aria-label="Moderación de propuesta IA">
        <span>
          <strong>Propuesta IA</strong>
          <small>
            {r.active.diagram.classes.length} clases · {r.active.diagram.relations.length} relaciones
            {r.active.diagram.deletions?.length
              ? ` · ${r.active.diagram.deletions.length} eliminaciones`
              : ''}{' '}
            pendientes
          </small>
        </span>
        <button className="btn-studio-glass" onClick={() => r.setHidden(!r.hidden)}>
          {r.hidden ? <Eye size={14} /> : <EyeOff size={14} />} {r.hidden ? 'Mostrar' : 'Ocultar'}
        </button>
        <button className="btn-studio-glass" onClick={onInspect}>
          <Pencil size={14} /> Revisar
        </button>
        {r.error && (
          <small className="proposal-review-error" role="alert">
            {r.error}
          </small>
        )}
        {r.canModerate && (
          <button
            className="btn-studio-primary"
            disabled={r.busy || r.editorOpen || !r.selected.length}
            onClick={() => void r.approve()}
          >
            <Check size={14} />{' '}
            {r.busy
              ? 'Procesando…'
              : r.active.diagram.deletions?.some((d) => r.selected.includes(d.id))
                ? 'Revisar eliminaciones'
                : 'Aprobar selección'}
          </button>
        )}
      </div>
      {r.confirmingDelete && (
        <GlassModal
          title="Confirmar eliminaciones"
          onClose={() => r.setConfirmingDelete(false)}
          maxWidth="480px"
          footer={
            <>
              <button className="btn-studio-glass" onClick={() => r.setConfirmingDelete(false)}>
                Cancelar
              </button>
              <button
                className="btn-studio-primary"
                disabled={r.busy}
                onClick={() => void r.confirmApprove()}
              >
                Confirmar y aprobar selección
              </button>
            </>
          }
        >
          <p>Estos cambios se aplicarán al diagrama compartido:</p>
          <ul>
            {r.active.diagram.deletions
              ?.filter((d) => r.selected.includes(d.id))
              .map((d) => (
                <li key={d.id}>
                  Eliminar <strong>{d.label}</strong>
                  {d.affectedRelationIds.length
                    ? ` y ${d.affectedRelationIds.length} relaciones afectadas`
                    : ''}
                  .
                </li>
              ))}
          </ul>
          <p>El equipo recibirá la actualización. Se conservará una versión anterior.</p>
        </GlassModal>
      )}
    </>
  );
}

export function ProposalReviewEditor({
  review: r,
  onFeedback,
}: {
  review: ProposalReview;
  onFeedback: (prompt: string, parent: string, context: DraftDiagram) => boolean;
}) {
  const [editing, setEditing] = useState<DraftDiagram | null>(null);
  const [revision, setRevision] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [notice, setNotice] = useState('');
  const [retryFeedback, setRetryFeedback] = useState<{
    prompt: string;
    parent: string;
    context: DraftDiagram;
  } | null>(null);
  const p = r.active;
  useEffect(() => {
    r.setEditorOpen(!!editing);
    return () => r.setEditorOpen(false);
  }, [!!editing, r.setEditorOpen]);
  useEffect(() => {
    setEditing(null);
    setFeedback('');
    setShowFeedback(false);
    setNotice('');
  }, [p?.id]);
  const toggle = (id: string) =>
    r.setSelected(r.selected.includes(id) ? r.selected.filter((x) => x !== id) : [...r.selected, id]);
  const begin = () => {
    if (p) {
      setEditing(structuredClone(p.diagram));
      setRevision(p.reviewRevision);
      setNotice('');
    }
  };
  const save = async () => {
    if (!editing) return;
    const result = await r.mutate('edit', { diagram: editing, expectedRevision: revision });
    if (result) setEditing(null);
  };
  const rejectFeedback = async () => {
    if (!p || !feedback.trim()) return;
    const text = feedback.trim();
    const next = await r.reject(text);
    if (next) {
      const prompt = `Corrección para ArchAI: ${text}`;
      if (onFeedback(prompt, p.id, p.diagram)) {
        setNotice('Corrección enviada a ArchAI.');
        setFeedback('');
      } else {
        setRetryFeedback({ prompt, parent: p.id, context: p.diagram });
        setNotice('El feedback se conservó. Reenvíalo cuando termine la consulta en curso.');
      }
    }
  };
  const message = r.error || notice;
  if (!p && !message) return null;
  return (
    <section className="proposal-review" aria-label="Revisión de propuesta">
      {message && (
        <div className="proposal-review-error" role="alert">
          <AlertCircle size={14} />
          <span>{message}</span>
          {r.hasPendingOperation && (
            <button className="btn-studio-glass" onClick={() => void r.retry()} disabled={r.busy}>
              Recuperar operación
            </button>
          )}
        </div>
      )}
      {retryFeedback && (
        <button
          className="btn-studio-glass"
          onClick={() => {
            if (onFeedback(retryFeedback.prompt, retryFeedback.parent, retryFeedback.context)) {
              setRetryFeedback(null);
              setNotice('Corrección enviada a ArchAI.');
            }
          }}
        >
          Reintentar corrección
        </button>
      )}
      {p && (
        <>
          <h4>
            Revisar propuesta {p.moderationStatus === 'partial' && <small>Parcialmente aprobada</small>}
          </h4>
          <ChatMarkdown text={p.explanation || ''} />
          {p.conflict && (
            <p className="proposal-review-error" role="alert">
              {p.conflict} Usa Editar para resolverlo.
            </p>
          )}
          <small>Selecciona lo que quieres incorporar. El resto seguirá pendiente.</small>
          {!editing && (
            <div className="proposal-selection">
              {p.diagram.classes.map((c) => (
                <label key={c.id} className={r.inspected === c.id ? 'is-inspected' : ''}>
                  <input
                    type="checkbox"
                    checked={r.selected.includes(c.id)}
                    onChange={() => toggle(c.id)}
                    disabled={!r.canModerate || r.busy}
                  />
                  <span>
                    <b>{c.name}</b>
                    <small>
                      {c.targetClassId ? 'Modificar clase existente' : 'Nueva clase'} · {c.attributes.length}{' '}
                      atributos · {c.methods.length} métodos
                    </small>
                  </span>
                </label>
              ))}
              {p.diagram.relations.map((rel) => (
                <label key={rel.id}>
                  <input
                    type="checkbox"
                    checked={r.selected.includes(rel.id)}
                    onChange={() => toggle(rel.id)}
                    disabled={!r.canModerate || r.busy}
                  />
                  <span>
                    {[rel.sourceClassId, rel.targetClassId]
                      .map(
                        (id) =>
                          p.diagram.classes.find((c) => c.id === id)?.name ||
                          r.snapshot?.official.classes.find((c) => c.id === id)?.name ||
                          'Clase'
                      )
                      .join(' → ')}
                    <small>
                      {rel.type} · {rel.sourceMultiplicity} : {rel.targetMultiplicity}
                    </small>
                  </span>
                </label>
              ))}
              {p.diagram.deletions?.map((d) => (
                <label key={d.id} className="chat-deletion">
                  <input
                    type="checkbox"
                    checked={r.selected.includes(d.id)}
                    onChange={() => toggle(d.id)}
                    disabled={!r.canModerate || r.busy}
                  />
                  <span>
                    Eliminar <b>{d.label}</b>
                    <small>
                      {
                        { class: 'Clase', attribute: 'Atributo', method: 'Método', relation: 'Relación' }[
                          d.kind
                        ]
                      }{' '}
                      · {d.affectedRelationIds.length} relaciones afectadas · requiere confirmación
                    </small>
                  </span>
                </label>
              ))}
            </div>
          )}
          {editing && (
            <div className="proposal-draft-editor">
              {editing.classes.map((c, i) => (
                <fieldset key={c.id}>
                  <legend>{c.name}</legend>
                  <label>
                    Acción sobre el modelo
                    <select
                      value={c.targetClassId || ''}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          classes: editing.classes.map((x, j) =>
                            j === i ? { ...x, targetClassId: e.target.value || undefined } : x
                          ),
                        })
                      }
                    >
                      <option value="">Crear clase nueva</option>
                      {r.snapshot?.official.classes.map((x) => (
                        <option key={x.id} value={x.id}>
                          Actualizar {x.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Nombre de clase
                    <input
                      className="glass-textfield"
                      value={c.name}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          classes: editing.classes.map((x, j) =>
                            j === i ? { ...x, name: e.target.value } : x
                          ),
                        })
                      }
                    />
                  </label>
                  {(['attributes', 'methods'] as const).map((kind) => (
                    <div key={kind}>
                      <b>{kind === 'attributes' ? 'Atributos' : 'Métodos'}</b>
                      {c[kind].map((member, mi) => (
                        <div className="proposal-member-editor" key={member.id}>
                          <select
                            aria-label="Visibilidad"
                            value={member.visibility}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                classes: editing.classes.map((x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        [kind]: x[kind].map((m, k) =>
                                          k === mi ? { ...m, visibility: e.target.value } : m
                                        ),
                                      }
                                    : x
                                ),
                              })
                            }
                          >
                            {['+', '-', '#', '~'].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                          <input
                            className="glass-textfield"
                            aria-label="Nombre del miembro"
                            value={member.name}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                classes: editing.classes.map((x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        [kind]: x[kind].map((m, k) =>
                                          k === mi ? { ...m, name: e.target.value } : m
                                        ),
                                      }
                                    : x
                                ),
                              })
                            }
                          />
                          <input
                            className="glass-textfield"
                            aria-label="Tipo del miembro"
                            value={'type' in member ? member.type : member.returnType}
                            onChange={(e) =>
                              setEditing({
                                ...editing,
                                classes: editing.classes.map((x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        [kind]: x[kind].map((m, k) =>
                                          k === mi
                                            ? {
                                                ...m,
                                                [kind === 'attributes' ? 'type' : 'returnType']:
                                                  e.target.value,
                                              }
                                            : m
                                        ),
                                      }
                                    : x
                                ),
                              })
                            }
                          />
                          {kind === 'methods' && (
                            <input
                              className="glass-textfield proposal-method-params"
                              aria-label="Parámetros del método"
                              value={'parameters' in member ? String(member.parameters || '') : ''}
                              placeholder="id: Long, fecha: LocalDate"
                              onChange={(e) =>
                                setEditing({
                                  ...editing,
                                  classes: editing.classes.map((x, j) =>
                                    j === i
                                      ? {
                                          ...x,
                                          methods: x.methods.map((m, k) =>
                                            k === mi ? { ...m, parameters: e.target.value } : m
                                          ),
                                        }
                                      : x
                                  ),
                                })
                              }
                            />
                          )}
                        </div>
                      ))}
                      <button
                        className="btn-studio-glass"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            classes: editing.classes.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    [kind]: [
                                      ...x[kind],
                                      {
                                        id: `draft-${crypto.randomUUID()}`,
                                        name: kind === 'attributes' ? 'nuevoAtributo' : 'nuevoMetodo',
                                        visibility: '+',
                                        ...(kind === 'attributes'
                                          ? { type: 'String' }
                                          : { returnType: 'void', parameters: '' }),
                                      },
                                    ],
                                  }
                                : x
                            ),
                          })
                        }
                      >
                        + {kind === 'attributes' ? 'Atributo' : 'Método'}
                      </button>
                    </div>
                  ))}
                </fieldset>
              ))}
              {editing.relations.map((rel, i) => (
                <fieldset key={rel.id}>
                  <legend>Relación {i + 1}</legend>
                  {(['sourceClassId', 'targetClassId'] as const).map((end) => (
                    <label key={end}>
                      {end === 'sourceClassId' ? 'Origen' : 'Destino'}
                      <select
                        value={rel[end]}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            relations: editing.relations.map((r, j) =>
                              j === i ? { ...r, [end]: e.target.value } : r
                            ),
                          })
                        }
                      >
                        {[...editing.classes, ...(r.snapshot?.official.classes || [])].map((c) => (
                          <option value={c.id} key={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <label>
                    Tipo
                    <select
                      value={rel.type}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          relations: editing.relations.map((r, j) =>
                            j === i ? { ...r, type: e.target.value as typeof r.type } : r
                          ),
                        })
                      }
                    >
                      {[
                        'ASSOCIATION_1_1',
                        'ASSOCIATION_1_N',
                        'ASSOCIATION_N_M',
                        'ASSOCIATION_BINARY',
                        'NON_NAVIGABLE',
                        'COMPOSITION',
                        'AGGREGATION',
                        'INHERITANCE',
                        'REALIZATION',
                        'DEPENDENCY',
                        'USAGE',
                        'PACKAGE_IMPORT',
                        'ASSOCIATION_CLASS',
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <div className="proposal-member-editor">
                    {(['sourceMultiplicity', 'targetMultiplicity'] as const).map((end) => (
                      <input
                        key={end}
                        aria-label={
                          end === 'sourceMultiplicity' ? 'Multiplicidad origen' : 'Multiplicidad destino'
                        }
                        className="glass-textfield"
                        value={rel[end]}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            relations: editing.relations.map((r, j) =>
                              j === i ? { ...r, [end]: e.target.value } : r
                            ),
                          })
                        }
                      />
                    ))}
                  </div>
                </fieldset>
              ))}
              <div className="proposal-review-actions">
                <button className="btn-studio-primary" disabled={r.busy} onClick={() => void save()}>
                  Guardar borrador
                </button>
                <button className="btn-studio-glass" onClick={() => setEditing(null)}>
                  Cancelar edición
                </button>
              </div>
            </div>
          )}
          {r.canModerate && !editing && (
            <>
              <div className="proposal-review-actions">
                <button
                  className="btn-studio-primary"
                  disabled={r.busy || !r.selected.length}
                  onClick={() => void r.approve()}
                >
                  <Check size={13} />{' '}
                  {p.diagram.deletions?.some((d) => r.selected.includes(d.id))
                    ? 'Revisar eliminaciones'
                    : 'Aprobar selección'}
                </button>
                <button className="btn-studio-glass" disabled={r.busy} onClick={begin}>
                  <Pencil size={13} /> Editar
                </button>
              </div>
              <div className="proposal-review-actions">
                <button className="btn-studio-glass" disabled={r.busy} onClick={() => void r.reject()}>
                  <X size={13} /> Rechazar pendientes
                </button>
                <button
                  className="btn-studio-glass"
                  disabled={r.busy}
                  onClick={() => setShowFeedback(!showFeedback)}
                >
                  <MessageSquare size={13} /> Con feedback
                </button>
              </div>
              <button className="btn-studio-glass" disabled={r.busy} onClick={() => void r.mutate('rebase')}>
                Validar contra el modelo actual
              </button>
            </>
          )}
          {!r.canModerate && <small>Tu acceso permite inspeccionar la propuesta.</small>}
          {showFeedback && (
            <div className="proposal-feedback">
              <label>
                Corrección para ArchAI
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Explica qué debería cambiar…"
                />
              </label>
              <small>
                Se consultará nuevamente al motor seleccionado en Preferencias. El modo Nube puede consumir
                cuota.
              </small>
              <button
                className="btn-studio-primary"
                disabled={r.busy || !feedback.trim()}
                onClick={() => void rejectFeedback()}
              >
                Rechazar y pedir corrección
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
