import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiFetch } from '../api/client';
import { readCurrentUser } from '../api/conversationApi';

const key = 'archai_push_registration';
export interface TeamNotification {
  id: string;
  roomId: string;
  diagramId: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string;
  target: 'chat' | 'diagram';
  proposalId?: string;
  focusClassId?: string;
}
export async function enablePush() {
  if (Platform.OS !== 'android')
    throw new Error('Esta configuración de la presentación está preparada para Android.');
  if (Constants.executionEnvironment === 'storeClient')
    throw new Error(
      'Las notificaciones con la app cerrada requieren instalar la compilación de ArchAI. Expo Go permite seguir usando el chat y la actividad.'
    );
  await Notifications.setNotificationChannelAsync('archai-important', {
    name: 'Actividad importante de ArchAI',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted')
    throw new Error('No se concedió permiso. Puedes consultar las novedades dentro de la app.');
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) throw new Error('La compilación necesita estar vinculada al proyecto Expo del equipo.');
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const registered = await apiFetch('/notificaciones/dispositivos', {
    method: 'PUT',
    body: JSON.stringify({ token }),
  });
  const user = await readCurrentUser();
  await AsyncStorage.setItem(key, JSON.stringify({ ...registered, userId: user?.id }));
  return registered;
}
export async function disablePush() {
  const saved = await AsyncStorage.getItem(key);
  try {
    if (saved) {
      const registration = JSON.parse(saved);
      await apiFetch(`/notificaciones/dispositivos/${encodeURIComponent(registration.id)}`, {
        method: 'DELETE',
      });
    }
  } finally {
    await AsyncStorage.removeItem(key);
    if (Constants.executionEnvironment !== 'storeClient')
      await Notifications.unregisterForNotificationsAsync().catch(() => {});
  }
}
export async function pushEnabled() {
  const saved = await AsyncStorage.getItem(key),
    user = await readCurrentUser(),
    permission = await Notifications.getPermissionsAsync();
  return permission.status === 'granted' && !!saved && JSON.parse(saved).userId === user?.id;
}
export const listNotifications = (room?: string) =>
  apiFetch(`/notificaciones${room ? `?roomId=${encodeURIComponent(room)}` : ''}`) as Promise<
    TeamNotification[]
  >;
export const markNotificationRead = (id: string) =>
  apiFetch(`/notificaciones/${encodeURIComponent(id)}/leida`, { method: 'PUT' });
export function validNotification(
  data: Record<string, unknown>
): data is Record<string, unknown> & TeamNotification {
  return (
    typeof data.id === 'string' &&
    typeof data.roomId === 'string' &&
    /^ARC-[A-Z0-9-]+$/.test(data.roomId) &&
    typeof data.diagramId === 'string' &&
    (data.target === 'chat' || data.target === 'diagram')
  );
}
