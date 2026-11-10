import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { ArrowRight, Plus, Laptop, AlertCircle } from 'lucide-react-native';
import { colors } from '../../theme/colors';

interface JoinRoomCardProps {
  roomCode: string;
  onChangeRoomCode: (code: string) => void;
  onJoin: () => void;
  isJoining: boolean;
  errorMessage: string | null;
  onCreateRoom: () => void;
  onEnterLocalMode: () => void;
}

export const JoinRoomCard: React.FC<JoinRoomCardProps> = React.memo(({
  roomCode,
  onChangeRoomCode,
  onJoin,
  isJoining,
  errorMessage,
  onCreateRoom,
  onEnterLocalMode,
}) => {
  return (
    <View style={styles.container}>
      {/* Bloque de Ingreso por Código PIN */}
      <View style={styles.joinBox}>
        <Text style={styles.sectionLabel}>UNIRSE A SALA COLABORATIVA</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.codeInput}
            value={roomCode}
            onChangeText={onChangeRoomCode}
            placeholder="Código PIN (ej. ARC-GRUPO04)"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={onJoin}
          />
          <TouchableOpacity
            style={[styles.joinActionBtn, (!roomCode.trim() || isJoining) && styles.joinActionBtnDisabled]}
            onPress={onJoin}
            disabled={!roomCode.trim() || isJoining}
            activeOpacity={0.8}
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
      </View>

      {/* Fila de Acciones Rápidas (Crear Sala Anfitrión | Modo Personal) */}
      <View style={styles.quickActionRow}>
        <TouchableOpacity
          style={styles.hostActionBtn}
          onPress={onCreateRoom}
          activeOpacity={0.8}
        >
          <Plus size={16} color={colors.primary} />
          <Text style={styles.hostActionBtnText}>Crear Sala (Anfitrión)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.soloActionBtn}
          onPress={onEnterLocalMode}
          activeOpacity={0.8}
        >
          <Laptop size={16} color={colors.textSecondary} />
          <Text style={styles.soloActionBtnText}>Modo Personal</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

JoinRoomCard.displayName = 'JoinRoomCard';

const styles = StyleSheet.create({
  container: {
    gap: 10,
    marginBottom: 16,
  },
  joinBox: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: 14,
    padding: 14,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  codeInput: {
    flex: 1,
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
  },
  joinActionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 48,
  },
  joinActionBtnDisabled: {
    opacity: 0.6,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
  },
  errorIcon: {
    marginRight: 6,
  },
  errorBannerText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  hostActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(232, 195, 158, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.30)',
    borderRadius: 12,
    paddingVertical: 12,
  },
  hostActionBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  soloActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: 12,
    paddingVertical: 12,
  },
  soloActionBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
});
