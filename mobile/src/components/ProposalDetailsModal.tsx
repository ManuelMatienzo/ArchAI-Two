import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bot, X } from 'lucide-react-native';
import { GhostDraftProposal, UmlClass } from '../types/uml';
import { colors } from '../theme/colors';
import { NativeChatText } from './chat/NativeChatText';

export function ProposalDetailsModal({
  proposal,
  visible,
  official,
  onClose,
  onConversation,
  onLocate,
}: {
  proposal: GhostDraftProposal | null;
  visible: boolean;
  official: UmlClass[];
  onClose: () => void;
  onConversation: () => void;
  onLocate: (model: UmlClass) => void;
}) {
  if (!proposal) return null;
  const classes = [...official, ...proposal.classes],
    name = (id: string) => classes.find((c) => c.id === id)?.name || 'Clase';
  const target =
    proposal.classes[0] ||
    classes.find((c) => proposal.deletions?.some((d) => d.targetId === c.id || d.classId === c.id)) ||
    classes.find((c) => proposal.relationships.some((r) => r.sourceId === c.id));
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Bot size={20} color={colors.primary} />
            <Text style={styles.title}>Propuesta de ArchAI</Text>
            <TouchableOpacity accessibilityLabel="Cerrar propuesta" onPress={onClose}>
              <X size={19} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <NativeChatText text={proposal.reasoning || proposal.description} />
            <Text style={styles.hint}>
              La propuesta está pendiente. Su edición y aprobación se realizan en la web.
            </Text>
            {proposal.classes.map((c) => (
              <View key={c.id} style={styles.element}>
                <Text style={styles.name}>{c.name}</Text>
                {c.attributes.map((a) => (
                  <Text key={a.id} style={styles.text}>
                    {a.name}: {a.type}
                  </Text>
                ))}
                {c.methods.map((m) => (
                  <Text key={m.id} style={styles.text}>
                    {m.name}(): {m.returnType}
                  </Text>
                ))}
              </View>
            ))}
            {proposal.relationships.map((r) => (
              <Text key={r.id} style={styles.text}>
                {name(r.sourceId)} → {name(r.targetId)} · {r.sourceMultiplicity} a {r.targetMultiplicity}
              </Text>
            ))}
            {proposal.deletions?.map((d) => (
              <View key={d.id} style={[styles.element, styles.deletion]}>
                <Text style={styles.deleteTitle}>Eliminar {d.label}</Text>
                <Text style={styles.text}>
                  {d.affectedRelationIds.length} relaciones afectadas. Requiere confirmación del equipo.
                </Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.actions}>
            {target && (
              <TouchableOpacity
                style={styles.secondary}
                onPress={() => {
                  onClose();
                  onLocate(target);
                }}
              >
                <Text style={styles.secondaryText}>Localizar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.primary}
              onPress={() => {
                onClose();
                onConversation();
              }}
            >
              <Text style={styles.primaryText}>Ver conversación</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,32,0.8)', justifyContent: 'center', padding: 20 },
  card: {
    maxHeight: '85%',
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: 18,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
  },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  body: { padding: 18, gap: 12 },
  hint: { fontSize: 11, lineHeight: 18, color: colors.textMuted },
  element: {
    padding: 12,
    gap: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    backgroundColor: colors.surfaceInput,
  },
  name: { fontWeight: '700', color: colors.primary, fontSize: 13 },
  text: { color: colors.textSecondary, fontSize: 12, lineHeight: 20 },
  deletion: { borderColor: colors.errorBorder, backgroundColor: colors.errorBg },
  deleteTitle: { color: colors.error, fontWeight: '700', fontSize: 13 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 9,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderGlass,
  },
  primary: { paddingVertical: 10, paddingHorizontal: 13, backgroundColor: colors.primary, borderRadius: 9 },
  primaryText: { fontSize: 12, fontWeight: '700', color: colors.textOnPrimary },
  secondary: {
    paddingVertical: 10,
    paddingHorizontal: 13,
    backgroundColor: colors.secondary,
    borderRadius: 9,
  },
  secondaryText: { fontSize: 12, color: colors.textPrimary },
});
