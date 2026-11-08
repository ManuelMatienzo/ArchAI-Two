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
  private subscriptionCallbacks: Map<string, MessageCallback> = new Map();
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
        // En producción mantenemos los logs limpios
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

    this.subscriptionCallbacks.forEach((callback, dest) => {
      try {
        const prevSub = this.subscriptions.get(dest);
        if (prevSub) {
          try { prevSub.unsubscribe(); } catch {}
        }

        const sub = this.client!.subscribe(dest, (message: IMessage) => {
          try {
            const payload = JSON.parse(message.body);
            callback(payload);
          } catch (e) {
            callback(message.body);
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

  private genericSubscribe(dest: string, callback: MessageCallback) {
    this.subscriptionCallbacks.set(dest, callback);

    if (!this.client || !this.client.connected) {
      return;
    }

    const prevSub = this.subscriptions.get(dest);
    if (prevSub) {
      try { prevSub.unsubscribe(); } catch {}
    }

    const sub = this.client.subscribe(dest, (message: IMessage) => {
      try {
        const payload = JSON.parse(message.body);
        callback(payload);
      } catch (e) {
        callback(message.body);
      }
    });
    this.subscriptions.set(dest, sub);
  }

  subscribeRoomCollab(roomId: string, callback: MessageCallback) {
    this.currentRoomId = roomId;
    this.genericSubscribe(`/topic/collab/${roomId}`, callback);
  }

  subscribeGhostDrafts(roomId: string, callback: MessageCallback) {
    this.genericSubscribe(`/topic/room/${roomId}/ghost-draft`, callback);
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

    this.genericSubscribe(`/topic/room/${roomId}/chat`, chatHandler);
    this.genericSubscribe(`/topic/collab/${roomId}`, chatHandler);
  }

  /**
   * Envía un mensaje de chat a la sala activa con encolamiento automático offline.
   */
  sendChatMessage(roomId: string, message: CollabMessage): boolean {
    const destinations = [
      `/app/collab/${roomId}`,
      `/topic/room/${roomId}/chat`
    ];

    const backendPayload = JSON.stringify({
      salaId: roomId,
      tipo: 'chat',
      emisorId: message.sender,
      emisorNombre: message.sender,
      payload: message,
      timestamp: Date.now()
    });

    if (this.isConnected()) {
      destinations.forEach((dest) => {
        try {
          this.client!.publish({
            destination: dest,
            body: dest.startsWith('/topic/') ? JSON.stringify(message) : backendPayload
          });
        } catch (e) {
          console.warn(`[STOMP] Fallo al enviar a ${dest}:`, e);
        }
      });
      return true;
    } else {
      this.offlineQueue.push({
        destinations,
        body: backendPayload
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
