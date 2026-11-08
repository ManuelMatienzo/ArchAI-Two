/**
 * Configuración centralizada de rutas y alias de URL para ArchAI.
 * Define las direcciones canónicas (inglés) y todos sus alias compatibles (español y abreviados).
 */

export const ROUTES = {
  // 1. Autenticación y Acceso
  LOGIN: {
    PATH: '/login',
    ALIASES: ['/auth', '/iniciar-sesion', '/autenticacion'],
    TITLE: 'Iniciar Sesión | ArchAI'
  },

  // 2. Gestión de Proyectos
  PROJECTS: {
    PATH: '/projects',
    ALIASES: ['/proyectos', '/dashboard', '/gestor-proyectos'],
    TITLE: 'Gestor de Proyectos | ArchAI'
  },

  // 3. Lienzo / Estudio UML Interactivo
  STUDIO: {
    PATH: '/studio',
    WITH_ID: '/studio/:diagramId',
    ALIASES: ['/canvas', '/lienzo', '/estudio'],
    ALIASES_WITH_ID: ['/canvas/:diagramId', '/lienzo/:diagramId', '/estudio/:diagramId'],
    TITLE: 'Estudio Lienzo UML | ArchAI'
  },

  // 4. Sala Colaborativa en Vivo (CU-03)
  ROOM: {
    PATH: '/room/:roomId',
    ALIASES: ['/sala/:roomId', '/colaboracion/:roomId', '/colab/:roomId'],
    TITLE: 'Sala Colaborativa | ArchAI'
  },

  // 5. Vistas y Módulos Especializados del Estudio
  TEAM: {
    PATH: '/team',
    ALIASES: ['/equipo', '/colaboradores'],
    TITLE: 'Equipo y Colaboración | ArchAI'
  },

  SETTINGS: {
    PATH: '/settings',
    ALIASES: ['/configuracion', '/ajustes', '/perfil'],
    TITLE: 'Configuración del Espacio | ArchAI'
  },

  GENERATOR: {
    PATH: '/generator',
    ALIASES: ['/generador', '/codigo'],
    TITLE: 'Generador de Código | ArchAI'
  }
} as const;

export default ROUTES;
