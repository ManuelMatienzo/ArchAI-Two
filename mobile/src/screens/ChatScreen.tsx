import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeft } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { CollabMessage } from '../types/uml';
import { mobileStomp } from '../api/stompClient';

export const ChatScreen = ({ route, navigation }: any) => {
  const { roomId = 'ARC-1029' } = route.params || {};

  const flatListRef = useRef<FlatList<CollabMessage>>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<{ name: string; role: string }>({
    name: 'Tú (Móvil)',
    role: 'Desarrollador Móvil'
  });

  const [messages, setMessages] = useState<CollabMessage[]>([
    {
      id: 'm1',
      sender: 'Carlos (Líder)',
      senderRole: 'Usuario',
      content: 'Acabo de modelar Cliente y Venta con sus respectivas llaves.',
      timestamp: '10:14',
      roomId,
    },
    {
      id: 'm2',
      sender: 'Andrea (Revisor)',
      senderRole: 'Colaborador',
      content: '¿No deberíamos desacoplar DetalleVenta como clase asociativa?',
      timestamp: '10:15',
      roomId,
    },
    {
      id: 'm3',
      sender: 'ArchAI Assistant',
      senderRole: 'Agente IA Co-Developer',
      content: 'Correcto Andrea. Bajo la 3FN, DetalleVenta debe registrar precioUnitario inmutable para conservar el historial fiscal.',
      timestamp: '10:16',
      isAiResponse: true,
      roomId,
    },
  ]);

  // Cargar perfil del usuario autenticado
  useEffect(() => {
    AsyncStorage.getItem('archai_session').then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.user?.name) {
            setCurrentUser({
              name: parsed.user.name,
              role: parsed.user.role || 'Desarrollador Móvil'
            });
          }
        } catch {}
      }
    });
  }, []);

  // Conexión y suscripción a STOMP
  useEffect(() => {
    let isSubscribed = true;

    const handleIncomingMessage = (incoming: CollabMessage) => {
      if (!isSubscribed || !incoming) return;

      setMessages((prev) => {
        // Evitar duplicados por id
        if (prev.some((m) => m.id === incoming.id)) {
          return prev;
        }
        return [...prev, incoming];
      });
    };

    // Conectar si no está conectado
    mobileStomp.connect(() => {
      if (!isSubscribed) return;
      mobileStomp.subscribeChat(roomId, handleIncomingMessage);
    });

    if (mobileStomp.isConnected()) {
      mobileStomp.subscribeChat(roomId, handleIncomingMessage);
    }

    return () => {
      isSubscribed = false;
      mobileStomp.unsubscribe(`/topic/room/${roomId}/chat`);
      mobileStomp.unsubscribe(`/topic/collab/${roomId}`);
    };
  }, [roomId]);

  // Auto-scroll al final ante nuevos mensajes
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  const handleSend = () => {
    if (!inputMessage.trim()) return;

    const text = inputMessage.trim();
    const newMsg: CollabMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      sender: currentUser.name,
      senderRole: 'DESARROLLADOR_MOVIL',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fullDate: new Date().toISOString(),
      roomId,
      status: 'enviando'
    };

    // 1. Mostrar de inmediato en la lista local con estado optimista
    setMessages((prev) => [...prev, newMsg]);
    setInputMessage('');

    // 2. Transmitir por STOMP al backend y compañeros
    const sent = mobileStomp.sendChatMessage(roomId, {
      ...newMsg,
      status: 'entregado'
    });

    if (sent) {
      setMessages((prev) =>
        prev.map((m) => (m.id === newMsg.id ? { ...m, status: 'entregado' } : m))
      );
    }

    // 3. Si menciona @ArchAI, simular y emitir respuesta técnica de la IA
    if (text.includes('@ArchAI')) {
      setTimeout(() => {
        const aiReply: CollabMessage = {
          id: 'ai_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          sender: 'ArchAI Assistant',
          senderRole: 'ARCHAI_IA',
          content: 'He analizado tu consulta. Para el caso de uso propuesto, sugiero proyectar un borrador translúcido en la pizarra para revisión del equipo.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          fullDate: new Date().toISOString(),
          isAiResponse: true,
          roomId,
          status: 'entregado'
        };
        // Emitir respuesta por STOMP para que el cliente Web la reciba
        mobileStomp.sendChatMessage(roomId, aiReply);
        setMessages((prev) => {
          if (prev.some((m) => m.id === aiReply.id)) return prev;
          return [...prev, aiReply];
        });
      }, 1000);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Top Info */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.roomBadge}>{roomId} · Chat de Equipo</Text>
            <Text style={styles.aiHint}>Escribe @ArchAI para consultar al Co-Developer</Text>
          </View>
        </View>
      </View>

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isMyMessage =
            item.sender === currentUser.name ||
            item.senderRole === 'DESARROLLADOR_MOVIL' ||
            item.senderRole === 'Desarrollador Móvil';
          const isAi =
            item.isAiResponse ||
            item.senderRole === 'ARCHAI_IA' ||
            item.senderRole === 'Agente IA Co-Developer' ||
            item.sender.includes('ArchAI');

          return (
            <View
              style={[
                styles.msgBubble,
                isAi && styles.aiBubble,
                isMyMessage && styles.myBubble,
              ]}
            >
              <View style={styles.bubbleHeader}>
                <Text style={[styles.senderName, isAi && styles.aiSenderName]}>
                  {item.sender}
                </Text>
                <Text style={styles.timestamp}>{item.timestamp}</Text>
              </View>
              <Text style={styles.msgContent}>{item.content}</Text>
            </View>
          );
        }}
      />

      {/* Input Row */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputMessage}
          onChangeText={setInputMessage}
          placeholder="Escribe un mensaje o menciona @ArchAI..."
          placeholderTextColor={colors.textMuted}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendBtnText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.surfaceGlass,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    padding: 4,
    marginRight: 4,
  },
  roomBadge: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  aiHint: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  msgBubble: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    padding: 12,
    maxWidth: '85%',
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  aiBubble: {
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    borderColor: colors.ghostBorder,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  bubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  senderName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  aiSenderName: {
    color: colors.primary,
  },
  timestamp: {
    color: colors.textMuted,
    fontSize: 10,
    marginLeft: 8,
  },
  msgContent: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderGlass,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#0b0f19',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
