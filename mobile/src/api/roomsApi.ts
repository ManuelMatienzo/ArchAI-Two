import { apiFetch } from './client';
import { UmlClass, UmlRelationship } from '../types/uml';

export interface RoomItem {
  id: string;
  name: string;
  projectCode?: string;
  activeUsers: number;
  lastUpdated: string;
  hostName?: string;
}

export interface ProjectItem {
  id: string;
  nombre: string;
  descripcion?: string;
  codigoAcceso: string;
  iconoColor?: string;
  estado: string;
  propietarioId: string;
  propietarioNombre: string;
  fechaCreacion?: string;
  fechaActualizacion?: string;
  totalDiagramas?: number;
  miembros?: any[];
}

export interface RoomParticipant {
  id: string;
  name: string;
  role: string;
  avatarColor?: string;
  isHost?: boolean;
  isCurrentUser?: boolean;
  clientType?: 'WEB_STUDIO' | 'MOBILE_APP' | 'AI_SERVICE';
  connectedSince?: string;
}

export interface InfoSesionDto {
  roomId: string;
  roomName: string;
  hostName: string;
  createdAt: string;
  currentUser?: RoomParticipant;
  participants: RoomParticipant[];
  isLocalMode?: boolean;
}

/**
 * Normaliza los nombres de tipos de relación del backend al tipo del cliente móvil.
 */
