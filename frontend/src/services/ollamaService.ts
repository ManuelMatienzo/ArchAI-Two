import { apiFetch } from './api';
import { contextoMotor, generarRespuestaGemini } from './geminiService';
export interface OllamaStatus {
  online: boolean;
  model: string | null;
  models: string[];
}
export async function verificarEstadoOllama(): Promise<OllamaStatus> {
  try {
    return await apiFetch<OllamaStatus>('/api/v1/ia/motor?' + new URLSearchParams(contextoMotor()));
  } catch {
    return { online: false, model: null, models: [] };
  }
}
export async function generarRespuestaOllama(
  prompt: string,
  _modelToUse?: string,
  contextoDiagrama?: string
): Promise<{ text: string; success: boolean }> {
  return generarRespuestaGemini(prompt, contextoDiagrama, 110000);
}
