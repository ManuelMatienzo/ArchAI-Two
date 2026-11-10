export interface UmlAttribute {
  id: string;
  name: string;
  type: string;
  visibility: '+' | '-' | '#' | '~';
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isNullable?: boolean;
  isUnique?: boolean;
}

export interface UmlMethod {
  id: string;
  name: string;
  returnType: string;
  visibility: '+' | '-' | '#' | '~';
  parameters?: string;
}

export interface UmlClass {
  id: string;
  name: string;
  stereotype?: 'Entity' | 'Boundary' | 'Control' | 'Service' | 'Repository' | string;
  tableName?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  attributes: UmlAttribute[];
  methods: UmlMethod[];
  isGhostDraft?: boolean;
}

export interface UmlRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'association' | 'inheritance' | 'aggregation' | 'composition' | 'dependency';
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  name?: string;
  isGhostDraft?: boolean;
}

export interface GhostDraftProposal {
  id: string;
  title: string;
  description: string;
  reasoning: string;
  author: 'IA Co-Developer (@ArchAI)';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  timestamp: string;
  classes: UmlClass[];
  relationships: UmlRelationship[];
  deletions?: Array<{id:string;kind:'class'|'attribute'|'method'|'relation';targetId:string;classId:string;label:string;affectedRelationIds:string[]}>;
}

export type CollabRole = 
  | 'Usuario' 
  | 'Colaborador' 
  | 'Desarrollador Móvil' 
  | 'Agente IA Co-Developer'
  | 'ARQUITECTO' 
  | 'DESARROLLADOR_MOVIL' 
  | 'REVISOR' 
  | 'ARCHAI_IA';

export interface CodeSnippet {
  language: 'sql' | 'java';
  code: string;
  title?: string;
}

export type MessageDeliveryStatus = 'enviando' | 'entregado' | 'fallido';

export type StompConnectionStatus = 'desconectado' | 'conectando' | 'conectado' | 'error';

export interface CollabMessage {
  id: string;
  authorId?: string;
  messageRole?: 'human' | 'ai' | 'system';
  sender: string;
  senderRole: CollabRole;
  avatarColor?: string;
  content: string;
  timestamp: string;
  fullDate?: string;
  isAiResponse?: boolean;
  roomId: string;
  status?: MessageDeliveryStatus;
  codeSnippet?: CodeSnippet;
}

export interface UserSession {
  token: string;
  user: {
    id: string;
    email: string;
    nombre: string;
    rol: 'ADMIN' | 'USER' | 'COLABORADOR' | 'MOBILE_DEV';
  };
}
