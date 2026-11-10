import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableOpacity,
  TextInput,
  AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { Bot, RefreshCw } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { CollabMessage, StompConnectionStatus } from '../types/uml';
import { mobileStomp } from '../api/stompClient';
import { ApiError } from '../api/client';
import { conversationApi, mergeRoomMessages, readCurrentUser, RoomMessage } from '../api/conversationApi';
import { ChatHeader } from '../components/chat/ChatHeader';
import { ChatMessageItem } from '../components/chat/ChatMessageItem';
import { QuickPromptsBar } from '../components/chat/QuickPromptsBar';
import { ChatInputRow } from '../components/chat/ChatInputRow';

const invokesAI = (text: string) => /(^|[^\w])@archai(?![\w])/i.test(text);
export const ChatScreen = ({ route, navigation }: any) => {
  const { roomId, roomName = 'Equipo & ArchAI', diagramId: initialId, projectId } = route.params || {};
  const [diagramId, setDiagramId] = useState<string | undefined>(initialId),
    [messages, setMessages] = useState<RoomMessage[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null),
    [inputMessage, setInputMessage] = useState(''),
    [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<StompConnectionStatus>(mobileStomp.getStatus());
  const [isInputFocused, setInputFocused] = useState(false),
    [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [proposalStatuses, setProposalStatuses] = useState<Record<string, string>>({});
  const flatListRef = useRef<FlatList<RoomMessage>>(null),
    inputRef = useRef<React.ElementRef<typeof TextInput>>(null),
    atBottom = useRef(true),
    live = useRef(true),
    flushing = useRef(false);
  const current = useRef({ diagramId, messages, currentUser, roomId });
  current.current = { diagramId, messages, currentUser, roomId };
  const cacheKey = `archai_chat_${currentUser?.id || 'pending'}_${roomId}`;
  const upsert = useCallback(
    (incoming: RoomMessage[]) =>
      setMessages((old) =>
        mergeRoomMessages(
          old,
          incoming.filter((m) => m.roomId === current.current.roomId)
        )
      ),
    []
  );
  const refresh = useCallback(async () => {
    const id = current.current.diagramId;
    if (!id) return;
    try {
      const state = await conversationApi.state(roomId, id);
      if (!live.current) return;
      upsert(state.messages);
      const statuses: Record<string, string> = {};
      state.review?.proposals?.forEach((p: any) => (statuses[p.id] = p.moderationStatus));
      setProposalStatuses(statuses);
      setError('');
    } catch (e) {
      if (live.current) setError(e instanceof Error ? e.message : 'No se pudo recuperar la conversación.');
    }
  }, [roomId, upsert]);
  useEffect(() => {
    live.current = true;
    setMessages([]);
    setDiagramId(initialId);
    let active = true;
    void readCurrentUser()
      .then(async (user) => {
        if (!active) return;
        setCurrentUser(user);
        if (!user) throw new Error('Inicia sesión para abrir el chat.');
        const cached = await AsyncStorage.getItem(`archai_chat_${user.id}_${roomId}`);
        if (cached && active) upsert(JSON.parse(cached));
        const session = await conversationApi.resolve(roomId, projectId, initialId);
        if (!active) return;
        setDiagramId(session.diagramId);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      live.current = false;
    };
  }, [roomId, projectId, initialId, upsert]);
  useEffect(() => {
    if (currentUser)
      void AsyncStorage.setItem(cacheKey, JSON.stringify(messages.filter((m) => m.roomId === roomId))).catch(
        () => {}
      );
  }, [messages, currentUser, cacheKey]);
  useEffect(() => {
    if (!diagramId) return;
    void refresh();
    const offStatus = mobileStomp.addStatusListener((status) => {
      setConnectionStatus(status);
      if (status === 'conectado') void refresh();
    });
    const offRoom = mobileStomp.subscribeRoomCollab(roomId, (event) => {
      if (event.tipo === 'chat_message' && event.payload?.roomId === roomId) upsert([event.payload]);
      if (event.tipo === 'ia_draft_state') {
        const statuses: Record<string, string> = {};
        event.payload?.proposals?.forEach((p: any) => (statuses[p.id] = p.moderationStatus));
        setProposalStatuses(statuses);
      }
    });
    void mobileStomp.connect();
    const interval = setInterval(() => void refresh(), 15000);
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      offStatus();
      offRoom();
      clearInterval(interval);
      app.remove();
    };
  }, [diagramId, roomId, refresh, upsert]);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true)),
      hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const send = async (raw: string, id: string = randomUUID()) => {
    const text = raw.trim(),
      c = current.current;
    if (!text || !c.currentUser) return;
    const optimistic: RoomMessage = {
      id,
      roomId,
      diagramId: c.diagramId || '',
      sequence: Date.now(),
      createdAt: new Date().toISOString(),
      role: 'human',
      authorId: c.currentUser.id,
      authorName: c.currentUser.name || c.currentUser.nombre || 'Tú',
      text,
      status: 'sending',
    };
    upsert([optimistic]);
    setError('');
    atBottom.current = true;
    if (!c.diagramId || !mobileStomp.isConnected()) {
      upsert([{ ...optimistic, status: 'offline' }]);
      setError(
        invokesAI(text)
          ? 'Consulta conservada. Pulsa Reintentar cuando vuelva la conexión para enviarla a ArchAI.'
          : 'Mensaje conservado. Se enviará al reconectar.'
      );
      return;
    }
    try {
      upsert([await conversationApi.send(roomId, c.diagramId, { id, text })]);
    } catch (e) {
      upsert([{ ...optimistic, status: e instanceof ApiError && e.status > 0 ? 'failed' : 'offline' }]);
      if (current.current.roomId === roomId)
        setError(e instanceof Error ? e.message : 'No se pudo enviar el mensaje.');
    }
  };
  useEffect(() => {
    if (connectionStatus !== 'conectado' || !diagramId || flushing.current) return;
    const queued = messages.filter(
      (m) => m.status === 'offline' && m.authorId === currentUser?.id && !invokesAI(m.text)
    );
    if (!queued.length) return;
    flushing.current = true;
    void (async () => {
      for (const m of queued) {
        if (current.current.roomId !== roomId) break;
        await send(m.text, m.id);
      }
    })().finally(() => {
      flushing.current = false;
    });
  }, [connectionStatus, diagramId, messages.filter((m) => m.status === 'offline').length]);
  const submit = (text = inputMessage) => {
    if (!text.trim()) return;
    setInputMessage('');
    void send(text);
  };
  const retry = (message: RoomMessage) => {
    if (message.role === 'human') void send(message.text, message.id);
    else {
      const request = messages.find((m) => m.id === message.replyTo);
      if (request) void send(request.text);
    }
  };
  const mapped = (m: RoomMessage): CollabMessage => ({
    id: m.id,
    authorId: m.authorId,
    messageRole: m.role,
    sender: m.authorName,
    senderRole: m.role === 'ai' ? 'ARCHAI_IA' : m.role === 'system' ? 'Colaborador' : 'Usuario',
    content:
      m.status === 'thinking'
        ? 'ArchAI está pensando…'
        : m.status === 'queued'
          ? 'ArchAI espera su turno…'
          : m.text,
    timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    fullDate: m.createdAt,
    isAiResponse: m.role === 'ai',
    roomId,
    status:
      m.status === 'sent'
        ? 'entregado'
        : m.status === 'offline' || m.status === 'failed'
          ? 'fallido'
          : 'enviando',
    avatarColor: m.avatarColor,
  });
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ChatHeader
        navigation={navigation}
        roomId={roomId}
        roomName={roomName}
        connectionStatus={connectionStatus}
      />
      <FlatList
        ref={flatListRef}
        data={messages.filter((m) => m.status !== 'skipped')}
        keyExtractor={(m) => m.id}
        style={styles.list}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          atBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 100;
        }}
        onContentSizeChange={() => {
          if (atBottom.current) flatListRef.current?.scrollToEnd({ animated: false });
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Bot size={32} color={colors.primary} />
            <Text style={styles.title}>Tu equipo, también en viaje</Text>
            <Text style={styles.hint}>
              Escribe a tus compañeros o menciona a @ArchAI para conversar con la IA.
            </Text>
          </View>
        }
        ListHeaderComponent={
          messages.length >= 100 ? (
            <TouchableOpacity
              onPress={async () => {
                if (!diagramId) return;
                atBottom.current = false;
                try {
                  upsert(await conversationApi.messages(roomId, diagramId, messages[0].sequence));
                } catch (e) {
                  setError('No se pudo cargar el historial anterior.');
                }
              }}
            >
              <Text style={styles.link}>Cargar mensajes anteriores</Text>
            </TouchableOpacity>
          ) : undefined
        }
        renderItem={({ item }) => (
          <View>
            <ChatMessageItem
              item={mapped(item)}
              currentUser={{
                id: currentUser?.id,
                name: currentUser?.name || currentUser?.nombre || '',
                role: currentUser?.role || '',
              }}
            />
            {item.provider && (
              <Text style={styles.meta}>
                {item.provider} · {item.model}
              </Text>
            )}
            {item.proposalId && (
              <View style={styles.proposal}>
                <Text style={styles.title}>
                  Propuesta de diseño · {proposalStatuses[item.proposalId] || 'pendiente'}
                </Text>
                <Text style={styles.hint}>
                  La revisión y aprobación se realizan desde la web. Aquí puedes supervisar sus cambios.
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('CanvasViewer', {
                      roomId,
                      roomName,
                      diagramId,
                      projectId,
                      proposalId: item.proposalId,
                    })
                  }
                >
                  <Text style={styles.link}>Ver en pizarra</Text>
                </TouchableOpacity>
              </View>
            )}
            {['offline', 'failed', 'interrupted'].includes(item.status) &&
              (item.authorId === currentUser?.id || item.requesterId === currentUser?.id) && (
                <TouchableOpacity onPress={() => retry(item)} style={styles.retry}>
                  <RefreshCw size={12} color={colors.primary} />
                  <Text style={styles.link}>Reintentar</Text>
                </TouchableOpacity>
              )}
            {['queued', 'thinking'].includes(item.status) && item.requesterId === currentUser?.id && (
              <TouchableOpacity
                onPress={async () => {
                  if (diagramId) {
                    try {
                      await conversationApi.cancel(roomId, diagramId, item.id);
                      await refresh();
                    } catch (e) {
                      setError('No se pudo cancelar la consulta.');
                    }
                  }
                }}
              >
                <Text style={styles.link}>Cancelar consulta</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
      {error ? (
        <View style={styles.error}>
          <Text style={styles.hint}>{error}</Text>
        </View>
      ) : null}
      {!isKeyboardVisible && (
        <QuickPromptsBar
          onSelectPrompt={(text) => {
            setInputMessage(text);
            inputRef.current?.focus();
          }}
          onLongPressPrompt={setInputMessage}
        />
      )}
      <ChatInputRow
        inputMessage={inputMessage}
        onChangeText={setInputMessage}
        onSend={() => submit()}
        onInsertMention={() => {
          setInputMessage((old) => (invokesAI(old) ? old : `@ArchAI ${old}`));
          inputRef.current?.focus();
        }}
        inputRef={inputRef}
        isFocused={isInputFocused}
        isKeyboardVisible={isKeyboardVisible}
        onFocus={() => setInputFocused(true)}
        onBlur={() => setInputFocused(false)}
      />
    </KeyboardAvoidingView>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1 },
  content: { padding: 16, gap: 12, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 25 },
  title: { color: colors.textPrimary, fontWeight: '700', fontSize: 12 },
  hint: { color: colors.textMuted, fontSize: 11, lineHeight: 18 },
  link: { color: colors.primary, fontSize: 12, fontWeight: '600', paddingVertical: 8 },
  meta: { color: colors.textMuted, fontSize: 10, paddingTop: 5 },
  proposal: {
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(232,195,158,.25)',
    borderRadius: 12,
    backgroundColor: colors.surface,
    gap: 4,
  },
  error: { padding: 12, borderTopWidth: 1, borderTopColor: colors.primary },
  retry: { flexDirection: 'row', gap: 6, alignItems: 'center' },
});
