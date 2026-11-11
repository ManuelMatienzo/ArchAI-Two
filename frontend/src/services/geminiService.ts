import { apiFetch } from './api';
import { activeRoomContext } from './activeRoom';
export let MODELO_GEMINI = 'IA de la sala';
let provider = '';
export const ultimoProveedorIa = () => provider;
export const contextoMotor = activeRoomContext;
/** Compatibility name: availability now means authenticated access to the server gateway. */
export function geminiDisponible() {
  return true;
}
export async function verificarEstadoGemini(
  _timeoutMs = 3500
): Promise<{ online: boolean; model: string | null }> {
  try {
    const query = new URLSearchParams(contextoMotor());
    const result = await apiFetch<{ online: boolean; model: string }>('/api/v1/ia/motor?' + query);
    MODELO_GEMINI = result.model;
    return result;
  } catch {
    return { online: false, model: null };
  }
}
interface ConfiguracionGeneracion {
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: 'application/json' | 'text/plain';
  reportErrors?: boolean;
  signal?: AbortSignal;
}
export async function generarContenidoGemini(
  prompt: string,
  systemPrompt: string,
  config: ConfiguracionGeneracion = {},
  timeoutMs = 120000
): Promise<string | null> {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await apiFetch<{ text: string; provider: string; model: string }>('/api/v1/ia/contenido', {
      method: 'POST',
      body: JSON.stringify({
        ...contextoMotor(),
        prompt,
        systemPrompt,
        json: config.responseMimeType === 'application/json',
        maxOutputTokens: config.maxOutputTokens || 2048,
      }),
      signal: config.signal ? AbortSignal.any([config.signal, controller.signal]) : controller.signal,
    });
    provider = result.provider;
    MODELO_GEMINI = result.model;
    return result.text;
  } catch (e) {
    if (config.reportErrors) throw e;
    return null;
  } finally {
    clearTimeout(timer);
  }
}
export async function generarRespuestaGemini(
  prompt: string,
  contextoDiagrama?: string,
  timeoutMs = 20000
): Promise<{ text: string; success: boolean }> {
  const systemMessage = `Eres ArchAI Assistant, el copiloto oficial de inteligencia artificial de ArchAI Studio (Herramienta CASE Colaborativa para modelado de arquitecturas UML 2.5 y backend Spring Boot 3).
Tu rol es asistir al arquitecto/usuario en el chat con recomendaciones técnicas precisas, explicaciones claras de modelado y respuestas profesionales.
${contextoDiagrama ? `Contexto del diagrama UML actual en el lienzo: ${contextoDiagrama}` : ''}
Pautas para tus respuestas:
1. Responde siempre en español, con un tono amable, experto, directo y profesional.
2. Si te preguntan sobre UML, patrones de diseño, relaciones (1:N, N:M, clases asociativas en T, herencia, composición) o persistencia JPA, responde con rigor técnico UML 2.5.
3. Si el usuario te saluda, salúdalo con calidez e infórmale brevemente de lo que puedes hacer:
   - Diseñar sistemas completos (ej.: "Crea un sistema de ventas", "Crea un sistema de clínica").
   - Modificar el lienzo actual (ej.: "Agrega una clase Factura con total Double", "Agrega un método calcularTotal a Venta").
   - Auditar calidad y normalización (ej.: "Auditar modelo", "Auto-corregir").
4. Mantén las respuestas fluidas y concisas (2 a 4 oraciones claras), salvo que el usuario pida una explicación detallada o una comparativa de arquitectura.`;

  const texto = await generarContenidoGemini(
    prompt,
    systemMessage,
    { temperature: 0.6, maxOutputTokens: 800 },
    timeoutMs
  );
  return texto ? { text: texto, success: true } : { text: '', success: false };
}
