import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { User as UserIcon, Settings as SettingsIcon, LogOut } from 'lucide-react-native';
import { colors } from '../../theme/colors';

export interface RoomsUserBarProps {
  userName: string;
  userRole: string;
  onOpenSettings: () => void;
  onLogout: () => void;
}

/**
 * Barra superior de perfil autenticado, configuración de red y cierre de sesión.
 * Componente modular desacoplado (Fase 4 - Hub de Salas).
 */
export const RoomsUserBar: React.FC<RoomsUserBarProps> = memo(({
  userName,
  userRole,
  onOpenSettings,
  onLogout,
}) => {
  return (
    <View style={styles.userBar}>
      <View style={styles.userInfo}>
        <View style={styles.userAvatar}>
          <UserIcon size={16} color={colors.primary} />
        </View>
        <View>
          <Text style={styles.userNameText}>{userName}</Text>
          <Text style={styles.userRoleText}>{userRole}</Text>
        </View>
      </View>

      <View style={styles.userBarRight}>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={onOpenSettings}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Configuración de red y conectividad"
          accessibilityRole="button"
        >
          <SettingsIcon size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={onLogout}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Cerrar sesión"
          accessibilityRole="button"
        >
          <LogOut size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

RoomsUserBar.displayName = 'RoomsUserBar';

const styles = StyleSheet.create({
  userBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    borderWidth: 1,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userNameText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  userRoleText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  userBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  logoutBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
