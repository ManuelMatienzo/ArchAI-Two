import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { mobileApi } from '../api/client';

/**
 * CU-23 — Alertas Push de Cambios Críticos (móvil).
 *
 * Flujo:
 *  1. Permiso del sistema + canal Android de máxima prioridad.
 *  2. Obtención del token: token nativo FCM/APNs; si no está disponible, Expo Push
 *     (requiere `extra.eas.projectId` o `extra.archaiPush.expoProjectId`).
 *  3. Registro del token contra `POST /api/v1/push/register`.
 *  4. Listeners de notificación recibida / tap para abrir la sala o proyecto.
 *
 * Integración de Firebase:
 *  - El móvil ya incluye `google-services.json` y `android.googleServicesFile` en `app.json`.
 *    Expo/`expo-notifications` obtiene el token FCM nativo con `getDevicePushTokenAsync`.
 *  - Lo único que falta es la credencial del servidor en el backend:
 *    `ARCHAI_PUSH_FCM_CREDENCIALES` + `ARCHAI_PUSH_FCM_HABILITADO=true`.
 */

export const PUSH_CHANNEL_ID = 'archai-critical';

const CLAVES = {
  habilitado: 'archai_push_enabled',
  token: 'archai_push_token',
  tipo: 'archai_push_token_type',
  usuario: 'archai_push_usuario_id',
} as const;

export type TipoTokenPush = 'expo' | 'fcm' | 'apns' | 'desconocido';

export interface UsuarioPush {
  id: string;
  name?: string;
}

export interface ContextoPush {
  salaId?: string | null;
  proyectoId?: string | null;
}

export interface RutaNotificacion {
  roomId: string;
  roomName: string;
  projectId?: string;
}

export type MotivoFalloPush =
  | 'permiso-denegado'
  | 'sin-token'
  | 'registro-fallido'
  | 'no-disponible';

export interface ResultadoActivacionPush {
  ok: boolean;
  motivo?: MotivoFalloPush;
  token?: string;
  tipo?: TipoTokenPush;
}

/** Evita que una notificación recibida en primer plano se muestre duplicada o silenciosa. */
export function configurarManejadorNotificaciones(): void {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // En Expo Go / web el manejador puede no estar disponible: la app sigue funcionando.
  }
}

/** Canal Android de máxima prioridad para alertas críticas (Android 8+). */
export async function configurarCanalAndroid(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
      name: 'Cambios críticos',
      description: 'Alertas de cambios críticos en tus proyectos y salas',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#38BDF8',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  } catch {
    // Un canal no disponible no debe impedir el resto del flujo.
  }
}

/** Project ID de EAS/Expo configurado por el usuario (opcional). */
export function obtenerProjectIdExpo(): string {
  const desdeEntorno = (globalThis as any)?.process?.env?.EXPO_PUBLIC_EAS_PROJECT_ID;
  const extra = (Constants.expoConfig as any)?.extra;
  const candidato =
    (typeof desdeEntorno === 'string' && desdeEntorno.trim()) ||
    extra?.eas?.projectId ||
    extra?.archaiPush?.expoProjectId ||
    (Constants as any)?.easConfig?.projectId ||
    '';
  return typeof candidato === 'string' ? candidato.trim() : '';
}

/**
 * Obtiene el token del dispositivo.
 * Prioriza el token nativo (FCM en Android / APNs en iOS) y usa Expo Push como respaldo
 * cuando el proyecto no tiene credenciales nativas pero sí `projectId` de EAS.
 */
