import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { getBackendUrl, getAuthToken } from './client';
import { CollabMessage, StompConnectionStatus } from '../types/uml';

export type MessageCallback = (data: any) => void;

interface QueuedMessage {
  destinations: string[];
  body: string;
}

export class MobileStompClient {
  private client: Client | null = null;
  private status: StompConnectionStatus = 'desconectado';
  private subscriptions: Map<string, StompSubscription> = new Map();
  private subscriptionCallbacks: Map<string, Set<MessageCallback>> = new Map();
  private statusListeners: Set<(status: StompConnectionStatus) => void> = new Set();
  private offlineQueue: QueuedMessage[] = [];
  private currentRoomId: string | null = null;

  private notifyStatus(newStatus: StompConnectionStatus) {
    this.status = newStatus;
    this.statusListeners.forEach((listener) => {
      try {
        listener(newStatus);
      } catch (err) {
        console.warn('[STOMP listener error]', err);
      }
    });
  }

  public getStatus(): StompConnectionStatus {
    return this.status;
  }

  public isConnected(): boolean {
    return this.status === 'conectado' && !!this.client?.connected;
  }

  public addStatusListener(listener: (status: StompConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  async connect(onConnectCallback?: () => void, onErrorCallback?: (err: any) => void) {
    if (this.client && this.isConnected()) {
      if (onConnectCallback) onConnectCallback();
      return;
    }

    this.notifyStatus('conectando');
    const backendUrl = await getBackendUrl();
    const wsUrl = backendUrl
      .replace('http://', 'ws://')
      .replace('https://', 'wss://')
      .replace('/api/v1', '/ws-stomp');

    const token = await getAuthToken();
    const connectHeaders: Record<string, string> = {};
    if (token) {
      connectHeaders['Authorization'] = `Bearer ${token}`;
    }

    this.client = new Client({
      brokerURL: wsUrl,
      connectHeaders,
      reconnectDelay: 3000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (_str) => {
        // Modo producción sin ruido de logs
      },
      onConnect: () => {
        this.notifyStatus('conectado');
        this.resubscribeAll();
        this.drainOfflineQueue();
        if (onConnectCallback) onConnectCallback();
      },
      onStompError: (frame) => {
        this.notifyStatus('error');
        if (onErrorCallback) onErrorCallback(frame);
      },
      onWebSocketClose: () => {
        this.notifyStatus('desconectado');
      },
    });

    this.client.activate();
  }

  private resubscribeAll() {
    if (!this.client || !this.client.connected) return;

    this.subscriptionCallbacks.forEach((listeners, dest) => {
      if (listeners.size === 0) return;
      try {
        const prevSub = this.subscriptions.get(dest);
        if (prevSub) {
          try { prevSub.unsubscribe(); } catch {}
        }

        const sub = this.client!.subscribe(dest, (message: IMessage) => {
          let payload: any;
          try {
            payload = JSON.parse(message.body);
          } catch {
            payload = message.body;
          }
          const currentListeners = this.subscriptionCallbacks.get(dest);
          if (currentListeners) {
            currentListeners.forEach((cb) => {
              try {
                cb(payload);
              } catch (err) {
                console.warn(`[STOMP] Error en callback de ${dest}:`, err);
              }
            });
          }
        });
        this.subscriptions.set(dest, sub);
      } catch (err) {
        console.warn(`[STOMP] Error al re-suscribir a ${dest}:`, err);
      }
    });
  }

  private drainOfflineQueue() {
    if (!this.client || !this.client.connected || this.offlineQueue.length === 0) return;

    const queueCopy = [...this.offlineQueue];
    this.offlineQueue = [];

    queueCopy.forEach(({ destinations, body }) => {
      destinations.forEach((dest) => {
        try {
          this.client!.publish({ destination: dest, body });
        } catch (e) {
          console.warn(`[STOMP] Error al despachar mensaje encolado a ${dest}:`, e);
        }
      });
    });
  }

  private genericSubscribe(dest: string, callback: MessageCallback): () => void {
    if (!this.subscriptionCallbacks.has(dest)) {
      this.subscriptionCallbacks.set(dest, new Set());
    }
    this.subscriptionCallbacks.get(dest)!.add(callback);

    if (this.client && this.client.connected && !this.subscriptions.has(dest)) {
      const sub = this.client.subscribe(dest, (message: IMessage) => {
        let payload: any;
        try {
          payload = JSON.parse(message.body);
        } catch {
          payload = message.body;
        }
        const listeners = this.subscriptionCallbacks.get(dest);
        if (listeners) {
          listeners.forEach((cb) => {
            try {
              cb(payload);
            } catch (err) {
              console.warn(`[STOMP] Error en callback de ${dest}:`, err);
            }
          });
        }
      });
      this.subscriptions.set(dest, sub);
    }

    return () => {
      const listeners = this.subscriptionCallbacks.get(dest);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.subscriptionCallbacks.delete(dest);
          const sub = this.subscriptions.get(dest);
          if (sub) {
            try { sub.unsubscribe(); } catch {}
            this.subscriptions.delete(dest);
          }
        }
      }
    };
  }

  subscribeRoomCollab(roomId: string, callback: MessageCallback) {
    this.currentRoomId = roomId;
    return this.genericSubscribe(`/topic/collab/${roomId}`, callback);
  }

