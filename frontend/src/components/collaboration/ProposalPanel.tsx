import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Send,
  X,
  ChevronRight,
  MessageSquare,
  Mic,
  Square,
} from 'lucide-react';
import { ApiError, apiFetch } from '../../services/api';
import { InformacionSesion } from '../../types/auth';
import { ModeloDiagrama } from '../../types/uml';
import { Proposal, CloudOptions } from '../../services/proposalAgent';
import { DraftDiagram } from '../../services/proposalDraft';
import {
  Checkpoint,
  RoomMessage,
  RoomSettings,
  mentionsArchAI,
  mergeMessages,
  postRoomMessage,
  roomPath,
  roomQuery,
} from '../../services/roomChat';
import { readSessionCache, writeSessionCache } from '../../services/sessionCache';
import { ProposalReview } from './useProposalReview';
import { ProposalReviewEditor } from './ProposalReviewEditor';
import { ChatMarkdown } from './ChatMarkdown';
import './ProposalPanel.css';

const defaultSettings: RoomSettings = {
  mode: 'cloud',
  model: 'qwen3.5:4b',
  observing: false,
  canConfigure: false,
  cloud: {
    available: false,
    claudeAvailable: false,
    fallbackEnabled: false,
    testControls: false,
    geminiModel: '',
    claudeModel: '',
  },
};
const friendly = (e: unknown) =>
  e instanceof ApiError && e.status === 0
    ? 'Se interrumpió la conexión. Tu mensaje se conserva para reintentar.'
    : e instanceof Error
      ? e.message
      : 'No se pudo completar la operación. Intenta nuevamente.';
