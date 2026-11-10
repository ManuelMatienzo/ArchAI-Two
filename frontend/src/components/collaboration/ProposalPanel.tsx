import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Send, X, ChevronRight, Cpu, RefreshCw, Cloud } from 'lucide-react';
import { ApiError } from '../../services/api';
import { InformacionSesion } from '../../types/auth';
import { ModeloDiagrama } from '../../types/uml';
import { DEFAULT_LOCAL_MODEL, InferenceMode, listLocalModels, Proposal, semanticDiagram, suggest, CloudConfig, CloudOptions, getCloudConfig } from '../../services/proposalAgent';
import './ProposalPanel.css';
import { DraftDiagram } from '../../services/proposalDraft';
import { ProposalReview } from './useProposalReview';
import { ProposalReviewEditor } from './ProposalReviewEditor';

type Envelope = {tipo: string; emisorId: string; payload: any};
export function useProposals(session: InformacionSesion, diagram: ModeloDiagrama, connected: boolean, publish: (type: string, data: unknown) => void, instance: string, diagramId?: string) {
  const [items, setItems] = useState<Proposal[]>([]);
  const [settings, setSettings] = useState({enabled:true,cloud:false});
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<Proposal | null>(null);
  const [error, setError] = useState('');
  const [unread,setUnread] = useState(0);
  const [localModel, setLocalModel] = useState(() => localStorage.getItem('archai_proposal_model') || DEFAULT_LOCAL_MODEL);
  const [cloudConfig,setCloudConfig]=useState<CloudConfig|null>(null);
  const [cloudOptions,setCloudOptions]=useState<CloudOptions>({});
  const [cloudConfigError,setCloudConfigError]=useState('');
  const [checkingCloud,setCheckingCloud]=useState(false);
  const configRequest=useRef(0);
  const checkCloud=useCallback(async()=>{
    const version=++configRequest.current;
    setCloudConfig(null);setCloudConfigError('');
    if(!connected || !diagramId){setCloudConfigError('Abre un diagrama guardado y conecta con su sala para usar la nube.');return;}
    setCheckingCloud(true);
    try{const config=await getCloudConfig(session.roomId,diagramId);if(version===configRequest.current)setCloudConfig(config);}
    catch(cause){if(version===configRequest.current)setCloudConfigError(cause instanceof ApiError && cause.status===404
      ? 'El diagrama abierto no está guardado en el servidor. Abre su versión guardada desde Proyectos o guárdalo primero.'
      : cause instanceof ApiError && cause.status===403 ? 'Tu cuenta necesita permisos de edición en este proyecto.'
      : cause instanceof ApiError && cause.status===401 ? 'Vuelve a iniciar sesión para usar la nube.'
      : 'No se pudieron cargar las preferencias de nube. Intenta nuevamente.');}
    finally{if(version===configRequest.current)setCheckingCloud(false);}
  },[connected,session.roomId,diagramId]);
  useEffect(()=>{setCloudOptions({});void checkCloud();return()=>{configRequest.current++;};},[checkCloud]);
  useEffect(()=>{if(open)void checkCloud();},[open,checkCloud]);
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
    const timer=setInterval(()=>setItems(old=>old.map(p=>p.status==='pending' && Date.now()-p.requestedAt>125000?{...p,status:'error',explanation:'La consulta tardó demasiado. Puedes reintentar.'}:p)),5000);
    return ()=>clearInterval(timer);
  },[]);
  const pending = useRef(new Map<string, {diagram: ModeloDiagrama; controller: AbortController; cloud: boolean; automatic: boolean; model: string; mode: InferenceMode; context?: DraftDiagram; options?:CloudOptions; started?: boolean}>());
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
    if (event.tipo === 'ia_denied' && event.emisorId === instance) { const job=pending.current.get(p.id);job?.controller.abort();pending.current.delete(p.id);setItems(old=>old.map(x=>x.id===p.id?{...x,status:'error',explanation:'La sala no autorizó la consulta. Comprueba tus permisos e intenta nuevamente.'}:x));return; }
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
    void suggest(job.context ? `${p.prompt}. Corrige únicamente esta propuesta pendiente: ${JSON.stringify(job.context)}. Conserva lo ya incorporado al modelo oficial.` : p.prompt, job.diagram, job.cloud, job.controller.signal, job.model,job.mode,{roomId:session.roomId,requestId:p.id,options:job.options}).then(result => {
      if (!job.controller.signal.aborted && current.current.connected) publish('ia_result',{...p,...result});
      else if (current.current.connected) publish('ia_result',{...p,status:'error',explanation:'La revisión se canceló.'});
    }).catch((cause: unknown) => {
      if (current.current.connected) publish('ia_result',{...p,status:'error',explanation: job.controller.signal.aborted ? 'La revisión se canceló.' : cause instanceof Error ? cause.message : 'No se pudo obtener una sugerencia. Intenta nuevamente.'});
      else setError('Se interrumpió la conexión. Vuelve a conectar para intentar otra vez.');
    }).finally(() => pending.current.delete(p.id));
  };
  const request = (prompt: string, automatic = false, parentId?: string, context?: DraftDiagram) => {
    if (!current.current.connected) { setError('No se pudo conectar con la sala. Intenta nuevamente.'); return false; }
    if (!prompt.trim()) return false;
    if (pending.current.size) {
      if (!automatic) setError('Hay una revisión en curso. Espera a que termine antes de enviar otra consulta.');
      return false;
    }
    setError('');
    const id = crypto.randomUUID();
    pending.current.set(id,{diagram: structuredClone(current.current.diagram), controller:new AbortController(),cloud: automatic ? current.current.settings.cloud : manualMode==='cloud',automatic,model:localModel,mode:automatic ? (current.current.settings.cloud?'hybrid':'local') : manualMode,context,options: automatic ? {} : (import.meta.env.DEV && cloudConfig?.testControls ? {...cloudOptions} : {})});
    const message = {id,parentId,inferenceMode:automatic ? (current.current.settings.cloud?'hybrid':'local') : manualMode,diagramId,draftContext:context,baseDiagram:structuredClone(current.current.diagram),prompt:prompt.trim(),author:session.currentUser.name,automatic,requestedAt:Date.now(),hash:semanticDiagram(current.current.diagram)};
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
    } },125000);
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
    localModel,localModels,checkingModel,modelError,checkModel,manualMode,setManualMode,cloudConfig,cloudConfigError,checkingCloud,checkCloud,cloudOptions,setCloudOptions,
    selectLocalModel:(model: string)=>{if(localModels.includes(model)){setLocalModel(model);localStorage.setItem('archai_proposal_model',model);}},
    configure:(value: typeof settings) => publish('ia_settings',value)};
}

