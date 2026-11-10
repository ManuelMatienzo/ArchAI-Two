import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from './client';
import { GhostDraftProposal } from '../types/uml';
import { parseBackendDiagram } from './roomsApi';
import { normalizeDiagramCoordinates } from '../utils/diagramSanitizer';

export interface RoomMessage {
  id: string;
  roomId: string;
  diagramId: string;
  sequence: number;
  createdAt: string;
  role: 'human' | 'ai' | 'system';
  authorId: string;
  authorName: string;
  text: string;
  status: string;
  replyTo?: string;
  requesterId?: string;
  provider?: string;
  model?: string;
  proposalId?: string;
  proposal?: any;
  avatarColor?: string;
}
export interface RoomSession {
  roomId: string;
  roomName: string;
  diagramId?: string;
  projectId?: string;
  currentUser: any;
  participants: any[];
}
export const chatPath = (room: string, id: string, suffix: string) =>
  `/colaboracion/salas/${encodeURIComponent(room)}${suffix}?diagramId=${encodeURIComponent(id)}`;
export const readCurrentUser = async () => {
  const saved = await AsyncStorage.getItem('archai_session');
  const session = saved ? JSON.parse(saved) : null;
  return session?.user || session?.currentUser || null;
};
export const conversationApi = {
  resolve: async (room?: string, projectId?: string, diagramId?: string): Promise<RoomSession> => {
    let id = diagramId;
    if (!id && projectId) {
      const items = await apiFetch(`/diagramas?proyectoId=${encodeURIComponent(projectId)}`);
      id = items?.[0]?.id;
    }
    if (!id && room) {
      const saved = await apiFetch(`/colaboracion/salas/${encodeURIComponent(room)}`);
      id = saved.diagramId;
    }
    if (!id)
      throw new Error(
        'La sala aún no tiene un diagrama guardado. Ábrelo desde la web o selecciona su proyecto.'
      );
    return apiFetch('/colaboracion/salas/abrir', {
      method: 'POST',
      body: JSON.stringify({ diagramId: id, ...(!projectId && room ? { roomId: room } : {}) }),
    });
  },
  state: (room: string, id: string) => apiFetch(chatPath(room, id, '/sesion')),
  messages: (room: string, id: string, before = 0) =>
    apiFetch(`${chatPath(room, id, '/mensajes')}&before=${before}&limit=100`) as Promise<RoomMessage[]>,
  send: (room: string, id: string, message: { id: string; text: string }) =>
    apiFetch(chatPath(room, id, '/mensajes'), {
      method: 'POST',
      body: JSON.stringify(message),
    }) as Promise<RoomMessage>,
  cancel: (room: string, id: string, messageId: string) =>
    apiFetch(chatPath(room, id, `/mensajes/${encodeURIComponent(messageId)}`), { method: 'DELETE' }),
};
export function mergeRoomMessages(current: RoomMessage[], incoming: RoomMessage[]) {
  const all = new Map(current.map((m) => [m.id, m]));
  incoming.forEach((m) => all.set(m.id, m));
  return [...all.values()].sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
}
export function toGhostDraft(review: any, proposalId?: string): GhostDraftProposal | null {
  const active = review?.proposals?.find(
    (p: any) =>
      p.id === (proposalId || review.activeId) && ['pending', 'partial'].includes(p.moderationStatus)
  );
  if (!active?.diagram) return null;
  const official = review.official?.classes || [];
  const parsed = parseBackendDiagram({
    classes: [...official, ...active.diagram.classes],
    relations: active.diagram.relations,
  });
  const ids = new Set(active.diagram.classes.map((c: any) => c.id));
  const { offsetX, offsetY } = normalizeDiagramCoordinates(
    parseBackendDiagram({ classes: official }).classes
  );
  return {
    id: active.id,
    title: 'Propuesta de ArchAI',
    description: active.explanation || '',
    reasoning: active.explanation || '',
    author: 'IA Co-Developer (@ArchAI)',
    status: 'PENDING',
    timestamp: new Date(active.requestedAt || Date.now()).toISOString(),
    classes: parsed.classes
      .filter((c) => ids.has(c.id))
      .map((c) => ({ ...c, x: c.x + offsetX, y: c.y + offsetY })),
    relationships: parsed.relationships,
    deletions: active.diagram.deletions || [],
  };
}