async function obtenerTokenPush(): Promise<{ token: string; tipo: TipoTokenPush }> {
  if (Platform.OS === 'web') {
    // El canal push de CU-23 es exclusivo del dispositivo móvil.
    throw new Error('no-disponible');
  }

  try {
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    const datos = (deviceToken as any)?.data;
    const token =
      typeof datos === 'string'
        ? datos
        : datos != null
          ? JSON.stringify(datos)
          : '';

    if (token) {
      return {
        token,
        tipo: Platform.OS === 'android' ? 'fcm' : Platform.OS === 'ios' ? 'apns' : 'desconocido',
      };
    }
  } catch {
    // Sin google-services.json / APNs se intenta el token de Expo Push.
  }

  const projectId = obtenerProjectIdExpo();
  if (projectId) {
    try {
      const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
      if (expoToken?.data) {
        return { token: expoToken.data, tipo: 'expo' };
      }
    } catch {
      // Sin servicio Expo disponible: no hay token utilizable.
    }
  }

  throw new Error('sin-token');
}

/** Activa notificaciones: permiso + canal + token + registro en backend. */
export async function activarNotificacionesPush(
  usuario: UsuarioPush,
  contexto?: ContextoPush
): Promise<ResultadoActivacionPush> {
  if (!usuario?.id) {
    return { ok: false, motivo: 'no-disponible' };
  }
  if (Platform.OS === 'web') {
    return { ok: false, motivo: 'no-disponible' };
  }

  await configurarCanalAndroid();

  try {
    let permiso = await Notifications.getPermissionsAsync();
    if (!permiso.granted && permiso.canAskAgain) {
      permiso = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
    }
    if (!permiso.granted) {
      return { ok: false, motivo: 'permiso-denegado' };
    }
  } catch {
    return { ok: false, motivo: 'no-disponible' };
  }

  let tokenInfo: { token: string; tipo: TipoTokenPush };
  try {
    tokenInfo = await obtenerTokenPush();
  } catch {
    return { ok: false, motivo: 'sin-token' };
  }

  try {
    await mobileApi.registerPushToken(tokenInfo.token, {
      usuarioId: usuario.id,
      salaId: contexto?.salaId || undefined,
      proyectoId: contexto?.proyectoId || undefined,
      plataforma: 'mobile-react-native',
      dispositivo: `${Platform.OS}-${Platform.Version}`,
    });
  } catch {
    return { ok: false, motivo: 'registro-fallido', token: tokenInfo.token, tipo: tokenInfo.tipo };
  }

  await AsyncStorage.multiSet([
    [CLAVES.habilitado, '1'],
    [CLAVES.token, tokenInfo.token],
    [CLAVES.tipo, tokenInfo.tipo],
    [CLAVES.usuario, usuario.id],
  ]);

  return { ok: true, token: tokenInfo.token, tipo: tokenInfo.tipo };
}

/** Desactiva notificaciones y desregistra el token del backend. */
export async function desactivarNotificacionesPush(): Promise<void> {
  const token = await AsyncStorage.getItem(CLAVES.token);
  if (token) {
    try {
      await mobileApi.unregisterPushToken(token);
    } catch {
      // Si el backend no responde, igualmente se desactiva localmente.
    }
  }

  await AsyncStorage.setItem(CLAVES.habilitado, '0');
  await AsyncStorage.multiRemove([CLAVES.token, CLAVES.tipo, CLAVES.usuario]);
}

/** Preferencia local de notificaciones (switch de Ajustes). */
export async function estaPushHabilitado(): Promise<boolean> {
  return (await AsyncStorage.getItem(CLAVES.habilitado)) === '1';
}

export async function obtenerTokenPushGuardado(): Promise<string | null> {
  return await AsyncStorage.getItem(CLAVES.token);
}

/**
 * Re-registra el token cuando cambia el usuario o el proyecto/sala abierto.
 * Así la alerta crítica se dirige al dispositivo que estaba supervisando ese proyecto.
 */
export async function sincronizarTokenPush(
  usuario: UsuarioPush,
  contexto?: ContextoPush
): Promise<boolean> {
  if (!usuario?.id) return false;
  if (!(await estaPushHabilitado())) return false;

  const token = await AsyncStorage.getItem(CLAVES.token);
  if (!token) return false;

  try {
    await mobileApi.registerPushToken(token, {
      usuarioId: usuario.id,
      salaId: contexto?.salaId || undefined,
      proyectoId: contexto?.proyectoId || undefined,
      plataforma: 'mobile-react-native',
      dispositivo: `${Platform.OS}-${Platform.Version}`,
    });
    await AsyncStorage.setItem(CLAVES.usuario, usuario.id);
    return true;
  } catch {
    return false;
  }
}

