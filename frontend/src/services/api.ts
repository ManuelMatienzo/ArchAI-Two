import { ModeloDiagrama } from '../types/uml';
import { InformacionSesion, PerfilUsuario } from '../types/auth';

/**
 * Cliente API central de ArchAI.
 * Conecta el frontend con el backend Spring Boot (CU-01 a CU-14).
 * URL configurable por variable de entorno VITE_ARCHAI_API_URL.
 */
export const API_BASE_URL: string =
  (import.meta as any).env?.VITE_ARCHAI_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  constructor(status: number, mensaje: string) {
    super(mensaje);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('archai_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> || {})
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers
    });
  } catch (err: any) {
    throw new ApiError(
      0,
      `No se pudo conectar con el servidor backend en ${API_BASE_URL}. Asegúrate de que el backend Spring Boot esté corriendo (ejecuta: .\\mvnw.cmd spring-boot:run)`
    );
  }

  if (!res.ok) {
    let mensaje = `Error del servidor (${res.status})`;
    try {
      const cuerpo = await res.json();
      if (cuerpo?.mensaje) mensaje = cuerpo.mensaje;
      else if (cuerpo?.message) mensaje = cuerpo.message;
      else if (cuerpo?.error) mensaje = cuerpo.error;
    } catch {
      /* el cuerpo no es JSON */
    }
    throw new ApiError(res.status, mensaje);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

/** Verifica si el backend Spring Boot está respondiendo en el puerto 8000 */
export async function verificarConexionBackend(): Promise<{ online: boolean; mensaje: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/status`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const txt = await res.text();
      return { online: true, mensaje: txt || 'Backend Spring Boot activo en http://localhost:8000' };
    }
    return { online: true, mensaje: `Servidor respondiendo (${res.status})` };
  } catch {
    return { online: false, mensaje: 'Backend no detectado en http://localhost:8000' };
  }
}

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

// ─────────────────────────── Mapeo Diagrama ⇄ Backend ───────────────────────────

export function construirPayloadDiagrama(diagram: ModeloDiagrama, extra?: { proyectoId?: string; creadorId?: string }): any {
  return {
    proyectoId: extra?.proyectoId,
    creadorId: extra?.creadorId,
    title: diagram.title,
    classes: (diagram.classes || []).map(c => ({
      id: c.id,
      name: c.name,
      stereotype: c.stereotype,
      position: c.position || { x: 200, y: 160 },
      attributes: (c.attributes || []).map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        visibility: a.visibility,
        isPrimaryKey: a.isPrimaryKey ?? false,
        isNullable: a.isNullable ?? true
      })),
      methods: (c.methods || []).map(m => ({
        id: m.id,
        name: m.name,
        returnType: m.returnType,
        visibility: m.visibility,
        parameters: m.parameters ? m.parameters.split(',').map(s => s.trim()).filter(Boolean) : []
      }))
    })),
    relations: (diagram.relations || []).map(r => ({
      id: r.id,
      sourceClassId: r.sourceClassId,
      targetClassId: r.targetClassId,
      type: r.type,
      sourceMultiplicity: r.sourceMultiplicity,
      targetMultiplicity: r.targetMultiplicity
    }))
  };
}

export function diagramaDesdeBackend(dto: any): ModeloDiagrama {
  return {
    title: dto?.title || 'Diagrama importado',
    updatedAt: dto?.updatedAt || new Date().toISOString(),
    classes: (dto?.classes || []).map((c: any) => ({
      id: c.id,
      name: c.name || 'Clase',
      stereotype: c.stereotype || 'Entity',
      position: c.position,
      attributes: (c.attributes || []).map((a: any) => ({
        id: a.id || `attr-${Math.random().toString(36).slice(2, 8)}`,
        name: a.name || 'campo',
        type: a.type || 'String',
        visibility: a.visibility || '+',
        isPrimaryKey: a.isPrimaryKey ?? false,
        isNullable: a.isNullable ?? true
      })),
      methods: (c.methods || []).map((m: any) => ({
        id: m.id || `met-${Math.random().toString(36).slice(2, 8)}`,
        name: m.name || 'operacion',
        returnType: m.returnType || 'void',
        visibility: m.visibility || '+',
        parameters: Array.isArray(m.parameters) ? m.parameters.join(', ') : (m.parameters || '')
      }))
    })),
    relations: (dto?.relations || []).map((r: any) => ({
      id: r.id,
      sourceClassId: r.sourceClassId,
      targetClassId: r.targetClassId,
      type: r.type || 'ASSOCIATION_1_N',
      sourceMultiplicity: r.sourceMultiplicity || '1',
      targetMultiplicity: r.targetMultiplicity || '0..*'
    }))
  };
}

// ─────────────────────────── CU-01 · Autenticación y Perfil ───────────────────────────

export interface RegistroUsuario {
  nombre: string;
  nombreUsuario?: string;
  correo: string;
  contrasena: string;
  dni?: string;
  rol?: string;
}

export interface RespuestaLogin {
  token: string;
  success: boolean;
  message: string;
  user: PerfilUsuario;
  session: InformacionSesion;
}

export function iniciarSesion(correoOUsuario: string, contrasena: string): Promise<RespuestaLogin> {
  return apiFetch<RespuestaLogin>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ usuario: correoOUsuario, contrasena })
  });
}

export function registrarUsuario(datos: RegistroUsuario): Promise<PerfilUsuario> {
  return apiFetch<PerfilUsuario>('/api/v1/auth/registro', {
    method: 'POST',
    body: JSON.stringify(datos)
  });
}

export function actualizarPerfil(id: string, cambios: Partial<PerfilUsuario>): Promise<PerfilUsuario> {
  return apiFetch<PerfilUsuario>(`/api/v1/auth/perfil/${id}`, {
    method: 'PUT',
    body: JSON.stringify(cambios)
  });
}

// ─────────────────────────── CU-02 · Proyectos / Workspace ───────────────────────────

export interface Proyecto {
  id: string;
  nombre: string;
  descripcion?: string;
  codigoAcceso?: string;
  iconoColor?: string;
  estado?: string;
  propietarioId?: string;
  propietarioNombre?: string;
  totalDiagramas?: number;
  miembros?: any[];
}

export function listarProyectos(usuarioId?: string): Promise<Proyecto[]> {
  const query = usuarioId ? `?usuarioId=${encodeURIComponent(usuarioId)}` : '';
  return apiFetch<Proyecto[]>(`/api/v1/proyectos${query}`);
}

export function crearProyecto(datos: { nombre: string; descripcion?: string; iconoColor?: string; propietarioId: string }): Promise<Proyecto> {
  return apiFetch<Proyecto>('/api/v1/proyectos', {
    method: 'POST',
    body: JSON.stringify(datos)
  });
}

/** CU-02 · Unirse a un proyecto compartido mediante su código de acceso. */
export function unirseProyectoPorCodigo(codigoAcceso: string, usuarioId: string): Promise<Proyecto> {
  return apiFetch<Proyecto>('/api/v1/proyectos/unirse', {
    method: 'POST',
    body: JSON.stringify({ codigoAcceso, usuarioId })
  });
}

// ─────────────────────────── CU-03 · Sala Colaborativa ───────────────────────────

export function crearSalaColaborativa(nombreSala: string, usuario: PerfilUsuario, pin?: string): Promise<InformacionSesion> {
  return apiFetch<InformacionSesion>('/api/v1/colaboracion/salas', {
    method: 'POST',
    body: JSON.stringify({ nombreSala, anfitrion: usuario, pin })
  });
}

export function unirseSalaColaborativa(pin: string, usuario: PerfilUsuario): Promise<InformacionSesion> {
  return apiFetch<InformacionSesion>('/api/v1/colaboracion/salas/unirse', {
    method: 'POST',
    body: JSON.stringify({ pin, usuario })
  });
}

export function obtenerDiagramaSala(pin: string): Promise<any> {
  return apiFetch<any>(`/api/v1/colaboracion/salas/${encodeURIComponent(pin)}/diagrama`);
}

export function actualizarDiagramaSala(pin: string, diagram: ModeloDiagrama): Promise<void> {
  return apiFetch<void>(`/api/v1/colaboracion/salas/${encodeURIComponent(pin)}/diagrama`, {
    method: 'PUT',
    body: JSON.stringify(construirPayloadDiagrama(diagram))
  });
}

// ─────────────────────────── CU-04 / CU-05 · Diagramas y Versiones ───────────────────────────

export interface VersionDiagrama {
  id: string;
  diagramaId: string;
  numeroVersion: number;
  etiqueta?: string;
  descripcionCambio?: string;
  autorNombre?: string;
}

export function guardarDiagramaEnNube(diagram: ModeloDiagrama, proyectoId?: string, creadorId?: string): Promise<any> {
  return apiFetch<any>('/api/v1/diagramas', {
    method: 'POST',
    body: JSON.stringify(construirPayloadDiagrama(diagram, { proyectoId, creadorId }))
  });
}

export function listarVersiones(diagramaId: string): Promise<VersionDiagrama[]> {
  return apiFetch<VersionDiagrama[]>(`/api/v1/diagramas/${diagramaId}/versiones`);
}

export function crearVersion(diagramaId: string, etiqueta: string, descripcionCambio?: string, autorId?: string): Promise<VersionDiagrama> {
  return apiFetch<VersionDiagrama>(`/api/v1/diagramas/${diagramaId}/versiones`, {
    method: 'POST',
    body: JSON.stringify({ etiqueta, descripcionCambio, autorId })
  });
}

export function restaurarVersion(diagramaId: string, versionId: string): Promise<any> {
  return apiFetch<any>(`/api/v1/diagramas/${diagramaId}/versiones/${versionId}/restaurar`, { method: 'POST' });
}

export function listarDiagramas(proyectoId?: string): Promise<any[]> {
  const query = proyectoId ? `?proyectoId=${encodeURIComponent(proyectoId)}` : '';
  return apiFetch<any[]>(`/api/v1/diagramas${query}`);
}

export function obtenerDiagrama(diagramaId: string): Promise<any> {
  return apiFetch<any>(`/api/v1/diagramas/${diagramaId}`);
}

// ─────────────────────────── CU-06 · IA Voz / Prompts ───────────────────────────

export function analizarComandoVoz(command: string): Promise<any> {
  return apiFetch<any>('/api/v1/ia/voz', {
    method: 'POST',
    body: JSON.stringify({ command })
  });
}

export function generarDiagramaConPrompt(prompt: string, titulo?: string): Promise<any> {
  return apiFetch<any>('/api/v1/ia/generar-diagrama', {
    method: 'POST',
    body: JSON.stringify({ prompt, titulo })
  });
}

// ─────────────────────────── CU-07 · OCR de Pizarra ───────────────────────────

export function procesarOcrPizarra(archivo: File, titulo?: string, onProgress?: (p: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/v1/ia/ocr-pizarra`);
    const form = new FormData();
    form.append('archivo', archivo);
    if (titulo) form.append('titulo', titulo);
    if (onProgress) {
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      try {
        const cuerpo = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(cuerpo);
        else reject(new ApiError(xhr.status, cuerpo?.mensaje || `Error OCR (${xhr.status})`));
      } catch {
        reject(new ApiError(xhr.status || 0, 'Respuesta OCR inválida'));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'Sin conexión con el servidor OCR'));
    xhr.send(form);
  });
}

