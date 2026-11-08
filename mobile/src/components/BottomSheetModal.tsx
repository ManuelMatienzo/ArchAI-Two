import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Lock } from 'lucide-react-native';
import { UmlClass } from '../types/uml';
import { colors } from '../theme/colors';

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  umlClass: UmlClass | null;
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({ visible, onClose, umlClass }) => {
  if (!umlClass) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        
        <View style={styles.sheetContainer}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              {umlClass.stereotype && (
                <Text style={styles.stereotype}>«{umlClass.stereotype}»</Text>
              )}
              <Text style={styles.className}>{umlClass.name}</Text>
              {umlClass.tableName && (
                <Text style={styles.tableName}>Tabla SQL: {umlClass.tableName}</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Body content */}
          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Attributes Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Atributos ({umlClass.attributes.length})</Text>
              {umlClass.attributes.map((attr) => (
                <View key={attr.id} style={styles.itemRow}>
                  <Text style={styles.visibility}>{attr.visibility}</Text>
                  <Text style={styles.attrName}>
                    {attr.name}
                    {attr.isPrimaryKey && <Text style={styles.pkBadge}> [PK]</Text>}
                    {attr.isForeignKey && <Text style={styles.fkBadge}> [FK]</Text>}
                  </Text>
                  <Text style={styles.attrType}>: {attr.type}</Text>
                </View>
              ))}
              {umlClass.attributes.length === 0 && (
                <Text style={styles.emptyText}>Sin atributos definidos</Text>
              )}
            </View>

            {/* Methods Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Métodos ({umlClass.methods.length})</Text>
              {umlClass.methods.map((method) => (
                <View key={method.id} style={styles.itemRow}>
                  <Text style={styles.visibility}>{method.visibility}</Text>
                  <Text style={styles.methodName}>{method.name}()</Text>
                  <Text style={styles.methodReturnType}>: {method.returnType}</Text>
                </View>
              ))}
              {umlClass.methods.length === 0 && (
                <Text style={styles.emptyText}>Sin métodos definidos</Text>
              )}
            </View>

            {/* Read-Only Badge */}
            <View style={styles.readOnlyNotice}>
              <Lock size={13} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.readOnlyText}>
                Modo Viaje (Solo Lectura): Modificaciones deshabilitadas para prevenir mutaciones accidentales táctiles.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    maxHeight: '75%',
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
    paddingBottom: 12,
  },
  stereotype: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: 'monospace',
  },
  className: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tableName: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  body: {
    marginTop: 14,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  visibility: {
    width: 18,
    fontSize: 14,
    color: colors.warning,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  attrName: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  attrType: {
    fontSize: 14,
    color: colors.umlType,
    fontFamily: 'monospace',
  },
  methodName: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  methodReturnType: {
    fontSize: 14,
    color: colors.umlType,
    fontFamily: 'monospace',
  },
  pkBadge: {
    color: colors.umlAttributePk,
    fontSize: 11,
    fontWeight: 'bold',
  },
  fkBadge: {
    color: colors.umlAttributeFk,
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  readOnlyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    marginTop: 8,
  },
  readOnlyText: {
    flex: 1,
    fontSize: 12,
    color: colors.primary,
    lineHeight: 16,
  },
});
