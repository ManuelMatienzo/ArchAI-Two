import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Sparkles, Move } from 'lucide-react-native';
import { UmlClass } from '../../types/uml';
import { colors } from '../../theme/colors';

export interface ClassCardProps {
  model: UmlClass;
  ghost?: boolean;
  highlighted?: boolean;
  remoteDraggingUser?: string;
  onSelect: (model: UmlClass) => void;
}

/**
 * Tarjeta de Clase UML con calibración Glassmorphic de alto contraste.
 * Optimizado para 60/120 FPS sin re-renders innecesarios.
 */
export const ClassCard = memo(({
  model,
  ghost,
  highlighted,
  remoteDraggingUser,
  onSelect,
}: ClassCardProps) => {
  const attributes = ghost ? (model.attributes || []) : (model.attributes || []).slice(0, 4);

  // Halo luminoso para Spotlight
  const haloOpacity = useSharedValue(0);

  useEffect(() => {
    if (highlighted) {
      haloOpacity.value = withTiming(1, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      haloOpacity.value = withTiming(0, {
        duration: 500,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [highlighted, haloOpacity]);

  const haloAnimatedStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
  }));

  const isRemoteDragging = Boolean(remoteDraggingUser);
  const safeX = Number.isFinite(model.x) ? model.x : 0;
  const safeY = Number.isFinite(model.y) ? model.y : 0;
  const safeW = Number.isFinite(model.width) && (model.width ?? 0) > 0 ? model.width : 195;

  return (
    <Pressable
      onPress={() => onSelect(model)}
      style={({ pressed }) => [
        styles.umlClassBox,
        ghost && styles.ghostUmlClass,
        isRemoteDragging && styles.remoteDraggingBox,
        { left: safeX, top: safeY, width: safeW },
        pressed && styles.umlClassBoxPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Clase UML ${model.name}`}
    >
      {/* Halo Luminoso Temporal Warm Sand con desvanecimiento suave */}
      <Animated.View
        style={[styles.haloRing, haloAnimatedStyle]}
        pointerEvents="none"
      />

      {/* Indicador de Movimiento en Vivo por un Colega */}
      {isRemoteDragging && (
        <View style={styles.remoteDragBadge}>
          <Move size={10} color="#000020" style={{ marginRight: 3 }} />
          <Text style={styles.remoteDragBadgeText} numberOfLines={1}>
            {remoteDraggingUser}
          </Text>
        </View>
      )}

      {/* Cabecera de la Clase */}
      <View style={[styles.umlHeader, ghost && styles.ghostUmlHeader]}>
        {ghost ? (
          <View style={styles.ghostBadgeRow}>
            <Sparkles size={11} color={colors.primary} />
            <Text style={styles.ghostBadge}>PROPUESTA IA</Text>
          </View>
        ) : (
          <View style={styles.stereotypePill}>
            <Text style={styles.umlStereotype}>«{model.stereotype || 'Entity'}»</Text>
          </View>
        )}
        <Text style={styles.umlClassName} numberOfLines={1}>{model.name}</Text>
        {model.tableName ? (
          <Text style={styles.umlTableName} numberOfLines={1}>{model.tableName}</Text>
        ) : null}
      </View>

      {/* Atributos tipados con insignias PK/FK */}
      <View style={styles.umlAttributes}>
        {attributes.length > 0 ? (
          attributes.map((a) => (
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
                <Text style={styles.attrVisibility}>{a.visibility || '-'}</Text>
                <Text
                  style={[styles.attrName, ghost && { color: colors.ghostText }]}
                  numberOfLines={1}
                >
                  {a.name}
                </Text>
              </View>
              <Text style={styles.attrType}>: {a.type || 'String'}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyAttributesText}>Sin atributos definidos</Text>
        )}

        {!ghost && (model.attributes || []).length > 4 && (
          <Text style={styles.moreLine}>
            +{(model.attributes || []).length - 4} atributos más...
          </Text>
        )}
      </View>

      {/* Pie con indicador táctil */}
      <View style={styles.tapToInspect}>
        <Text style={[styles.tapToInspectText, ghost && { color: colors.primary }]}>
          {ghost ? 'Sugerencia para revisión' : 'Toca para código y métodos'}
        </Text>
      </View>
    </Pressable>
  );
});

ClassCard.displayName = 'ClassCard';

const styles = StyleSheet.create({
  umlClassBox: {
    position: 'absolute',
    backgroundColor: '#13163d',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(232, 195, 158, 0.40)',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.50,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  remoteDraggingBox: {
    borderColor: '#38bdf8',
    borderWidth: 2,
    shadowColor: '#38bdf8',
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 14,
    zIndex: 25,
  },
  remoteDragBadge: {
    position: 'absolute',
    top: -18,
    left: 8,
    backgroundColor: '#38bdf8',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 30,
  },
  remoteDragBadgeText: {
    color: '#000020',
    fontSize: 9,
    fontWeight: '800',
  },
  umlClassBoxPressed: {
    opacity: 0.92,
  },
  haloRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#e8c39e',
    backgroundColor: 'rgba(232, 195, 158, 0.08)',
    shadowColor: '#e8c39e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 18,
    elevation: 18,
    zIndex: 15,
  },
  umlHeader: {
    backgroundColor: '#1b1f52',
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 195, 158, 0.18)',
  },
  stereotypePill: {
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginBottom: 2,
  },
  umlStereotype: {
    color: colors.primary,
    fontSize: 8.5,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  umlClassName: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  umlTableName: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  umlAttributes: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 32, 0.50)',
    gap: 4,
  },
  emptyAttributesText: {
    color: colors.textMuted,
    fontSize: 9.5,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 4,
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
    fontSize: 10.5,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  attrName: {
    color: '#e2e8f0',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  attrType: {
    color: '#38bdf8',
    fontSize: 10.5,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  pkBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.22)',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 3,
    paddingHorizontal: 2.5,
    paddingVertical: 0.5,
  },
  pkBadgeText: {
    color: '#fbbf24',
    fontSize: 7.5,
    fontWeight: '800',
  },
  fkBadge: {
    backgroundColor: 'rgba(167, 139, 250, 0.22)',
    borderWidth: 1,
    borderColor: '#a78bfa',
    borderRadius: 3,
    paddingHorizontal: 2.5,
    paddingVertical: 0.5,
  },
  fkBadgeText: {
    color: '#a78bfa',
    fontSize: 7.5,
    fontWeight: '800',
  },
  moreLine: {
    color: colors.textMuted,
    fontSize: 9.5,
    fontStyle: 'italic',
    marginTop: 2,
    textAlign: 'center',
  },
  tapToInspect: {
    paddingVertical: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
    borderTopWidth: 1,
    borderTopColor: 'rgba(232, 195, 158, 0.10)',
    alignItems: 'center',
  },
  tapToInspectText: {
    color: colors.primary,
    fontSize: 9,
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
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
