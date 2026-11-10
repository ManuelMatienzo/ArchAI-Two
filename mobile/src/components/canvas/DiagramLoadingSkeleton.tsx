import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Layers } from 'lucide-react-native';
import { colors } from '../../theme/colors';

interface DiagramLoadingSkeletonProps {
  roomName?: string;
}

/**
 * Skeleton Glassmorphic de carga inicial para el Visor UML (Fase 2).
 * Mantiene la estética visual Midnight Navy & Warm Sand mientras se resuelve
 * la consulta REST o la caché local de clases.
 */
export const DiagramLoadingSkeleton: React.FC<DiagramLoadingSkeletonProps> = ({
  roomName = 'Sala de Co-Diseño',
}) => {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [pulseAnim]);

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.card}>
        {/* Cabecera del Skeleton */}
        <View style={styles.headerRow}>
          <View style={styles.iconBox}>
            <Layers size={18} color={colors.primary} />
          </View>
          <View style={styles.headerTexts}>
            <Text style={styles.title} numberOfLines={1}>
              {roomName}
            </Text>
            <Text style={styles.subtitle}>Sincronizando modelo arquitectónico...</Text>
          </View>
        </View>

        {/* Líneas simuladas de clases UML con pulso suave */}
        <Animated.View style={[styles.skeletonBody, { opacity: pulseAnim }]}>
          <View style={styles.skeletonHeaderBar} />
          <View style={[styles.skeletonLine, { width: '80%' }]} />
          <View style={[styles.skeletonLine, { width: '65%' }]} />
          <View style={styles.skeletonDivider} />
          <View style={[styles.skeletonLine, { width: '90%' }]} />
          <View style={[styles.skeletonLine, { width: '50%' }]} />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTexts: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  skeletonBody: {
    backgroundColor: 'rgba(0, 0, 32, 0.50)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderInput,
    padding: 12,
  },
  skeletonHeaderBar: {
    height: 14,
    width: '55%',
    backgroundColor: 'rgba(232, 195, 158, 0.25)',
    borderRadius: 4,
    marginBottom: 12,
  },
  skeletonLine: {
    height: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 3,
    marginBottom: 8,
  },
  skeletonDivider: {
    height: 1,
    backgroundColor: colors.borderInput,
    marginVertical: 6,
  },
});