  subscribeGhostDrafts(roomId: string, callback: MessageCallback) {
    return this.genericSubscribe(`/topic/room/${roomId}/ghost-draft`, callback);
  }

  subscribePresence(roomId: string, callback: MessageCallback) {
    return this.genericSubscribe(`/topic/room/${roomId}/presence`, callback);
  }

  sendJoin(roomId: string, user: { id: string; name: string; role?: string }) {
    if (!roomId || roomId === 'LOCAL-MODE') return;
    const body = JSON.stringify({
      salaId: roomId,
      tipo: 'join',
      emisorId: user.id,
      emisorNombre: user.name,
      payload: { usuario: user },
      timestamp: Date.now(),
    });

    if (this.isConnected()) {
      try {
        this.client!.publish({ destination: `/app/collab/${roomId}`, body });
      } catch (e) {
        console.warn('[STOMP] Error al enviar join:', e);
      }
    } else {
      this.offlineQueue.push({ destinations: [`/app/collab/${roomId}`], body });
    }
  }

  sendSolicitarDiagrama(roomId: string) {
    if (!roomId || roomId === 'LOCAL-MODE') return;
    const body = JSON.stringify({
      salaId: roomId,
      tipo: 'solicitar_diagrama',
      emisorId: 'usr-mobile-01',
      emisorNombre: 'Desarrollador Móvil',
      payload: {},
      timestamp: Date.now(),
    });

    if (this.isConnected()) {
      try {
        this.client!.publish({ destination: `/app/collab/${roomId}`, body });
      } catch (e) {
        console.warn('[STOMP] Error al solicitar diagrama:', e);
      }
    } else {
      this.offlineQueue.push({ destinations: [`/app/collab/${roomId}`], body });
    }
  }

  sendLeave(roomId: string, user: { id: string; name: string }) {
    if (!roomId || roomId === 'LOCAL-MODE') return;
    const body = JSON.stringify({
      salaId: roomId,
      tipo: 'leave',
      emisorId: user.id,
      emisorNombre: user.name,
      payload: { usuarioId: user.id },
      timestamp: Date.now(),
    });

    if (this.isConnected()) {
      try {
        this.client!.publish({ destination: `/app/collab/${roomId}`, body });
      } catch (e) {
        console.warn('[STOMP] Error al enviar leave:', e);
      }
    }
  }

  subscribeChat(roomId: string, callback: MessageCallback) {
    this.currentRoomId = roomId;

    const chatHandler = (data: any) => {
      // 1. Mensaje directo CollabMessage
      if (data && data.sender && data.content && data.roomId) {
        callback(data);
        return;
      }
      // 2. Mensaje envuelto en MensajeColaboracionDto del backend ({ tipo: 'chat', payload: CollabMessage })
      if (data && data.tipo === 'chat' && data.payload) {
        callback(data.payload);
        return;
      }
    };

    const unsub1 = this.genericSubscribe(`/topic/room/${roomId}/chat`, chatHandler);
    const unsub2 = this.genericSubscribe(`/topic/collab/${roomId}`, chatHandler);

    return () => {
      unsub1();
      unsub2();
    };
  }

  /**
   * Envía un mensaje de chat a la sala activa con encolamiento automático offline.
   */
  sendChatMessage(roomId: string, message: CollabMessage): boolean {
    const destinations = [
      `/app/collab/${roomId}`,
      `/topic/room/${roomId}/chat`,
    ];

    const backendPayload = JSON.stringify({
      salaId: roomId,
      tipo: 'chat',
      emisorId: message.sender,
      emisorNombre: message.sender,
      payload: message,
      timestamp: Date.now(),
    });

    if (this.isConnected()) {
      destinations.forEach((dest) => {
        try {
          this.client!.publish({
            destination: dest,
            body: dest.startsWith('/topic/') ? JSON.stringify(message) : backendPayload,
          });
        } catch (e) {
          console.warn(`[STOMP] Fallo al enviar a ${dest}:`, e);
        }
      });
      return true;
    } else {
      this.offlineQueue.push({
        destinations,
        body: backendPayload,
      });
      return false;
    }
  }

  unsubscribe(dest: string) {
    const sub = this.subscriptions.get(dest);
    if (sub) {
      try { sub.unsubscribe(); } catch {}
      this.subscriptions.delete(dest);
    }
    this.subscriptionCallbacks.delete(dest);
  }

  unsubscribeRoom(roomId: string) {
    this.unsubscribe(`/topic/collab/${roomId}`);
    this.unsubscribe(`/topic/room/${roomId}/ghost-draft`);
    this.unsubscribe(`/topic/room/${roomId}/chat`);
    this.unsubscribe(`/topic/room/${roomId}/presence`);
    if (this.currentRoomId === roomId) {
      this.currentRoomId = null;
    }
  }

  disconnect() {
    this.subscriptions.forEach((sub) => {
      try { sub.unsubscribe(); } catch {}
    });
    this.subscriptions.clear();
    this.subscriptionCallbacks.clear();
    this.offlineQueue = [];
    this.currentRoomId = null;

    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
    this.notifyStatus('desconectado');
  }
}

export const mobileStomp = new MobileStompClient();
