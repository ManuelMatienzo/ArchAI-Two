import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import {
  ChevronLeft,
  Copy,
  Users,
  Search,
  MessageSquare,
  Bell,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';

export interface CanvasHeaderProps {
  roomId: string;
  roomName: string;
  participantCount: number;
  unreadChatCount: number;
  isSearchOpen: boolean;
  pinCopied: boolean;
  onBack: () => void;
  onCopyPin: () => void;
  onOpenParticipants: () => void;
  onToggleSearch: () => void;
  onOpenChat: () => void;
  onOpenNotifications?:()=>void;
}

/**
 * Encabezado ergonómico del Visor 360° en Modo Viaje (Fase 1 / Hub de Salas).
 * Componente modular desacoplado y memorizado para evitar re-renders innecesarios
 * durante manipulaciones 2D y animaciones en la GPU.
 */
export const CanvasHeader: React.FC<CanvasHeaderProps> = React.memo(
  ({
    roomId,
    roomName,
    participantCount,
    unreadChatCount,
    isSearchOpen,
    pinCopied,
    onBack,
    onCopyPin,
    onOpenParticipants,
    onToggleSearch,
    onOpenChat,
    onOpenNotifications,
  }) => {
    return (
      <View style={styles.header}>
        {/* Botón de Retorno Suave al Hub de Salas */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Volver a lista de salas"
        >
          <ChevronLeft size={22} color="#ffffff" />
        </TouchableOpacity>

        {/* Título de Sala y Badge de PIN Copiable */}
        <View style={styles.headerTitleContainer}>
          <View style={styles.badgeRow}>
            <TouchableOpacity
              style={styles.roomBadgeContainer}
              onPress={onCopyPin}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Copiar código PIN de la sala"
            >
              <Text style={styles.roomBadge}>{roomId}</Text>
              <Copy size={10} color={colors.primary} style={{ marginLeft: 3 }} />
            </TouchableOpacity>

            {pinCopied && (
              <View style={styles.copiedTooltip}>
                <Text style={styles.copiedTooltipText}>¡Copiado!</Text>
              </View>
            )}
          </View>

          <Text style={styles.roomTitle} numberOfLines={1}>
            {roomName}
          </Text>
        </View>

        {/* Grupo de Acciones Rápidas (Presencia + Spotlight + Chat) */}
        <View style={styles.headerActions}>
          {/* Píldora de Presencia en Sala */}
          <TouchableOpacity
            style={styles.presenceBtn}
            onPress={onOpenParticipants}
            activeOpacity={0.75}
            accessibilityLabel="Ver colaboradores en sala"
          >
            <Users size={13} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={styles.presenceText}>{participantCount || 1}</Text>
          </TouchableOpacity>

          {/* Buscador Spotlight */}
          <TouchableOpacity
            style={[styles.searchBtn, isSearchOpen && styles.searchBtnActive]}
            onPress={onToggleSearch}
            activeOpacity={0.75}
            accessibilityLabel="Buscar clase en el lienzo"
          >
            <Search size={15} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.searchBtn} onPress={onOpenNotifications} accessibilityLabel="Ver actividad del equipo"><Bell size={15} color={colors.primary}/></TouchableOpacity>
          {/* Botón de Chat con Contador Reactivo de No Leídos */}
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={onOpenChat}
            activeOpacity={0.75}
            accessibilityLabel="Abrir chat de la sala"
          >
            <View style={styles.chatBtnContent}>
              <MessageSquare size={14} color={colors.primary} style={{ marginRight: 5 }} />
              <Text style={styles.chatBtnText}>Chat</Text>
            </View>
            {unreadChatCount > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

CanvasHeader.displayName = 'CanvasHeader';

const styles = StyleSheet.create({
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.surfaceGlass,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  roomBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
  },
  copiedTooltip: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderWidth: 1,
    borderColor: '#4ade80',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  copiedTooltipText: {
    color: '#4ade80',
    fontSize: 9,
    fontWeight: '800',
  },
  roomBadge: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  roomTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  presenceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  presenceText: {
    color: colors.primary,
    fontSize: 11.5,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  searchBtn: {
    backgroundColor: 'rgba(232, 195, 158, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232, 195, 158, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnActive: {
    backgroundColor: 'rgba(232, 195, 158, 0.28)',
    borderColor: colors.primary,
  },
  chatBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  chatBadge: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatBadgeText: {
    color: colors.textOnPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
});
