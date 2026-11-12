export type RolUsuario = 
  | 'Arquitecto de Software'
  | 'Ingeniero de Datos'
  | 'Desarrollador Backend'
  | 'Ingeniero Frontend'
  | 'Líder Técnico';

export interface PerfilUsuario {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: RolUsuario;
  avatarColor: string;
  isHost: boolean;
}

export interface InformacionSesion {
  roomId: string;
  diagramId?: string;
  projectId?: string | null;
  roomName: string;
  hostName: string;
  createdAt: string;
  currentUser: PerfilUsuario;
  participants: PerfilUsuario[];
  isLocalMode?: boolean;
}
