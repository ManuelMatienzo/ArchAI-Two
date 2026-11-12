import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Users, Sparkles } from 'lucide-react-native';
import { colors } from '../theme/colors';
import {
  CollabMessage,
  StompConnectionStatus,
  UmlClass,
  UmlRelationship,
} from '../types/uml';
import { mobileStomp } from '../api/stompClient';
import { mobileApi } from '../api/client';
import { roomsApi } from '../api/roomsApi';
import { auditUmlModelWithSnippet } from '../utils/umlAuditor';
import { diagramCacheService } from '../services/diagramCacheService';
import { ChatHeader } from '../components/chat/ChatHeader';
import { ChatMessageItem } from '../components/chat/ChatMessageItem';
import { QuickPromptsBar } from '../components/chat/QuickPromptsBar';
import { ChatInputRow } from '../components/chat/ChatInputRow';

const INITIAL_WELCOME_MESSAGES = (roomId: string, roomName: string): CollabMessage[] => [
  {
    id: 'sys_' + Date.now(),
    sender: 'ArchAI Assistant',
    senderRole: 'ARCHAI_IA',
    content: `Te has conectado a la sala colaborativa "${roomName}" (${roomId}). Puedes interactuar con tu equipo en tiempo real o mencionar a @ArchAI para auditar la arquitectura, validar 3FN o generar código.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    fullDate: new Date().toISOString(),
    isAiResponse: true,
    roomId,
    status: 'entregado',
  },
];

export const ChatScreen = ({ route, navigation }: any) => {
  const {
    roomId = 'ARC-1029',
    roomName = 'Sala de Co-Diseno',
    classes: routeClasses = [],
    relationships: routeRelationships = [],
  } = route.params || {};

  const [activeClasses, setActiveClasses] = useState<UmlClass[]>(
    Array.isArray(routeClasses) && routeClasses.length > 0 ? routeClasses : []
  );
  const [activeRelationships, setActiveRelationships] = useState<UmlRelationship[]>(
    Array.isArray(routeRelationships) && routeRelationships.length > 0
      ? routeRelationships
      : []
  );

  const flatListRef = useRef<FlatList<CollabMessage>>(null);
  const inputRef = useRef<any>(null);

  const [inputMessage, setInputMessage] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<StompConnectionStatus>('desconectado');
  const [currentUser, setCurrentUser] = useState<{ id?: string; name: string; role: string }>({
    name: 'Tu (Movil)',
    role: 'Desarrollador Movil',
  });

  const [messages, setMessages] = useState<CollabMessage[]>([]);

  // 1. Cargar historial persistido de la sala desde almacenamiento local (purgando mockups residuales)
  useEffect(() => {
    const chatStorageKey = 'archai_chat_history_' + roomId;
    AsyncStorage.getItem(chatStorageKey).then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const clean = parsed.filter(
              (m: any) =>
                m.id !== 'm1' &&
                m.id !== 'm2' &&
                m.id !== 'm3' &&
                !m.content?.includes('DetalleVenta como clase asociativa') &&
                !m.content?.includes('respectivas llaves')
            );
            if (clean.length > 0) {
              setMessages(clean);
              return;
            }
          }
        } catch {}
      }
      setMessages(INITIAL_WELCOME_MESSAGES(roomId, roomName));
    });
  }, [roomId, roomName]);

  // 2. Guardar mensajes al actualizarse
  useEffect(() => {
    if (messages.length > 0) {
      const chatStorageKey = 'archai_chat_history_' + roomId;
      AsyncStorage.setItem(chatStorageKey, JSON.stringify(messages.slice(-50))).catch(() => {});
    }
  }, [messages, roomId]);

  // 3. Sincronizar clases y relaciones activas desde el cache o backend si no llegaron por params
  useEffect(() => {
    if (activeClasses.length === 0) {
      let isMounted = true;
      diagramCacheService.getCachedDiagram(roomId).then((cached) => {
        if (!isMounted) return;
        if (cached && Array.isArray(cached.classes) && cached.classes.length > 0) {
          setActiveClasses(cached.classes);
          if (Array.isArray(cached.relationships)) {
            setActiveRelationships(cached.relationships);
          }
          return;
        }

        roomsApi.getRoomDiagram(roomId).then((diagram) => {
          if (!isMounted) return;
          if (diagram && Array.isArray(diagram.classes) && diagram.classes.length > 0) {
            setActiveClasses(diagram.classes);
            if (Array.isArray(diagram.relationships)) {
              setActiveRelationships(diagram.relationships);
            }
          }
        }).catch(() => {});
      }).catch(() => {});

      return () => {
        isMounted = false;
      };
    }
  }, [roomId, activeClasses.length]);

  // 4. Cargar perfil autenticado con ID y nombre
  useEffect(() => {
    AsyncStorage.getItem('archai_session').then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const u = parsed?.user || parsed;
          if (u?.nombre || u?.name || u?.id) {
            setCurrentUser({
              id: u.id ? String(u.id) : undefined,
              name: u.nombre || u.name || 'Desarrollador Móvil',
              role: u.rol || u.role || 'Desarrollador Móvil',
            });
          }
        } catch {}
      }
    });
  }, []);

  // 5. Escuchar estado de conexion STOMP
  useEffect(() => {
    const unsubStatus = mobileStomp.addStatusListener((status) => {
      setConnectionStatus(status);
    });
    return unsubStatus;
  }, []);

  // 6. Suscripcion a la sala en tiempo real (Chat + Propuestas IA + Diagrama en vivo)
  useEffect(() => {
    let isSubscribed = true;
    let unsubscribeChat: (() => void) | undefined;
    let unsubscribeDiagram: (() => void) | undefined;

    const handleIncomingMessage = (incoming: CollabMessage) => {
      if (!isSubscribed || !incoming) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        // Evitar duplicación de notificaciones de presencia idénticas consecutivas
        if (incoming.isSystemNotification) {
          const last = prev[prev.length - 1];
          if (last && last.isSystemNotification && last.content === incoming.content) {
            return prev;
          }
        }
        return [...prev, incoming];
      });
    };

    // Callback para actualizaciones de diagrama concurrentes desde web
    const handleCollabEvents = (event: any) => {
      if (!isSubscribed || !event) return;
      if (event.tipo === 'diagrama' && event.payload) {
        try {
          const diag = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
          if (diag && Array.isArray(diag.classes)) {
            setActiveClasses(diag.classes);
            if (Array.isArray(diag.relationships)) {
              setActiveRelationships(diag.relationships);
            }
          }
        } catch {}
      }
    };

    void mobileStomp.connect(() => {
      if (!isSubscribed) return;
      unsubscribeChat?.();
      unsubscribeDiagram?.();
      unsubscribeChat = mobileStomp.subscribeChat(roomId, handleIncomingMessage);
      unsubscribeDiagram = mobileStomp.subscribeRoomCollab(roomId, handleCollabEvents);
    }).catch(() => {});

    return () => {
      isSubscribed = false;
      unsubscribeChat?.();
      unsubscribeDiagram?.();
    };
  }, [roomId]);

  // 7. Auto-scroll al final ante nuevos mensajes
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  // 8. Escucha reactiva del teclado
  useEffect(() => {
    const onKeyboardShow = () => {
      setIsKeyboardVisible(true);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    };

    const onKeyboardHide = () => {
      setIsKeyboardVisible(false);
    };

    const willShowSub = Keyboard.addListener('keyboardWillShow', onKeyboardShow);
    const didShowSub = Keyboard.addListener('keyboardDidShow', onKeyboardShow);
    const willHideSub = Keyboard.addListener('keyboardWillHide', onKeyboardHide);
    const didHideSub = Keyboard.addListener('keyboardDidHide', onKeyboardHide);

    return () => {
      willShowSub.remove();
      didShowSub.remove();
      willHideSub.remove();
      didHideSub.remove();
    };
  }, []);

  // Interoperabilidad Chat -> Visor de Diagrama enfocando una entidad
  const handleFocusClass = useCallback(
    (classId: string) => {
      navigation.navigate('CanvasViewer', {
        roomId,
        roomName,
        focusClassId: classId,
        classes: activeClasses,
        relationships: activeRelationships,
      });
    },
    [navigation, roomId, roomName, activeClasses, activeRelationships]
  );

  const handleSendText = useCallback(
    (rawText?: string) => {
      const textToSend = (rawText !== undefined ? rawText : inputMessage).trim();
      if (!textToSend) return;

      const newMsg: CollabMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        sender: currentUser.name,
        senderId: currentUser.id,
        senderRole: (currentUser.role as any) || 'DESARROLLADOR_MOVIL',
        content: textToSend,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fullDate: new Date().toISOString(),
        roomId,
        status: 'enviando',
      };

      setMessages((prev) => [...prev, newMsg]);
      setInputMessage('');

      const sent = mobileStomp.sendChatMessage(roomId, {
        ...newMsg,
        status: 'entregado',
      });

      if (sent) {
        setMessages((prev) =>
          prev.map((m) => (m.id === newMsg.id ? { ...m, status: 'entregado' } : m))
        );
      }

      // Si menciona @ArchAI, respuesta analitica real (Backend REST CU-08 + Codegen determinista)
      if (textToSend.includes('@ArchAI')) {
        setIsAiThinking(true);
        const cleanPrompt = textToSend.replace(/@ArchAI/gi, '').trim();

        // 1. Solicitudes directas de codigo o auditoria 3FN: generacion determinista inmediata
        const isCodeOr3Fn =
          cleanPrompt.toLowerCase().includes('jpa') ||
          cleanPrompt.toLowerCase().includes('sql') ||
          cleanPrompt.toLowerCase().includes('ddl') ||
          cleanPrompt.toLowerCase().includes('3fn') ||
          cleanPrompt.toLowerCase().includes('normal') ||
          cleanPrompt.toLowerCase().includes('codigo');

        if (isCodeOr3Fn) {
          setTimeout(() => {
            const aiResult = auditUmlModelWithSnippet(cleanPrompt, activeClasses, activeRelationships);
            setIsAiThinking(false);

            const mentionedClass = activeClasses.find((c) =>
              cleanPrompt.toLowerCase().includes(c.name.toLowerCase()) ||
              aiResult.content.toLowerCase().includes(c.name.toLowerCase())
            );

            const aiReply: CollabMessage = {
              id: 'ai_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              sender: 'ArchAI Assistant',
              senderRole: 'ARCHAI_IA',
              content: aiResult.content,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              fullDate: new Date().toISOString(),
              isAiResponse: true,
              roomId,
              status: 'entregado',
              codeSnippet: aiResult.codeSnippet,
              targetClassId: mentionedClass?.id,
            };

            mobileStomp.sendChatMessage(roomId, aiReply);
            setMessages((prev) => {
              if (prev.some((m) => m.id === aiReply.id)) return prev;
              return [...prev, aiReply];
            });
          }, 500);
          return;
        }

        // 2. Consultas analiticas al backend real Spring Boot (/api/v1/ia/contexto)
        mobileApi
          .consultarAgenteIa(cleanPrompt, activeClasses, activeRelationships)
          .then((backendRes) => {
            setIsAiThinking(false);
            let contentText = '';
            if (backendRes && backendRes.respuesta) {
              contentText = backendRes.respuesta;
              if (backendRes.alertas && backendRes.alertas.length > 0) {
                contentText += '\n\n⚠️ Alertas:\n• ' + backendRes.alertas.join('\n• ');
              }
              if (backendRes.sugerencias && backendRes.sugerencias.length > 0) {
                contentText += '\n\n💡 Sugerencias:\n• ' + backendRes.sugerencias.join('\n• ');
              }
            } else {
              contentText = auditUmlModelWithSnippet(cleanPrompt, activeClasses, activeRelationships).content;
            }

            const mentionedClass = activeClasses.find((c) =>
              cleanPrompt.toLowerCase().includes(c.name.toLowerCase()) ||
              contentText.toLowerCase().includes(c.name.toLowerCase())
            );

            const aiReply: CollabMessage = {
              id: 'ai_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              sender: 'ArchAI Assistant',
              senderRole: 'ARCHAI_IA',
              content: contentText,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              fullDate: new Date().toISOString(),
              isAiResponse: true,
              roomId,
              status: 'entregado',
              targetClassId: mentionedClass?.id,
            };

            mobileStomp.sendChatMessage(roomId, aiReply);
            setMessages((prev) => {
              if (prev.some((m) => m.id === aiReply.id)) return prev;
              return [...prev, aiReply];
            });
          })
          .catch(() => {
            // Fallback autonomo local si el backend REST no responde
            setIsAiThinking(false);
            const fallbackResult = auditUmlModelWithSnippet(cleanPrompt, activeClasses, activeRelationships);
            const mentionedClass = activeClasses.find((c) =>
              cleanPrompt.toLowerCase().includes(c.name.toLowerCase()) ||
              fallbackResult.content.toLowerCase().includes(c.name.toLowerCase())
            );

            const aiReply: CollabMessage = {
              id: 'ai_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              sender: 'ArchAI Assistant',
              senderRole: 'ARCHAI_IA',
              content: fallbackResult.content,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              fullDate: new Date().toISOString(),
              isAiResponse: true,
              roomId,
              status: 'entregado',
              codeSnippet: fallbackResult.codeSnippet,
              targetClassId: mentionedClass?.id,
            };

            mobileStomp.sendChatMessage(roomId, aiReply);
            setMessages((prev) => {
              if (prev.some((m) => m.id === aiReply.id)) return prev;
              return [...prev, aiReply];
            });
          });
      }
    },
    [currentUser.name, inputMessage, roomId, activeClasses, activeRelationships]
  );

  const handleSelectQuickPrompt = useCallback(
    (prompt: string) => {
      handleSendText(prompt);
    },
    [handleSendText]
  );

  const handleLongPressQuickPrompt = useCallback((prompt: string) => {
    setInputMessage(prompt);
    inputRef.current?.focus();
  }, []);

  const handleInsertBotMention = useCallback(() => {
    if (!inputMessage.includes('@ArchAI')) {
      setInputMessage((prev) => (prev ? `@ArchAI ${prev}` : '@ArchAI '));
      inputRef.current?.focus();
    }
  }, [inputMessage]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* 1. Header Superior Ergonomico */}
      <ChatHeader
        navigation={navigation}
        roomId={roomId}
        roomName={roomName}
        connectionStatus={connectionStatus}
      />

      {/* 2. Lista de Mensajes con Auto-Scroll y Soporte de Codigo */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.flatList}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }}
        onLayout={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }}
        ListHeaderComponent={
          <View style={styles.sessionHeaderBanner}>
            <View style={styles.sessionPill}>
              <Users size={11} color={colors.primary} style={{ marginRight: 5 }} />
              <Text style={styles.sessionPillText}>SALA DE CO-DISENO ACTIVA</Text>
            </View>
            <Text style={styles.sessionSubtext}>
              Supervision en Modo Viaje · STOMP WebSocket Bidireccional
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ChatMessageItem
            item={item}
            currentUser={currentUser}
            onFocusClass={handleFocusClass}
          />
        )}
      />

      {/* Indicador de Analisis en Vivo de @ArchAI */}
      {isAiThinking && (
        <View style={styles.aiThinkingRow}>
          <Sparkles size={13} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.aiThinkingText}>
            ArchAI Co-Developer esta evaluando la arquitectura...
          </Text>
        </View>
      )}

      {/* 3. Carrusel Horizontal de Atajos Rapidos a @ArchAI (visible en reposo) */}
      {!isKeyboardVisible && (
        <QuickPromptsBar
          onSelectPrompt={handleSelectQuickPrompt}
          onLongPressPrompt={handleLongPressQuickPrompt}
        />
      )}

      {/* 4. Barra Inferior de Entrada de Texto Ergonomica */}
      <ChatInputRow
        inputMessage={inputMessage}
        onChangeText={setInputMessage}
        onSend={() => handleSendText()}
        onInsertMention={handleInsertBotMention}
        inputRef={inputRef}
        isFocused={isInputFocused}
        isKeyboardVisible={isKeyboardVisible}
        onFocus={() => {
          setIsInputFocused(true);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }}
        onBlur={() => setIsInputFocused(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  aiThinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(47, 44, 121, 0.40)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(232, 195, 158, 0.25)',
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  aiThinkingText: {
    color: colors.primary,
    fontSize: 11.5,
    fontStyle: 'italic',
    fontWeight: '600',
  },
  flatList: {
    flex: 1,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  sessionHeaderBanner: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(23, 26, 74, 0.45)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.15)',
  },
  sessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  sessionPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.6,
  },
  sessionSubtext: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
