import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { QuickProfile } from '../../types/auth';

const PROFILES: QuickProfile[] = [
  {
    id: 'carlos',
    name: 'Carlos',
    email: 'carlos.criado@archai.io',
    role: 'Arquitecto de Software',
    specialty: 'Arquitecto',
    color: '#e8c39e',
    initial: 'C',
  },
  {
    id: 'elena',
    name: 'Elena',
    email: 'elena.ramos@archai.io',
    role: 'Ingeniero de Datos',
    specialty: 'Datos',
    color: '#8892b0',
    initial: 'E',
  },
  {
    id: 'lucas',
    name: 'Lucas',
    email: 'lucas.vaca@archai.io',
    role: 'Desarrollador Backend',
    specialty: 'Backend',
    color: '#4a4891',
    initial: 'L',
  },
];

interface QuickProfileSelectorProps {
  selectedEmail: string;
  onSelect: (profile: QuickProfile) => void;
}

/**
 * Acceso rápido por perfil: tres tiles verticales con avatar, nombre y
 * especialidad. Pensado para dedos y pantallas de 360 dp de ancho.
 */
export const QuickProfileSelector: React.FC<QuickProfileSelectorProps> = memo(
  ({ selectedEmail, onSelect }) => {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionHeader}>ACCESO RÁPIDO</Text>
          <View style={styles.headerRule} />
        </View>

        <View style={styles.row}>
          {PROFILES.map((profile) => {
            const isSelected = selectedEmail === profile.email;
            return (
              <Pressable
                key={profile.id}
                style={({ pressed }) => [
                  styles.tile,
                  isSelected && styles.tileSelected,
                  pressed && styles.tilePressed,
                ]}
                onPress={() => onSelect(profile)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${profile.name}, ${profile.role}`}
              >
                <View style={styles.avatarWrap}>
                  <View
                    style={[
                      styles.avatarRing,
                      isSelected && styles.avatarRingSelected,
                    ]}
                  >
                    <View
                      style={[
                        styles.avatarCircle,
                        { backgroundColor: profile.color },
                      ]}
                    >
                      <Text style={styles.avatarInitial}>{profile.initial}</Text>
                    </View>
                  </View>

                  {isSelected && (
                    <View style={styles.checkBadge}>
                      <Check size={8} color={colors.textOnPrimary} strokeWidth={3.5} />
                    </View>
                  )}
                </View>

                <Text
                  style={[styles.name, isSelected && styles.nameSelected]}
                  numberOfLines={1}
                >
                  {profile.name}
                </Text>
                <Text style={styles.specialty} numberOfLines={1}>
                  {profile.specialty}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }
);
QuickProfileSelector.displayName = 'QuickProfileSelector';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 9,
  },
  sectionHeader: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.3,
  },
  headerRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(232, 195, 158, 0.18)',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.14)',
  },
  tileSelected: {
    borderColor: 'rgba(232, 195, 158, 0.65)',
    backgroundColor: 'rgba(232, 195, 158, 0.10)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 2,
  },
  tilePressed: {
    opacity: 0.82,
  },
  avatarWrap: {
    marginBottom: 7,
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 225, 206, 0.18)',
  },
  avatarRingSelected: {
    borderColor: colors.primary,
  },
  avatarCircle: {
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#000020',
    fontSize: 13,
    fontWeight: '900',
  },
  checkBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(13, 15, 44, 0.95)',
  },
  name: {
    color: colors.textSecondary,
    fontSize: 11.5,
    fontWeight: '800',
  },
  nameSelected: {
    color: colors.textPrimary,
  },
  specialty: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
});
