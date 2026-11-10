import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { ArrowRight, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { colors } from '../../theme/colors';

interface JoinProjectCardProps {
  projectCode: string;
  onChangeProjectCode: (code: string) => void;
  onJoin: () => void;
  isJoining: boolean;
  errorMessage: string | null;
  successMessage?: string | null;
}

export const JoinProjectCard: React.FC<JoinProjectCardProps> = React.memo(({
  projectCode,
  onChangeProjectCode,
  onJoin,
  isJoining,
  errorMessage,
  successMessage,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.joinBox}>
        <View style={styles.headerRow}>
          <KeyRound size={13} color={colors.primary} />
          <Text style={styles.sectionLabel}>UNIRSE A UN PROYECTO</Text>
        </View>

        <Text style={styles.subLabel}>
          Ingresa el código de acceso proporcionado por el creador del proyecto.
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.codeInput}
            value={projectCode}
            onChangeText={onChangeProjectCode}
            placeholder="Código de acceso (ej. SISTEM-1071)"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={onJoin}
          />
          <TouchableOpacity
            style={[
              styles.joinActionBtn,
              (!projectCode.trim() || isJoining) && styles.joinActionBtnDisabled,
            ]}
            onPress={onJoin}
            disabled={!projectCode.trim() || isJoining}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Unirse al proyecto"
          >
            {isJoining ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <ArrowRight size={16} color={colors.textOnPrimary} />
            )}
          </TouchableOpacity>
        </View>

        {errorMessage && (
          <View style={styles.errorBanner}>
            <AlertCircle size={13} color="#f87171" style={styles.errorIcon} />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}

        {successMessage && (
          <View style={styles.successBanner}>
            <CheckCircle2 size={13} color="#34d399" style={styles.errorIcon} />
            <Text style={styles.successBannerText}>{successMessage}</Text>
          </View>
        )}
      </View>
    </View>
  );
});

JoinProjectCard.displayName = 'JoinProjectCard';

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  joinBox: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  subLabel: {
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  codeInput: {
    flex: 1,
    height: 44,
    backgroundColor: 'rgba(0, 0, 32, 0.55)',
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  joinActionBtn: {
    width: 44,
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  joinActionBtnDisabled: {
    backgroundColor: 'rgba(232, 195, 158, 0.18)',
    shadowOpacity: 0,
    elevation: 0,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 2,
  },
  errorIcon: {
    marginRight: 6,
  },
  errorBannerText: {
    color: '#fca5a5',
    fontSize: 11.5,
    fontWeight: '500',
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 2,
  },
  successBannerText: {
    color: '#6ee7b7',
    fontSize: 11.5,
    fontWeight: '500',
    flex: 1,
  },
});
