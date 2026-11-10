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
import { auditUmlModel } from '../utils/umlAuditor';
import { ChatHeader } from '../components/chat/ChatHeader';
import { ChatMessageItem } from '../components/chat/ChatMessageItem';
import { QuickPromptsBar } from '../components/chat/QuickPromptsBar';
import { ChatInputRow } from '../components/chat/ChatInputRow';

const DEFAULT_CLASSES: UmlClass[] = [
  {
    id: 'c1',
    name: 'Cliente',
    stereotype: 'Entity',
    tableName: 'clientes',
    x: 60,
    y: 80,
    width: 200,
    height: 180,
    attributes: [
      { id: 'a1', name: 'id', type: 'Long', visibility: '-', isPrimaryKey: true },
      { id: 'a2', name: 'dniRuc', type: 'String', visibility: '-' },
      { id: 'a3', name: 'nombre', type: 'String', visibility: '-' },
      { id: 'a4', name: 'email', type: 'String', visibility: '-' },
    ],
    methods: [
      { id: 'm1', name: 'validarIdentidad', returnType: 'boolean', visibility: '+' },
    ],
  },
  {
    id: 'c2',
    name: 'Venta',
    stereotype: 'Entity',
    tableName: 'ventas',
    x: 350,
    y: 80,
    width: 200,
    height: 180,
    attributes: [
      { id: 'a5', name: 'id', type: 'Long', visibility: '-', isPrimaryKey: true },
      { id: 'a6', name: 'codigoFactura', type: 'String', visibility: '-' },
      { id: 'a7', name: 'clienteId', type: 'Long', visibility: '-', isForeignKey: true },
      { id: 'a8', name: 'totalVenta', type: 'BigDecimal', visibility: '-' },
    ],
    methods: [
      { id: 'm2', name: 'calcularTotal', returnType: 'BigDecimal', visibility: '+' },
    ],
  },
  {
    id: 'c3',
    name: 'Producto',
    stereotype: 'Entity',
    tableName: 'productos',
    x: 60,
    y: 340,
    width: 190,
    height: 175,
    attributes: [
      { id: 'a10', name: 'id', type: 'Long', visibility: '-', isPrimaryKey: true },
      { id: 'a11', name: 'sku', type: 'String', visibility: '-', isUnique: true },
      { id: 'a12', name: 'precio', type: 'BigDecimal', visibility: '-' },
      { id: 'a13', name: 'stockActual', type: 'Integer', visibility: '-' },
    ],
    methods: [
      { id: 'm4', name: 'descontarStock', returnType: 'void', visibility: '+' },
    ],
  },
  {
    id: 'c4',
    name: 'DetalleVenta',
    stereotype: 'Entity',
    tableName: 'detalles_venta',
    x: 350,
    y: 340,
    width: 200,
    height: 175,
    attributes: [
      { id: 'a14', name: 'id', type: 'Long', visibility: '-', isPrimaryKey: true },
      { id: 'a15', name: 'ventaId', type: 'Long', visibility: '-', isForeignKey: true },
      { id: 'a16', name: 'productoId', type: 'Long', visibility: '-', isForeignKey: true },
      { id: 'a17', name: 'cantidad', type: 'Integer', visibility: '-' },
      { id: 'a18', name: 'subtotal', type: 'BigDecimal', visibility: '-' },
    ],
    methods: [
      { id: 'm5', name: 'calcularSubtotal', returnType: 'BigDecimal', visibility: '+' },
    ],
  },
];

const DEFAULT_RELATIONSHIPS: UmlRelationship[] = [
  {
    id: 'r1',
    sourceId: 'c1',
    targetId: 'c2',
    type: 'association',
    sourceMultiplicity: '1',
    targetMultiplicity: '0..*',
    name: 'genera',
  },
  {
    id: 'r2',
    sourceId: 'c2',
    targetId: 'c4',
    type: 'composition',
    sourceMultiplicity: '1',
    targetMultiplicity: '1..*',
    name: 'contiene',
  },
  {
    id: 'r3',
    sourceId: 'c3',
    targetId: 'c4',
    type: 'association',
    sourceMultiplicity: '1',
    targetMultiplicity: '0..*',
    name: 'incluido en',
  },
];

