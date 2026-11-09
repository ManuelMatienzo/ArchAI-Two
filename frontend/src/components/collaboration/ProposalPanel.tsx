import { useEffect, useRef, useState } from 'react';
import { Bot, Send, X, ChevronRight, Cpu, RefreshCw, Cloud } from 'lucide-react';
import { InformacionSesion } from '../../types/auth';
import { ModeloDiagrama } from '../../types/uml';
import { DEFAULT_LOCAL_MODEL, InferenceMode, listLocalModels, Proposal, semanticDiagram, suggest } from '../../services/proposalAgent';
import { geminiDisponible, MODELO_GEMINI } from '../../services/geminiService';
import './ProposalPanel.css';

type Envelope = {tipo: string; emisorId: string; payload: any};
export function useProposals(session: InformacionSesion, diagram: ModeloDiagrama, connected: boolean, publish: (type: string, data: unknown) => void, instance: string) {
  const [items, setItems] = useState<Proposal[]>([]);
  const [settings, setSettings] = useState({enabled:true,cloud:false});
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<Proposal | null>(null);
  const [error, setError] = useState('');
  const [unread,setUnread] = useState(0);
  const [localModel, setLocalModel] = useState(() => localStorage.getItem('archai_proposal_model') || DEFAULT_LOCAL_MODEL);
  const [manualMode,setManualMode] = useState<'local'|'cloud'>('local');
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [checkingModel, setCheckingModel] = useState(false);
  const [modelError, setModelError] = useState('');
  const modelCheck = useRef<AbortController | null>(null);
  const checkModel = async () => {
    modelCheck.current?.abort();
    const controller = new AbortController(); modelCheck.current = controller;
    setCheckingModel(true); setModelError('');
    try {
      const models = await listLocalModels(controller.signal);
      if (!controller.signal.aborted) {
        setLocalModels(models);
        if (!models.length) setModelError('No hay modelos instalados en Ollama.');
      }
    } catch {
      if (!controller.signal.aborted) {setLocalModels([]);setModelError('No se pudo conectar con Ollama. Ábrelo e intenta nuevamente.');}
    } finally {if (!controller.signal.aborted) setCheckingModel(false);}
  };
  useEffect(() => { if (open) void checkModel(); },[open]);
  useEffect(() => () => modelCheck.current?.abort(),[]);
  useEffect(()=>{if(open) {setUnread(0);setNotice(null);}},[open]);
  useEffect(()=>{
    const timer=setInterval(()=>setItems(old=>old.map(p=>p.status==='pending' && Date.now()-p.requestedAt>70000?{...p,status:'error',explanation:'La consulta tardó demasiado. Puedes reintentar.'}:p)),5000);
    return ()=>clearInterval(timer);
  },[]);
  const pending = useRef(new Map<string, {diagram: ModeloDiagrama; controller: AbortController; cloud: boolean; automatic: boolean; model: string; mode: InferenceMode; started?: boolean}>());
  const lastAutomatic = useRef('');
  const current = useRef({session,diagram,settings,connected,publish});
  current.current = {session,diagram,settings,connected,publish};
  useEffect(() => {
    setItems([]); setNotice(null); setSettings({enabled:true,cloud:false}); lastAutomatic.current = '';
    return () => { pending.current.forEach(p => p.controller.abort()); pending.current.clear(); };
  }, [session.roomId]);
  useEffect(() => { if (connected) publish('ia_sync', {}); }, [connected, session.roomId]);
  useEffect(() => {
    if (!connected) {
      pending.current.forEach(job => job.controller.abort()); pending.current.clear();
      setItems(old => old.map(p => p.status === 'pending' ? {...p,status:'error',explanation:'Se interrumpió la conexión. Puedes reintentar.'} : p));
    }
  },[connected]);
  const receive = (event: Envelope) => {
    const p = event.payload;
    if (event.tipo === 'ia_denied' && event.emisorId === instance) { pending.current.delete(p.id); return; }
    if (event.tipo === 'ia_settings') {
      setSettings(p);
      pending.current.forEach(job => { if (job.automatic && (!p.enabled || (job.cloud && !p.cloud))) job.controller.abort(); });
      return;
    }
    if (!['ia_request','ia_auto','ia_result'].includes(event.tipo) || typeof p?.id !== 'string') return;
    if (event.tipo === 'ia_result') {
      setItems(old => p.explanation ? [...old.filter(x => x.id !== p.id),p] : old.filter(x => x.id !== p.id));
      if (p.status === 'ready' && p.explanation) {setNotice(p);if(!open)setUnread(n=>n+1);}
      return;
    }
    setItems(old => old.some(x => x.id === p.id) ? old : [...old,{...p,status:'pending'}]);
    const job = pending.current.get(p.id);
    if (event.emisorId !== instance || !job || job.started) return;
    job.started = true;
    if (job.automatic) lastAutomatic.current = semanticDiagram(job.diagram);
    pending.current.delete(p.id);
    // Only the requesting tab executes inference after the broker accepts it.
    pending.current.set(p.id, job);
    void suggest(p.prompt, job.diagram, job.cloud, job.controller.signal, job.model,job.mode).then(result => {
      if (!job.controller.signal.aborted && current.current.connected) publish('ia_result',{...p,...result});
      else if (current.current.connected) publish('ia_result',{...p,status:'error',explanation:'La revisión se canceló.'});
    }).catch((cause: unknown) => {
      if (current.current.connected) publish('ia_result',{...p,status:'error',explanation: job.controller.signal.aborted ? 'La revisión se canceló.' : cause instanceof Error ? cause.message : 'No se pudo obtener una sugerencia. Intenta nuevamente.'});
      else setError('Se interrumpió la conexión. Vuelve a conectar para intentar otra vez.');
    }).finally(() => pending.current.delete(p.id));
  };
  const request = (prompt: string, automatic = false) => {
    if (!current.current.connected) { setError('No se pudo conectar con la sala. Intenta nuevamente.'); return false; }
    if (!prompt.trim()) return false;
    if (pending.current.size) {
      if (!automatic) setError('Hay una revisión en curso. Espera a que termine antes de enviar otra consulta.');
      return false;
    }
    setError('');
    const id = crypto.randomUUID();
    pending.current.set(id,{diagram: structuredClone(current.current.diagram), controller:new AbortController(),cloud: automatic ? current.current.settings.cloud : manualMode==='cloud',automatic,model:localModel,mode:automatic ? (current.current.settings.cloud?'hybrid':'local') : manualMode});
    const message = {id,prompt:prompt.trim(),author:session.currentUser.name,automatic,requestedAt:Date.now(),hash:semanticDiagram(current.current.diagram)};
    if (!automatic) setItems(old=>[...old,{...message,status:'pending'}]);
    publish(automatic ? 'ia_auto' : 'ia_request',message);
    setTimeout(()=>{
      const job=pending.current.get(id);
      if (job && !job.started) {
        job.controller.abort(); pending.current.delete(id);
        if (!automatic) setItems(old=>old.map(p=>p.id===id?{...p,status:'error',explanation:'La sala no confirmó el envío. Intenta nuevamente.'}:p));
      }
    },5000);
    // A denied automatic lease must not block subsequent requests.
    setTimeout(() => { const job = pending.current.get(id); if (job) {
      job.controller.abort(); pending.current.delete(id);
      setItems(old=>old.map(p=>p.id===id && p.status==='pending'?{...p,status:'error',explanation:'La consulta tardó demasiado. Intenta nuevamente.'}:p));
    } },70000);
    return true;
  };
  const semantic = semanticDiagram(diagram);
  useEffect(() => {
    if (!connected || !settings.enabled || !session.currentUser.isHost || !diagram.classes.length) return;
    let interval: ReturnType<typeof setInterval>;
    const run = () => { if (semantic !== lastAutomatic.current) request('Revisa el modelo actual y sugiere una única mejora importante. Si no hay problemas relevantes responde skip.',true); };
    const timer = setTimeout(() => {run(); interval = setInterval(run,5000);},5000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [semantic, connected, settings.enabled, settings.cloud, session.roomId, localModel]);
  return {items,settings,open,setOpen,notice,setNotice,unread,error,receive,request,
    localModel,localModels,checkingModel,modelError,checkModel,manualMode,setManualMode,
    selectLocalModel:(model: string)=>{if(localModels.includes(model)){setLocalModel(model);localStorage.setItem('archai_proposal_model',model);}},
    configure:(value: typeof settings) => publish('ia_settings',value)};
}

export function ProposalPanel({state,host}: {state: ReturnType<typeof useProposals>;host:boolean}) {
  const [text,setText] = useState('');
  const last = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state.open) last.current?.scrollIntoView({block:'nearest'}); },[state.items,state.open]);
  const toggle = (label: string, description: string, checked: boolean, change: () => void) => <div className="proposal-setting">
    <div><span>{label}</span><small>{description}</small></div>
    <button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={!host} onClick={change} className="proposal-switch"><span/></button>
  </div>;
  return <>
    {state.open && <aside className="proposal-panel" aria-label="Propuestas del equipo">
      <header className="proposal-header">
        <div className="proposal-avatar"><Bot size={19}/></div>
        <div className="proposal-heading"><h3>@ArchAI</h3><span>Propuestas del equipo</span></div>
        <button className="btn-studio-glass proposal-close" aria-label="Cerrar propuestas" onClick={()=>state.setOpen(false)}><X size={16}/></button>
      </header>
      <details className="proposal-preferences">
        <summary>Preferencias del asistente <ChevronRight size={13}/></summary>
        <div className="proposal-engine">
          <span>Motor para tus consultas</span>
          <div className="proposal-engine-options" role="group" aria-label="Motor para consultas manuales">
            <button type="button" aria-pressed={state.manualMode==='local'} onClick={()=>state.setManualMode('local')} disabled={state.items.some(p=>p.status==='pending')}><Cpu size={13}/> Local</button>
            <button type="button" aria-pressed={state.manualMode==='cloud'} onClick={()=>state.setManualMode('cloud')} disabled={state.items.some(p=>p.status==='pending')}><Cloud size={13}/> Nube</button>
          </div>
          <small>{state.manualMode==='local' ? 'Tus consultas usan solo Ollama, sin respaldo en nube.' : `Tus consultas y el contexto del diagrama se envían a Gemini (${MODELO_GEMINI}). Pueden consumir cuota.`}</small>
          {state.manualMode==='cloud' && !geminiDisponible() && <small>Configura el proveedor de nube antes de enviar una consulta.</small>}
        </div>
        {state.manualMode==='local' &&
        <div className="proposal-local-model">
          <label htmlFor="proposal-local-model"><Cpu size={13}/> Modelo local</label>
          <div className="proposal-model-controls">
            <select id="proposal-local-model" value={state.localModel} onChange={e=>state.selectLocalModel(e.target.value)} disabled={state.checkingModel || state.items.some(p=>p.status==='pending')}>
              {!state.localModels.includes(state.localModel) && <option value={state.localModel}>{state.localModel}</option>}
              {state.localModels.map(model=><option key={model} value={model}>{model}</option>)}
            </select>
            <button type="button" className="btn-studio-glass" onClick={()=>void state.checkModel()} disabled={state.checkingModel} aria-label="Conectar con Ollama" title="Consultar modelos disponibles en Ollama"><RefreshCw size={13} className={state.checkingModel?'proposal-model-loading':''}/>{state.checkingModel?'Buscando…':'Conectar'}</button>
          </div>
          <small>{state.checkingModel ? 'Consultando los modelos disponibles…' : state.modelError || (state.localModels.includes(state.localModel) ? 'Modelo disponible. Se cargará al enviar una consulta.' : 'El modelo elegido no aparece en Ollama. Conecta o elige otro modelo.')}</small>
        </div>}
        {toggle('Sugerencias automáticas','Revisiones con Ollama mientras modelas.',state.settings.enabled,()=>state.configure({...state.settings,enabled:!state.settings.enabled}))}
        {toggle('Observación en la nube','Respaldo automático si Ollama falla. Consume cuota.',state.settings.cloud,()=>state.configure({...state.settings,cloud:!state.settings.cloud}))}
        {!host && <small className="proposal-hint">El anfitrión administra estas preferencias.</small>}
      </details>
      <div className={`proposal-conversation${state.items.length ? '' : ' is-empty'}`} aria-live="polite">
        {!state.items.length && <div className="proposal-empty">
          <div className="proposal-empty-icon"><Bot size={28}/></div>
          <h4>Diseñemos juntos</h4>
          <p>Comparte una idea o continúa modelando. Las propuestas de ArchAI estarán aquí para todo el equipo.</p>
          <button type="button" className="proposal-prompt" onClick={()=>setText('Sugiere una mejora para nuestro modelo actual')}>Sugiere una mejora del modelo <ChevronRight size={14}/></button>
        </div>}
        {state.items.map(p=><article className="proposal-message" key={p.id}>
          <div className="proposal-request"><small>{p.automatic ? 'Revisión del modelo' : p.author}</small><p>{p.automatic?'Recomendación automática':p.prompt}</p></div>
          <div className="proposal-answer"><strong><Bot size={14}/> ArchAI <span>IA</span></strong>
            {p.provider && <small className="proposal-response-model">{p.provider}{p.model ? ` · ${p.model}` : ''}</small>}
            <p role={p.status==='error'?'alert':undefined}>{p.status==='pending'?'Preparando una propuesta…':p.explanation}</p>
            {p.diagram && <details className="proposal-structure"><summary>Explorar clases y relaciones</summary>{p.diagram.classes.map(c=><div className="proposal-class" key={c.id}><b>{c.name}</b><p>{c.attributes.map(a=>`${a.name}: ${a.type}`).join(', ')}</p>{c.methods.length>0 && <p>{c.methods.map(m=>`${m.name}(): ${m.returnType}`).join(', ')}</p>}</div>)}<p>{p.diagram.relations.map(r=>`${p.diagram!.classes.find(c=>c.id===r.sourceClassId)?.name} → ${p.diagram!.classes.find(c=>c.id===r.targetClassId)?.name}`).join(' · ')}</p></details>}
            {p.status==='ready' && <button disabled className="btn-studio-glass proposal-preview" title="Vista previa aún no disponible">Ver en pizarra</button>}
            {p.status==='error' && !p.automatic && <button className="btn-studio-glass" onClick={()=>state.request(p.prompt)}>Reintentar</button>}
          </div>
        </article>)}<div ref={last}/>
      </div>
      <footer className="proposal-composer">
        {state.error && <p className="proposal-error" role="alert">{state.error}</p>}
        <form onSubmit={e=>{e.preventDefault();if(state.request(text)) setText('');}}>
          <label htmlFor="proposal-query" className="proposal-composer-label">Consulta al equipo con @ArchAI <span className="proposal-engine-label">{state.manualMode==='local'?'Local':'Nube'}</span></label>
          <div className="proposal-input-wrap">
            <textarea id="proposal-query" rows={3} aria-label="Consulta a ArchAI" placeholder="¿Qué podemos mejorar en este diseño?" value={text} onChange={e=>setText(e.target.value)}/>
            <div className="proposal-input-actions"><span>Una propuesta, una decisión del equipo.</span><button type="submit" className="btn-studio-primary" aria-label="Pedir sugerencia" title="Pedir sugerencia" disabled={!text.trim() || state.items.some(p=>p.status==='pending')}><Send size={15}/></button></div>
          </div>
        </form>
        <small className="proposal-hint">Las sugerencias conservan tu diagrama actual.</small>
      </footer>
    </aside>}
    {!state.open && state.notice && <div className="proposal-notice" role="status">
      <div className="proposal-notice-title"><div className="proposal-avatar"><Bot size={17}/></div><strong>Una idea de ArchAI</strong><button className="btn-studio-glass proposal-close" aria-label="Cerrar aviso" onClick={()=>state.setNotice(null)}><X size={14}/></button></div>
      <p>{state.notice.explanation?.slice(0,150)}</p>
      <div className="proposal-notice-actions"><small>{state.unread} sin leer</small><button className="btn-studio-glass" onClick={()=>{state.setOpen(true);state.setNotice(null);}}>Ver propuesta <ChevronRight size={14}/></button></div>
    </div>}
  </>;
}
