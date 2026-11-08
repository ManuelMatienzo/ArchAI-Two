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
} from 'react-native';
import Svg, { Path, Circle, Rect, Text as SvgText, G, Defs, Pattern } from 'react-native-svg';
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
  ShieldCheck,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
} from 'lucide-react-native';
import { colors } from '../theme/colors';
import { UmlClass, UmlRelationship, GhostDraftProposal } from '../types/uml';
import { BottomSheetModal } from '../components/BottomSheetModal';
import { GhostDraftBanner } from '../components/GhostDraftBanner';
import { mobileStomp } from '../api/stompClient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Tamaño del mundo virtual del lienzo móvil
const CANVAS_WORLD_WIDTH = 2200;
const CANVAS_WORLD_HEIGHT = 2200;

// Rango de escala táctil (zoom)
const MIN_SCALE = 0.35;
const MAX_SCALE = 2.8;
const INITIAL_SCALE = 0.85;

// Curva de animación para los controles HUD y el auto-ajuste
const ANIM = { duration: 260, easing: Easing.out(Easing.cubic) };

/**
 * Clamp seguro para worklets (se ejecuta en el hilo de UI).
 */
const clampValue = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

interface ClassCardProps {
  model: UmlClass;
  ghost?: boolean;
  onSelect: (model: UmlClass) => void;
}

/**
 * Tarjeta UML memorizada: no se vuelve a renderizar mientras el usuario
 * panea o hace zoom (la transformación ocurre en el hilo nativo de UI).
 */
