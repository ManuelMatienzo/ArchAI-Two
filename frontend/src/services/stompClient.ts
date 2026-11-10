import { API_BASE_URL } from './api';

/**
 * Cliente STOMP mínimo sobre WebSocket nativo (CU-03 · Sala Colaborativa STOMP).
 * Conecta al endpoint /ws-stomp del backend Spring (broker simple /topic, /queue)
 * y permite suscribirse al canal /topic/collab/{salaId} del diagrama en vivo.
 */
export class ClienteStomp {
  private ws: WebSocket | null = null;
  private subscriptionCounter = 0;
  private conectado = false;

  constructor(
    private roomId: string,
    private emisorId: string,
    private emisorNombre: string,
    private onMensaje: (payload: any) => void,
    private onEstado?: (estado: string) => void
  ) {}

  private notificar(estado: string): void {
    if (this.onEstado) this.onEstado(estado);
  }

  connect(timeoutMs = 8000): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocolo = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
      const url = `${protocolo}://${API_BASE_URL.replace(/^https?:\/\//, '')}/ws-stomp`;

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        reject(new Error('No se pudo crear el WebSocket STOMP'));
        return;
      }
      this.ws = ws;

      const temporizador = setTimeout(() => {
        ws.close();
        reject(new Error('Tiempo de espera agotado al conectar STOMP'));
      }, timeoutMs);

      ws.onopen = () => {
        this.notificar('Conectando al broker STOMP...');
        const token = localStorage.getItem('archai_token');
        this.enviarFrame('CONNECT', { 'accept-version': '1.2', host: 'archai', ...(token ? {Authorization:`Bearer ${token}`} : {}) }, '');
      };

      ws.onmessage = (evento) => {
        const frame = ClienteStomp.parsearFrame(String(evento.data));
        if (!frame) return;

        if (frame.command === 'CONNECTED') {
          clearTimeout(temporizador);
          this.conectado = true;
          this.suscribirse(this.roomId);
          this.notificar('Conectado al canal STOMP /topic/collab/' + this.roomId);
          resolve();
          return;
        }

        if (frame.command === 'ERROR') {
          clearTimeout(temporizador);
          this.notificar('Error STOMP: ' + frame.body);
          reject(new Error(frame.body || 'Error STOMP desconocido'));
          return;
        }

        if (frame.command === 'MESSAGE') {
          try {
            const payload = frame.body ? JSON.parse(frame.body) : {};
            this.onMensaje(payload);
          } catch {
            this.onMensaje({ texto: frame.body });
          }
        }
      };

      ws.onerror = () => {
        clearTimeout(temporizador);
        this.notificar('Error de conexión WebSocket STOMP');
        reject(new Error('Error de conexión STOMP (¿backend iniciado?)'));
      };

      ws.onclose = () => {
        this.conectado = false;
        this.notificar('Desconectado del broker STOMP');
      };
    });
  }

  private suscribirse(destino: string): void {
    const id = `sub-${this.subscriptionCounter++}`;
    this.enviarFrame('SUBSCRIBE', { id, destination: `/topic/collab/${destino}` }, '');
  }

  /**
   * Publica una acción colaborativa en el canal /app/collab/{salaId};
   * el backend la retransmite a todos los suscriptores del topic.
   * El payload sigue el DTO `MensajeColaboracionDto` del backend:
   * { salaId, tipo, emisorId, emisorNombre, payload, timestamp }.
   */
  publicar(tipo: string, payload: any): void {
    if (!this.conectado) return;
    this.enviarFrame(
      'SEND',
      {
        destination: `/app/collab/${this.roomId}`,
        'content-type': 'application/json'
      },
      JSON.stringify(construirMensajeColaboracion(this.roomId, tipo, this.emisorId, this.emisorNombre, payload))
    );
  }

  public estaConectado(): boolean {
    return this.conectado;
  }

  disconnect(): void {
    try {
      this.enviarFrame('DISCONNECT', {}, '');
    } catch {
      /* sin importar */
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.conectado = false;
  }

  private enviarFrame(command: string, headers: Record<string, string>, body: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    let frame = command + '\n';
    for (const [clave, valor] of Object.entries(headers)) {
      frame += `${clave}:${valor}\n`;
    }
    frame += '\n' + body + '\u0000';
    this.ws.send(frame);
  }

  private static parsearFrame(texto: string): { command: string; headers: Record<string, string>; body: string } | null {
    // Quitar delimitador nulo STOMP final si existe
    const indiceNulo = texto.indexOf('\u0000');
    const contenido = indiceNulo >= 0 ? texto.substring(0, indiceNulo) : texto;

    // En el protocolo STOMP, los encabezados y el cuerpo están separados por un salto de línea doble
    let indiceSeparador = contenido.indexOf('\n\n');
    let sepLen = 2;
    if (indiceSeparador === -1) {
      indiceSeparador = contenido.indexOf('\r\n\r\n');
      sepLen = 4;
    }

    let parteEncabezados: string;
    let body = '';

    if (indiceSeparador >= 0) {
      parteEncabezados = contenido.substring(0, indiceSeparador);
      body = contenido.substring(indiceSeparador + sepLen);
    } else {
      parteEncabezados = contenido;
    }

    const lineas = parteEncabezados.split(/\r?\n/);
    if (lineas.length === 0) return null;

    const command = lineas.shift()?.trim() || '';
    if (!command) return null;

    const headers: Record<string, string> = {};
    for (const linea of lineas) {
      if (!linea.trim()) continue;
      const indice = linea.indexOf(':');
      if (indice <= 0) continue;
      headers[linea.substring(0, indice).trim()] = linea.substring(indice + 1).trim();
    }
    return { command, headers, body };
  }
}

/** Forma el mensaje de colaboración estándar del flujo STOMP (DTO MensajeColaboracionDto). */
export function construirMensajeColaboracion(salaId: string, tipo: string, emisorId: string, emisorNombre: string, payload: unknown): any {
  return {
    salaId,
    tipo,
    emisorId,
    emisorNombre,
    payload,
    timestamp: Date.now()
  };
}