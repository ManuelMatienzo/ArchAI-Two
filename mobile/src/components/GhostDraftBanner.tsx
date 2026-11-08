import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GhostDraftProposal } from '../types/uml';
import { colors } from '../theme/colors';

interface GhostDraftBannerProps {
  proposal: GhostDraftProposal | null;
  onPress: () => void;
}

export const GhostDraftBanner: React.FC<GhostDraftBannerProps> = ({ proposal, onPress }) => {
  if (!proposal || proposal.status !== 'PENDING') return null;

  return (
    <TouchableOpacity style={styles.banner} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>IA GHOST DRAFT</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{proposal.title}</Text>
        <Text style={styles.desc} numberOfLines={1}>
          Propone {proposal.classes.length} clases · Toca para inspeccionar
        </Text>
      </View>
      <Text style={styles.chevron}>→</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: colors.ghostBorder,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  badge: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
    borderWidth: 0.5,
    borderColor: colors.primary,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  content: {
    flex: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  desc: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  chevron: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
