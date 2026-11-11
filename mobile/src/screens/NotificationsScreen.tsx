import React, { useCallback, useState } from 'react';
import { FlatList, Text, View, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Bell } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { listNotifications, markNotificationRead, TeamNotification } from '../services/notificationsService';
export function NotificationsScreen({ navigation }: any) {
  const [items, setItems] = useState<TeamNotification[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listNotifications());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la actividad.');
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const timer = setInterval(() => void refresh(), 15000);
      return () => clearInterval(timer);
    }, [refresh])
  );
  return (
    <View style={styles.container}>
      <Text style={styles.intro}>Propuestas, decisiones y cambios de tus proyectos.</Text>
      {error ? <Text style={styles.intro}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        refreshing={loading}
        onRefresh={() => void refresh()}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Bell size={30} color={colors.primary} />
            <Text style={styles.intro}>Las novedades importantes aparecerán aquí.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, !item.readAt && styles.unread]}
            onPress={() => {
              void markNotificationRead(item.id).catch(() => {});
              navigation.navigate(item.target === 'chat' ? 'Chat' : 'CanvasViewer', {
                roomId: item.roomId,
                diagramId: item.diagramId,
                roomName: 'Proyecto compartido',
                proposalId: item.proposalId || undefined,
                focusClassId: item.focusClassId || undefined,
              });
            }}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.time}>
              {new Date(item.createdAt).toLocaleString()} · {item.roomId}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  intro: { color: colors.textMuted, padding: 16, fontSize: 12, lineHeight: 20 },
  list: { padding: 16, gap: 10 },
  item: {
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    backgroundColor: colors.surface,
    gap: 7,
  },
  unread: { borderColor: colors.primary },
  title: { fontWeight: '700', color: colors.textPrimary, fontSize: 13 },
  body: { color: colors.textSecondary, fontSize: 12, lineHeight: 19 },
  time: { color: colors.textMuted, fontSize: 10 },
  empty: { alignItems: 'center', padding: 30 },
});
