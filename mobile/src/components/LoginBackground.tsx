import React, { memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';

/**
 * Fondo ambiental exclusivo del cliente móvil ("Blueprint Nocturno").
 *
 * Diferencias deliberadas frente al login web:
 *  - Composición vertical pensada para pantallas de teléfono.
 *  - Cuadrícula técnica + retícula de puntos + trazos de conexión UML.
 *  - Tarjetas UML flotantes con deriva lenta en el hilo de UI (Reanimated),
 *    sin re-renders de React y con respeto a "reducir movimiento".
 */

interface DriftProps {
  amplitude?: number;
  duration?: number;
  delay?: number;
  baseTilt?: number;
  sway?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Deriva ambiental: traslación vertical + balanceo angular continuo.
 * Corre 100% en el hilo de UI (worklets); no consume el hilo de JavaScript.
 */
const Drift = memo(
  ({
    amplitude = 12,
    duration = 9000,
    delay = 0,
    baseTilt = 0,
    sway = 1.4,
    style,
    children,
  }: DriftProps) => {
    const reduceMotion = useReducedMotion();
    const progress = useSharedValue(0);

    React.useEffect(() => {
      if (reduceMotion) return;
      progress.value = withDelay(
        delay,
        withRepeat(
          withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
          -1,
          true
        )
      );
      return () => {
        cancelAnimation(progress);
      };
    }, [delay, duration, progress, reduceMotion]);

    const driftStyle = useAnimatedStyle(() => {
      const t = progress.value;
      return {
        transform: [
          { translateY: -amplitude * t },
          { rotate: `${baseTilt - sway + 2 * sway * t}deg` },
        ],
      };
    });

    return <Animated.View style={[style, driftStyle]}>{children}</Animated.View>;
  }
);
Drift.displayName = 'Drift';

/** Tarjeta UML translúcida que flota en el fondo. */
const MiniClassCard = memo(
  ({
    stereotype,
    name,
    lines,
    accent,
  }: {
    stereotype: string;
    name: string;
    lines: string[];
    accent?: boolean;
  }) => (
    <View style={[styles.miniCard, accent && styles.miniCardAccent]}>
      <View style={styles.miniHeader}>
        <View style={styles.miniStereotypePill}>
          <View style={styles.miniStereotypeDot} />
          <Text style={styles.miniStereotype}>{stereotype}</Text>
        </View>
        <Text style={styles.miniName}>{name}</Text>
      </View>
      <View style={styles.miniBody}>
        {lines.map((line) => (
          <Text key={line} style={styles.miniLine} numberOfLines={1}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  )
);
MiniClassCard.displayName = 'MiniClassCard';

export const LoginBackground: React.FC = memo(() => {
  const { width, height } = useWindowDimensions();

  return (
    <View
      style={styles.backdrop}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Cielo nocturno con foco de luz superior */}
          <RadialGradient
            id="sky"
            gradientUnits="userSpaceOnUse"
            cx={width * 0.5}
            cy={height * 0.12}
            r={Math.max(width, height) * 0.95}
          >
            <Stop offset="0" stopColor="#191d5c" />
            <Stop offset="0.55" stopColor="#080a2b" />
            <Stop offset="1" stopColor="#000020" />
          </RadialGradient>

          {/* Halo índigo superior izquierdo */}
          <RadialGradient
            id="indigoGlow"
            gradientUnits="userSpaceOnUse"
            cx={width * 0.08}
            cy={height * 0.04}
            r={width * 0.85}
          >
            <Stop offset="0" stopColor="#2f2c79" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#2f2c79" stopOpacity="0" />
          </RadialGradient>

          {/* Halo arena inferior derecho */}
          <RadialGradient
            id="sandGlow"
            gradientUnits="userSpaceOnUse"
            cx={width * 0.95}
            cy={height * 0.9}
            r={width * 0.95}
          >
            <Stop offset="0" stopColor="#e8c39e" stopOpacity="0.20" />
            <Stop offset="1" stopColor="#e8c39e" stopOpacity="0" />
          </RadialGradient>

          {/* Retícula técnica */}
          <Pattern
            id="blueprint"
            width="36"
            height="36"
            patternUnits="userSpaceOnUse"
          >
            <Path
              d="M 36 0 L 0 0 0 36"
              fill="none"
              stroke="#e8c39e"
              strokeOpacity="0.07"
              strokeWidth="1"
            />
          </Pattern>

          {/* Nodos de la retícula */}
          <Pattern
            id="blueprintNodes"
            width="108"
            height="108"
            patternUnits="userSpaceOnUse"
          >
            <Circle cx="0.8" cy="0.8" r="1.5" fill="#e8c39e" fillOpacity="0.20" />
          </Pattern>

          {/* Degradado que apaga la retícula en los bordes */}
          <LinearGradient id="gridFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000020" stopOpacity="0.85" />
            <Stop offset="0.32" stopColor="#000020" stopOpacity="0.12" />
            <Stop offset="0.72" stopColor="#000020" stopOpacity="0.30" />
            <Stop offset="1" stopColor="#000020" stopOpacity="0.92" />
          </LinearGradient>
        </Defs>

        <Rect width={width} height={height} fill="url(#sky)" />
        <Rect width={width} height={height} fill="url(#indigoGlow)" />
        <Rect width={width} height={height} fill="url(#sandGlow)" />
        <Rect width={width} height={height} fill="url(#blueprint)" />
        <Rect width={width} height={height} fill="url(#blueprintNodes)" />
        <Rect width={width} height={height} fill="url(#gridFade)" />

        {/* Trazos de conexión arquitectónica (motivo propio del móvil) */}
        <G fill="none" stroke={colors.primary} strokeWidth={1}>
          <Path
            d={`M ${-24} ${height * 0.52} C ${width * 0.24} ${height * 0.40}, ${width * 0.58} ${height * 0.78}, ${width + 24} ${height * 0.58}`}
            strokeOpacity="0.16"
            strokeDasharray="6 10"
          />
          <Path
            d={`M ${width * 0.06} ${height * 0.30} C ${width * 0.38} ${height * 0.22}, ${width * 0.52} ${height * 0.46}, ${width * 0.92} ${height * 0.34}`}
            strokeOpacity="0.10"
            strokeDasharray="3 12"
          />
        </G>

        {/* Nodos de anclaje de los trazos */}
        <Circle
          cx={width * 0.92}
          cy={height * 0.34}
          r={3}
          fill={colors.primary}
          fillOpacity={0.28}
        />
        <Circle
          cx={width * 0.06}
          cy={height * 0.30}
          r={2.4}
          fill={colors.primary}
          fillOpacity={0.22}
        />
      </Svg>

      {/* Tarjeta flotante superior derecha: entidad del dominio */}
      <Drift
        style={styles.cardTopRight}
        amplitude={14}
        duration={11000}
        delay={200}
        baseTilt={-6}
        sway={1.6}
      >
        <MiniClassCard
          stereotype="Entity"
          name="Cliente"
          lines={['- id: Long [PK]', '- dniRuc: String', '- email: String']}
        />
      </Drift>

      {/* Tarjeta flotante izquierda: servicio de dominio */}
      <Drift
        style={styles.cardLeft}
        amplitude={10}
        duration={13500}
        delay={900}
        baseTilt={5}
        sway={1.1}
      >
        <MiniClassCard
          stereotype="Service"
          name="VentaService"
          lines={['+ registrarVenta()', '+ anularVenta()']}
          accent
        />
      </Drift>
    </View>
  );
});
LoginBackground.displayName = 'LoginBackground';

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  miniCard: {
    width: 152,
    backgroundColor: 'rgba(23, 26, 74, 0.52)',
    borderWidth: 1,
    borderColor: 'rgba(245, 225, 206, 0.10)',
    borderTopWidth: 2,
    borderTopColor: 'rgba(232, 195, 158, 0.32)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    opacity: 0.55,
  },
  miniCardAccent: {
    borderTopColor: 'rgba(232, 195, 158, 0.55)',
    backgroundColor: 'rgba(47, 44, 121, 0.34)',
  },
  miniHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(245, 225, 206, 0.12)',
    paddingBottom: 5,
    marginBottom: 6,
  },
  miniStereotypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  miniStereotypeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(232, 195, 158, 0.7)',
  },
  miniStereotype: {
    color: 'rgba(232, 195, 158, 0.75)',
    fontSize: 8,
    fontFamily: 'monospace',
    letterSpacing: 0.4,
  },
  miniName: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  miniBody: {
    gap: 3,
  },
  miniLine: {
    color: 'rgba(226, 232, 240, 0.62)',
    fontSize: 9,
    fontFamily: 'monospace',
  },
  cardTopRight: {
    position: 'absolute',
    top: '8%',
    right: -26,
  },
  cardLeft: {
    position: 'absolute',
    top: '29%',
    left: -34,
  },
});