export function ProposalPanel({state,host,review}: {state: ReturnType<typeof useProposals>;host:boolean;review:ProposalReview}) {
  const visibleItems=[...state.items.map(p=>review.snapshot?.proposals.find(x=>x.id===p.id) || p),...(review.snapshot?.proposals.filter(p=>!state.items.some(x=>x.id===p.id)) || [])].sort((a,b)=>a.requestedAt-b.requestedAt);
  const [text,setText] = useState('');
  const [reviewMode,setReviewMode]=useState(true);
  useEffect(()=>{if(review.active)setReviewMode(true);},[review.active?.id]);
  const last = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state.open) last.current?.scrollIntoView({block:'nearest'}); },[state.items,state.open,review.snapshot?.sequence]);
  const toggle = (label: string, description: string, checked: boolean, change: () => void) => <div className="proposal-setting">
    <div><span>{label}</span><small>{description}</small></div>
    <button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={!host} onClick={change} className="proposal-switch"><span/></button>
  </div>;
  return <>
    {state.open && <aside className={`proposal-panel${review.active ? ' has-active-proposal' : ''}${reviewMode && review.active ? ' is-reviewing' : ''}`} aria-label="Propuestas del equipo">
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
          <small>{state.manualMode==='local' ? 'Tus consultas usan solo Ollama, sin respaldo en nube.' : `Tus consultas y el contexto del diagrama se envían a Gemini${state.cloudConfig?.fallbackEnabled ? ' con respaldo de Claude' : ''}. Pueden consumir cuota.`}</small>
          {state.manualMode==='cloud' && <>
            {state.checkingCloud && <small>Cargando preferencias de nube…</small>}
            {state.cloudConfigError && <div className="proposal-error" role="alert"><p>{state.cloudConfigError}</p><button type="button" className="btn-studio-glass" onClick={()=>void state.checkCloud()} disabled={state.checkingCloud}>Reintentar</button></div>}
            {state.cloudConfig && !state.cloudConfig.available && <small>Configura Gemini en el servidor o selecciona Claude en las pruebas.</small>}
          </>}
        </div>
        {import.meta.env.DEV && state.cloudConfig?.testControls && state.manualMode==='cloud' && <div className="proposal-local-model">
          <label htmlFor="proposal-cloud-provider">Proveedor para pruebas</label>
          <div className="proposal-model-controls"><select id="proposal-cloud-provider" value={state.cloudOptions.provider || 'auto'} disabled={state.items.some(p=>p.status==='pending')} onChange={e=>state.setCloudOptions({...state.cloudOptions,provider:e.target.value as CloudOptions['provider']})}>
            <option value="auto">Automático: Gemini → Claude</option><option value="gemini">Solo Gemini</option><option value="claude" disabled={!state.cloudConfig.claudeAvailable}>Solo Claude</option>
          </select></div>
          <div className="proposal-setting"><div><span>Permitir respaldo con Claude</span><small>Solo para consultas que envía el equipo.</small></div><button type="button" role="switch" className="proposal-switch" aria-label="Permitir respaldo con Claude" aria-checked={state.cloudOptions.allowFallback ?? state.cloudConfig.fallbackEnabled} disabled={state.items.some(p=>p.status==='pending') || !state.cloudConfig.fallbackEnabled || state.cloudOptions.provider==='gemini' || state.cloudOptions.provider==='claude'} onClick={()=>state.setCloudOptions({...state.cloudOptions,allowFallback:!(state.cloudOptions.allowFallback ?? state.cloudConfig!.fallbackEnabled)})}><span/></button></div>
        </div>}
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
      {review.active && <div className="proposal-review-tabs proposal-engine-options" role="group" aria-label="Vista del panel ArchAI"><button aria-pressed={!reviewMode} disabled={review.editorOpen} onClick={()=>setReviewMode(false)}>Conversación</button><button aria-pressed={reviewMode} onClick={()=>setReviewMode(true)}>Revisión de propuesta</button></div>}
      {(!reviewMode || !review.active) && <div className={`proposal-conversation${visibleItems.length ? '' : ' is-empty'}`} aria-live="polite">
        {!visibleItems.length && <div className="proposal-empty">
          <div className="proposal-empty-icon"><Bot size={28}/></div>
          <h4>Diseñemos juntos</h4>
          <p>Comparte una idea o continúa modelando. Las propuestas de ArchAI estarán aquí para todo el equipo.</p>
          <button type="button" className="proposal-prompt" onClick={()=>setText('Sugiere una mejora para nuestro modelo actual')}>Sugiere una mejora del modelo <ChevronRight size={14}/></button>
        </div>}
        {visibleItems.map(p=><article className="proposal-message" key={p.id}>
          <div className="proposal-request"><small>{p.automatic ? 'Revisión del modelo' : p.author}</small><p>{p.automatic?'Recomendación automática':p.prompt}</p></div>
          <div className="proposal-answer"><strong><Bot size={14}/> ArchAI <span>IA</span></strong>
            {p.provider && <small className="proposal-response-model">{p.provider}{p.model ? ` · ${p.model}` : ''}</small>}
            <p role={p.status==='error'?'alert':undefined}>{p.status==='pending'?'Preparando una propuesta…':p.explanation}</p>
            {p.diagram && <details className="proposal-structure"><summary>Explorar clases y relaciones</summary>{p.diagram.classes.map(c=><div className="proposal-class" key={c.id}><b>{c.name}</b><p>{c.attributes.map(a=>`${a.name}: ${a.type}`).join(', ')}</p>{c.methods.length>0 && <p>{c.methods.map(m=>`${m.name}(): ${m.returnType}`).join(', ')}</p>}</div>)}<p>{p.diagram.relations.map(r=>`${(p.diagram!.classes.find(c=>c.id===r.sourceClassId)||p.baseDiagram?.classes.find(c=>c.id===r.sourceClassId)||review.snapshot?.official.classes.find(c=>c.id===r.sourceClassId))?.name} → ${(p.diagram!.classes.find(c=>c.id===r.targetClassId)||p.baseDiagram?.classes.find(c=>c.id===r.targetClassId)||review.snapshot?.official.classes.find(c=>c.id===r.targetClassId))?.name}`).join(' · ')}</p></details>}
            {p.status==='ready' && <><button disabled={review.busy || !!review.snapshot?.proposals.some(x=>x.id===p.id && !['pending','partial'].includes(x.moderationStatus))} className="btn-studio-glass proposal-preview" onClick={()=>void review.preview(p)}>Ver en pizarra</button>
              {review.snapshot?.proposals.find(x=>x.id===p.id) && <small className="proposal-hint">{({pending:'Pendiente',partial:'Aprobada parcialmente · quedan elementos pendientes',approved:'Aprobada',rejected:'Pendientes rechazados',superseded:'Rechazada con feedback'} as const)[review.snapshot.proposals.find(x=>x.id===p.id)!.moderationStatus]}</small>}</>}
            {p.status==='error' && !p.automatic && <button className="btn-studio-glass" onClick={()=>state.request(p.prompt)}>Reintentar</button>}
          </div>
        </article>)}<div ref={last}/>
      </div>}
      {(reviewMode || !review.active) && <ProposalReviewEditor review={review} onFeedback={(prompt,parent,context)=>state.request(prompt,false,parent,context)}/>}
      {(!reviewMode || !review.active) && <footer className="proposal-composer">
        {state.error && <p className="proposal-error" role="alert">{state.error}</p>}
        <form onSubmit={e=>{e.preventDefault();if(state.request(text)) setText('');}}>
          <label htmlFor="proposal-query" className="proposal-composer-label">Consulta al equipo con @ArchAI <span className="proposal-engine-label">{state.manualMode==='local'?'Local':'Nube'}</span></label>
          <div className="proposal-input-wrap">
            <textarea id="proposal-query" rows={3} aria-label="Consulta a ArchAI" placeholder="¿Qué podemos mejorar en este diseño?" value={text} onChange={e=>setText(e.target.value)}/>
            <div className="proposal-input-actions"><span>Una propuesta, una decisión del equipo.</span><button type="submit" className="btn-studio-primary" aria-label="Pedir sugerencia" title="Pedir sugerencia" disabled={!text.trim() || state.items.some(p=>p.status==='pending')}><Send size={15}/></button></div>
          </div>
        </form>
        <small className="proposal-hint">Las sugerencias conservan tu diagrama actual.</small>
      </footer>}
    </aside>}
    {!state.open && state.notice && <div className="proposal-notice" role="status">
      <div className="proposal-notice-title"><div className="proposal-avatar"><Bot size={17}/></div><strong>Una idea de ArchAI</strong><button className="btn-studio-glass proposal-close" aria-label="Cerrar aviso" onClick={()=>state.setNotice(null)}><X size={14}/></button></div>
      <p>{state.notice.explanation?.slice(0,150)}</p>
      <div className="proposal-notice-actions"><small>{state.unread} sin leer</small><button className="btn-studio-glass" onClick={()=>{state.setOpen(true);state.setNotice(null);}}>Ver propuesta <ChevronRight size={14}/></button></div>
    </div>}
  </>;
}
