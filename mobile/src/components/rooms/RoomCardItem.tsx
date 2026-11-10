import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Activity, ChevronRight, User } from 'lucide-react-native';
import { RoomItem } from '../../api/roomsApi';
import { colors } from '../../theme/colors';

export interface RoomCardItemProps {
  room: RoomItem;
  onSelect: (room: RoomItem) => void;
}

/**
 * Tarjeta individual de sala activa optimizada para FlatList fluida a 60 FPS.
 * Componente memorizado (Fase 4 - Hub de Salas).
 */
export const RoomCardItem: React.FC<RoomCardItemProps> = memo(({
  room,
  onSelect,
}) => {
  return (
    <TouchableOpacity
      style={styles.roomCard}
      onPress={() => onSelect(room)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Sala ${room.name}, código ${room.id}`}
    >
      <View style={styles.roomCardLeft}>
        <View style={styles.roomHeader}>
          <View style={styles.roomIdBadge}>
            <Text style={styles.roomIdText}>{room.id}</Text>
          </View>
          <View style={styles.liveIndicator}>
            <Activity size={12} color={colors.success} />
            <Text style={styles.activeUsers}>
              {room.activeUsers} {room.activeUsers === 1 ? 'en sala' : 'en sala'}
            </Text>
          </View>
        </View>

        <Text style={styles.roomName} numberOfLines={1}>
          {room.name}
        </Text>

        <View style={styles.metaRow}>
          {room.projectCode ? (
            <Text style={styles.projectCode}>Proyecto: {room.projectCode}</Text>
          ) : (
            <Text style={styles.projectCode}>Sala colaborativa en vivo</Text>
          )}
          {room.hostName && (
            <View style={styles.hostRow}>
              <User size={10} color={colors.textMuted} style={{ marginRight: 3 }} />
              <Text style={styles.hostText} numberOfLines={1}>{room.hostName}</Text>
            </View>
          )}
        </View>

        <Text style={styles.lastUpdated}>{room.lastUpdated}</Text>
      </View>

      <ChevronRight size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
});

RoomCardItem.displayName = 'RoomCardItem';

const styles = StyleSheet.create({
  roomCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roomCardLeft: {
    flex: 1,
    paddingRight: 10,
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  roomIdBadge: {
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  roomIdText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeUsers: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '600',
  },
  roomName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 3,
  },
  projectCode: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostText: {
    color: colors.textMuted,
    fontSize: 10.5,
  },
  lastUpdated: {
    color: colors.textMuted,
    fontSize: 10,
  },
});
