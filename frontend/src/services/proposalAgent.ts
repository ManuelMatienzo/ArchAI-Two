import { ModeloDiagrama } from '../types/uml';
import { normalizarDiagrama, serializarModeloUML, extraerJSON } from './agenteDiagrama';
import { geminiDisponible, generarContenidoGemini, MODELO_GEMINI } from './geminiService';

export interface Proposal {
  id: string; author: string; prompt: string; automatic: boolean;
  requestedAt: number;
  status: 'pending' | 'ready' | 'clarification' | 'error';
  explanation?: string; diagram?: ReturnType<typeof normalizarDiagrama>; provider?: string; model?: string;
}
export const DEFAULT_LOCAL_MODEL = 'qwen3.5:4b';
export type InferenceMode = 'local' | 'cloud' | 'hybrid';
export async function listLocalModels(signal?: AbortSignal): Promise<string[]> {
  const response = await fetch('/api/ollama/api/tags', {signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000)});
  if (!response.ok) throw new Error('No se pudo acceder a los modelos locales. Abre Ollama e intenta nuevamente.');
  const data = await response.json();
  return Array.isArray(data.models) ? data.models.map((m: {name: string}) => m.name).filter((name: unknown): name is string => typeof name === 'string') : [];
}
export function semanticDiagram(diagram: ModeloDiagrama): string {
  return serializarModeloUML({ ...diagram, classes: [...diagram.classes].sort((a,b) => a.id.localeCompare(b.id)), relations: [...diagram.relations].sort((a,b) => a.id.localeCompare(b.id)) });
}
export async function suggest(prompt: string, diagram: ModeloDiagrama, cloud: boolean, signal: AbortSignal, selectedModel?: string, mode: InferenceMode = cloud ? 'hybrid' : 'local'): Promise<Pick<Proposal, 'diagram' | 'explanation' | 'provider' | 'model' | 'status'>> {
  const system = `Eres @ArchAI, asesor UML del equipo. Propón, no apliques cambios. Responde SOLO JSON: {"explanation":"justificación breve en español","classes":[{"name":"Clase","attributes":[{"name":"id","type":"Long"}],"methods":[]}],"relations":[{"sourceName":"A","targetName":"B","type":"ASSOCIATION_1_N"}]}. Para una consulta ambigua devuelve {"clarification":"pregunta concreta"}. En revisión automática devuelve {"skip":true} si no hay mejora importante. Contexto actual:\n${semanticDiagram(diagram)}`;
  const parse = (text: string, provider: string) => {
    const json = extraerJSON(text);
    if (!json) throw new Error('Respuesta inválida');
    const data = JSON.parse(json);
    if (data.skip) return null;
    if (typeof data.clarification === 'string') return { status: 'clarification' as const, explanation: data.clarification, provider };
    const result = normalizarDiagrama(data, []);
    if (!result || typeof data.explanation !== 'string' || !data.explanation.trim()) throw new Error('Propuesta incompleta');
    return { status: 'ready' as const, explanation: data.explanation, diagram: result, provider };
  };
  const cloudProposal = async () => {
    if (signal.aborted) throw new Error('Consulta cancelada');
    if (!geminiDisponible()) throw new Error('Configura el proveedor de nube para usar este modo o selecciona Local.');
    const text = await generarContenidoGemini(prompt, system, {temperature:0.2,maxOutputTokens:1800,responseMimeType:'application/json',reportErrors:true,signal}, 60000);
    if (signal.aborted) throw new Error('Consulta cancelada');
    if (!text) throw new Error('No se pudo obtener una respuesta del proveedor. Intenta nuevamente.');
    return {...(parse(text, 'Nube') || {status:'ready' as const, explanation:''}),provider:'Nube',model:MODELO_GEMINI};
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
    if (mode === 'local' || !cloud || !geminiDisponible()) {
      if (error instanceof Error && error.name === 'TimeoutError') throw new Error('El modelo local tardó más de un minuto. Intenta otra vez o elige un modelo más ligero.');
      throw new Error(error instanceof Error && !['TypeError','SyntaxError'].includes(error.name) ? error.message : 'No se pudo obtener una propuesta válida del modelo local. Intenta nuevamente.');
    }
    return await cloudProposal();
  }
}
