import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { LoginScreen } from './src/screens/LoginScreen';
import { RoomsScreen } from './src/screens/RoomsScreen';
import { CanvasViewerScreen } from './src/screens/CanvasViewerScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { colors } from './src/theme/colors';
import {
  configurarCanalAndroid,
  configurarManejadorNotificaciones,
  procesarNotificacionInicial,
  suscribirNotificaciones,
  type RutaNotificacion,
} from './src/services/pushNotificationsService';

const Stack = createNativeStackNavigator();

// CU-23 — Referencia global para abrir la sala/proyecto desde una alerta push.
const navigationRef = createNavigationContainerRef<any>();

export default function App() {
  React.useEffect(() => {
    configurarManejadorNotificaciones();
    configurarCanalAndroid().catch(() => {});

    const abrirSalaDesdeAlerta = async (ruta: RutaNotificacion, intento = 0): Promise<void> => {
      if (!navigationRef.isReady()) {
        if (intento < 6) {
          setTimeout(() => {
            void abrirSalaDesdeAlerta(ruta, intento + 1);
          }, 350);
        }
        return;
      }

      // Sin sesión iniciada no se abre el lienzo: el usuario entra por el login habitual.
      const sesion = await AsyncStorage.getItem('archai_session').catch(() => null);
      if (!sesion) return;

      // Se deja el hub debajo para que "atrás" regrese a las salas del usuario.
      (navigationRef as any).reset({
        index: 1,
        routes: [
          { name: 'Rooms' },
          {
            name: 'CanvasViewer',
            params: {
              roomId: ruta.roomId,
              roomName: ruta.roomName,
              projectId: ruta.projectId,
            },
          },
        ],
      });
    };

    const desuscribir = suscribirNotificaciones((ruta) => {
      void abrirSalaDesdeAlerta(ruta);
    });
    procesarNotificacionInicial((ruta) => {
      void abrirSalaDesdeAlerta(ruta);
    }).catch(() => {});

    return desuscribir;
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ErrorBoundary>
          <NavigationContainer ref={navigationRef}>

          <Stack.Navigator
          initialRouteName="Login"
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
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
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
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ headerShown: false }}
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
