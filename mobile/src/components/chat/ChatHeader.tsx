import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { StompConnectionStatus } from '../../types/uml';

interface ChatHeaderProps {
  navigation: any;
  roomId: string;
  roomName: string;
  connectionStatus: StompConnectionStatus;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  navigation,
  roomId,
  roomName,
  connectionStatus,
}) => {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top + (Platform.OS === 'android' ? 8 : 4), 44);

  const handleBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation?.navigate?.('Canvas');
    }
  };

  const isConnected = connectionStatus === 'conectado';
  const isConnecting = connectionStatus === 'conectando';

  return (
    <View style={[styles.header, { paddingTop: topPadding }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          accessibilityLabel="Volver al visor"
        >
          <ChevronLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <View style={styles.titleWithStatus}>
            <Text style={styles.roomBadge}>{roomId}</Text>
            <View
              style={[
                styles.statusIndicator,
                {
                  backgroundColor: isConnected
                    ? colors.success
                    : isConnecting
                    ? '#f59e0b'
                    : '#ef4444',
                },
              ]}
            />
            <Text style={styles.statusLabel}>
              {isConnected ? 'EN VIVO' : 'CONECTANDO'}
            </Text>
          </View>
          <Text style={styles.roomSubtitle} numberOfLines={1}>
            {roomName}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.surfaceGlass,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderGlass,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    padding: 6,
    marginRight: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitleBox: {
    flex: 1,
  },
  titleWithStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roomBadge: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  statusIndicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
    marginLeft: 2,
  },
  roomSubtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
});
