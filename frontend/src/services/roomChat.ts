import { apiFetch } from './api';
import { Proposal } from './proposalAgent';
export interface RoomMessage {
  id: string;
  roomId: string;
  diagramId: string;
  sequence: number;
  createdAt: string;
  role: 'human' | 'ai' | 'system';
  authorId: string;
  authorName: string;
  username?: string;
  avatarColor?: string;
  text: string;
  status:
    | 'sending'
    | 'sent'
    | 'queued'
    | 'thinking'
    | 'failed'
    | 'interrupted'
    | 'cancelled'
    | 'skipped'
    | 'offline';
  replyTo?: string;
  requesterId?: string;
  provider?: string;
  model?: string;
  proposalId?: string;
  proposal?: Proposal;
  automatic?: boolean;
}
export interface RoomSettings {
  mode: 'cloud' | 'local';
  model: string;
  observing: boolean;
  canConfigure: boolean;
  cloud: {
    available: boolean;
    claudeAvailable: boolean;
    fallbackEnabled: boolean;
    testControls: boolean;
    geminiModel: string;
    claudeModel: string;
  };
}
export interface Checkpoint {
  id: string;
  savedAt: string;
  classes: number;
}
export const roomPath = (room: string, _id: string) =>
  `/api/v1/colaboracion/salas/${encodeURIComponent(room)}`;
export const roomQuery = (id: string) => `?diagramId=${encodeURIComponent(id)}`;
export const postRoomMessage = (
  room: string,
  id: string,
  message: { id: string; text: string; options?: unknown }
) =>
  apiFetch<RoomMessage>(`${roomPath(room, id)}/mensajes${roomQuery(id)}`, {
    method: 'POST',
    body: JSON.stringify(message),
  });
export const mentionsArchAI = (text: string) => /(^|[^\p{L}\p{N}_])@archai(?![\p{L}\p{N}_])/iu.test(text);
export function mergeMessages(current: RoomMessage[], incoming: RoomMessage[]) {
  const next = new Map(current.map((m) => [m.id, m]));
  incoming.forEach((m) => next.set(m.id, m));
  return [...next.values()].sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
}