// ─────────────────────────── CU-08 · Agente IA Contextual ───────────────────────────

export interface ConsultaContextual {
  mensaje: string;
  clasesActuales: any[];
  relacionesActuales: any[];
  contextoExtra?: string;
}

export interface RespuestaContextual {
  success: boolean;
  respuesta: string;
  alertas: string[];
  sugerencias: string[];
  clasesSugeridas: any[];
  relacionesSugeridas: any[];
  accionEjecutable?: string;
}

export function consultarAgenteContextual(consulta: ConsultaContextual): Promise<RespuestaContextual> {
  return apiFetch<RespuestaContextual>('/api/v1/ia/contexto', {
    method: 'POST',
    body: JSON.stringify(consulta)
  });
}

// ─────────────────────────── CU-10 a CU-14 · Generación ───────────────────────────

export function generarProyectoPreview(diagram: ModeloDiagrama): Promise<any> {
  return apiFetch<any>('/api/v1/generator/preview', {
    method: 'POST',
    body: JSON.stringify(construirPayloadDiagrama(diagram))
  });
}

export function generarSqlDdl(diagram: ModeloDiagrama): Promise<string> {
  return apiFetchText('/api/v1/generator/sql', JSON.stringify(construirPayloadDiagrama(diagram)));
}

export function generarColeccionPostman(diagram: ModeloDiagrama): Promise<string> {
  return apiFetchText('/api/v1/generator/postman', JSON.stringify(construirPayloadDiagrama(diagram)));
}