export const ChatScreen = ({ route, navigation }: any) => {
  const {
    roomId = 'ARC-1029',
    roomName = 'Sala de Co-Diseño',
    classes: routeClasses = [],
    relationships: routeRelationships = [],
  } = route.params || {};

  const activeClasses: UmlClass[] =
    routeClasses && routeClasses.length > 0 ? routeClasses : DEFAULT_CLASSES;
  const activeRelationships: UmlRelationship[] =
    routeRelationships && routeRelationships.length > 0
      ? routeRelationships
      : DEFAULT_RELATIONSHIPS;

  const flatListRef = useRef<FlatList<CollabMessage>>(null);
  const inputRef = useRef<any>(null);

  const [inputMessage, setInputMessage] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<StompConnectionStatus>('desconectado');
  const [currentUser, setCurrentUser] = useState<{ name: string; role: string }>({
    name: 'Tú (Móvil)',
    role: 'Desarrollador Móvil',
  });

  const [messages, setMessages] = useState<CollabMessage[]>([
    {
      id: 'm1',
      sender: 'Carlos (Líder)',
      senderRole: 'ARQUITECTO',
      content: 'Acabo de modelar Cliente y Venta con sus respectivas llaves.',
      timestamp: '10:14',
      roomId,
      status: 'entregado',
    },
    {
      id: 'm2',
      sender: 'Andrea (Revisor)',
      senderRole: 'REVISOR',
      content: '¿No deberíamos desacoplar DetalleVenta como clase asociativa?',
      timestamp: '10:15',
      roomId,
      status: 'entregado',
    },
    {
      id: 'm3',
      sender: 'ArchAI Assistant',
      senderRole: 'ARCHAI_IA',
      content: 'Correcto Andrea. Bajo la 3FN, DetalleVenta debe registrar precioUnitario inmutable para conservar el historial fiscal sin dependencias transitivas.',
      timestamp: '10:16',
      isAiResponse: true,
      roomId,
      status: 'entregado',
    },
    {
      id: 'm4',
      sender: 'Carlos (Líder)',
      senderRole: 'ARQUITECTO',
      content: 'De acuerdo. Comparto la estructura SQL base para validación del equipo:',
      timestamp: '10:17',
      roomId,
      status: 'entregado',
      codeSnippet: {
        language: 'sql',
        title: 'schema_cliente.sql',
        code: 'CREATE TABLE clientes (\n    id BIGSERIAL PRIMARY KEY,\n    dni_ruc VARCHAR(20) NOT NULL UNIQUE,\n    nombre VARCHAR(120) NOT NULL\n);',
      },
    },
  ]);

  // Cargar perfil autenticado
  useEffect(() => {
    AsyncStorage.getItem('archai_session').then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.user?.name) {
            setCurrentUser({
              name: parsed.user.name,
              role: parsed.user.role || 'Desarrollador Móvil',
            });
          }
        } catch {}
      }
    });
  }, []);

  // Escuchar estado STOMP
  useEffect(() => {
    const unsubStatus = mobileStomp.addStatusListener((status) => {
      setConnectionStatus(status);
    });
    return unsubStatus;
  }, []);

  // Suscripción a la sala en tiempo real
  useEffect(() => {
    let isSubscribed = true;

    const handleIncomingMessage = (incoming: CollabMessage) => {
      if (!isSubscribed || !incoming) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });
    };

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

  // Escucha reactiva del teclado para desplazar el chat suavemente sin solapar mensajes
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

  const handleSendText = useCallback(
    (rawText?: string) => {
      const textToSend = (rawText !== undefined ? rawText : inputMessage).trim();
      if (!textToSend) return;

      const newMsg: CollabMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        sender: currentUser.name,
        senderRole: 'DESARROLLADOR_MOVIL',
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

      // Si menciona @ArchAI, respuesta analítica 3FN y Arquitectura en Solo Lectura
      if (textToSend.includes('@ArchAI')) {
        setIsAiThinking(true);
        setTimeout(() => {
          const aiContent = auditUmlModel(textToSend, activeClasses, activeRelationships);
          setIsAiThinking(false);

          const aiReply: CollabMessage = {
            id: 'ai_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            sender: 'ArchAI Assistant',
            senderRole: 'ARCHAI_IA',
            content: aiContent,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            fullDate: new Date().toISOString(),
            isAiResponse: true,
            roomId,
            status: 'entregado',
          };

          mobileStomp.sendChatMessage(roomId, aiReply);
          setMessages((prev) => {
            if (prev.some((m) => m.id === aiReply.id)) return prev;
            return [...prev, aiReply];
          });
        }, 800);
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
      {/* 1. Header Superior Ergonómico Modular */}
      <ChatHeader
        navigation={navigation}
        roomId={roomId}
        roomName={roomName}
        connectionStatus={connectionStatus}
      />

      {/* 2. Lista de Mensajes con Burbujas Glassmorphism Modulares */}
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
              <Text style={styles.sessionPillText}>SALA DE CO-DISEÑO ACTIVA</Text>
            </View>
            <Text style={styles.sessionSubtext}>
              Supervisión en Modo Viaje · Mensajes sincronizados por STOMP
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ChatMessageItem item={item} currentUser={currentUser} />
        )}
      />

      {/* Indicador de Análisis en Vivo de @ArchAI */}
      {isAiThinking && (
        <View style={styles.aiThinkingRow}>
          <Sparkles size={13} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.aiThinkingText}>
            ArchAI Co-Developer está evaluando la arquitectura...
          </Text>
        </View>
      )}

      {/* 3. Carrusel Horizontal de Atajos Rápidos a @ArchAI (visible en reposo) */}
      {!isKeyboardVisible && (
        <QuickPromptsBar
          onSelectPrompt={handleSelectQuickPrompt}
          onLongPressPrompt={handleLongPressQuickPrompt}
        />
      )}

      {/* 4. Barra Inferior de Entrada de Texto con Ergonomía Modular */}
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