export function useProposals(
  session: InformacionSesion,
  diagram: ModeloDiagrama,
  connected: boolean,
  _publish: (type: string, data: unknown) => void,
  _instance: string,
  diagramId?: string
) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [settings, setSettings] = useState<RoomSettings>(defaultSettings);
  const [open, setOpen] = useState(false),
    [unread, setUnread] = useState(0),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Proposal | null>(null),
    [participants, setParticipants] = useState(session.participants);
  const [localModels, setLocalModels] = useState<string[]>([]),
    [checkingModel, setCheckingModel] = useState(false),
    [modelError, setModelError] = useState('');
  const [cloudOptions, setCloudOptions] = useState<CloudOptions>({});
  const [persistence, setPersistence] = useState<{
    configured: boolean;
    connected: boolean;
    pending: number;
  } | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [sessionNotice, setSessionNotice] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [historyNotice, setHistoryNotice] = useState('');
  const current = useRef({ session, diagram, diagramId, connected, open, messages, settings });
  current.current = { session, diagram, diagramId, connected, open, messages, settings };
  const generation = useRef(0),
    flushing = useRef(false);
  const cacheKey = `${session.currentUser.id}/${session.roomId}/${diagramId || 'unsaved'}`;
  const path = (suffix: string) => {
    const c = current.current;
    if (!c.diagramId)
      throw new Error('Guarda primero el diagrama del proyecto para iniciar su conversación compartida.');
    return `${roomPath(c.session.roomId, c.diagramId)}${suffix}${roomQuery(c.diagramId)}`;
  };
  const upsert = (incoming: RoomMessage[]) => {
    const c = current.current;
    const matching = incoming.filter(
      (m) => m.roomId === c.session.roomId && m.diagramId === (c.diagramId || '')
    );
    if (!matching.length) return;
    const key = `${c.session.currentUser.id}/${c.session.roomId}/${c.diagramId || 'unsaved'}`;
    setMessages((old) => {
      const next = mergeMessages(old, matching);
      void writeSessionCache(key, { messages: next, diagram: c.diagram });
      return next;
    });
  };
  const applySettings = (value: Partial<RoomSettings>) => {
    setSettings((old) => ({ ...old, ...value, cloud: value.cloud || old.cloud }));
    const c = current.current;
    localStorage.setItem(
      `archai_ai_settings_${c.session.roomId}`,
      JSON.stringify({ mode: value.mode || c.settings.mode, model: value.model || c.settings.model })
    );
  };
  const refresh = async () => {
    const version = generation.current;
    if (!current.current.diagramId) return;
    try {
      const data = await apiFetch<{
        messages: RoomMessage[];
        settings: RoomSettings;
        persistence: typeof persistence;
        participants: typeof participants;
      }>(path('/sesion'));
      if (version !== generation.current) return;
      upsert(data.messages);
      applySettings(data.settings);
      setPersistence(data.persistence);
      setParticipants(data.participants);
      setError('');
    } catch (e) {
      if (version === generation.current) setError(friendly(e));
    }
  };
  useEffect(() => {
    const version = ++generation.current;
    setMessages([]);
    setSettings(defaultSettings);
    setCheckpoints([]);
    setSessionNotice('');
    setSettingsError('');
    setHistoryNotice('');
    setNotice(null);
    setUnread(0);
    setError('');
    void readSessionCache<{ messages: RoomMessage[] }>(cacheKey).then((c) => {
      if (c && version === generation.current)
        setMessages((old) =>
          mergeMessages(
            c.messages.filter((m) => m.roomId === session.roomId && m.diagramId === (diagramId || '')),
            old
          )
        );
    });
    return () => {
      generation.current++;
    };
  }, [cacheKey]);
  useEffect(() => {
    if (connected && diagramId) {
      setLoading(true);
      void refresh().finally(() => setLoading(false));
      const timer = setInterval(() => void refresh(), 15000);
      return () => clearInterval(timer);
    }
  }, [connected, diagramId, session.roomId]);
  useEffect(() => {
    if (open) {
      setUnread(0);
      setNotice(null);
    }
  }, [open]);
  const send = async (text: string, id: string = crypto.randomUUID()) => {
    const c = current.current,
      version = generation.current;
    if (!text.trim()) return;
    const optimistic: RoomMessage = {
      id,
      roomId: c.session.roomId,
      diagramId: c.diagramId || '',
      sequence: Date.now(),
      createdAt: new Date().toISOString(),
      role: 'human',
      authorId: c.session.currentUser.id,
      authorName: c.session.currentUser.name,
      text: text.trim(),
      status: c.connected ? 'sending' : 'offline',
    };
    upsert([optimistic]);
    setError('');
    if (!c.connected) {
      setError(
        mentionsArchAI(text)
          ? 'Tu consulta se conservó. Pulsa Reintentar cuando vuelvas a conectar para autorizar su envío.'
          : 'Sin conexión. El mensaje se enviará cuando vuelva la conexión.'
      );
      return;
    }
    try {
      const response = await postRoomMessage(c.session.roomId, c.diagramId || '', {
        id,
        text: text.trim(),
        ...(import.meta.env.DEV && c.settings.cloud.testControls ? { options: cloudOptions } : {}),
      });
      if (version === generation.current) upsert([response]);
    } catch (e) {
      if (version !== generation.current) return;
      upsert([{ ...optimistic, status: e instanceof ApiError && e.status === 0 ? 'offline' : 'failed' }]);
      setError(friendly(e));
    }
  };
  // Ordinary human messages may reconnect automatically; paid AI requests require an explicit resend.
  useEffect(() => {
    if (!connected || !diagramId || flushing.current) return;
    const queued = messages.filter(
      (m) =>
        m.status === 'offline' &&
        m.role === 'human' &&
        m.authorId === session.currentUser.id &&
        !mentionsArchAI(m.text)
    );
    if (!queued.length) return;
    flushing.current = true;
    void (async () => {
      for (const m of queued) {
        if (current.current.session.roomId !== session.roomId || current.current.diagramId !== diagramId)
          break;
        await send(m.text, m.id);
      }
    })().finally(() => {
      flushing.current = false;
    });
  }, [connected, diagramId, messages.filter((m) => m.status === 'offline').length]);
  const request = (prompt: string, _automatic = false, _parentId?: string, context?: DraftDiagram) => {
    const text = `@ArchAI ${prompt.replace(/^\s*@archai\s*/i, '')}${context ? `\nBorrador pendiente que debe corregirse, conservando lo aprobado: ${JSON.stringify(context)}` : ''}`;
    void send(text);
    return true;
  };
  const receive = (event: { tipo: string; payload: any }) => {
    if (event.tipo === 'chat_message' && event.payload?.roomId === current.current.session.roomId) {
      const m = event.payload as RoomMessage;
      upsert([m]);
      if (
        !current.current.open &&
        m.authorId !== current.current.session.currentUser.id &&
        m.status === 'sent'
      ) {
        setUnread((n) => n + 1);
        if (m.proposal) setNotice(m.proposal);
      }
    }
    if (event.tipo === 'chat_settings') applySettings(event.payload);
    if ((event.tipo === 'join' || event.tipo === 'leave') && Array.isArray(event.payload?.participantes))
      setParticipants(event.payload.participantes);
  };
  const configure = async (value: Partial<Pick<RoomSettings, 'mode' | 'model' | 'observing'>>) => {
    try {
      setSettingsError('');
      applySettings(
        await apiFetch<RoomSettings>(path('/configuracion'), {
          method: 'PUT',
          body: JSON.stringify({ ...current.current.settings, ...value }),
        })
      );
    } catch (e) {
      setSettingsError(friendly(e));
    }
  };
  const checkModel = async () => {
    setCheckingModel(true);
    setModelError('');
    try {
      const list = await apiFetch<string[]>(path('/modelos-locales'));
      setLocalModels(list);
      if (!list.length) setModelError('No se encontraron modelos locales.');
    } catch (e) {
      setModelError(friendly(e));
    } finally {
      setCheckingModel(false);
    }
  };
  const loadOlder = async () => {
    try {
      const first = current.current.messages[0];
      if (!first) return;
      const older = await apiFetch<RoomMessage[]>(`${path('/mensajes')}&before=${first.sequence}&limit=100`);
      upsert(older);
      setHistoryNotice(older.length ? '' : 'Has llegado al inicio de la conversación.');
    } catch (e) {
      setError(friendly(e));
    }
  };
  /**
   * Contexto del diagrama: conserva el chat del equipo, las respuestas de la IA y las
   * propuestas ya resueltas para restaurarlos al volver a abrir el diagrama.
   */
  const exportarContexto = () => {
    const c = current.current;
    const historicos: RoomMessage[] = c.messages
      .filter((m) => m.status !== 'skipped' && (m.text?.trim() || m.proposal))
      .map((m) => ({
        ...m,
        diagramId: c.diagramId || m.diagramId,
        status: 'sent',
        historico: true,
        proposal: m.proposal
          ? { ...m.proposal, diagram: undefined, baseDiagram: undefined }
          : undefined,
        resumenPropuesta: m.proposal?.diagram
          ? {
              clases: m.proposal.diagram.classes?.length || 0,
              relaciones: m.proposal.diagram.relations?.length || 0,
              eliminaciones: m.proposal.diagram.deletions?.length || 0,
            }
          : m.resumenPropuesta,
      }));
    let recorte = historicos;
    const construir = () => ({
      version: 1,
      roomId: c.session.roomId,
      diagramId: c.diagramId || '',
      diagramUpdatedAt: c.diagram?.updatedAt,
      settings: {
        mode: c.settings.mode,
        model: c.settings.model,
        observing: c.settings.observing,
      },
      messages: recorte,
    });
    let contexto = construir();
    while (recorte.length > 1 && JSON.stringify(contexto).length > 900_000) {
      recorte = recorte.slice(1);
      contexto = construir();
    }
    return contexto;
  };
  const importarContexto = (contexto: { messages?: RoomMessage[] } | undefined | null) => {
    if (!contexto?.messages?.length) return;
    const c = current.current;
    const restaurados = contexto.messages
      .filter((m) => m && typeof m.id === 'string' && typeof m.text === 'string')
      .map((m) => ({
        ...m,
        roomId: c.session.roomId,
        diagramId: c.diagramId || m.diagramId || '',
        status: 'sent' as const,
        historico: true,
        proposal: m.proposal
          ? { ...m.proposal, diagram: undefined, baseDiagram: undefined }
          : undefined,
      }));
    if (!restaurados.length) return;
    setMessages((old) => mergeMessages(restaurados, old));
  };
  const loadCheckpoints = async () => {
    try {
      setSettingsError('');
      setCheckpoints(await apiFetch<Checkpoint[]>(path('/sesion/puntos-control')));
    } catch (e) {
      setSettingsError(friendly(e));
    }
  };
  const saveSession = async () => {
    try {
      setSettingsError('');
      setSessionNotice('');
      await apiFetch(path('/sesion/guardar'), {
        method: 'POST',
        body: JSON.stringify({ official: current.current.diagram }),
      });
      setSessionNotice('Punto de control guardado.');
      await loadCheckpoints();
      await refresh();
    } catch (e) {
      setSettingsError(friendly(e));
    }
  };
  const restore = async (
    action: 'undo' | 'redo' | 'restore',
    expectedRevision: number,
    checkpointId?: string
  ) => {
    const reportError = action === 'restore' ? setSettingsError : setError;
    try {
      reportError('');
      const next = await apiFetch<any>(path('/sesion/restaurar'), {
        method: 'POST',
        body: JSON.stringify({ action, checkpointId, expectedRevision, operationId: crypto.randomUUID() }),
      });
      if (action === 'restore') setSessionNotice('Punto de control restaurado.');
      await refresh();
      return next;
    } catch (e) {
      reportError(friendly(e));
      return undefined;
    }
  };
  const cancel = async (id: string) => {
    try {
      await apiFetch(path(`/mensajes/${encodeURIComponent(id)}`), { method: 'DELETE' });
      await refresh();
    } catch (e) {
      setError(friendly(e));
    }
  };
  const retry = (m: RoomMessage) => {
    if (m.role === 'human') void send(m.text, m.id);
    else {
      const original = current.current.messages.find((x) => x.id === m.replyTo);
      if (original) void send(original.text);
    }
  };
  const items = messages.filter((m) => m.proposal).map((m) => m.proposal!);
  return {
    messages,
    items,
    settings,
    open,
    setOpen,
    notice,
    setNotice,
    unread,
    error,
    receive,
    request,
    send,
    configure,
    refresh,
    loading,
    participants,
    localModels,
    checkingModel,
    modelError,
    checkModel,
    cloudOptions,
    setCloudOptions,
    persistence,
    checkpoints,
    loadCheckpoints,
    saveSession,
    restore,
    sessionNotice,
    settingsError,
    historyNotice,
    loadOlder,
    cancel,
    retry,
    exportarContexto,
    importarContexto,
    currentUserId: session.currentUser.id,
  };
}

