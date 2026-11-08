import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { UmlClass, UmlRelationship, GhostDraftProposal } from '../types/uml';

/**
 * Detecta automáticamente la IP del host cuando se ejecuta en un dispositivo físico.
 * En Expo en un teléfono real, `hostUri` expone la IP de la computadora en la red Wi-Fi (ej. 192.168.1.10:8081).
 */
export const getAutoDetectedHost = (): string => {
  const hostUri = Constants.expoConfig?.hostUri 
    || (Constants as any).manifest2?.extra?.expoClient?.hostUri 
    || (Constants as any).manifest?.debuggerHost;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return host;
    }
  }

  // Fallback: emulador Android (10.0.2.2) o localhost (iOS/Web)
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
};

export const getDefaultBackendUrl = (): string => {
  const host = getAutoDetectedHost();
  return `http://${host}:8000/api/v1`;
};

export const getBackendUrl = async (): Promise<string> => {
  const customUrl = await AsyncStorage.getItem('archai_backend_url');

  // Si en el almacenamiento quedó "10.0.2.2" pero estamos en un dispositivo físico real,
  // migramos automáticamente a la IP detectada en la red local (ej. 192.168.1.10).
  const autoHost = getAutoDetectedHost();
  if (customUrl && customUrl.includes('10.0.2.2') && autoHost !== '10.0.2.2') {
    const migratedUrl = customUrl.replace('10.0.2.2', autoHost);
    await AsyncStorage.setItem('archai_backend_url', migratedUrl);
    return migratedUrl;
  }

  return customUrl || getDefaultBackendUrl();
};

export const setBackendUrl = async (url: string): Promise<void> => {
  await AsyncStorage.setItem('archai_backend_url', url);
};

export const getAuthToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem('archai_jwt_token');
};

export const setAuthToken = async (token: string): Promise<void> => {
  await AsyncStorage.setItem('archai_jwt_token', token);
};

export const apiFetch = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  const baseUrl = await getBackendUrl();
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMsg = response.statusText;
      try {
        const errorBody = await response.json();
        errorMsg = errorBody.message || errorBody.mensaje || errorBody.error || errorMsg;
      } catch {
        try {
          errorMsg = await response.text();
        } catch {}
      }
      throw new Error(errorMsg || `Error ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    // Si la conexión falló a nivel de socket/red, formatear mensaje limpio sin stack trace Java
    if (
      err?.message?.includes('ConnectException') ||
      err?.message?.includes('Network request failed') ||
      err?.message?.includes('Failed to connect')
    ) {
      throw new Error('No se pudo conectar con el servidor. Verifica que tu teléfono y PC compartan la misma red Wi-Fi.');
    }
    throw err;
  }
};

// API Services for Mobile
export const mobileApi = {
  // Authentication
  login: async (email: string, pass: string) => {
    return await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });
  },

  // Rooms & Diagrams
  getRoomDiagram: async (roomId: string): Promise<{ classes: UmlClass[]; relationships: UmlRelationship[] }> => {
    return await apiFetch(`/diagramas/sala/${roomId}`);
  },

  // Active Ghost Drafts (AI Suggestions)
  getGhostDrafts: async (roomId: string): Promise<GhostDraftProposal[]> => {
    return await apiFetch(`/ia/ghost-drafts/${roomId}`);
  },

  // Register Web Push Token (VAPID)
  registerPushToken: async (token: string) => {
    return await apiFetch('/push/register', {
      method: 'POST',
      body: JSON.stringify({ token, platform: 'mobile-react-native' }),
    });
  },
};
