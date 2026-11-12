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
  proposedDeletion?: boolean;
  highlighted?: boolean;
  remoteDraggingUser?: string;
  onSelect: (model: UmlClass) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Tarjeta de Clase UML 2.5+ con tres compartimentos:
 *  1. Nombre de la clase (con estereotipo «» centrado)
 *  2. Atributos (visibilidad + nombre: tipo)
 *  3. Operaciones (visibilidad + nombre(params): tipo)
 *
 * Separados por líneas divisorias horizontales, estándar UML 2.5+.
 */
export const ClassCard = memo(({ model, ghost, proposedDeletion, highlighted, remoteDraggingUser, onSelect }: ClassCardProps) => {
  const attributes = ghost ? (model.attributes || []) : (model.attributes || []).slice(0, 4);
  const methods = ghost ? (model.methods || []) : (model.methods || []).slice(0, 4);

  const safeX = Number.isFinite(model.x) ? model.x : 0;
  const safeY = Number.isFinite(model.y) ? model.y : 0;
  const safeW = Number.isFinite(model.width) && (model.width ?? 0) > 0 ? model.width : 220;

  // Animación de posición fluida cuando se mueve en vivo desde la Web
  const posX = useSharedValue(safeX);
  const posY = useSharedValue(safeY);

  useEffect(() => {
    posX.value = withTiming(safeX, { duration: 80, easing: Easing.out(Easing.quad) });
    posY.value = withTiming(safeY, { duration: 80, easing: Easing.out(Easing.quad) });
  }, [safeX, safeY]);

  const animatedPositionStyle = useAnimatedStyle(() => ({
    left: posX.value,
    top: posY.value,
  }));

  const haloOpacity = useSharedValue(0);

  useEffect(() => {
    if (highlighted) {
      haloOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
    } else {
      haloOpacity.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
    }
  }, [highlighted]);

  const haloAnimatedStyle = useAnimatedStyle(() => ({ opacity: haloOpacity.value }));

  const isRemoteDragging = Boolean(remoteDraggingUser);

  const stereotype = model.stereotype || 'Entity';
  const isAbstractOrInterface = stereotype === 'Interface' || stereotype === 'Abstract' || model.stereotype === 'Interface' || model.stereotype === 'Abstract';

  return (
    <AnimatedPressable
      onPress={() => onSelect(model)}
      style={[
        styles.umlClassBox,
        ghost && styles.ghostUmlClass,
        proposedDeletion && { borderColor: colors.error, borderWidth: 2 },
        isRemoteDragging && styles.remoteDraggingBox,
        { width: safeW },
        animatedPositionStyle,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Clase UML ${model.name}`}
    >
      {/* Halo Luminoso Temporal Warm Sand */}
      <Animated.View style={[styles.haloRing, haloAnimatedStyle]} pointerEvents="none" />

      {/* Indicador de Movimiento en Vivo por un Colega */}
      {isRemoteDragging && (
        <View style={styles.remoteDraggingBox}>
          <Move size={10} color="#000020" style={{ marginRight: 3 }} />
          <Text style={styles.remoteDragBadgeText} numberOfLines={1}>
            {remoteDraggingUser}
          </Text>
        </View>
      )}

      {/* ========================================================
         COMPARTIMENTO 1: NOMBRE DE LA CLASE (UML 2.5+)
         ======================================================== */}
      <View style={[styles.compartmentName, ghost && styles.ghostCompartment]}>
        {ghost ? (
          <View style={styles.ghostBadgeRow}>
            <Sparkles size={11} color={colors.primary} />
            <Text style={styles.ghostBadge}>PROPUESTA IA</Text>
          </View>
        ) : (
          <View style={styles.stereotypePill}>
            <Text style={[styles.umlStereotype, isAbstractOrInterface && { fontStyle: 'italic' }]}>
              «{stereotype}»
            </Text>
          </View>
        )}
        <Text style={[styles.umlClassName, isAbstractOrInterface && { fontStyle: 'italic' }]} numberOfLines={1}>
          {model.name}
        </Text>
        {model.tableName ? (
          <Text style={styles.umlTableName} numberOfLines={1}>{model.tableName}</Text>
        ) : null}
      </View>

      {/* Línea divisoria entre compartimentos */}
      <View style={[styles.divider, ghost && styles.ghostDivider]} />

      {/* ========================================================
         COMPARTIMENTO 2: ATRIBUTOS (UML 2.5+)
         ======================================================== */}
      <View style={[styles.compartmentAttrs, ghost && styles.ghostCompartment]}>
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
                <Text style={[styles.attrName, ghost && { color: colors.ghostText }]} numberOfLines={1}>
                  {a.name}
                </Text>
                <Text style={styles.attrSeparator}>:</Text>
                <Text style={styles.attrType}>{a.type || 'String'}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyAttributesText}>Sin atributos</Text>
        )}
        {!ghost && (model.attributes || []).length > 4 && (
          <Text style={styles.moreLine}>
            +{(model.attributes || []).length - 4} atributos más…
          </Text>
        )}
      </View>

      {/* Línea divisoria entre compartimentos */}
      <View style={[styles.divider, ghost && styles.ghostDivider]} />

      {/* ========================================================
         COMPARTIMENTO 3: OPERACIONES / MÉTODOS (UML 2.5+)
         ======================================================== */}
      <View style={[styles.compartmentMethods, ghost && styles.ghostCompartment]}>
        {methods.length > 0 ? (
          methods.map((m) => (
            <View key={m.id} style={styles.methodRow}>
              <Text style={[styles.methodVisibility, { minWidth: 14, textAlign: 'center' }]}>
                {m.visibility || '+'}
              </Text>
              <Text style={[styles.methodName, ghost && { color: colors.ghostText }]} numberOfLines={1} ellipsizeMode="tail">
                {m.name}({m.parameters || ''})
              </Text>
              <Text style={[styles.methodSeparator, { minWidth: 8, textAlign: 'center' }]}>:</Text>
              <Text style={styles.methodReturnType}>{m.returnType || 'void'}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyAttributesText}>Sin operaciones</Text>
        )}
        {!ghost && (model.methods || []).length > 4 && (
          <Text style={styles.moreLine}>
            +{(model.methods || []).length - 4} operaciones más…
          </Text>
        )}
      </View>

      {/* Pie táctil */}
      <View style={[styles.tapToInspect, ghost && styles.ghostTap]}>
        <Text style={[styles.tapToInspectText, ghost && { color: colors.primary }]}>
          {ghost ? 'Sugerencia para revisión' : 'Toca para código y métodos'}
        </Text>
      </View>
    </AnimatedPressable>
  );
});

ClassCard.displayName = 'ClassCard';

const styles = StyleSheet.create({
  // ========================================================
  // CONTENEDOR PRINCIPAL
  // ========================================================
  umlClassBox: {
    position: 'absolute',
    backgroundColor: '#13163d',
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(232, 195, 158, 0.40)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.50,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  umlClassBoxPressed: {
    opacity: 0.92,
  },

  // ========================================================
  // HALO Y BADGES
  // ========================================================
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
  remoteDraggingBox: {
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

  // ========================================================
  // COMPARTIMENTO 1: NOMBRE
  // ========================================================
  compartmentName: {
    backgroundColor: '#1b1f52',
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(232, 195, 158, 0.25)',
  },
  stereotypePill: {
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginBottom: 3,
  },
  umlStereotype: {
    color: colors.primary,
    fontSize: 8,
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.05,
  },
  umlClassName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.01,
    textAlign: 'center',
    marginBottom: 2,
  },
  umlTableName: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: 'monospace',
    textAlign: 'center',
  },

  // ========================================================
  // LÍNEAS DIVISORIAS
  // ========================================================
  divider: {
    height: 1,
    backgroundColor: 'rgba(232, 195, 158, 0.25)',
    marginHorizontal: -1,
  },
  ghostDivider: {
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
  },

  // ========================================================
  // COMPARTIMENTO 2: ATRIBUTOS
  // ========================================================
  compartmentAttrs: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 32, 0.50)',
    gap: 2,
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
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  attrLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
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
    fontSize: 7,
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
    fontSize: 7,
    fontWeight: '800',
  },
  attrVisibility: {
    color: colors.primary,
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: '800',
    minWidth: 14,
    textAlign: 'center',
  },
  attrName: {
    color: '#e2e8f0',
    fontSize: 10.5,
    fontFamily: 'monospace',
    fontWeight: '600',
    flex: 1,
  },
  attrSeparator: {
    color: '#64748b',
    fontSize: 10.5,
    fontFamily: 'monospace',
    fontWeight: '700',
    marginHorizontal: 2,
  },
  attrType: {
    color: '#38bdf8',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  moreLine: {
    color: colors.textMuted,
    fontSize: 9,
    fontStyle: 'italic',
    marginTop: 1,
    textAlign: 'center',
  },

  // ========================================================
  // COMPARTIMENTO 3: OPERACIONES
  // ========================================================
  compartmentMethods: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 1,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  methodVisibility: {
    color: colors.primary,
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: '800',
    minWidth: 14,
    textAlign: 'center',
  },
  methodName: {
    color: '#e2e8f0',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '600',
    flex: 1,
  },
  methodSeparator: {
    color: '#64748b',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    marginHorizontal: 2,
  },
  methodReturnType: {
    color: '#38bdf8',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '600',
  },

  // ========================================================
  // PIE TÁCTIL
  // ========================================================
  tapToInspect: {
    paddingVertical: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
  },
  ghostTap: {
    backgroundColor: 'rgba(232, 195, 158, 0.05)',
  },
  tapToInspectText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: '600',
  },

  // ========================================================
  // GHOST / PROPUESTA IA
  // ========================================================
  ghostUmlClass: {
    backgroundColor: 'rgba(23, 26, 74, 0.85)',
    borderColor: colors.primary,
    borderStyle: 'dashed',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
  },
  ghostCompartment: {
    backgroundColor: 'rgba(47, 44, 121, 0.30)',
  },
  ghostBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  ghostBadge: {
    color: colors.primary,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
