import { apiFetch, setAuthToken, getBackendUrl, setBackendUrl } from './client';
import { AuthSession, MobileUser } from '../types/auth';

/**
 * Módulo de autenticación móvil preparado para Backend Local y Backend Cloud.
 * Si el backend está disponible (local o en la nube), autentica contra /api/v1/auth/login.
 * Si está en modo desconectado, genera una sesión local resiliente.
 */
export const authApi = {
  // Iniciar sesión estricto contra el servidor backend (Local o Nube)
  login: async (email: string, password: string): Promise<AuthSession> => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usuario: email.trim(), contrasena: password.trim() }),
    });

    if (!data || !data.token || !data.session) {
      throw new Error('El backend no devolvió una sesión o token válido.');
    }

    await setAuthToken(data.token);

    return {
      token: data.token,
      user: {
        id: data.user?.id || 'usr-' + Date.now(),
        name: data.user?.nombre || data.user?.name || email.split('@')[0],
        email: data.user?.correo || email,
        role: data.user?.rol || 'Arquitecto de Software',
        avatarColor: '#e8c39e',
        isHost: false,
      },
      roomId: data.session.roomId || 'ARC-GRUPO04',
      roomName: data.session.roomName || 'Sesión ArchAI Studio',
      isLocalMode: false,
    };
  },

  // Modo de demostración local explícito (Sin Backend)
  loginOffline: async (email: string, role = 'Arquitecto de Software'): Promise<AuthSession> => {
    const fallbackUser: MobileUser = {
      id: 'usr-offline-' + Date.now(),
      name: email.split('@')[0] || 'Ing. Carlos Criado',
      email: email.trim() || 'carlos.criado@archai.io',
      role,
      avatarColor: '#e8c39e',
      isHost: true,
    };

    return {
      user: fallbackUser,
      roomId: 'ARC-OFFLINE',
      roomName: 'Sesión Offline Móvil',
      isLocalMode: true,
    };
  },

  // Registro de nuevo usuario (compatible con servidor local y nube)
  register: async (nombre: string, email: string, password: string, rol: string): Promise<void> => {
    try {
      await apiFetch('/auth/registro', {
        method: 'POST',
        body: JSON.stringify({
          nombre: nombre.trim(),
          nombreUsuario: email.trim().split('@')[0],
          correo: email.trim(),
          contrasena: password.trim(),
          rol,
        }),
      });
    } catch (err: any) {
      console.warn('Registro en backend opcional o sin conexión:', err?.message);
    }
  },

  // Gestión de URL del servidor (Local vs Nube)
  getServerUrl: async (): Promise<string> => {
    return await getBackendUrl();
  },

  setServerUrl: async (url: string): Promise<void> => {
    await setBackendUrl(url);
  },
};
