import AsyncStorage from '@react-native-async-storage/async-storage';
import { UmlClass, UmlRelationship } from '../types/uml';

export interface DiagramData {
  classes: UmlClass[];
  relationships: UmlRelationship[];
  updatedAt?: number;
}

const CACHE_PREFIX = 'archai_cache_diagram_';
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hora de validez para caché offline

/**
 * Caché L1 en memoria para navegación instantánea (0 ms jank) entre
 * el Chat, el Selector de Salas y el Visor 360° en Modo Viaje.
 */
const memoryCache = new Map<string, { data: DiagramData; timestamp: number }>();

export const diagramCacheService = {
  /**
   * Obtiene el diagrama cacheado en memoria (L1) o en disco (L2).
   */
  getCachedDiagram: async (roomId: string): Promise<DiagramData | null> => {
    if (!roomId || await AsyncStorage.getItem('archai_offline_enabled')==='false') return null;

    // 1. Verificación en memoria L1 (0 ms)
    const memEntry = memoryCache.get(roomId);
    if (memEntry && Date.now() - memEntry.timestamp < CACHE_TTL_MS) {
      return memEntry.data;
    }

    // 2. Verificación en almacenamiento persistente L2
    try {
      const stored = await AsyncStorage.getItem(CACHE_PREFIX + roomId);
      if (stored) {
        const parsed: DiagramData = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.classes)) {
          // Re-poblar L1 para accesos subsecuentes
          memoryCache.set(roomId, {
            data: parsed,
            timestamp: Date.now(),
          });
          return parsed;
        }
      }
    } catch (err) {
      console.warn(`[diagramCacheService] Error al leer caché L2 para ${roomId}:`, err);
    }

    return null;
  },

  /**
   * Almacena el diagrama en memoria (L1) y en almacenamiento local (L2).
   */
  saveCachedDiagram: async (roomId: string, data: DiagramData): Promise<void> => {
    if (!roomId || !data || await AsyncStorage.getItem('archai_offline_enabled')==='false') return;

    const payload: DiagramData = {
      classes: data.classes || [],
      relationships: data.relationships || [],
      updatedAt: Date.now(),
    };

    // 1. Guardar en memoria L1
    memoryCache.set(roomId, {
      data: payload,
      timestamp: Date.now(),
    });

    // 2. Persistir en almacenamiento L2
    try {
      await AsyncStorage.setItem(CACHE_PREFIX + roomId, JSON.stringify(payload));
    } catch (err) {
      console.warn(`[diagramCacheService] Error al escribir caché L2 para ${roomId}:`, err);
    }
  },

  /**
   * Invalida el caché de una sala específica o de todas las salas.
   */
  clearCache: async (roomId?: string): Promise<void> => {
    if (roomId) {
      memoryCache.delete(roomId);
      try {
        await AsyncStorage.removeItem(CACHE_PREFIX + roomId);
      } catch {}
    } else {
      memoryCache.clear();
      try {
        const keys = await AsyncStorage.getAllKeys();
        const diagramKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
        if (diagramKeys.length > 0) {
          await AsyncStorage.multiRemove(diagramKeys);
        }
      } catch {}
    }
  },
};