export function exportarXmi(diagram: ModeloDiagrama): Promise<string> {
  return apiFetchText('/api/v1/generator/xmi', JSON.stringify(construirPayloadDiagrama(diagram)));
}

async function apiFetchText(path: string, body: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });
  if (!res.ok) {
    let mensaje = `Error del servidor (${res.status})`;
    try {
      const cuerpo = await res.json();
      if (cuerpo?.mensaje) mensaje = cuerpo.mensaje;
    } catch { /* cuerpo no JSON */ }
    throw new ApiError(res.status, mensaje);
  }
  return res.text();
}

export function importarXmi(xmiContent: string, titulo?: string): Promise<any> {
  return apiFetch<any>('/api/v1/generator/xmi/importar', {
    method: 'POST',
    body: JSON.stringify({ xmiContent, titulo })
  });
}

export interface GeneracionHistorial {
  id: string;
  tipo: string;
  tituloDiagrama: string;
  nombreArchivo?: string;
  tamanoBytes?: number;
  usuarioId?: string;
  fechaCreacion: string;
}

/** CU-10..CU-14 · Listar historial de generaciones del backend. */
export function listarHistorialGeneraciones(tipo?: string): Promise<GeneracionHistorial[]> {
  const query = tipo ? `?tipo=${encodeURIComponent(tipo)}` : '';
  return apiFetch<GeneracionHistorial[]>(`/api/v1/generator/historial${query}`);
}

