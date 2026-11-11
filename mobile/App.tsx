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
import {
  procesarNotificacionInicial,
  suscribirNotificaciones,
  type RutaNotificacion,
} from './src/services/pushNotificationsService';
import { colors } from './src/theme/colors';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef<any>();

export default function App() {
  const [initial, setInitial] = useState<string | null>(null);
  const pending = useRef<{ ruta: RutaNotificacion; datos: Record<string, string> } | null>(null);
  const ultimaApertura = useRef<{ clave: string; ts: number } | null>(null);

  /** Evita abrir dos veces la misma alerta cuando el sistema entrega el tap por dos vías. */
  const esAperturaDuplicada = (clave: string) => {
    const ahora = Date.now();
    const previa = ultimaApertura.current;
    ultimaApertura.current = { clave, ts: ahora };
    return Boolean(previa && previa.clave === clave && ahora - previa.ts < 2000);
  };

  const puedeAbrir = async () =>
    navigationRef.isReady() &&
    Boolean(await getAuthToken()) &&
    Boolean(await AsyncStorage.getItem('archai_session')) &&
    navigationRef.getCurrentRoute()?.name !== 'Login';

  const abrirDesdeNotificacion = async (ruta: RutaNotificacion, datos: Record<string, string>) => {
    // Actividad del equipo: conserva el destino original (chat o lienzo con propuesta).
    if (validNotification(datos)) {
      if ((await AsyncStorage.getItem('archai_last_opened_notification')) === datos.id) return;
      if (!(await puedeAbrir())) {
        pending.current = { ruta, datos };
        return;
      }
      pending.current = null;
      await AsyncStorage.setItem('archai_last_opened_notification', datos.id);
      void markNotificationRead(datos.id).catch(() => {});
      navigationRef.navigate(datos.target === 'chat' ? 'Chat' : 'CanvasViewer', {
        roomId: datos.roomId,
        diagramId: datos.diagramId,
        roomName: 'Proyecto compartido',
        proposalId: datos.proposalId || undefined,
        focusClassId: datos.focusClassId || undefined,
      });
      return;
    }

    // CU-23 — Alerta de cambio crítico: abre el lienzo de la sala que originó el cambio.
    // La deduplicación se evalúa solo cuando la app ya puede navegar; si el tap llega
    // en frío se guarda como pendiente y se reintenta al montar el NavigationContainer.
    if (!(await puedeAbrir())) {
      pending.current = { ruta, datos };
      return;
    }
    if (esAperturaDuplicada(`${ruta.roomId}|${ruta.projectId ?? ''}`)) return;
    pending.current = null;
    navigationRef.navigate('CanvasViewer', {
      roomId: ruta.roomId,
      roomName: ruta.roomName,
      projectId: ruta.projectId,
    });
  };

  const abrirPendiente = async () => {
    const item = pending.current;
    if (!item || !(await puedeAbrir())) return;
    await abrirDesdeNotificacion(item.ruta, item.datos);
  };

  useEffect(() => {
    void Promise.all([getAuthToken(), AsyncStorage.getItem('archai_session')]).then(([token, session]) =>
      setInitial(token && session ? 'Rooms' : 'Login')
    );
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const current = navigationRef.getCurrentRoute();
        const data: any = notification.request.content.data || {};
        const sameRoom =
          Boolean(current?.params) &&
          ((current?.params as any)?.roomId === data.roomId ||
            (current?.params as any)?.roomId === data.salaId);
        return {
          shouldShowBanner: !sameRoom,
          shouldShowList: true,
          shouldPlaySound: !sameRoom,
          shouldSetBadge: true,
        };
      },
    });
    const desuscribir = suscribirNotificaciones((ruta, datos) => {
      void abrirDesdeNotificacion(ruta, datos);
    });
    void procesarNotificacionInicial((ruta, datos) => {
      void abrirDesdeNotificacion(ruta, datos);
    });
    return () => desuscribir();
  }, []);
  if (!initial) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ErrorBoundary>
          <NavigationContainer
            ref={navigationRef}
            onReady={() => void abrirPendiente()}
            onStateChange={() => void abrirPendiente()}
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