const ClassCard = memo(({ model, ghost, onSelect }: ClassCardProps) => {
  const attributes = ghost ? model.attributes : model.attributes.slice(0, 4);

  return (
    <Pressable
      onPress={() => onSelect(model)}
      style={({ pressed }) => [
        styles.umlClassBox,
        ghost && styles.ghostUmlClass,
        { left: model.x, top: model.y, width: model.width },
        pressed && styles.umlClassBoxPressed,
      ]}
    >
      {/* Cabecera de la Clase */}
      <View style={[styles.umlHeader, ghost && styles.ghostUmlHeader]}>
        {ghost ? (
          <View style={styles.ghostBadgeRow}>
            <Sparkles size={11} color={colors.primary} />
            <Text style={styles.ghostBadge}>SUGERENCIA IA</Text>
          </View>
        ) : (
          <View style={styles.stereotypePill}>
            <Text style={styles.umlStereotype}>«{model.stereotype || 'Entity'}»</Text>
          </View>
        )}
        <Text style={styles.umlClassName}>{model.name}</Text>
        {model.tableName && <Text style={styles.umlTableName}>{model.tableName}</Text>}
      </View>

      {/* Atributos tipados con insignias PK/FK */}
      <View style={styles.umlAttributes}>
        {attributes.map((a) => (
          <View key={a.id} style={styles.attrRow}>
            <View style={styles.attrLeft}>
              {a.isPrimaryKey && (
                <View style={styles.pkBadge}>
                  <Text style={styles.pkBadgeText}>PK</Text>
                </View>
              )}
              {!ghost && a.isForeignKey && (
                <View style={styles.fkBadge}>
                  <Text style={styles.fkBadgeText}>FK</Text>
                </View>
              )}
              <Text style={styles.attrVisibility}>{a.visibility}</Text>
              <Text style={[styles.attrName, ghost && { color: colors.ghostText }]} numberOfLines={1}>
                {a.name}
              </Text>
            </View>
            <Text style={styles.attrType}>: {a.type}</Text>
          </View>
        ))}
        {!ghost && model.attributes.length > 4 && (
          <Text style={styles.moreLine}>+{model.attributes.length - 4} atributos más...</Text>
        )}
      </View>

      {/* Pie con indicador táctil */}
      <View style={styles.tapToInspect}>
        <Text style={[styles.tapToInspectText, ghost && { color: colors.primary }]}>
          {ghost ? 'Propuesta en revisión' : 'Toca para inspeccionar métodos'}
        </Text>
      </View>
    </Pressable>
  );
});
ClassCard.displayName = 'ClassCard';

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
  const { roomId = 'ARC-1029', roomName = 'Sala de Co-Diseño' } = route.params || {};

  // Estado del lienzo UML: Clases y Relaciones completas
  const [classes] = useState<UmlClass[]>([
    {
      id: 'c1',
      name: 'Cliente',
      stereotype: 'Entity',
      tableName: 'clientes',
      x: 60,
      y: 80,
      width: 190,
      height: 165,
      attributes: [
        { id: 'a1', name: 'id', type: 'Long', visibility: '-', isPrimaryKey: true },
        { id: 'a2', name: 'dniRuc', type: 'String', visibility: '-', isUnique: true },
        { id: 'a3', name: 'nombre', type: 'String', visibility: '-' },
        { id: 'a4', name: 'email', type: 'String', visibility: '-' },
      ],
      methods: [
        { id: 'm1', name: 'validarDocumento', returnType: 'boolean', visibility: '+' },
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
      height: 185,
      attributes: [
        { id: 'a5', name: 'id', type: 'Long', visibility: '-', isPrimaryKey: true },
        { id: 'a6', name: 'codigoFactura', type: 'String', visibility: '-', isUnique: true },
        { id: 'a7', name: 'clienteId', type: 'Long', visibility: '-', isForeignKey: true },
        { id: 'a8', name: 'totalVenta', type: 'BigDecimal', visibility: '-' },
        { id: 'a9', name: 'fechaEmision', type: 'LocalDateTime', visibility: '-' },
      ],
      methods: [
        { id: 'm2', name: 'calcularImpuestos', returnType: 'void', visibility: '+' },
        { id: 'm3', name: 'anularVenta', returnType: 'void', visibility: '+' },
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
  ]);

  const [relationships] = useState<UmlRelationship[]>([
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
  ]);

  const [activeGhostDraft, setActiveGhostDraft] = useState<GhostDraftProposal | null>({
    id: 'gd-1',
    title: '@ArchAI propone clase RecetaMedica y Dosis',
    description: 'Relación 1..* con Cliente para modelar prescripciones farmacéuticas bajo 3FN.',
    reasoning: 'Separación de responsabilidades: Dosis desacopla la frecuencia horaria del catálogo farmacéutico.',
    author: 'IA Co-Developer (@ArchAI)',
    status: 'PENDING',
    timestamp: 'Hace 1 min',
    classes: [
      {
        id: 'gd_c1',
        name: 'RecetaMedica',
        stereotype: 'Entity',
        tableName: 'recetas_medicas',
        x: 630,
        y: 80,
        width: 190,
        height: 155,
        isGhostDraft: true,
        attributes: [
          { id: 'ga1', name: 'id', type: 'Long', visibility: '-', isPrimaryKey: true },
          { id: 'ga2', name: 'matriculaMedico', type: 'String', visibility: '-' },
          { id: 'ga3', name: 'fechaPrescripcion', type: 'LocalDate', visibility: '-' },
        ],
        methods: [],
      },
    ],
    relationships: [
      {
        id: 'gd_r1',
        sourceId: 'c1',
        targetId: 'gd_c1',
        type: 'association',
        sourceMultiplicity: '1',
        targetMultiplicity: '0..*',
        name: 'prescrita para',
        isGhostDraft: true,
      },
    ],
  });

  const [selectedClass, setSelectedClass] = useState<UmlClass | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

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

  // Dimensiones reales del viewport (medidas con onLayout)
  const viewportW = useSharedValue(SCREEN_WIDTH);
  const viewportH = useSharedValue(SCREEN_HEIGHT - 220);

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

  // Estilo animado: translate + scale se aplican en el hilo nativo.
  const worldStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Auto-ajuste: centra la caja envolvente de todas las clases en el viewport.
  const fitDiagram = useCallback(() => {
    const allClasses = [...classes, ...(activeGhostDraft ? activeGhostDraft.classes : [])];
    if (allClasses.length === 0) return;

    const minX = Math.min(...allClasses.map((c) => c.x));
    const maxX = Math.max(...allClasses.map((c) => c.x + c.width));
    const minY = Math.min(...allClasses.map((c) => c.y));
    const maxY = Math.max(...allClasses.map((c) => c.y + c.height));

    const diagramW = Math.max(maxX - minX, 1);
    const diagramH = Math.max(maxY - minY, 1);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const vw = viewportW.value || SCREEN_WIDTH;
    const vh = viewportH.value || SCREEN_HEIGHT - 220;

    const targetScale = clampValue(
      Math.min((vw - 48) / diagramW, (vh - 48) / diagramH),
      0.45,
      1.15
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

  // Gestos nativos (hilo de UI): paneo 1 dedo + pinza 2 dedos simultáneos.
  const composedGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(4)
      .maxPointers(1)
      .onStart(() => {
        startX.value = translateX.value;
        startY.value = translateY.value;
        runOnJS(markInteracting)();
      })
      .onUpdate((event) => {
        translateX.value = startX.value + event.translationX;
        translateY.value = startY.value + event.translationY;
      })
      .onFinalize(() => {
        runOnJS(clearInteracting)();
      });

    const pinch = Gesture.Pinch()
      .onStart((event) => {
        startScale.value = scale.value;
        // Punto del mundo que debe permanecer anclado bajo los dedos
        focalX.value = (event.focalX - translateX.value) / scale.value;
        focalY.value = (event.focalY - translateY.value) / scale.value;
        runOnJS(markInteracting)();
      })
      .onUpdate((event) => {
        const nextScale = clampValue(startScale.value * event.scale, MIN_SCALE, MAX_SCALE);
        scale.value = nextScale;
        translateX.value = event.focalX - focalX.value * nextScale;
        translateY.value = event.focalY - focalY.value * nextScale;
      })
      .onFinalize(() => {
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
    markInteracting,
    clearInteracting,
  ]);

  // Selección de clase (solo si no venimos de un paneo)
  const handleSelectClass = useCallback((model: UmlClass) => {
    if (interactingRef.current) return;
    setSelectedClass(model);
    setModalVisible(true);
  }, []);

  // Doble toque sobre zona vacía: zoom focal o restablecer vista
  const handleBackgroundPress = useCallback(
    (event: GestureResponderEvent) => {
      const now = Date.now();
      const { locationX, locationY } = event.nativeEvent;

      if (now - lastTapRef.current < 300) {
        lastTapRef.current = 0;
        if (scale.value > 1.2) {
          fitDiagram();
        } else {
          animateZoomTo(1.45, locationX, locationY);
        }
        return;
      }

      lastTapRef.current = now;
    },
    [animateZoomTo, fitDiagram, scale]
  );

  // Medición del viewport + auto-ajuste inicial
  const handleViewportLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      if (width <= 0 || height <= 0) return;

      viewportW.value = width;
      viewportH.value = height;

      if (!hasFittedRef.current) {
        hasFittedRef.current = true;
        fitDiagram();
      }
    },
    [fitDiagram, viewportW, viewportH]
  );

  // Conexión WebSocket STOMP
  useEffect(() => {
    mobileStomp.connect(() => {
      mobileStomp.subscribeRoomCollab(roomId, () => {});
      mobileStomp.subscribeGhostDrafts(roomId, (proposal) => {
        setActiveGhostDraft(proposal);
      });
    });

    return () => {
      mobileStomp.disconnect();
    };
  }, [roomId]);

  // Renderizado SVG de Relaciones (Líneas Bézier y Cardinalidad)
  const relationshipsLayer = useMemo(() => {
    const allRels = [...relationships, ...(activeGhostDraft ? activeGhostDraft.relationships : [])];
    const allClasses = [...classes, ...(activeGhostDraft ? activeGhostDraft.classes : [])];

    return allRels.map((rel) => {
      const source = allClasses.find((c) => c.id === rel.sourceId);
      const target = allClasses.find((c) => c.id === rel.targetId);
      if (!source || !target) return null;

      // Cálculo de puntos de conexión óptimos
      const sx = source.x + source.width;
      const sy = source.y + source.height / 2;
      const tx = target.x;
      const ty = target.y + target.height / 2;

      // Curva Bézier fluida idéntica al lienzo web
      const midX = (sx + tx) / 2;
      const midY = (sy + ty) / 2;
      const pathD = `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`;
      const isGhost = rel.isGhostDraft;

      return (
        <G key={rel.id}>
          {/* Sombra de resplandor */}
          <Path
            d={pathD}
            stroke={isGhost ? 'rgba(232, 195, 158, 0.15)' : 'rgba(232, 195, 158, 0.20)'}
            strokeWidth={isGhost ? 5 : 4}
            fill="none"
          />
          {/* Línea principal */}
          <Path
            d={pathD}
            stroke={colors.primary}
            strokeWidth={isGhost ? 2 : 2.2}
            strokeDasharray={isGhost ? '6, 4' : undefined}
            fill="none"
          />
          {/* Círculo origen */}
          <Circle cx={sx} cy={sy} r={3.5} fill={colors.primary} />
          {/* Rombo / Terminal destino */}
          <Circle
            cx={tx}
            cy={ty}
            r={4.5}
            fill={colors.surface}
            stroke={colors.primary}
            strokeWidth={1.8}
          />

          {/* Badge de Multiplicidad y Nombre */}
          <Rect
            x={midX - 28}
            y={midY - 11}
            width={56}
            height={22}
            rx={6}
            fill="rgba(15, 23, 42, 0.94)"
            stroke={isGhost ? colors.primary : 'rgba(232, 195, 158, 0.50)'}
            strokeWidth={1}
          />
          <SvgText
            x={midX}
            y={midY + 4}
            fill={isGhost ? colors.primary : '#ffffff'}
            fontSize={9.5}
            fontWeight="bold"
            textAnchor="middle"
          >
            {rel.targetMultiplicity || '1..*'}
          </SvgText>
        </G>
      );
    });
  }, [relationships, classes, activeGhostDraft]);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.roomBadge}>{roomId}</Text>
          <Text style={styles.roomTitle} numberOfLines={1}>
            {roomName}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => navigation.navigate('Chat', { roomId })}
          >
            <MessageSquare size={14} color={colors.textOnPrimary} style={{ marginRight: 5 }} />
            <Text style={styles.chatBtnText}>Chat</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modo Viaje Banner */}
      <View style={styles.modoViajeBanner}>
        <ShieldCheck size={14} color="#38bdf8" style={{ marginRight: 6 }} />
        <Text style={styles.modoViajeText}>
          MODO VIAJE ACTIVO · Paneo 360°, zoom táctil y supervisión en tiempo real
        </Text>
      </View>

      {/* Floating Ghost Draft Banner */}
      <GhostDraftBanner
        proposal={activeGhostDraft}
        onPress={() => {
          if (activeGhostDraft && activeGhostDraft.classes[0]) {
            handleSelectClass(activeGhostDraft.classes[0]);
          }
        }}
      />

      {/* Viewport Interactivo: gestos nativos en el hilo de UI */}
      <GestureDetector gesture={composedGesture}>
        <View style={styles.viewport} onLayout={handleViewportLayout}>
          {/* Fondo táctil (doble toque para zoom / auto-fit) */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleBackgroundPress}
            android_disableSound
          />

          {/* Capa de Transformación del Lienzo (Pan 360° y Zoom Focal) */}
          <Animated.View style={[styles.canvasWorld, worldStyle]} pointerEvents="box-none">
            {/* Capa SVG Unificada: Cuadrícula Técnica y Relaciones Bézier */}
            <Svg
              width={CANVAS_WORLD_WIDTH}
              height={CANVAS_WORLD_HEIGHT}
              pointerEvents="none"
            >
              <Defs>
                <Pattern
                  id="gridDots"
                  width={28}
                  height={28}
                  patternUnits="userSpaceOnUse"
                >
                  <Circle cx={2} cy={2} r={1.2} fill="rgba(232, 195, 158, 0.20)" />
                </Pattern>
              </Defs>
              <Rect width={CANVAS_WORLD_WIDTH} height={CANVAS_WORLD_HEIGHT} fill="url(#gridDots)" />
              {relationshipsLayer}
            </Svg>

            {/* Nodos de Clases UML */}
            {classes.map((c) => (
              <ClassCard key={c.id} model={c} onSelect={handleSelectClass} />
            ))}

            {/* Nodos de Sugerencia IA (Ghost Draft translúcidos) */}
            {activeGhostDraft?.classes.map((gc) => (
              <ClassCard key={gc.id} model={gc} ghost onSelect={handleSelectClass} />
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
        </View>
      </GestureDetector>

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
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.surfaceGlass,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  roomBadge: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  roomTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    maxWidth: SCREEN_WIDTH * 0.65,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  chatBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  modoViajeBanner: {
    backgroundColor: 'rgba(56, 189, 248, 0.10)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.22)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 15,
  },
  modoViajeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  viewport: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000020',
  },
  // Mundo virtual dimensionado a su tamaño real (hit-testing correcto en Android).
  // transformOrigin 'top left' mantiene la matemática pan + mundo * zoom.
  canvasWorld: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CANVAS_WORLD_WIDTH,
    height: CANVAS_WORLD_HEIGHT,
    transformOrigin: 'top left',
  },
  umlClassBox: {
    position: 'absolute',
    backgroundColor: 'rgba(23, 26, 74, 0.94)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(232, 195, 158, 0.35)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 8,
    zIndex: 10,
  },
  umlClassBoxPressed: {
    opacity: 0.9,
  },
  umlHeader: {
    backgroundColor: '#171a4a',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 195, 158, 0.20)',
  },
  stereotypePill: {
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginBottom: 3,
  },
  umlStereotype: {
    color: colors.primary,
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  umlClassName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  umlTableName: {
    color: colors.textMuted,
    fontSize: 9.5,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  umlAttributes: {
    padding: 10,
    backgroundColor: 'rgba(0, 0, 32, 0.40)',
    gap: 4,
  },
  attrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attrLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    marginRight: 4,
  },
  attrVisibility: {
    color: colors.primary,
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  attrName: {
    color: '#e2e8f0',
    fontSize: 11.5,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  attrType: {
    color: '#38bdf8',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  pkBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.20)',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  pkBadgeText: {
    color: '#fbbf24',
    fontSize: 8,
    fontWeight: '800',
  },
  fkBadge: {
    backgroundColor: 'rgba(167, 139, 250, 0.20)',
    borderWidth: 1,
    borderColor: '#a78bfa',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  fkBadgeText: {
    color: '#a78bfa',
    fontSize: 8,
    fontWeight: '800',
  },
  moreLine: {
    color: colors.textMuted,
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2,
    textAlign: 'center',
  },
  tapToInspect: {
    paddingVertical: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(232, 195, 158, 0.12)',
    alignItems: 'center',
  },
  tapToInspectText: {
    color: colors.primary,
    fontSize: 9.5,
    fontWeight: '600',
  },
  ghostUmlClass: {
    backgroundColor: 'rgba(23, 26, 74, 0.85)',
    borderColor: colors.primary,
    borderStyle: 'dashed',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
  },
  ghostUmlHeader: {
    backgroundColor: 'rgba(47, 44, 121, 0.60)',
  },
  ghostBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  ghostBadge: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
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
