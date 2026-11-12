import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Dimensions,
  LayoutChangeEvent,
  GestureResponderEvent,
  TextInput,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  runOnJS,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import {
  MessageSquare,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  Search,
  X,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { UmlClass, UmlRelationship, GhostDraftProposal } from '../types/uml';
import { BottomSheetModal } from '../components/BottomSheetModal';
import { GhostDraftBanner } from '../components/GhostDraftBanner';
import { CanvasHeader } from '../components/canvas/CanvasHeader';
import { SpotlightSearchBar } from '../components/canvas/SpotlightSearchBar';
import { ClassCard } from '../components/canvas/ClassCard';
import { EmptyDiagramCard } from '../components/canvas/EmptyDiagramCard';
import { RoomParticipantsModal } from '../components/canvas/RoomParticipantsModal';
import { DiagramLoadingSkeleton } from '../components/canvas/DiagramLoadingSkeleton';
import { CanvasRelationLayer } from '../components/canvas/CanvasRelationLayer';
import { computeDiagramRelationships, getEstimatedClassHeight } from '../utils/diagramGeometry';
import { normalizeDiagramCoordinates, normalizeGhostDraft } from '../utils/diagramSanitizer';
import { diagramCacheService } from '../services/diagramCacheService';
import { roomsApi, RoomParticipant, parseBackendDiagram } from '../api/roomsApi';
import { mobileStomp } from '../api/stompClient';
import { vincularSalaPush } from '../services/pushNotificationsService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Dimensiones seguras del mundo virtual dentro del límite de textura OpenGL móvil
const CANVAS_WORLD_WIDTH = 2600;
const CANVAS_WORLD_HEIGHT = 2600;

// Rango de escala táctil desbloqueado (idéntico al rango web de 5% a 400%)
const MIN_SCALE = 0.05;
const MAX_SCALE = 4.0;
const INITIAL_SCALE = 0.85;

// Curva de animación para los controles HUD y el auto-ajuste
const ANIM = { duration: 260, easing: Easing.out(Easing.cubic) };

// Animación focal de alta respuesta (< 300 ms) para Spotlight
const FOCUS_ANIM = { duration: 280, easing: Easing.out(Easing.cubic) };

/**
 * Clamp seguro para worklets (se ejecuta en el hilo de UI).
 */
const clampValue = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

/**
 * Etiqueta de porcentaje de zoom aislada: se suscribe al valor compartido y
 * re-renderiza únicamente este texto (no el lienzo completo).
 */
const ZoomBadge = ({ progress }: { progress: SharedValue<number> }) => {
  const [percent, setPercent] = useState(Math.round(INITIAL_SCALE * 100));

  useAnimatedReaction(
    () => Math.round(progress.value * 100),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setPercent)(current);
      }
    }
  );

  return <Text style={styles.zoomPercentText}>{percent}%</Text>;
};