export function eliminarGeneracionHistorial(id: string): Promise<void> {
  return apiFetch<void>(`/api/v1/generator/historial/${id}`, { method: 'DELETE' });
}

export function descargarZipApi(diagram: ModeloDiagrama): Promise<Blob> {
  return fetch(`${API_BASE_URL}/api/v1/generator/zip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(construirPayloadDiagrama(diagram))
  }).then(async res => {
    if (!res.ok) throw new ApiError(res.status, 'No se pudo descargar el ZIP');
    return res.blob();
  });
}

// ─────────────────────────── CU-09 · Cola Offline (sincronización diferida) ───────────────────────────

const COLA_OFFLINE_KEY = 'archai_cola_offline';

export interface OperacionOffline {
  id: string;
  tipo: string;
  url: string;
  cuerpo: any;
  creadaEn: string;
}

export function encolarOperacionOffline(tipo: string, url: string, cuerpo: any): void {
  const operacion: OperacionOffline = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tipo,
    url,
    cuerpo,
    creadaEn: new Date().toISOString()
  };
  try {
    const cola: OperacionOffline[] = JSON.parse(localStorage.getItem(COLA_OFFLINE_KEY) || '[]');
    cola.push(operacion);
    localStorage.setItem(COLA_OFFLINE_KEY, JSON.stringify(cola));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function obtenerColaOffline(): OperacionOffline[] {
  try {
    return JSON.parse(localStorage.getItem(COLA_OFFLINE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function limpiarColaOffline(): void {
  localStorage.removeItem(COLA_OFFLINE_KEY);
}

/**
 * Reenvía las operaciones encoladas cuando hay conexión.
 * Devuelve la cantidad de operaciones sincronizadas.
 */
export async function sincronizarColaOffline(): Promise<number> {
  const cola = obtenerColaOffline();
  let sincronizadas = 0;
  for (const op of cola) {
    try {
      await apiFetch(op.url, { method: 'POST', body: JSON.stringify(op.cuerpo) });
      sincronizadas++;
    } catch {
      break; // sigue sin conexión: se detiene el flush
    }
  }
  if (sincronizadas > 0) {
    const restantes = cola.slice(sincronizadas);
    localStorage.setItem(COLA_OFFLINE_KEY, JSON.stringify(restantes));
  }
  return sincronizadas;
}

export function estaEnLinea(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

// ─────────────────────────── Sesión persistida ───────────────────────────

export function guardarSesionLocal(session: InformacionSesion, token?: string): void {
  localStorage.setItem('archai_session', JSON.stringify(session));
  if (token) localStorage.setItem('archai_token', token);
}

export function obtenerSesionLocal(): InformacionSesion | null {
  try {
    const guardada = localStorage.getItem('archai_session');
    return guardada ? (JSON.parse(guardada) as InformacionSesion) : null;
  } catch {
    return null;
  }
}

// ─────────────────────────── Auditoría de Madurez ───────────────────────────

export async function auditarMadurezBackend(diagram: ModeloDiagrama): Promise<any> {
  const payload = construirPayloadDiagrama(diagram);
  return apiFetch<any>('/api/v1/auditoria/madurez', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}