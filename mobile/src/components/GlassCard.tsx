import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  isGhostDraft?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style, isGhostDraft }) => {
  return (
    <View
      style={[
        styles.card,
        isGhostDraft && styles.ghostCard,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  ghostCard: {
    backgroundColor: colors.ghostBackground,
    borderColor: colors.ghostBorder,
    borderStyle: 'dashed',
  },
});