export const CanvasViewerScreen = ({ route, navigation }: any) => {
  const { roomId = 'ARC-1029', roomName = 'Sala de Co-Diseño', projectId } = route.params || {};
  const cacheKey = projectId ? `proj_${projectId}` : roomId;

  // Identidad real de la sesión móvil para presencia y eventos colaborativos.
  // Se resuelve antes de conectar el STOMP para que el `join` no use un usuario genérico.
  const currentUserRef = useRef({ id: 'usr-mobile-01', name: 'Desarrollador Móvil' });
  const [currentUserId, setCurrentUserId] = useState('usr-mobile-01');

  // Estado reactivo del lienzo UML: cargado dinámicamente desde el backend
  const [classes, setClasses] = useState<UmlClass[]>([]);
  const [relationships, setRelationships] = useState<UmlRelationship[]>([]);
  const [isLoadingDiagram, setIsLoadingDiagram] = useState(true);
  const [stompConnected, setStompConnected] = useState(mobileStomp.isConnected());
  const lastRealtimeUpdateRef = useRef(0);

  // Participantes activos en la sala obtenidos del backend
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [participantsModalVisible, setParticipantsModalVisible] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);

  // Copiado rápido del PIN de sala al portapapeles
  const handleCopyPin = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(roomId);
      setPinCopied(true);
      setTimeout(() => setPinCopied(false), 2000);
    } catch {}
  }, [roomId]);

  const [activeGhostDraft, setActiveGhostDraft] = useState<GhostDraftProposal | null>(null);

  // Registro en tiempo real de nodos siendo arrastrados remotamente por colaboradores
  const [remoteDraggingNodes, setRemoteDraggingNodes] = useState<Record<string, { name: string; color: string }>>({});
  const timersRemoteDragRef = useRef<Record<string, any>>({});
  // Offset de normalización para mantener sincronía 1:1 con eventos remotos STOMP
  const diagramOffsetRef = useRef({ x: 0, y: 0 });

  const [selectedClass, setSelectedClass] = useState<UmlClass | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Spotlight Search & Highlighting
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedClassId, setHighlightedClassId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  // Contador de mensajes de chat no leídos para el badge del visor
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Filtrado reactivo de clases para el buscador Spotlight
  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const all = [
      ...classes,
      ...(Array.isArray(activeGhostDraft?.classes) ? activeGhostDraft!.classes : []),
    ];
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.tableName && c.tableName.toLowerCase().includes(q)) ||
        (c.stereotype && c.stereotype.toLowerCase().includes(q))
    );
  }, [classes, activeGhostDraft, searchQuery]);

  // ---------------------------------------------------------------------------
  // Navegación 2D en el hilo de UI (Reanimated).
  // Los valores compartidos NO provocan re-renders de React: el lienzo completo
  // se transforma en la GPU a 60/120 FPS aunque haya decenas de nodos.
  // ---------------------------------------------------------------------------
  const translateX = useSharedValue(20);
  const translateY = useSharedValue(10);
  const scale = useSharedValue(INITIAL_SCALE);

  // Capturas para paneo / pinza
  const startX = useSharedValue(20);
  const startY = useSharedValue(10);
  const startScale = useSharedValue(INITIAL_SCALE);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const isPinching = useSharedValue(false);

  // Dimensiones reales del viewport (medidas con onLayout)
  const viewportW = useSharedValue(SCREEN_WIDTH);
  const viewportH = useSharedValue(SCREEN_HEIGHT - 220);

  // Selección en Spotlight y auto-centrado focal animado
  const handleSpotlightSelect = useCallback(
    (targetClass: UmlClass) => {
      setIsSearchOpen(false);
      setSearchQuery('');
      setHighlightedClassId(targetClass.id);

      // Auto-enfoque focal Reanimated (1.25x) en el centro de la pantalla móvil
      const targetScale = 1.25;
      const panX = viewportW.value / 2 - (targetClass.x + targetClass.width / 2) * targetScale;
      const panY = viewportH.value / 2 - (targetClass.y + targetClass.height / 2) * targetScale;

      translateX.value = withTiming(panX, FOCUS_ANIM);
      translateY.value = withTiming(panY, FOCUS_ANIM);
      scale.value = withTiming(targetScale, FOCUS_ANIM);

      // Halo luminoso temporal Warm Sand activo por 2.5 segundos con desvanecimiento suave
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedClassId(null);
      }, 2500);
    },
    [viewportW, viewportH, translateX, translateY, scale]
  );

  // Enfoque focal reactivo ante navegación entrante con targetClassId (interoperabilidad Chat ↔ Visor)
  useEffect(() => {
    if (route.params?.focusClassId) {
      const all = [
        ...classes,
        ...(Array.isArray(activeGhostDraft?.classes) ? activeGhostDraft!.classes : []),
      ];
      const target = all.find((c) => c.id === route.params.focusClassId);
      if (target) {
        handleSpotlightSelect(target);
      }
    }
  }, [route.params?.focusClassId, classes, activeGhostDraft, handleSpotlightSelect]);

  // Evita abrir el BottomSheet al terminar un paneo
  const interactingRef = useRef(false);
  const lastTapRef = useRef(0);
  const hasFittedRef = useRef(false);

  const markInteracting = useCallback(() => {
    interactingRef.current = true;
  }, []);

  const clearInteracting = useCallback(() => {
    setTimeout(() => {
      interactingRef.current = false;
    }, 60);
  }, []);

  // Estilo animado: translate + scale con compensación matemática al centro geométrico (cx, cy).
  // En React Native, al escalar una vista su origen por defecto es (W/2, H/2).
  // Restando (1 - s) * (W / 2) y (1 - s) * (H / 2) el origen se sitúa con precisión
  // matemática en (0, 0) de forma 100% nativa sin depender de 'transformOrigin' (evita crash en Android).
  const worldStyle = useAnimatedStyle(() => {
    'worklet';
    const s = scale.value;
    const originShiftX = (1 - s) * (CANVAS_WORLD_WIDTH / 2);
    const originShiftY = (1 - s) * (CANVAS_WORLD_HEIGHT / 2);
    return {
      transform: [
        { translateX: translateX.value - originShiftX },
        { translateY: translateY.value - originShiftY },
        { scale: s },
      ],
    };
  });

  // Auto-ajuste: centra la caja envolvente de todas las clases en el viewport.
  const fitDiagram = useCallback(() => {
    const allClasses = [
      ...classes,
      ...(Array.isArray(activeGhostDraft?.classes) ? activeGhostDraft!.classes : []),
    ];
    if (allClasses.length === 0) return;

    const minX = Math.min(...allClasses.map((c) => c.x));
    const maxX = Math.max(...allClasses.map((c) => c.x + (c.width || 195)));
    const minY = Math.min(...allClasses.map((c) => c.y));
    const maxY = Math.max(...allClasses.map((c) => c.y + getEstimatedClassHeight(c)));

    const diagramW = Math.max(maxX - minX, 1);
    const diagramH = Math.max(maxY - minY, 1);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const vw = viewportW.value || SCREEN_WIDTH;
    const vh = viewportH.value || SCREEN_HEIGHT - 220;

    const targetScale = clampValue(
      Math.min((vw - 48) / diagramW, (vh - 48) / diagramH),
      MIN_SCALE,
      1.2
    );

    translateX.value = withTiming(vw / 2 - midX * targetScale, ANIM);
    translateY.value = withTiming(vh / 2 - midY * targetScale, ANIM);
    scale.value = withTiming(targetScale, ANIM);
  }, [classes, activeGhostDraft, translateX, translateY, scale, viewportW, viewportH]);

  // Zoom focal animado hacia un punto de pantalla concreto.
  const animateZoomTo = useCallback(
    (targetScale: number, anchorX: number, anchorY: number) => {
      const nextScale = clampValue(targetScale, MIN_SCALE, MAX_SCALE);
      const worldX = (anchorX - translateX.value) / scale.value;
      const worldY = (anchorY - translateY.value) / scale.value;

      translateX.value = withTiming(anchorX - worldX * nextScale, ANIM);
      translateY.value = withTiming(anchorY - worldY * nextScale, ANIM);
      scale.value = withTiming(nextScale, ANIM);
    },
    [translateX, translateY, scale]
  );

  // Controles HUD de Zoom (anclados al centro del viewport)
  const zoomBy = useCallback(
    (factor: number) => {
      const vw = viewportW.value || SCREEN_WIDTH;
      const vh = viewportH.value || SCREEN_HEIGHT - 220;
      const nextScale = clampValue(scale.value * factor, MIN_SCALE, MAX_SCALE);
      const centerX = vw / 2;
      const centerY = vh / 2;
      const worldX = (centerX - translateX.value) / scale.value;
      const worldY = (centerY - translateY.value) / scale.value;

      translateX.value = withTiming(centerX - worldX * nextScale, ANIM);
      translateY.value = withTiming(centerY - worldY * nextScale, ANIM);
      scale.value = withTiming(nextScale, ANIM);
    },
    [translateX, translateY, scale, viewportW, viewportH]
  );

  const handleZoomIn = useCallback(() => zoomBy(1.2), [zoomBy]);
  const handleZoomOut = useCallback(() => zoomBy(1 / 1.2), [zoomBy]);

  const handleResetZoom = useCallback(() => {
    const vw = viewportW.value || SCREEN_WIDTH;
    const vh = viewportH.value || SCREEN_HEIGHT - 220;
    animateZoomTo(1, vw / 2, vh / 2);
  }, [animateZoomTo, viewportW, viewportH]);

  // Gestos nativos (hilo de UI): paneo 1 dedo + pinza 2 dedos coordinados sin colisión.
  const composedGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(3)
      .maxPointers(1)
      .onStart(() => {
        if (isPinching.value) return;
        startX.value = translateX.value;
        startY.value = translateY.value;
        runOnJS(markInteracting)();
      })
      .onUpdate((event) => {
        if (isPinching.value) return;
        translateX.value = startX.value + event.translationX;
        translateY.value = startY.value + event.translationY;
      })
      .onFinalize(() => {
        runOnJS(clearInteracting)();
      });

    const pinch = Gesture.Pinch()
      .onStart((event) => {
        isPinching.value = true;
        startScale.value = scale.value;
        const currentScale = Math.max(scale.value, MIN_SCALE);
        // Punto del mundo anclado con precisión matemática bajo el centro de los dedos
        focalX.value = (event.focalX - translateX.value) / currentScale;
        focalY.value = (event.focalY - translateY.value) / currentScale;
        runOnJS(markInteracting)();
      })
      .onUpdate((event) => {
        const nextScale = clampValue(startScale.value * event.scale, MIN_SCALE, MAX_SCALE);
        // Evita desplazamiento parásito al tocar los topes extremos (idéntico al cliente Web)
        if (scale.value === nextScale && (nextScale === MIN_SCALE || nextScale === MAX_SCALE)) {
          return;
        }
        scale.value = nextScale;
        // Conserva el punto focal exactamente bajo los dedos durante todo el gesto de pinza
        translateX.value = event.focalX - focalX.value * nextScale;
        translateY.value = event.focalY - focalY.value * nextScale;
      })
      .onFinalize(() => {
        isPinching.value = false;
        runOnJS(clearInteracting)();
      });

    return Gesture.Simultaneous(pan, pinch);
  }, [
    translateX,
    translateY,
    scale,
    startX,
    startY,
    startScale,
    focalX,
    focalY,
    isPinching,
    markInteracting,
    clearInteracting,
  ]);

  // Selección de clase (solo si no venimos de un paneo)
  const handleSelectClass = useCallback((model: UmlClass) => {
    if (interactingRef.current) return;
    setSelectedClass(model);
    setModalVisible(true);
  }, []);

  // Resetea la bandera de centrado inicial cuando cambia la sala o el proyecto
  useEffect(() => {
    hasFittedRef.current = false;
  }, [roomId, projectId]);

  // Carga reactiva del diagrama y participantes desde el backend Spring Boot con caché L1/L2
  useEffect(() => {
    let isMounted = true;
    setIsLoadingDiagram(true);
    // Limpia el lienzo anterior para que el auto-ajuste se recalcule con la sala nueva
    setClasses([]);
    setRelationships([]);

    // 0. Carga instantánea desde caché L1 (memoria) o L2 (almacenamiento) para 0 ms jank
    diagramCacheService.getCachedDiagram(cacheKey).then((cached) => {
      if (isMounted && cached && Array.isArray(cached.classes) && cached.classes.length > 0) {
        const { classes: normClasses } = normalizeDiagramCoordinates(cached.classes);
        diagramOffsetRef.current = { x: 0, y: 0 };
        setClasses(normClasses);
        setRelationships(Array.isArray(cached.relationships) ? cached.relationships : []);
        setIsLoadingDiagram(false);
      }
    }).catch(() => {});

    // 1. Obtener detalles y participantes de la sala desde el servidor
    roomsApi.getRoomDetails(roomId).then((info) => {
      if (isMounted && info && Array.isArray(info.participants)) {
        setParticipants(info.participants);
      }
    }).catch(() => {});

    // 2. Carga inicial y sondeo de respaldo.
    // Con WebSocket conectado, el tiempo real llega por STOMP; el polling agresivo (1.5s)
    // sobreescribía posiciones recientes y provocaba saltos/regresos. Solo se sondea
    // como respaldo cuando NO hay conexión en vivo o no han llegado eventos recientes.
    const cargarDiagramaServidor = (force = false) => {
      if (!isMounted) return;
      const conectado = mobileStomp.isConnected();
      const reciente = Date.now() - lastRealtimeUpdateRef.current < 4000;
      if (!force && conectado && reciente) return;

      roomsApi.getRoomDiagram(roomId, projectId).then((diagram) => {
        if (!isMounted) return;
        const loadedClasses = Array.isArray(diagram?.classes) ? diagram.classes : [];
        const loadedRels = Array.isArray(diagram?.relationships) ? diagram.relationships : [];
        if (loadedClasses.length === 0) return;
        const { classes: normClasses } = normalizeDiagramCoordinates(loadedClasses);
        diagramOffsetRef.current = { x: 0, y: 0 };
        setClasses((prev) => {
          // Si las clases son iguales en conteo y posiciones no cambiaron, evitar re-render innecesario
          if (prev.length === normClasses.length) {
            let cambio = false;
            for (let i = 0; i < prev.length; i++) {
              const p = prev[i];
              const n = normClasses.find(c => c.id === p.id);
              if (!n || Math.abs(p.x - n.x) > 1 || Math.abs(p.y - n.y) > 1 || (p.attributes?.length !== n.attributes?.length) || (p.methods?.length !== n.methods?.length)) {
                cambio = true;
                break;
              }
            }
            if (!cambio) return prev;
          }
          return normClasses;
        });
        setRelationships(loadedRels);
        setIsLoadingDiagram(false);
        diagramCacheService.saveCachedDiagram(cacheKey, {
          classes: loadedClasses,
          relationships: loadedRels,
        });
      }).catch(() => {
        if (isMounted) {
          setIsLoadingDiagram(false);
        }
      });
    };

    cargarDiagramaServidor(true);
    const pollingInterval = setInterval(() => cargarDiagramaServidor(false), 8000);

    return () => {
      isMounted = false;
      clearInterval(pollingInterval);
    };
  }, [roomId, projectId, cacheKey]);

  // Auto-ajuste diferido: se dispara cuando las clases llegan realmente al estado.
  // Evita la closure obsoleta de `fitDiagram` (antes capturaba `classes = []` y el
  // lienzo abría descentrado). El debounce descarta la carga de caché si la carga
  // fresca del backend llega poco después.
  useEffect(() => {
    if (classes.length === 0 || hasFittedRef.current) return;

    const timer = setTimeout(() => {
      if (hasFittedRef.current) return;
      hasFittedRef.current = true;
      fitDiagram();
    }, 120);

    return () => clearTimeout(timer);
  }, [classes, fitDiagram]);

  // Medición del viewport para límites de zoom
  const handleViewportLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      if (width <= 0 || height <= 0) return;

      viewportW.value = width;
      viewportH.value = height;
    },
    [viewportW, viewportH]
  );

  // Conexión WebSocket STOMP y sincronización presencial de sala
  useEffect(() => {
    let cancelado = false;
    let unsubscribeStatus: (() => void) | null = null;
    const subscriptions: (() => void)[] = [];
    const seenChatIds = new Set<string>();
    const clearSubscriptions = () => {
      subscriptions.splice(0).forEach(unsubscribe => unsubscribe());
    };

    // Resuelve la identidad real antes de conectar: el join y la presencia deben
    // llevar el usuario de la sesión, no un id fijo que nunca coincide con la web.
    const iniciarCanalColaborativo = async () => {
      try {
        const raw = await AsyncStorage.getItem('archai_session');
        if (raw) {
          const parsed = JSON.parse(raw);
          const usuario = parsed?.user || parsed;
          if (usuario?.id) {
            currentUserRef.current = {
              id: String(usuario.id),
              name: usuario.name || currentUserRef.current.name,
            };
            setCurrentUserId(String(usuario.id));
          }
        }
      } catch {}

      if (cancelado) return;

      // CU-23 — El token push queda asociado a la sala/proyecto que el ingeniero supervisa.
      // Si luego entra en tránsito, las alertas críticas de este proyecto llegarán a su teléfono.
      vincularSalaPush(currentUserRef.current, roomId, projectId).catch(() => {});

      unsubscribeStatus = mobileStomp.addStatusListener((status) => {
        setStompConnected(status === 'conectado');
      });

      mobileStomp.connect(() => {
        if (cancelado) return;
        const usuarioActual = currentUserRef.current;

        // 1. Suscribirse primero al canal: si el anfitrión responde al join con el
        //    diagrama de bienvenida antes de estar escuchando, ese mensaje se perdería.
        //    Eventos: join/leave, nodo_mover y diagrama en tiempo real.
        //    Evita suscripciones duplicadas si el callback de conexión se dispara tras reconexión.
        clearSubscriptions();
        subscriptions.push(mobileStomp.subscribeRoomCollab(roomId, (msg) => {
          if (!msg) return;

          const tipo = (msg.tipo || '').toLowerCase();
          let payload = msg.payload;
          if (typeof payload === 'string') {
            try {
              payload = JSON.parse(payload);
            } catch {}
          }

          // A. Presencia: Join / Leave
          if (tipo === 'join' || tipo === 'leave' || tipo === 'salir') {
            if (payload && Array.isArray(payload.participantes)) {
              setParticipants(payload.participantes);
              return;
            }

            const usuarioRemoto = payload?.usuario;
            if (tipo === 'join' && usuarioRemoto?.id) {
              setParticipants((prev) => {
                if (prev.some((p) => p.id === usuarioRemoto.id)) return prev;
                return [
                  ...prev,
                  {
                    id: usuarioRemoto.id,
                    name: usuarioRemoto.name || 'Colaborador',
                    role: usuarioRemoto.role || 'COLABORADOR',
                    isHost: Boolean(usuarioRemoto.isHost),
                  },
                ];
              });
              return;
            }

            if (tipo !== 'join') {
              const idSaliente = payload?.usuarioId || usuarioRemoto?.id;
              if (idSaliente) {
                setParticipants((prev) => prev.filter((p) => p.id !== idSaliente));
                return;
              }
            }

            roomsApi.getRoomDetails(roomId).then((info) => {
              if (info && Array.isArray(info.participants)) {
                setParticipants(info.participants);
              }
            }).catch(() => {});
            return;
          }

          // B. Movimiento fluido de nodos/tablas en vivo (nodo_mover a ~33 FPS)
          if (tipo === 'nodo_mover' && payload) {
            const classId = payload.classId || payload.id || payload.nodeId;
            const rawX = payload.x;
            const rawY = payload.y;
            const senderName = msg.emisorNombre || payload.emisorNombre || 'Colaborador';

            if (classId && typeof rawX === 'number' && typeof rawY === 'number') {
              const x = Math.round(rawX);
              const y = Math.round(rawY);

              lastRealtimeUpdateRef.current = Date.now();

              // Indicador visual de quién está moviendo la tabla en la Web
              setRemoteDraggingNodes((prev) => ({
                ...prev,
                [classId]: { name: senderName, color: payload.color || '#38bdf8' },
              }));

              if (timersRemoteDragRef.current[classId]) {
                clearTimeout(timersRemoteDragRef.current[classId]);
              }
              timersRemoteDragRef.current[classId] = setTimeout(() => {
                setRemoteDraggingNodes((prev) => {
                  const next = { ...prev };
                  delete next[classId];
                  return next;
                });
              }, 1200);

              // Actualización instantánea de posición en el lienzo móvil.
              setClasses((prev) =>
                prev.map((c) => (c.id === classId ? { ...c, x, y } : c))
              );
            }
            return;
          }

          // C. Sincronización de commit o diagrama completo enviado por el anfitrión
          if (tipo === 'diagrama' && payload) {
            try {
              const diagramData = payload.diagram || payload;
              const parsed = parseBackendDiagram(diagramData);
              if (Array.isArray(diagramData.classes)) {
                lastRealtimeUpdateRef.current = Date.now();
                const { classes: normClasses } = normalizeDiagramCoordinates(parsed.classes);
                diagramOffsetRef.current = { x: 0, y: 0 };
                setRemoteDraggingNodes({});
                setClasses(normClasses);
                setRelationships(parsed.relationships);
                diagramCacheService.saveCachedDiagram(cacheKey, parsed);
              }
            } catch (err) {
              console.warn('[CanvasViewer] Error al sincronizar diagrama entrante:', err);
            }
            return;
          }
        }));

        // 2. Suscripción dedicada al canal de presencia de sala
        subscriptions.push(mobileStomp.subscribePresence(roomId, (presenceList) => {
          if (Array.isArray(presenceList)) {
            setParticipants(presenceList);
          }
        }));

        // 3. Suscripción a propuestas de copiloto fantasma (@ArchAI)
        subscriptions.push(mobileStomp.subscribeGhostDrafts(roomId, (proposal) => {
          // Blindaje: la propuesta remota puede llegar sin `classes`/`relationships`
          // (antes provocaba un crash al hacer spread de `undefined`).
          setActiveGhostDraft(normalizeGhostDraft(proposal));
        }));

        // 4. Suscripción al chat para badge numérico reactivo en el visor
        subscriptions.push(mobileStomp.subscribeChat(roomId, (incoming) => {
          if (!incoming?.id || seenChatIds.has(incoming.id)) return;
          seenChatIds.add(incoming.id);
          if (incoming.senderId !== currentUserRef.current.id) setUnreadChatCount((prev) => prev + 1);
        }));

        // 5. Ya escuchando: anunciar presencia y pedir el diagrama activo.
        mobileStomp.sendJoin(roomId, {
          id: usuarioActual.id,
          name: usuarioActual.name,
          role: 'DESARROLLADOR_MOVIL',
        });
        mobileStomp.sendSolicitarDiagrama(roomId, usuarioActual);
      }).catch((err) => {
        // La sala sigue siendo navegable en modo lectura aunque el WebSocket no conecte.
        console.warn('[CanvasViewer] No se pudo abrir la conexión STOMP:', err);
      });
    };

    iniciarCanalColaborativo().catch(() => {});

    return () => {
      cancelado = true;
      try { unsubscribeStatus?.(); } catch {}
      const usuarioActual = currentUserRef.current;
      mobileStomp.sendLeave(roomId, { id: usuarioActual.id, name: usuarioActual.name });
      roomsApi.leaveRoom(roomId, usuarioActual.id).catch(() => {});
      clearSubscriptions();
    };
  }, [roomId]);

  // Limpieza de temporizadores al desmontar para evitar setState sobre componente desmontado
  useEffect(() => {
    const remoteTimers = timersRemoteDragRef.current;
    return () => {
      Object.values(remoteTimers).forEach((timer) => clearTimeout(timer as any));
      timersRemoteDragRef.current = {};
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
    };
  }, []);

  // Renderizado SVG de Relaciones (Geometría Bézier Tangente y Marcadores UML estándar)
  const computedRelationPaths = useMemo(() => {
    const allRels = [
      ...relationships,
      ...(Array.isArray(activeGhostDraft?.relationships) ? activeGhostDraft!.relationships : []),
    ];
    const allClasses = [
      ...classes,
      ...(Array.isArray(activeGhostDraft?.classes) ? activeGhostDraft!.classes : []),
    ];
    return computeDiagramRelationships(allClasses, allRels);
  }, [relationships, classes, activeGhostDraft]);

  // Navegación de retorno al hub de salas con salida limpia de sesión
  const handleBackToRooms = useCallback(() => {
    const usuarioActual = currentUserRef.current;
    mobileStomp.sendLeave(roomId, { id: usuarioActual.id, name: usuarioActual.name });
    roomsApi.leaveRoom(roomId, usuarioActual.id).catch(() => {});
    navigation.goBack();
  }, [roomId, navigation]);

  return (
    <View style={styles.container}>
      {/* Top Header Modular Ergonómico con Botón de Retorno y PIN Copiable */}
      <CanvasHeader
        roomId={roomId}
        roomName={roomName}
        participantCount={participants.length}
        unreadChatCount={unreadChatCount}
        isSearchOpen={isSearchOpen}
        pinCopied={pinCopied}
        onBack={handleBackToRooms}
        onCopyPin={handleCopyPin}
        onOpenParticipants={() => setParticipantsModalVisible(true)}
        onToggleSearch={() => {
          setIsSearchOpen((prev) => !prev);
          if (isSearchOpen) setSearchQuery('');
        }}
        onOpenChat={() => {
          setUnreadChatCount(0);
          navigation.navigate('Chat', {
            roomId,
            roomName,
            classes,
            relationships,
          });
        }}
      />

      {/* Spotlight Search Floating Drawer Modular */}
      <SpotlightSearchBar
        isOpen={isSearchOpen}
        query={searchQuery}
        onChangeQuery={setSearchQuery}
        onClear={() => setSearchQuery('')}
        results={filteredClasses}
        onSelectClass={handleSpotlightSelect}
      />

      {/* Floating Ghost Draft Banner */}
      <GhostDraftBanner
        proposal={activeGhostDraft}
        onPress={() => {
          const firstGhost = activeGhostDraft?.classes?.[0];
          if (firstGhost) {
            handleSelectClass(firstGhost);
          }
        }}
      />

      {/* Viewport Interactivo: gestos nativos en el hilo de UI */}
      <GestureDetector gesture={composedGesture}>
        <View style={styles.viewport} onLayout={handleViewportLayout}>
          {/* Capa de Transformación del Lienzo (Pan 360° y Zoom Focal Libre) */}
          <Animated.View style={[styles.canvasWorld, worldStyle]} pointerEvents="box-none">
            {/* Capa de Relaciones Bézier Modular (cada relación con su propio SVG ligero) */}
            <CanvasRelationLayer paths={computedRelationPaths} />

            {/* Nodos de Clases UML */}
            {classes.map((c) => (
              <ClassCard
                key={c.id}
                model={c}
                highlighted={highlightedClassId === c.id}
                remoteDraggingUser={remoteDraggingNodes[c.id]?.name}
                onSelect={handleSelectClass}
              />
            ))}

            {/* Nodos de Sugerencia IA (Ghost Draft translúcidos) */}
            {(activeGhostDraft?.classes ?? []).map((gc) => (
              <ClassCard
                key={gc.id}
                model={gc}
                ghost
                highlighted={highlightedClassId === gc.id}
                onSelect={handleSelectClass}
              />
            ))}
          </Animated.View>

          {/* HUD Flotante de Control de Navegación y Zoom (Glassmorphic) */}
          <View style={styles.hudControls}>
            <TouchableOpacity style={styles.hudBtn} onPress={handleZoomIn} activeOpacity={0.75}>
              <ZoomIn size={18} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.hudBtn} onPress={handleZoomOut} activeOpacity={0.75}>
              <ZoomOut size={18} color="#ffffff" />
            </TouchableOpacity>

            {/* Porcentaje de Zoom / Reset */}
            <TouchableOpacity
              style={[styles.hudBtn, styles.hudBtnPill]}
              onPress={handleResetZoom}
              activeOpacity={0.75}
            >
              <ZoomBadge progress={scale} />
            </TouchableOpacity>

            {/* Ajustar y Centrar Todo */}
            <TouchableOpacity
              style={[styles.hudBtn, styles.hudBtnFit]}
              onPress={fitDiagram}
              activeOpacity={0.75}
            >
              <Maximize2 size={16} color={colors.textOnPrimary} />
            </TouchableOpacity>
          </View>

          {/* Pill de Estado en Vivo (Inferior Izquierda) */}
          <View style={styles.statusPill}>
            <Layers size={12} color={colors.primary} />
            <Text style={styles.statusPillText}>
              {classes.length} Clases · {relationships.length} Relaciones
            </Text>
          </View>

          {/* Skeleton Glassmorphic durante la sincronización inicial */}
          {isLoadingDiagram && classes.length === 0 && (
            <DiagramLoadingSkeleton roomName={roomName} />
          )}

          {/* Estado de Lienzo Vacío si la sala no tiene clases modeladas */}
          {classes.length === 0 && !isLoadingDiagram && (
            <EmptyDiagramCard
              onOpenChat={() =>
                navigation.navigate('Chat', {
                  roomId,
                  roomName,
                  classes,
                  relationships,
                })
              }
            />
          )}
        </View>
      </GestureDetector>

      {/* Modal de Participantes en Vivo */}
      <RoomParticipantsModal
        visible={participantsModalVisible}
        onClose={() => setParticipantsModalVisible(false)}
        roomId={roomId}
        roomName={roomName}
        participants={participants}
        currentUserId={currentUserId}
      />

      {/* Bottom Sheet Modal para inspección completa de clase */}
      <BottomSheetModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        umlClass={selectedClass}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  viewport: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000020',
  },
  // Mundo virtual dimensionado a su tamaño real dentro del límite de textura GPU.
  // La compensación al centro en worldStyle mantiene el origen focal exacto en (0, 0)
  // de forma nativa sin usar 'transformOrigin', eliminando los cierres y fallas en Android.
  canvasWorld: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CANVAS_WORLD_WIDTH,
    height: CANVAS_WORLD_HEIGHT,
  },
  hudControls: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(232, 195, 158, 0.35)',
    padding: 6,
    gap: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 50,
  },
  hudBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudBtnPill: {
    paddingHorizontal: 6,
    backgroundColor: 'rgba(232, 195, 158, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.30)',
  },
  zoomPercentText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  hudBtnFit: {
    backgroundColor: colors.primary,
  },
  statusPill: {
    position: 'absolute',
    left: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.25)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    zIndex: 50,
  },
  statusPillText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