export function ProposalPanel({
  state,
  host: _host,
  review,
}: {
  state: ReturnType<typeof useProposals>;
  host: boolean;
  review: ProposalReview;
}) {
  const [text, setText] = useState(''),
    [reviewMode, setReviewMode] = useState(false);
  const [listening, setListening] = useState(false),
    [voiceError, setVoiceError] = useState('');
  const recognition = useRef<{ stop: () => void } | null>(null);
  const dictate = () => {
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }
    const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Speech) {
      setVoiceError('Este navegador no admite dictado. Puedes escribir la consulta.');
      return;
    }
    const engine = new Speech();
    engine.lang = 'es-ES';
    engine.continuous = false;
    engine.interimResults = false;
    engine.onresult = (event: any) => {
      const spoken = event.results[0][0].transcript;
      setText((old) => (old ? `${old} ${spoken}` : `@ArchAI ${spoken}`));
    };
    engine.onend = () => setListening(false);
    engine.onerror = () => {
      setListening(false);
      setVoiceError('No se pudo completar el dictado. Revisa el permiso del micrófono.');
    };
    recognition.current = engine;
    setVoiceError('');
    try {
      engine.start();
      setListening(true);
    } catch {
      setListening(false);
      setVoiceError('No se pudo iniciar el dictado.');
    }
  };
  useEffect(() => {
    if (!state.open) {
      recognition.current?.stop();
      setListening(false);
    }
    return () => recognition.current?.stop();
  }, [state.open]);
  const last = useRef<HTMLDivElement>(null),
    conversation = useRef<HTMLDivElement>(null),
    stick = useRef(true);
  useEffect(() => {
    if (review.active) setReviewMode(true);
  }, [review.active?.id]);
  useEffect(() => {
    if (state.open && stick.current) last.current?.scrollIntoView({ block: 'nearest' });
  }, [state.messages, state.open, reviewMode]);
  const visible = state.messages.filter((m) => m.status !== 'skipped');
  const archived =
    review.snapshot?.proposals.filter((p) => !state.messages.some((m) => m.proposalId === p.id)) || [];
  const submit = () => {
    if (!text.trim()) return;
    void state.send(text);
    setText('');
    stick.current = true;
  };
  return (
    <>
      {state.open && (
        <aside
          className={`proposal-panel room-chat-panel${review.active ? ' has-active-proposal' : ''}${reviewMode && review.active ? ' is-reviewing' : ''}`}
          aria-label="Chat del equipo"
        >
          <header className="proposal-header">
            <div className="proposal-avatar">
              <MessageSquare size={18} />
            </div>
            <div className="proposal-heading">
              <h3>Equipo & ArchAI</h3>
            </div>
            <button
              className="btn-studio-glass proposal-close"
              aria-label="Cerrar chat"
              onClick={() => state.setOpen(false)}
            >
              <X size={16} />
            </button>
          </header>
          {review.active && (
            <div className="proposal-review-tabs proposal-engine-options">
              <button aria-pressed={!reviewMode} onClick={() => setReviewMode(false)}>
                Conversación
              </button>
              <button aria-pressed={reviewMode} onClick={() => setReviewMode(true)}>
                Revisar propuesta
              </button>
            </div>
          )}
          {(!reviewMode || !review.active) && (
            <div
              ref={conversation}
              onScroll={() => {
                const el = conversation.current;
                stick.current = !!el && el.scrollHeight - el.scrollTop - el.clientHeight < 90;
              }}
              className={`proposal-conversation${!visible.length ? ' is-empty' : ''}`}
            >
              {!visible.length && (
                <div className="proposal-empty">
                  <div className="proposal-empty-icon">
                    <Bot size={26} />
                  </div>
                  <h4>Diseñemos juntos</h4>
                  <p>
                    Habla con tu equipo o menciona a <b>@ArchAI</b> para sumar a la IA a la conversación.
                  </p>
                  <button
                    className="proposal-prompt"
                    onClick={() => setText('@ArchAI sugiere una mejora para nuestro modelo actual')}
                  >
                    Pedir una recomendación <ChevronRight size={12} />
                  </button>
                </div>
              )}
              {state.historyNotice ? (
                <small className="proposal-hint" role="status">{state.historyNotice}</small>
              ) : visible.length >= 100 && (
                <button
                  className="btn-studio-glass chat-load-older"
                  onClick={() => {
                    stick.current = false;
                    void state.loadOlder();
                  }}
                >
                  Mensajes anteriores
                </button>
              )}
              {visible.map((m) => {
                const proposal = review.snapshot?.proposals.find((p) => p.id === m.proposalId) || m.proposal;
                const mine = m.authorId === state.currentUserId;
                return (
                  <article key={m.id} className={`chat-message chat-${m.role}${mine ? ' is-mine' : ''}`}>
                    <div className="chat-author">
                      {m.role === 'ai' ? (
                        <Bot size={13} />
                      ) : (
                        <span className="chat-avatar" style={{ background: m.avatarColor }}>
                          {m.authorName.slice(0, 1)}
                        </span>
                      )}
                      <strong>{m.authorName}</strong>
                      {m.role === 'ai' && <span className="chat-ai-label">IA</span>}
                      <time dateTime={m.createdAt}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </time>
                    </div>
                    {m.provider && (
                      <small className="proposal-response-model">
                        {m.provider} · {m.model}
                      </small>
                    )}
                    {m.status === 'thinking' || m.status === 'queued' ? (
                      <p className="chat-thinking" role="status">
                        <span /> {m.status === 'queued' ? 'ArchAI espera su turno…' : 'ArchAI está pensando…'}
                      </p>
                    ) : (
                      <ChatMarkdown text={m.text} />
                    )}
                    {proposal && (
                      <div className="chat-proposal-card">
                        <b>Propuesta de diseño</b>
                        <small>
                          {proposal.diagram?.classes.length || m.resumenPropuesta?.clases || 0} clases ·{' '}
                          {proposal.diagram?.relations.length || m.resumenPropuesta?.relaciones || 0} relaciones
                          {proposal.diagram?.deletions?.length || m.resumenPropuesta?.eliminaciones
                            ? ` · ${proposal.diagram?.deletions?.length || m.resumenPropuesta?.eliminaciones} eliminaciones`
                            : ''}
                        </small>
                        {'moderationStatus' in proposal && (
                          <small>
                            Estado:{' '}
                            {String(proposal.moderationStatus) === 'approved'
                              ? 'aprobada'
                              : String(proposal.moderationStatus) === 'rejected'
                                ? 'rechazada'
                                : String(proposal.moderationStatus) === 'partial'
                                  ? 'parcialmente aprobada'
                                  : 'pendiente'}
                          </small>
                        )}
                        {proposal.diagram ? (
                          <button
                            className="btn-studio-glass"
                            disabled={
                              'moderationStatus' in proposal &&
                              !['pending', 'partial'].includes(String(proposal.moderationStatus))
                            }
                            onClick={() => {
                              void review.preview(proposal);
                              setReviewMode(true);
                            }}
                          >
                            Ver en pizarra
                          </button>
                        ) : (
                          <small className="proposal-hint">Propuesta histórica conservada como contexto.</small>
                        )}
                      </div>
                    )}
                    {['offline', 'failed', 'interrupted'].includes(m.status) && (
                      <div className="chat-message-actions">
                        <small>
                          {m.status === 'offline'
                            ? 'Pendiente de conexión'
                            : m.status === 'interrupted'
                              ? 'Consulta interrumpida'
                              : 'No se completó el envío o la respuesta'}
                        </small>
                        {(mine || m.requesterId === state.currentUserId) && (
                          <button className="btn-studio-glass" onClick={() => state.retry(m)}>
                            Reintentar
                          </button>
                        )}
                      </div>
                    )}
                    {['queued', 'thinking'].includes(m.status) && m.requesterId === state.currentUserId && (
                      <button className="btn-studio-glass" onClick={() => void state.cancel(m.id)}>
                        Cancelar consulta
                      </button>
                    )}
                  </article>
                );
              })}
              {archived.map((p) => (
                <article key={p.id} className="chat-message chat-ai">
                  <b>
                    <Bot size={13} /> Propuesta recuperada
                  </b>
                  <ChatMarkdown text={p.explanation || ''} />
                  <button className="btn-studio-glass" onClick={() => void review.preview(p)}>
                    Ver en pizarra
                  </button>
                </article>
              ))}
              <div ref={last} />
            </div>
          )}
          {review.active && reviewMode && (
            <ProposalReviewEditor
              review={review}
              onFeedback={(prompt, parent, context) => state.request(prompt, false, parent, context)}
            />
          )}
          {voiceError && (
            <div className="proposal-error" role="alert">
              <p>{voiceError}</p>
            </div>
          )}
          {state.error && (
            <div className="proposal-error" role="alert">
              <p>{state.error}</p>
            </div>
          )}
          {(!reviewMode || !review.active) && (
            <form
              className="proposal-composer"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <label htmlFor="proposal-query" className="proposal-composer-label">
                Mensaje para el equipo{' '}
                <span className="proposal-engine-label">
                  {state.settings.mode === 'cloud' ? 'Nube' : 'Local'}
                </span>
              </label>
              <div className="proposal-input-wrap">
                <textarea
                  id="proposal-query"
                  maxLength={12000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder="Escribe al equipo o menciona a @ArchAI…"
                />
                <div className="proposal-input-actions">
                  <button
                    className="chat-mention"
                    type="button"
                    onClick={dictate}
                    aria-label={listening ? 'Detener dictado' : 'Dictar consulta'}
                  >
                    {listening ? <Square size={13} /> : <Mic size={13} />}
                  </button>
                  <button
                    className="chat-mention"
                    type="button"
                    onClick={() => setText((old) => (old.includes('@ArchAI') ? old : `@ArchAI ${old}`))}
                  >
                    @ArchAI
                  </button>
                  <button
                    className="proposal-send"
                    type="submit"
                    aria-label="Enviar mensaje"
                    disabled={!text.trim()}
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </form>
          )}
        </aside>
      )}
      {!state.open && state.unread > 0 && (
        <button className="proposal-notice" onClick={() => state.setOpen(true)}>
          <MessageSquare size={15} />
          <span>{state.unread} novedades del equipo</span>
        </button>
      )}
    </>
  );
}