/** Vincula el token al proyecto/sala que el ingeniero acaba de abrir. */
export async function vincularSalaPush(
  usuario: UsuarioPush,
  salaId?: string | null,
  proyectoId?: string | null
): Promise<boolean> {
  if (!salaId || salaId === 'LOCAL-MODE') return false;
  return await sincronizarTokenPush(usuario, { salaId, proyectoId });
}

/** Normaliza el `data` de una notificación a un mapa string→string. */
export function extraerDatosNotificacion(
  origen: Notifications.NotificationResponse | Notifications.Notification | null | undefined
): Record<string, string> {
  if (!origen) return {};

  const contenido =
    (origen as any)?.notification?.request?.content ??
    (origen as any)?.request?.content ??
    null;
  const datos = contenido?.data;

  if (!datos || typeof datos !== 'object') return {};

  const normalizado: Record<string, string> = {};
  Object.entries(datos as Record<string, unknown>).forEach(([clave, valor]) => {
    if (valor !== null && valor !== undefined) {
      normalizado[clave] = String(valor);
    }
  });
  return normalizado;
}

/**
 * Traduce el payload de la alerta a la ruta de la sala/proyecto.
 *
 * Devuelve `null` si la alerta no trae `roomId`/`salaId`: una alerta solo de proyecto
 * no puede abrir el lienzo (el visor necesita una sala concreta), así que se limita a
 * mostrarse en la bandeja del sistema.
 */
export function extraerRutaNotificacion(
  datos: Record<string, string>
): RutaNotificacion | null {
  const roomId = datos.roomId || datos.salaId || '';
  if (!roomId) return null;

  const projectId = datos.projectId || datos.proyectoId || '';
  const roomName = datos.roomName || datos.nombreSala || 'Sala colaborativa';

  return {
    roomId,
    roomName,
    projectId: projectId || undefined,
  };
}

/**
 * Suscribe los listeners de notificación. Devuelve la función de limpieza.
 *
 * `alAbrir` recibe la ruta de la sala/proyecto y el `data` normalizado de la alerta,
 * para que la app pueda distinguir entre una alerta crítica de CU-23 y una notificación
 * de actividad del equipo sin registrar dos listeners.
 */
export function suscribirNotificaciones(
  alAbrir: (ruta: RutaNotificacion, datos: Record<string, string>) => void
): () => void {
  const suscripcionRespuesta = Notifications.addNotificationResponseReceivedListener((respuesta) => {
    const datos = extraerDatosNotificacion(respuesta);
    const ruta = extraerRutaNotificacion(datos);
    if (ruta) alAbrir(ruta, datos);
  });

  const suscripcionRecibida = Notifications.addNotificationReceivedListener(() => {
    // El manejador global ya muestra la alerta; aquí no hay estado adicional que actualizar.
  });

  return () => {
    try {
      suscripcionRespuesta.remove();
    } catch {}
    try {
      suscripcionRecibida.remove();
    } catch {}
  };
}

/** Procesa el tap que abrió la app desde una notificación en frío. */
export async function procesarNotificacionInicial(
  alAbrir: (ruta: RutaNotificacion, datos: Record<string, string>) => void
): Promise<void> {
  try {
    const respuesta = await Notifications.getLastNotificationResponseAsync();
    if (!respuesta) return;

    const datos = extraerDatosNotificacion(respuesta);
    const ruta = extraerRutaNotificacion(datos);
    if (ruta) alAbrir(ruta, datos);

    await Notifications.clearLastNotificationResponseAsync();
  } catch {
    // Sin respuesta inicial: arranque normal de la app.
  }
}
