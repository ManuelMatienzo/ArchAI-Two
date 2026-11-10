import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UmlClass } from '../../types/uml';
import { colors } from '../../theme/colors';

interface UmlStructureViewerProps {
  umlClass: UmlClass;
}

/**
 * Componente modular para la inspección táctil de la estructura UML:
 * Atributos (visibilidad, PK/FK/UQ, tipos) y Métodos (visibilidad, retornos).
 */
export const UmlStructureViewer: React.FC<UmlStructureViewerProps> = memo(({ umlClass }) => {
  return (
    <View style={styles.container}>
      {/* Sección: Atributos Tipados */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            Atributos de la Clase
          </Text>
          <View style={styles.counterBadge}>
            <Text style={styles.counterText}>{umlClass.attributes.length}</Text>
          </View>
        </View>

        {umlClass.attributes.map((attr) => (
          <View key={attr.id} style={styles.itemRow}>
            <View style={styles.leftColumn}>
              <Text style={styles.visibility}>{attr.visibility || '-'}</Text>
              <Text style={styles.attrName} numberOfLines={1}>
                {attr.name}
              </Text>
              {attr.isPrimaryKey && (
                <View style={styles.pkBadge}>
                  <Text style={styles.pkBadgeText}>PK</Text>
                </View>
              )}
              {attr.isForeignKey && (
                <View style={styles.fkBadge}>
                  <Text style={styles.fkBadgeText}>FK</Text>
                </View>
              )}
              {attr.isUnique && !attr.isPrimaryKey && (
                <View style={styles.uqBadge}>
                  <Text style={styles.uqBadgeText}>UQ</Text>
                </View>
              )}
            </View>

            <Text style={styles.attrType}>: {attr.type}</Text>
          </View>
        ))}

        {umlClass.attributes.length === 0 && (
          <Text style={styles.emptyText}>Sin atributos declarados en el modelo.</Text>
        )}
      </View>

      {/* Sección: Métodos y Firmas de Negocio */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            Métodos y Operaciones
          </Text>
          <View style={styles.counterBadge}>
            <Text style={styles.counterText}>{umlClass.methods?.length || 0}</Text>
          </View>
        </View>

        {umlClass.methods && umlClass.methods.length > 0 ? (
          umlClass.methods.map((method) => (
            <View key={method.id} style={styles.itemRow}>
              <View style={styles.leftColumn}>
                <Text style={styles.visibility}>{method.visibility || '+'}</Text>
                <Text style={styles.methodName} numberOfLines={1}>
                  {method.name}()
                </Text>
              </View>

              <Text style={styles.methodReturnType}>: {method.returnType || 'void'}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Sin métodos declarados en el modelo.</Text>
        )}
      </View>
    </View>
  );
});

UmlStructureViewer.displayName = 'UmlStructureViewer';

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  section: {
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 195, 158, 0.15)',
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  counterBadge: {
    backgroundColor: 'rgba(232, 195, 158, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  counterText: {
    color: colors.primary,
    fontSize: 10.5,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  leftColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  visibility: {
    width: 14,
    fontSize: 13,
    color: colors.warning,
    fontWeight: '700',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  attrName: {
    fontSize: 13.5,
    color: '#ffffff',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  attrType: {
    fontSize: 12.5,
    color: '#38bdf8',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  methodName: {
    fontSize: 13.5,
    color: '#e2e8f0',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  methodReturnType: {
    fontSize: 12.5,
    color: '#a78bfa',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  pkBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.20)',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  pkBadgeText: {
    color: '#fbbf24',
    fontSize: 8.5,
    fontWeight: '800',
  },
  fkBadge: {
    backgroundColor: 'rgba(167, 139, 250, 0.20)',
    borderWidth: 1,
    borderColor: '#a78bfa',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  fkBadgeText: {
    color: '#a78bfa',
    fontSize: 8.5,
    fontWeight: '800',
  },
  uqBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.20)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  uqBadgeText: {
    color: '#38bdf8',
    fontSize: 8.5,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
});
