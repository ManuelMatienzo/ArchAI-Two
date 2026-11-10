import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { getAuthToken } from './src/api/client';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { validNotification, markNotificationRead } from './src/services/notificationsService';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { LoginScreen } from './src/screens/LoginScreen';
import { RoomsScreen } from './src/screens/RoomsScreen';
import { CanvasViewerScreen } from './src/screens/CanvasViewerScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { colors } from './src/theme/colors';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef<any>();

export default function App() {
  const [initial, setInitial] = useState<string | null>(null);
  const pending = useRef<Record<string, unknown> | null>(null);
  const openPending = async () => {
    const data = pending.current;
    if (
      !data ||
      !validNotification(data) ||
      !navigationRef.isReady() ||
      !(await getAuthToken()) ||
      navigationRef.getCurrentRoute()?.name === 'Login'
    )
      return;
    pending.current = null;
    await AsyncStorage.setItem('archai_last_opened_notification', data.id);
    void markNotificationRead(data.id).catch(() => {});
    navigationRef.navigate(data.target === 'chat' ? 'Chat' : 'CanvasViewer', {
      roomId: data.roomId,
      diagramId: data.diagramId,
      roomName: 'Proyecto compartido',
      proposalId: data.proposalId || undefined,
      focusClassId: data.focusClassId || undefined,
    });
  };
  useEffect(() => {
    void Promise.all([getAuthToken(), AsyncStorage.getItem('archai_session')]).then(([token, session]) =>
      setInitial(token && session ? 'Rooms' : 'Login')
    );
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const current = navigationRef.getCurrentRoute();
        const sameRoom = (current?.params as any)?.roomId === notification.request.content.data?.roomId;
        return {
          shouldShowBanner: !sameRoom,
          shouldShowList: true,
          shouldPlaySound: !sameRoom,
          shouldSetBadge: true,
        };
      },
    });
    const handle = async (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      if (
        data &&
        validNotification(data) &&
        (await AsyncStorage.getItem('archai_last_opened_notification')) !== data.id
      ) {
        pending.current = data;
        await openPending();
      }
    };
    const listener = Notifications.addNotificationResponseReceivedListener(
      (response) => void handle(response)
    );
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) void handle(response);
    });
    return () => listener.remove();
  }, []);
  if (!initial) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ErrorBoundary>
          <NavigationContainer
            ref={navigationRef}
            onReady={() => void openPending()}
            onStateChange={() => void openPending()}
          >
            <Stack.Navigator
              initialRouteName={initial}
              screenOptions={{
                headerStyle: {
                  backgroundColor: colors.surface,
                },
                headerTintColor: colors.primary,
                headerTitleStyle: {
                  fontWeight: '700',
                  color: colors.textPrimary,
                },
                contentStyle: {
                  backgroundColor: colors.background,
                },
              }}
            >
              <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
              <Stack.Screen
                name="Rooms"
                component={RoomsScreen}
                options={{ title: 'ArchAI · Salas', headerBackVisible: false }}
              />
              <Stack.Screen
                name="CanvasViewer"
                component={CanvasViewerScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
                options={{ title: 'Actividad del equipo' }}
              />
              <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ title: 'Configuración Móvil' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