function normalizeRelationType(type?: string): 'association' | 'inheritance' | 'composition' | 'aggregation' {
  const clean = (type || '').toLowerCase();
  if (clean.includes('inherit') || clean.includes('generaliz')) return 'inheritance';
  if (clean.includes('composit')) return 'composition';
  if (clean.includes('aggregat')) return 'aggregation';
  return 'association';
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Cliente de API para Salas Colaborativas (CU-03) y Carga de Diagramas en Backend Spring Boot.
 * 100% conectado a endpoints reales sin mocks.
 */
export const roomsApi = {
  /**
   * Obtiene las salas visibles para la cuenta desde el backend (`GET /api/v1/colaboracion/salas?usuarioId=`).
   * Incluye las salas creadas por el usuario y aquellas a las que se unió con el PIN.
   * Enriquece cada sala con sus detalles de sesión (`GET /api/v1/colaboracion/salas/{pin}`).
   */
  listActiveRooms: async (usuarioId?: string): Promise<RoomItem[]> => {
    try {
      const query = usuarioId ? `?usuarioId=${encodeURIComponent(usuarioId)}` : '';
      const pins: string[] = await apiFetch(`/colaboracion/salas${query}`);
      if (!Array.isArray(pins) || pins.length === 0) {
        return [];
      }

      // Consultar información detallada de cada sala en paralelo
      const roomPromises = pins.map(async (pin) => {
        try {
          const info: InfoSesionDto = await apiFetch(`/colaboracion/salas/${encodeURIComponent(pin)}`);
          return {
            id: info.roomId || pin,
            name: info.roomName || `Sala ${pin}`,
            activeUsers: info.participants ? info.participants.length : 1,
            lastUpdated: info.createdAt ? `Creada a las ${info.createdAt}` : 'En vivo',
            hostName: info.hostName,
          } as RoomItem;
        } catch {
          return {
            id: pin,
            name: `Sala ${pin}`,
            activeUsers: 1,
            lastUpdated: 'En vivo',
          } as RoomItem;
        }
      });

      return await Promise.all(roomPromises);
    } catch (err) {
      console.warn('Error al listar salas activas desde backend:', err);
      return [];
    }
  },

  /**
   * Consulta los detalles de una sala específica (`GET /api/v1/colaboracion/salas/{pin}`).
   */
  getRoomDetails: async (pin: string): Promise<InfoSesionDto | null> => {
    try {
      return await apiFetch(`/colaboracion/salas/${encodeURIComponent(pin)}`);
    } catch {
      return null;
    }
  },

  /**
   * Crea una nueva sala en el backend (`POST /api/v1/colaboracion/salas`).
   */
  createRoom: async (nombreSala: string, anfitrion: any, pin?: string): Promise<InfoSesionDto> => {
    return await apiFetch('/colaboracion/salas', {
      method: 'POST',
      body: JSON.stringify({
        nombreSala: nombreSala.trim() || 'Nueva Sala de Arquitectura',
        anfitrion: {
          id: anfitrion.id,
          name: anfitrion.name || 'Desarrollador Móvil',
          email: anfitrion.email || 'movil@archai.io',
          role: anfitrion.role || 'Desarrollador Móvil',
        },
        pin: pin?.trim() || undefined,
      }),
    });
  },

  /**
   * Se une a una sala existente en el backend (`POST /api/v1/colaboracion/salas/unirse`).
   */
  joinRoom: async (pin: string, usuario: any): Promise<InfoSesionDto> => {
    return await apiFetch('/colaboracion/salas/unirse', {
      method: 'POST',
      body: JSON.stringify({
        pin: pin.trim().toUpperCase(),
        usuario: {
          id: usuario.id,
          name: usuario.name || 'Desarrollador Móvil',
          email: usuario.email || 'movil@archai.io',
          role: usuario.role || 'Desarrollador Móvil',
        },
      }),
    });
  },

  /**
   * Abandona una sala activa en el backend (`POST /api/v1/colaboracion/salas/{pin}/salir`).
   */
  leaveRoom: async (pin: string, usuarioId: string): Promise<boolean> => {
    try {
      await apiFetch(`/colaboracion/salas/${encodeURIComponent(pin)}/salir?usuarioId=${encodeURIComponent(usuarioId)}`, {
        method: 'POST',
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * CU-02 · Lista exclusivamente los proyectos visibles para la cuenta autenticada
   * (proyectos donde es propietario o donde fue agregado como colaborador).
   */
  listUserProjects: async (usuarioId: string): Promise<ProjectItem[]> => {
    try {
      if (!usuarioId) return [];
      const data = await apiFetch(`/proyectos?usuarioId=${encodeURIComponent(usuarioId)}`);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('[roomsApi] Error al listar proyectos del usuario:', err);
      return [];
    }
  },

  /**
   * CU-02 · Unirse a un proyecto compartido mediante su código de acceso (ej. SISTEM-1071).
   */
  joinProjectByCode: async (codigoAcceso: string, usuarioId: string): Promise<ProjectItem> => {
    return await apiFetch('/proyectos/unirse', {
      method: 'POST',
      body: JSON.stringify({
        codigoAcceso: codigoAcceso.trim().toUpperCase(),
        usuarioId: usuarioId.trim(),
      }),
    });
  },

  /**
   * Obtiene los diagramas pertenecientes a un proyecto específico.
   */
  getProjectDiagram: async (proyectoId: string): Promise<{ classes: UmlClass[]; relationships: UmlRelationship[] }> => {
    try {
      const diagrams = await apiFetch(`/diagramas?proyectoId=${encodeURIComponent(proyectoId)}`);
      if (Array.isArray(diagrams) && diagrams.length > 0) {
        const target = diagrams.find((d: any) => d.classes && d.classes.length > 0) || diagrams[0];
        if (target && Array.isArray(target.classes) && target.classes.length > 0) {
          return parseBackendDiagram(target);
        }
      }
      return { classes: [], relationships: [] };
    } catch (err) {
      console.warn('[roomsApi] Error al obtener diagrama del proyecto:', err);
      return { classes: [], relationships: [] };
    }
  },

  /**
   * Obtiene el diagrama vivo de la sala o el diagrama del proyecto seleccionado.
   */
  getRoomDiagram: async (
    pin: string,
    projectId?: string
  ): Promise<{ classes: UmlClass[]; relationships: UmlRelationship[] }> => {
    try {
      // 1. Si se indicó un proyecto específico, obtener el diagrama de ese proyecto
      if (projectId) {
        const pDiag = await roomsApi.getProjectDiagram(projectId);
        if (pDiag.classes.length > 0) return pDiag;
      }

      // 2. Intentar obtener el diagrama activo en memoria de la sala
      const roomDiagram = await apiFetch(`/colaboracion/salas/${encodeURIComponent(pin)}/diagrama`);

      if (roomDiagram && Array.isArray(roomDiagram.classes) && roomDiagram.classes.length > 0) {
        return parseBackendDiagram(roomDiagram);
      }

      // 3. Si la sala no tiene clases en memoria, consultar si existe un diagrama persistido
      const allDiagrams = await apiFetch('/diagramas');
      if (Array.isArray(allDiagrams) && allDiagrams.length > 0) {
        const populatedDiagram = allDiagrams.find((d: any) => d.classes && d.classes.length > 0) || allDiagrams[0];
        if (populatedDiagram && Array.isArray(populatedDiagram.classes) && populatedDiagram.classes.length > 0) {
          return parseBackendDiagram(populatedDiagram);
        }
      }

      return { classes: [], relationships: [] };
    } catch (err) {
      console.warn('Error al obtener diagrama de sala desde backend:', err);
      return { classes: [], relationships: [] };
    }
  },
};

/**
 * Transforma el DTO del backend Spring Boot (`UmlClassDto` / `UmlRelationDto`)
 * a las interfaces estrictas del cliente móvil (`UmlClass` / `UmlRelationship`).
 */
export function parseBackendDiagram(dto: any): { classes: UmlClass[]; relationships: UmlRelationship[] } {
  const rawClasses = Array.isArray(dto?.classes) ? dto.classes : [];
  const rawRelations = Array.isArray(dto?.relations)
    ? dto.relations
    : Array.isArray(dto?.relationships)
      ? dto.relationships
      : [];

  const toFinite = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  const classes: UmlClass[] = rawClasses.filter(Boolean).map((c: any, index: number) => {
    const posX = toFinite(c.position?.x ?? c.x, 60 + (index % 3) * 290);
    const posY = toFinite(c.position?.y ?? c.y, 80 + Math.floor(index / 3) * 260);

    return {
      id: c.id || `c-${index}`,
      name: c.name || `Clase_${index + 1}`,
      stereotype: c.stereotype || 'Entity',
      tableName: c.tableName || toSnakeCase(c.name || 'tabla') + 's',
      x: posX,
      y: posY,
      width: toFinite(c.width, 190),
      height: toFinite(c.height, 175),
      attributes: Array.isArray(c.attributes)
        ? c.attributes.map((a: any, aIdx: number) => ({
            id: a.id || `a-${index}-${aIdx}`,
            name: a.name || `attr${aIdx + 1}`,
            type: a.type || 'String',
            visibility: a.visibility || '-',
            isPrimaryKey: Boolean(a.isPrimaryKey),
            isForeignKey: Boolean(a.isForeignKey),
            isUnique: Boolean(a.isUnique),
          }))
        : [],
      methods: Array.isArray(c.methods)
        ? c.methods.map((m: any, mIdx: number) => ({
            id: m.id || `m-${index}-${mIdx}`,
            name: m.name || `metodo${mIdx + 1}`,
            returnType: m.returnType || 'void',
            visibility: m.visibility || '+',
            parameters: m.parameters || '',
          }))
        : [],
    };
  });

  // Solo se conservan relaciones con extremos válidos y existentes en el diagrama.
  const validClassIds = new Set(classes.map((c) => c.id));
  const relationships: UmlRelationship[] = rawRelations
    .filter((r: any) => r && (r.sourceClassId || r.sourceId) && (r.targetClassId || r.targetId))
    .filter((r: any) => {
      const sourceId = r.sourceClassId || r.sourceId;
      const targetId = r.targetClassId || r.targetId;
      return validClassIds.has(sourceId) && validClassIds.has(targetId);
    })
    .map((r: any, rIdx: number) => ({
      id: r.id || `r-${rIdx}`,
      sourceId: r.sourceClassId || r.sourceId,
      targetId: r.targetClassId || r.targetId,
      type: normalizeRelationType(r.type),
      sourceMultiplicity: r.sourceMultiplicity || '1',
      targetMultiplicity: r.targetMultiplicity || '1..*',
      name: r.name || r.sourceRole || '',
    }));

  return { classes, relationships };
}
