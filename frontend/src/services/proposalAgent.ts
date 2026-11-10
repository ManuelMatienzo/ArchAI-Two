import { ModeloDiagrama } from '../types/uml';
import { serializarModeloUML, extraerJSON } from './agenteDiagrama';
import { apiFetch, ApiError } from './api';

import { DraftDiagram, normalizeProposal } from './proposalDraft';

export interface Proposal {
  id: string; author: string; prompt: string; automatic: boolean;
  requestedAt: number; baseDiagram?: ModeloDiagrama; parentId?: string; durationMs?: number; inputTokens?: number; outputTokens?: number;
  status: 'pending' | 'ready' | 'clarification' | 'error';
  explanation?: string; diagram?: DraftDiagram; provider?: string; model?: string;
}
export const DEFAULT_LOCAL_MODEL = 'qwen3.5:4b';
export type InferenceMode = 'local' | 'cloud' | 'hybrid';
export interface CloudConfig { available:boolean; claudeAvailable:boolean; fallbackEnabled:boolean; testControls:boolean; geminiModel:string; claudeModel:string }
export interface CloudOptions { provider?:'auto'|'gemini'|'claude'; allowFallback?:boolean; simulateGeminiFailure?:boolean }
export interface CloudRequest { roomId:string; requestId:string; options?:CloudOptions }
export const cloudPath=(roomId:string)=>`/api/v1/colaboracion/salas/${encodeURIComponent(roomId)}/inferencia`;
export const getCloudConfig=(roomId:string,diagramId:string)=>apiFetch<CloudConfig>(`${cloudPath(roomId)}?diagramId=${encodeURIComponent(diagramId)}`);
export async function listLocalModels(signal?: AbortSignal): Promise<string[]> {
  const response = await fetch('/api/ollama/api/tags', {signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000)});
  if (!response.ok) throw new Error('No se pudo acceder a los modelos locales. Abre Ollama e intenta nuevamente.');
  const data = await response.json();
  return Array.isArray(data.models) ? data.models.map((m: {name: string}) => m.name).filter((name: unknown): name is string => typeof name === 'string') : [];
}
export function semanticDiagram(diagram: ModeloDiagrama): string {
  return serializarModeloUML({ ...diagram, classes: [...diagram.classes].sort((a,b) => a.id.localeCompare(b.id)), relations: [...diagram.relations].sort((a,b) => a.id.localeCompare(b.id)) });
}
export async function suggest(prompt: string, diagram: ModeloDiagrama, cloud: boolean, signal: AbortSignal, selectedModel?: string, mode: InferenceMode = cloud ? 'hybrid' : 'local', request?: CloudRequest): Promise<Pick<Proposal, 'diagram' | 'explanation' | 'provider' | 'model' | 'status'>> {
  const system = `Eres @ArchAI, asesor UML del equipo. Propón, no apliques cambios. Responde SOLO JSON: {"explanation":"justificación breve en español","classes":[{"name":"Clase","attributes":[{"name":"id","type":"Long"}],"methods":[]}],"relations":[{"sourceName":"A","targetName":"B","type":"ASSOCIATION_1_N"}]}. Para modificar una clase existente incluye targetClassId con su ID real; devuelve solo los miembros que propones cambiar o añadir. Puedes relacionar clases nuevas con clases existentes por sourceName/targetName sin repetir las existentes. No propongas eliminaciones implícitas. Para una consulta ambigua devuelve {"clarification":"pregunta concreta"}. En revisión automática devuelve {"skip":true} si no hay mejora importante. Contexto actual:\n${semanticDiagram(diagram)}`;
  const parse = (text: string, provider: string) => {
    const json = extraerJSON(text);
    if (!json) throw new Error('Respuesta inválida');
    const data = JSON.parse(json);
    if (data.skip) return null;
    if (typeof data.clarification === 'string' && data.clarification.trim()) return { status: 'clarification' as const, explanation: data.clarification, provider };
    const result = normalizeProposal(data, diagram);
    if (!result || typeof data.explanation !== 'string' || !data.explanation.trim()) throw new Error('Propuesta incompleta');
    return { status: 'ready' as const, explanation: data.explanation, diagram: result, provider };
  };
  const cloudProposal = async () => {
    if (signal.aborted) throw new Error('Consulta cancelada');
    if (!request) throw new Error('La sala no confirmó esta consulta. Vuelve a enviarla.');
    const path=`${cloudPath(request.roomId)}/${encodeURIComponent(request.requestId)}`;
    const cancel=()=>{void apiFetch(path,{method:'DELETE'}).catch(()=>{});};
    signal.addEventListener('abort',cancel,{once:true});
    try {
      const result=await apiFetch<{content:unknown;provider:string;model:string;durationMs:number;inputTokens:number;outputTokens:number}>(path,{method:'POST',body:JSON.stringify(request.options || {}),signal:AbortSignal.any([signal,AbortSignal.timeout(55000)])});
      if(signal.aborted) throw new Error('Consulta cancelada');
      return {...(parse(JSON.stringify(result.content),result.provider) || {status:'ready' as const,explanation:''}),provider:result.provider,model:result.model,durationMs:result.durationMs,inputTokens:result.inputTokens,outputTokens:result.outputTokens};
    } catch(error) {
      if(error instanceof ApiError && error.status===0) throw new Error('No se pudo conectar con el servicio de IA. Intenta nuevamente.');
      throw error;
    } finally {signal.removeEventListener('abort',cancel);}

  };
  if (mode === 'cloud') return await cloudProposal();
  try {
    const models = await listLocalModels(signal);
    const model = selectedModel || [DEFAULT_LOCAL_MODEL,'qwen2.5:1.5b','qwen2.5:0.5b'].find(name => models.includes(name));
    if (!model || !models.includes(model)) throw new Error('El modelo elegido no está disponible. Revisa Modelo local en las preferencias de ArchAI.');
    const res = await fetch('/api/ollama/api/chat', { method: 'POST', headers: {'Content-Type':'application/json'}, signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]), body: JSON.stringify({model, ...(model.startsWith('qwen3.5:') ? {think:false} : {}), stream:false, format:'json', messages:[{role:'system',content:system},{role:'user',content:prompt}], options:{temperature:0.2,num_predict:1800}}) });
    if (!res.ok) throw new Error('El modelo local no pudo procesar la consulta. Comprueba que Ollama tenga recursos disponibles.');
    const result = parse((await res.json()).message.content, 'Ollama');
    if (!result) return {status:'ready', explanation:'', provider:'Ollama', model};
    return {...result, model};
  } catch (error) {
    if (signal.aborted) throw error;
    if (mode === 'local' || !cloud) {
      if (error instanceof Error && error.name === 'TimeoutError') throw new Error('El modelo local tardó más de un minuto. Intenta otra vez o elige un modelo más ligero.');
      throw new Error(error instanceof Error && !['TypeError','SyntaxError'].includes(error.name) ? error.message : 'No se pudo obtener una propuesta válida del modelo local. Intenta nuevamente.');
    }
    return await cloudProposal();
  }
}
