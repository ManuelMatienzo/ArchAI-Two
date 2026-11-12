import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { InformacionSesion, PerfilUsuario, RolUsuario } from '../../types/auth';
import { ModeloDiagrama, ClaseUml, RelacionUml, AtributoUml, MetodoUml } from '../../types/uml';
import { LeftNavRail as BarraLateralNavegacion } from '../../components/layout/LeftNavRail';
import { TopHeader as BarraSuperior } from '../../components/layout/TopHeader';
import { ProjectStructureFlyout as PanelEstructuraProyecto } from '../../components/canvas/ProjectStructureFlyout';
import { InteractiveStudioCanvas as LienzoInteractivoStudio } from '../../components/canvas/InteractiveStudioCanvas';
import { StudioSettings } from './StudioSettings';
import { CollaborationPanel as PanelColaboracion } from '../../components/collaboration/CollaborationPanel';
import { RolEquipo, PermisosUsuario, MiembroEquipo, obtenerPermisosRol } from '../../types/rbac';

// Carga diferida (Code Splitting) de paneles y modales secundarios
const PanelGeneracionCodigo = lazy(() =>
  import('../../components/dock/CodeGenerationDock').then(m => ({ default: m.CodeGenerationDock }))
);
const ModalEscanerPizarra = lazy(() =>
  import('../../components/canvas/WhiteboardScannerModal').then(m => ({ default: m.WhiteboardScannerModal }))
);
const ModalGestionEquipo = lazy(() =>
  import('../../components/equipo/ModalGestionEquipo').then(m => ({ default: m.ModalGestionEquipo }))
);
const ModalAtajosTeclado = lazy(() =>
  import('../../components/canvas/ModalAtajosTeclado').then(m => ({ default: m.ModalAtajosTeclado }))
);
const ModalExportarVisual = lazy(() =>
  import('../../components/canvas/ModalExportarVisual').then(m => ({ default: m.ModalExportarVisual }))
);
const QuickSearchSpotlightModal = lazy(() =>
  import('../../components/canvas/QuickSearchSpotlightModal').then(m => ({ default: m.QuickSearchSpotlightModal }))
);
import {
  exportProjectAsArchAi,
  openProjectFileDialog,
  readAndImportProjectFile
} from '../../services/nativeProjectService';
import { calcularMadurezProyecto } from '../../services/softwareMaturity';
import { generarMetodosSugeridos } from '../../services/projectBrainService';
import { ClienteStomp } from '../../services/stompClient';
import { useProposalReview } from '../../components/collaboration/useProposalReview';
import { ProposalToolbar } from '../../components/collaboration/ProposalReviewEditor';
import { ProposalPanel, useProposals } from '../../components/collaboration/ProposalPanel';
import { generateXmiXml } from '../../services/codeGenerator';
import { reportArtifact } from '../../services/projectActivity';
import { exportarXmiEnterpriseArchitect } from '../../services/exportarXmiEA';
import { normalizarDiagrama } from '../../services/agenteDiagrama';
import { sanitizarDiagramaUML25 } from '../../services/semanticDomainEngine';
import {
  apiFetch,
  guardarDiagramaEnNube,
  listarVersiones,
  crearVersion,
  restaurarVersion,
  actualizarPerfil,
  diagramaDesdeBackend,
  listarProyectos,
  obtenerProyecto,
  listarDiagramas,
  obtenerDiagrama,
  construirPayloadDiagrama,
  obtenerDiagramaSala,
  actualizarDiagramaSala,
  guardarContextoDiagrama,
  obtenerContextoDiagrama,
  guardarContextoSala,
  obtenerContextoSala,
  encolarOperacionOffline,
  sincronizarColaOffline,
  obtenerColaOffline
} from '../../services/api';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { Share2, Copy, Check, X, Save, History, UserCircle, CloudOff, RotateCcw, Upload, RefreshCw, Users, UserCheck, Zap, Radio, CheckCircle2, AlertTriangle } from 'lucide-react';
import { GlassModal } from '../../components/glass/GlassModal';

export interface StudioPageProps {
  session?: InformacionSesion;
  onLogout?: () => void;
  initialDiagram?: ModeloDiagrama;
  onOpenProjects?: () => void;
  projectTitle?: string;
  diagramId?: string;
  roomId?: string;
  initialTab?: 'canvas' | 'team' | 'settings';
  initialDock?: 'code' | 'ai' | null;
}

export type PaginaEstudioCanvasProps = StudioPageProps;

const DIAGRAMA_INICIAL_DEFECTO: ModeloDiagrama = {
  title: 'Sistema de Comercio Electrónico v1.2',
  updatedAt: new Date().toISOString(),
  classes: [
    {
      id: 'cls-controller',
      name: 'ProductController',
      stereotype: 'Controller',
      attributes: [
        { id: 'ca1', name: 'service', type: 'String', visibility: '-' }
      ],
      methods: [
        { id: 'cm1', name: 'handleCreate', returnType: 'ResponseEntity', visibility: '+', parameters: 'ProductDto' },
        { id: 'cm2', name: 'handleGet', returnType: 'ResponseEntity', visibility: '+', parameters: 'Long' },
        { id: 'cm3', name: 'handleUpdate', returnType: 'ResponseEntity', visibility: '+', parameters: 'Long, ProductDto' }
      ],
      position: { x: 60, y: 40 }
    },
    {
      id: 'cls-service',
      name: 'ProductService',
      stereotype: 'Service',
      attributes: [
        { id: 'sa1', name: 'repository', type: 'String', visibility: '-' }
      ],
      methods: [
        { id: 'sm1', name: 'createProduct', returnType: 'Product', visibility: '+', parameters: 'ProductDto' },
        { id: 'sm2', name: 'getProductById', returnType: 'Product', visibility: '+', parameters: 'Long' },
        { id: 'sm3', name: 'updateStock', returnType: 'Boolean', visibility: '+', parameters: 'Long, Integer' }
      ],
      position: { x: 410, y: 40 }
    },
    {
      id: 'cls-repository',
      name: 'ProductRepository',
      stereotype: 'Repository',
      attributes: [
        { id: 'ra1', name: 'dataSource', type: 'String', visibility: '-' }
      ],
      methods: [
        { id: 'rm1', name: 'findAll', returnType: 'List<Product>', visibility: '+' },
        { id: 'rm2', name: 'findById', returnType: 'Optional<Product>', visibility: '+', parameters: 'Long' },
        { id: 'rm3', name: 'save', returnType: 'Product', visibility: '+', parameters: 'Product' },
        { id: 'rm4', name: 'delete', returnType: 'void', visibility: '+', parameters: 'Long' }
      ],
      position: { x: 760, y: 40 }
    },
    {
      id: 'cls-product',
      name: 'Product',
      stereotype: 'Entity',
      attributes: [
        { id: 'pa1', name: 'id', type: 'Long', visibility: '-', isPrimaryKey: true },
        { id: 'pa2', name: 'name', type: 'String', visibility: '-' },
        { id: 'pa3', name: 'price', type: 'Double', visibility: '-' },
        { id: 'pa4', name: 'stock', type: 'Integer', visibility: '-' }
      ],
      methods: [
        { id: 'pm1', name: 'calculateDiscount', returnType: 'Double', visibility: '+', parameters: 'Double' },
        { id: 'pm2', name: 'updateStock', returnType: 'Boolean', visibility: '+', parameters: 'Integer' }
      ],
      position: { x: 760, y: 300 }
    }
  ],
  relations: [
    {
      id: 'rel-ctrl-srv',
      sourceClassId: 'cls-controller',
      targetClassId: 'cls-service',
      type: 'ASSOCIATION_1_N',
      sourceMultiplicity: '1',
      targetMultiplicity: '1',
      label: 'delega'
    },
    {
      id: 'rel-srv-repo',
      sourceClassId: 'cls-service',
      targetClassId: 'cls-repository',
      type: 'ASSOCIATION_1_N',
      sourceMultiplicity: '1',
      targetMultiplicity: '1',
      label: 'consulta'
    },
    {
      id: 'rel-repo-prod',
      sourceClassId: 'cls-repository',
      targetClassId: 'cls-product',
      type: 'COMPOSITION',
      sourceMultiplicity: '1',
      targetMultiplicity: '0..*',
      label: 'administra'
    }
  ]
};

export const StudioPage: React.FC<StudioPageProps> = ({
  session: propSession,
  onLogout: propOnLogout,
  initialDiagram: propInitialDiagram,
  onOpenProjects: propOnOpenProjects,
  projectTitle: propProjectTitle,
  diagramId: propDiagramId,
  roomId: propRoomId,
  initialTab,
  initialDock
}) => {
  const navigate = useNavigate();
  const params = useParams<{ diagramId?: string; roomId?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const explicitDiagramId=params.diagramId||searchParams.get('diagramId')||(location.state as any)?.diagramId;
  const urlRoomId = params.roomId || searchParams.get('roomId') || (explicitDiagramId ? undefined : propRoomId);
  const [resolvedRoomDiagram, setResolvedRoomDiagram] = useState<{ roomId: string; diagramId: string }>();
  const diagramId = explicitDiagramId || (urlRoomId
    ? (resolvedRoomDiagram?.roomId === urlRoomId ? resolvedRoomDiagram.diagramId : undefined)
    : propDiagramId || localStorage.getItem('archai_selected_diagram_id') || undefined);
  const projectTitle=searchParams.get('title')||(location.state as any)?.projectTitle||propProjectTitle||localStorage.getItem('archai_selected_project_title')||undefined;
  const initialDiagram=(location.state as any)?.diagram||(!urlRoomId&&propDiagramId===diagramId?propInitialDiagram:undefined);
  useEffect(() => {
    if (!urlRoomId || explicitDiagramId) return;
    let active = true;
    void apiFetch<{ diagramId?: string }>(`/api/v1/colaboracion/salas/${encodeURIComponent(urlRoomId)}`)
      .then(room => {
        if (active && room.diagramId) setResolvedRoomDiagram({ roomId: urlRoomId, diagramId: room.diagramId });
      })
      .catch(e => { if (active) setSaveInfo({ tipo: 'error', texto: e.message }); });
    return () => { active = false; };
  }, [urlRoomId, explicitDiagramId]);

  const [currentSession, setCurrentSession] = useState<InformacionSesion>(() => {
    if (propSession) {
      if (urlRoomId && propSession.roomId !== urlRoomId) {
        return { ...propSession, roomId: urlRoomId, roomName: `Sala ${urlRoomId}` };
      }
      return propSession;
    }
    const guardado = localStorage.getItem('archai_session');
    if (guardado) {
      try {
        const parsed = JSON.parse(guardado);
        if (parsed?.currentUser) {
          if (urlRoomId && parsed.roomId !== urlRoomId) {
            return { ...parsed, roomId: urlRoomId, roomName: `Sala ${urlRoomId}` };
          }
          return parsed;
        }
      } catch {}
    }
    return {
      roomId: urlRoomId || 'ARC-GRUPO04',
      roomName: urlRoomId ? `Sala ${urlRoomId}` : 'Sala General',
      hostName: 'Arquitecto',
      createdAt: new Date().toISOString(),
      currentUser: {
        id: 'usr-default',
        name: 'Arquitecto ArchAI',
        email: 'arquitecto@archai.io',
        role: 'ARQUITECTO' as any,
        isHost: true
      },
      participants: []
    };
  });

  useEffect(() => {
    if (propSession) {
      if (urlRoomId && propSession.roomId !== urlRoomId) {
        setCurrentSession(prev => prev.currentUser.id===propSession.currentUser.id ? prev : { ...propSession, roomId: urlRoomId, roomName: `Sala ${urlRoomId}` });
      } else {
        setCurrentSession(prev => prev.currentUser.id===propSession.currentUser.id ? prev : propSession);
      }
    } else {
      const guardado = localStorage.getItem('archai_session');
      if (!guardado) {
        navigate('/login', { replace: true });
      } else if (urlRoomId) {
        try {
          const parsed = JSON.parse(guardado);
          if (parsed && parsed.roomId !== urlRoomId) {
            setCurrentSession(prev => ({ ...prev, roomId: urlRoomId, roomName: `Sala ${urlRoomId}` }));
          }
        } catch {}
      }
    }
  }, [propSession, urlRoomId, navigate]);

  const onLogout = () => {
    if (propOnLogout) {
      propOnLogout();
    } else {
      localStorage.removeItem('archai_session');
      localStorage.removeItem('archai_token');
      localStorage.removeItem('archai_current_view');
      localStorage.removeItem('archai_selected_diagram_id');
      localStorage.removeItem('archai_selected_project_title');
      localStorage.removeItem('archai_selected_diagram');
    }
    navigate('/login');
  };

  const onOpenProjects = () => {
    if (propOnOpenProjects) {
      propOnOpenProjects();
    }
    navigate('/projects');
  };
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('archai_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [diagram, setDiagram] = useState<ModeloDiagrama>(() => {
    if (diagramId) {
      try {
        const guardado = localStorage.getItem(`archai_diagram_${diagramId}`);
        if (guardado) {
          const parsed = JSON.parse(guardado);
          if (Array.isArray(parsed?.classes) && Array.isArray(parsed?.relations)) {
            const pTitle = (projectTitle || initialDiagram?.title || '').toLowerCase();
            const esHosp = pTitle.includes('hospit') || pTitle.includes('clíni') || pTitle.includes('clinic') || pTitle.includes('médic') || pTitle.includes('salud');
            const tieneProduct = parsed.classes.some((c: any) => c.name === 'ProductController' || c.name === 'Product');
            if (!(tieneProduct && esHosp)) {
              return parsed;
            }
          }
        }
      } catch {}
    }
    if (initialDiagram) return initialDiagram;
    if (diagramId) return { title: projectTitle || 'Diagrama', classes: [], relations: [], updatedAt: new Date().toISOString() };
    try {
      const guardadoGeneral = localStorage.getItem('archai_selected_diagram');
      if (guardadoGeneral) {
        const parsed = JSON.parse(guardadoGeneral);
        if (Array.isArray(parsed?.classes) && Array.isArray(parsed?.relations)) return parsed;
      }
    } catch {}
    if (projectTitle) return { ...DIAGRAMA_INICIAL_DEFECTO, title: projectTitle };
    return DIAGRAMA_INICIAL_DEFECTO;
  });
  const [selectedClassId, setSelectedClassId] = useState<string | null>('cls-service');
  const [activeRailTab, setActiveRailTab] = useState<'canvas' | 'team' | 'settings'>(() => {
    if (initialTab) return initialTab;
    const tabParam = searchParams.get('tab');
    if (tabParam === 'team' || tabParam === 'settings' || tabParam === 'canvas') return tabParam;
    return 'canvas';
  });
  const [isProjectStructureOpen, setIsProjectStructureOpen] = useState(false);
  const [projectName, setProjectName] = useState<{ key: string; name: string } | null>(null);

  const [isCodeDockOpen, setIsCodeDockOpen] = useState<boolean>(() => {
    if (initialDock === 'code') return true;
    return searchParams.get('dock') === 'code';
  });
  const [showWhiteboardModal, setShowWhiteboardModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [shareCopied, setShareCopied] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [showExportarVisualModal, setShowExportarVisualModal] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState<boolean>(false);
  const [focusTarget, setFocusTarget] = useState<{ classId: string; tick: number } | null>(null);
  const clipboardClassRef = useRef<ClaseUml | null>(null);

  // Pilas de Historial para Deshacer (Undo) y Rehacer (Redo)
  const undoStackRef = useRef<ModeloDiagrama[]>([]);
  const redoStackRef = useRef<ModeloDiagrama[]>([]);
  const [historyTick, setHistoryTick] = useState<number>(0);

  const canUndo = historyTick >= 0 && undoStackRef.current.length > 0;
  const canRedo = historyTick >= 0 && redoStackRef.current.length > 0;

  useEffect(() => {
    if (diagramId) {
      try {
        const guardado = localStorage.getItem(`archai_diagram_${diagramId}`);
        if (guardado) {
          const parsed = JSON.parse(guardado);
          if (Array.isArray(parsed?.classes) && Array.isArray(parsed?.relations)) {
            const pTitle = (projectTitle || initialDiagram?.title || '').toLowerCase();
            const esHosp = pTitle.includes('hospit') || pTitle.includes('clíni') || pTitle.includes('clinic') || pTitle.includes('médic') || pTitle.includes('salud');
            const tieneProduct = parsed.classes.some((c: any) => c.name === 'ProductController' || c.name === 'Product');
            if (!(tieneProduct && esHosp)) {
              setDiagram(parsed);
              return;
            }
          }
        }
      } catch {}
    }
    if (initialDiagram) {
      setDiagram(initialDiagram);
    } else if (projectTitle) {
      setDiagram(prev => ({ ...prev, title: projectTitle }));
    }
  }, [initialDiagram, projectTitle, diagramId]);

  // Persistir automáticamente cualquier cambio del diagrama en su clave local única y en archai_selected_diagram
  useEffect(() => {
    if (diagram && diagram.classes) {
      try {
        if (diagramId) {
          localStorage.setItem(`archai_diagram_${diagramId}`, JSON.stringify(diagram));
        }
        localStorage.setItem('archai_selected_diagram', JSON.stringify(diagram));
      } catch (e) {
        console.warn('Error al persistir diagrama local', e);
      }
    }
  }, [diagram, diagramId]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('archai_theme', theme);
  }, [theme]);

  // ───────────────── Historial Universal (Undo/Redo) & Métodos de Edición ─────────────────
  const serializeForDiff = (d: ModeloDiagrama): string => {
    if (!d || !d.classes) return '';
    return JSON.stringify({
      title: d.title,
      classes: d.classes.map(c => ({
        id: c.id,
        name: c.name,
        stereotype: c.stereotype,
        isAbstract: c.isAbstract,
        isInterface: c.isInterface,
        position: c.position,
        attributes: c.attributes,
        methods: c.methods
      })),
      relations: (d.relations || []).map(r => ({
        id: r.id,
        sourceClassId: r.sourceClassId,
        targetClassId: r.targetClassId,
        type: r.type,
        label: r.label,
        sourceMultiplicity: r.sourceMultiplicity,
        targetMultiplicity: r.targetMultiplicity
      }))
    });
  };

  const handleUpdateDiagram = (
    updater: ModeloDiagrama | ((prev: ModeloDiagrama) => ModeloDiagrama),
    recordHistory: boolean = true
  ) => {
    setDiagram(prev => {
      const rawNext = typeof updater === 'function' ? updater(prev) : updater;
      if (rawNext === prev) return prev;

      // Deduplicar atributos y métodos por id para evitar duplicados acumulados
      const deduped: ModeloDiagrama = {
        ...rawNext,
        classes: (rawNext.classes || []).map(c => ({
          ...c,
          attributes: Array.from(new Map((c.attributes || []).map(a => [a.id, a])).values()),
          methods: Array.from(new Map((c.methods || []).map(m => [m.id, m])).values()),
        }))
      };

      const next = sanitizarDiagramaUML25({...deduped,...((prev as any)._reviewRevision!==undefined?{_reviewRevision:(prev as any)._reviewRevision}:{})});

      if (recordHistory) {
        const prevSerialized = serializeForDiff(prev);
        const nextSerialized = serializeForDiff(next);
        if (prevSerialized !== nextSerialized) {
          undoStackRef.current.push(JSON.parse(JSON.stringify(prev)));
          if (undoStackRef.current.length > 50) {
            undoStackRef.current.shift();
          }
          redoStackRef.current = [];
          setHistoryTick(t => t + 1);
        }
      }

      return next;
    });
  };

  const handleUndo = () => {
    if(diagramId&&reviewRef.current.snapshot){void proposalsRef.current.restore('undo',reviewRef.current.snapshot.officialRevision).then(next=>{if(next)reviewRef.current.receive(next);});return;}
    if (undoStackRef.current.length === 0) {
      setSaveInfo({ tipo: 'ok', texto: 'No hay más acciones para deshacer' });
      return;
    }
    const previousState = undoStackRef.current.pop()!;
    redoStackRef.current.push(JSON.parse(JSON.stringify(diagramRef.current)));
    setHistoryTick(t => t + 1);
    handleUpdateDiagram(previousState, false);
    setSaveInfo({ tipo: 'ok', texto: '↩ Deshecho (Ctrl+Z)' });
  };

  const handleRedo = () => {
    if(diagramId&&reviewRef.current.snapshot){void proposalsRef.current.restore('redo',reviewRef.current.snapshot.officialRevision).then(next=>{if(next)reviewRef.current.receive(next);});return;}
    if (redoStackRef.current.length === 0) {
      setSaveInfo({ tipo: 'ok', texto: 'No hay más acciones para rehacer' });
      return;
    }
    const nextState = redoStackRef.current.pop()!;
    undoStackRef.current.push(JSON.parse(JSON.stringify(diagramRef.current)));
    setHistoryTick(t => t + 1);
    handleUpdateDiagram(nextState, false);
    setSaveInfo({ tipo: 'ok', texto: '↪ Rehecho (Ctrl+Y)' });
  };

  const handleCopyClass = () => {
    if (!selectedClassId) {
      setSaveInfo({ tipo: 'ok', texto: 'Selecciona una clase para copiar (Ctrl+C)' });
      return;
    }
    const target = diagram.classes.find(c => c.id === selectedClassId);
    if (!target) return;
    clipboardClassRef.current = JSON.parse(JSON.stringify(target));
    setSaveInfo({ tipo: 'ok', texto: `Clase '${target.name}' copiada al portapapeles` });
  };

  const handlePasteClass = () => {
    const source = clipboardClassRef.current;
    if (!source) {
      setSaveInfo({ tipo: 'ok', texto: 'El portapapeles está vacío. Copia una clase con Ctrl+C primero.' });
      return;
    }
    const ts = Date.now();
    const newId = `cls-copy-${ts}`;
    const newName = `${source.name}Copia`;

    const clone: ClaseUml = {
      ...source,
      id: newId,
      name: newName,
      position: {
        x: Math.max(20, (source.position?.x || 100) + 40),
        y: Math.max(20, (source.position?.y || 100) + 40)
      },
      attributes: (source.attributes || []).map((a, i) => ({ ...a, id: `attr-${ts}-${i}` })),
      methods: (source.methods || []).map((m, i) => ({ ...m, id: `m-${ts}-${i}` }))
    };

    handleUpdateDiagram(prev => ({
      ...prev,
      classes: [...prev.classes, clone],
      updatedAt: new Date().toISOString()
    }));
    setSelectedClassId(newId);
    setSaveInfo({ tipo: 'ok', texto: `Clase '${clone.name}' pegada en el lienzo (Ctrl+V)` });
  };

  const handleDuplicateClass = () => {
    if (!selectedClassId) {
      setSaveInfo({ tipo: 'ok', texto: 'Selecciona una clase para duplicar (Ctrl+D)' });
      return;
    }
    const target = diagram.classes.find(c => c.id === selectedClassId);
    if (!target) return;
    const ts = Date.now();
    const newId = `cls-dup-${ts}`;
    const clone: ClaseUml = {
      ...target,
      id: newId,
      name: `${target.name}Copia`,
      position: {
        x: Math.max(20, (target.position?.x || 100) + 40),
        y: Math.max(20, (target.position?.y || 100) + 40)
      },
      attributes: (target.attributes || []).map((a, i) => ({ ...a, id: `attr-${ts}-${i}` })),
      methods: (target.methods || []).map((m, i) => ({ ...m, id: `m-${ts}-${i}` }))
    };

    handleUpdateDiagram(prev => ({
      ...prev,
      classes: [...prev.classes, clone],
      updatedAt: new Date().toISOString()
    }));
    setSelectedClassId(newId);
    setSaveInfo({ tipo: 'ok', texto: `Clase '${clone.name}' duplicada (Ctrl+D)` });
  };

  // ───────────────── CU-01/CU-04 · Cargar el diagrama PROPIO del usuario al entrar ─────────────────
  // Si entra a una sala colaborativa como invitado, se sincroniza el diagrama de la sala y no el personal.
  useEffect(() => {
    let activo = true;
    const idUsuario = currentSession.currentUser.id;
    if (!idUsuario) return;
    // Si se abrió un proyecto o diagrama específico, NO pisarlo con el primer diagrama por defecto de la nube
    if (initialDiagram || diagramId) return;
    if (!currentSession.currentUser.isHost && currentSession.roomId && currentSession.roomId !== 'LOCAL-MODE') {
      return;
    }

    const claveIdDiagramaPropio = `archai_diagrama_id_${idUsuario}`;

    (async () => {
      try {
        // 1. Diagrama previamente guardado por ESTE usuario en la nube
        const guardadoId = localStorage.getItem(claveIdDiagramaPropio);
        if (guardadoId) {
          const remoto = await obtenerDiagrama(guardadoId);
          if (activo && remoto) {
            const modelo = diagramaDesdeBackend(remoto);
            if (modelo?.classes?.length) {
              setDiagram(modelo);
              setGuardadoEn(guardadoId);
              return;
            }
          }
        }
        // 2. Primer proyecto del usuario → primer diagrama de ese proyecto
        const proyectos = await listarProyectos(idUsuario);
        if (!activo || !proyectos?.length) return;
        const diagramas = await listarDiagramas(proyectos[0].id);
        if (!activo || !diagramas?.length) return;
        const primerId = diagramas[0].id;
        const remoto = await obtenerDiagrama(primerId);
        if (!activo || !remoto) return;
        const modelo = diagramaDesdeBackend(remoto);
        if (!modelo?.classes?.length) return;
        setDiagram(modelo);
        setGuardadoEn(primerId);
        localStorage.setItem(claveIdDiagramaPropio, primerId);
      } catch {
        /* sin conexión o sin diagrama en nube: se conserva el diagrama actual */
      }
    })();

    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───────────────── CU-03 · Carga y Sincronización Inmediata de la Sala Colaborativa ─────────────────
  useEffect(() => {
    const pin = currentSession.roomId;
    if (!pin || pin === 'LOCAL-MODE') return;
    // Si se abrió un proyecto o diagrama específico, NO pisarlo con el diagrama previo de la sala
    if (initialDiagram || diagramId) return;
    let activo = true;

    (async () => {
      try {
        const datosSala = await obtenerDiagramaSala(pin);
        if (activo && datosSala && datosSala.classes && datosSala.classes.length > 0) {
          const modelo = diagramaDesdeBackend(datosSala);
          diagramRef.current = modelo;
          ultimaAplicacionRemotaRef.current = Date.now();
          setDiagram(modelo);
          setSaveInfo({ tipo: 'ok', texto: `Sincronizado con la sala ${pin} (${modelo.classes.length} clases).` });
        }
      } catch {
        // Sala recién creada o sin diagrama persistido aún en el backend
      }
    })();

    return () => { activo = false; };
  }, [currentSession.roomId]);

  // Espejo del diagrama para comparar cambios de forma no destructiva

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // ─────────────────────── CU-03 · Edición Colaborativa en Tiempo Real (STOMP) ───────────────────────

  const [estadoColab, setEstadoColab] = useState<'conectando' | 'conectado' | 'simulado'>('conectando');
  const [roomReady,setRoomReady]=useState(!diagramId&&!urlRoomId);
  useEffect(()=>{
    if(!diagramId){setRoomReady(!urlRoomId);return;}
    let live=true;setRoomReady(false);setEstadoColab('conectando');
    void apiFetch<InformacionSesion>('/api/v1/colaboracion/salas/abrir',{method:'POST',body:JSON.stringify({diagramId,...(urlRoomId?{roomId:urlRoomId}:{})})}).then(session=>{
      if(!live)return;setCurrentSession(session);localStorage.setItem('archai_session',JSON.stringify(session));setRoomReady(true);
    }).catch(e=>{if(live)setSaveInfo({tipo:'error',texto:e instanceof Error?e.message:'No se pudo abrir la sala del proyecto.'});});
    return()=>{live=false;};
  },[diagramId,urlRoomId]);
  const requestedPin = urlRoomId?.trim().toUpperCase();
  const canonicalPin = requestedPin && !requestedPin.startsWith('ARC-') ? `ARC-${requestedPin}` : requestedPin;
  const activeProjectId = diagramId && currentSession.diagramId === diagramId &&
    (!canonicalPin || currentSession.roomId === canonicalPin)
      ? currentSession.projectId
      : undefined;
  const projectNameKey = activeProjectId ? `${currentSession.currentUser.id}/${activeProjectId}` : '';
  useEffect(() => {
    if (!activeProjectId) return;
    let active = true;
    void obtenerProyecto(activeProjectId).then(project => {
      if (active) setProjectName({ key: projectNameKey, name: project.nombre });
    }).catch(() => {
      if (active) setProjectName(null);
    });
    return () => { active = false; };
  }, [activeProjectId, projectNameKey]);
  const [remoteCursors, setRemoteCursors] = useState<{ id: string; name: string; color: string; x: number; y: number }[]>([]);
  const [remoteDraggingNodes, setRemoteDraggingNodes] = useState<Record<string, { name: string; color: string }>>({});
  const timersRemoteDragRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [pinCambioSala, setPinCambioSala] = useState<string>('');
  const stompRef = useRef<ClienteStomp | null>(null);
  const diagramRef = useRef<ModeloDiagrama>(diagram);
  const primeraCargaRef = useRef<boolean>(true);
  const esActualizacionRemotaRef = useRef<boolean>(false);
  const ultimaPublicacionRef = useRef<number>(0);
  const ultimaAplicacionRemotaRef = useRef<number>(0);
  const ultimoCursorLocalRef = useRef<number>(0);
  const temporizadorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // CU-03: Identificador único por pestaña para permitir pruebas simultáneas incluso con el mismo usuario
  const miInstanciaIdRef = useRef<string>(
    'tab-' + Math.random().toString(36).slice(2, 8) + '-' + Date.now().toString(36)
  );
  // CU-03: bandera para NO golpear la nube con guardados durante un arrastre en curso (solo al soltar)
  const arrastreEnCursoRef = useRef<boolean>(false);
  const proposals = useProposals(currentSession, diagram, roomReady && estadoColab === 'conectado',
    (type, data) => stompRef.current?.publicar(type,data), `${currentSession.currentUser.id}#${miInstanciaIdRef.current}`, diagramId);
  const review = useProposalReview(currentSession.roomId, diagramId, roomReady && estadoColab === 'conectado', diagram, (next,previous) => {
    if(previous && serializeForDiff(previous)!==serializeForDiff(next)) {
      const top=undoStackRef.current[undoStackRef.current.length-1];
      if(!top || serializeForDiff(top)!==serializeForDiff(previous)) {
        undoStackRef.current.push(previous);redoStackRef.current=[];setHistoryTick(t=>t+1);
      }
    }
    if (JSON.stringify(diagramRef.current) === JSON.stringify(next)) return;
    esActualizacionRemotaRef.current = true;
    diagramRef.current = next;
    setDiagram(next);
  });
  const initialAiDock = initialDock === 'ai' || searchParams.get('dock') === 'ai';
  useEffect(() => { if (initialAiDock) proposals.setOpen(true); }, [initialAiDock]);
  const reviewRef = useRef(review); reviewRef.current = review;
  const [connectionAttempt,setConnectionAttempt] = useState(0);
  const proposalsRef = useRef(proposals);
  proposalsRef.current = proposals;

  // CU-05 · Al abrir un diagrama, restaura el contexto conversacional (chat, IA y propuestas)
  // guardado junto al diagrama para que no se pierda nada al recargar.
  useEffect(() => {
    let activo = true;
    if (!diagramId) return;
    (async () => {
      try {
        const contexto = await obtenerContextoDiagrama(diagramId);
        if (activo && contexto) {
          proposalsRef.current.importarContexto(contexto);
        }
      } catch {
        // Sin contexto previo: se inicia una conversación nueva.
      }
    })();
    return () => { activo = false; };
  }, [diagramId]);

  // CU-03 · Al entrar a una sala colaborativa, restaura el contexto de esa sala (chat, IA, propuestas)
  // para que cada sala conserve su propia conversación aislada.
  useEffect(() => {
    let activo = true;
    const room = currentSession?.roomId;
    if (!room || room === 'LOCAL-MODE') return;
    (async () => {
      try {
        const contexto = await obtenerContextoSala(room);
        if (activo && contexto) {
          proposalsRef.current.importarContexto(contexto);
        }
      } catch {
        // Sin contexto previo de sala: se inicia una conversación nueva en esta sala.
      }
    })();
    return () => { activo = false; };
  }, [currentSession?.roomId]);

  // Espejo del diagrama para comparar cambios sin reintroducir dependencias circulares
  useEffect(() => { diagramRef.current = diagram; }, [diagram]);

  // Conexión STOMP a la sala: suscribe /topic/collab/{salaId} y anuncia la llegada
  useEffect(() => {
    const habitacionId = currentSession.roomId;
    if (!habitacionId || !roomReady) return;
    let activo = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const emisorIdInstancia = `${currentSession.currentUser.id}#${miInstanciaIdRef.current}`;

    const cliente = new ClienteStomp(
      habitacionId,
      emisorIdInstancia,
      currentSession.currentUser.name,
      (payload: any) => {
        if (!activo) return;
        const tipo = payload?.tipo;
        const emisorId = payload?.emisorId;
        proposalsRef.current.receive(payload);
        if (tipo === 'ia_review_conflict') { reviewRef.current.setError(payload.payload?.message || 'El diagrama cambió. Revisa la versión actual.'); return; }
        if (tipo === 'ia_draft_state') { reviewRef.current.receive(payload.payload); return; }
        if(tipo==='ia_revision'){reviewRef.current.receiveRevision(payload.payload);return;}
        if (tipo?.startsWith('ia_') || tipo?.startsWith('chat_')) return;

        if (emisorId === emisorIdInstancia && tipo !== 'diagrama') return;

        // 1. Detección de nuevo participante en la sala
        if (tipo === 'join' || tipo === 'solicitar_diagrama') {
          const datosUsuario = payload?.payload?.usuario;
          if (datosUsuario && datosUsuario.id) {
            setCurrentSession(prev => {
              const existe = prev.participants.some(p => p.id === datosUsuario.id || p.name === datosUsuario.name);
              if (existe) return prev;
              return {
                ...prev,
                participants: [...prev.participants, datosUsuario]
              };
            });
          }

          // Si tenemos el diagrama o somos anfitrión, enviarlo de inmediato para sincronizar al recién llegado
          if (!reviewRef.current.snapshot && (currentSession.currentUser.isHost || (diagramRef.current.classes && diagramRef.current.classes.length > 0))) {
            setTimeout(() => {
              if (stompRef.current?.estaConectado()) {
                stompRef.current.publicar('diagrama', construirPayloadDiagrama(diagramRef.current));
              }
            }, 120);
          }
          return;
        }

        // 2. Cursor en vivo de colaboradores (CU-03)
        if (tipo === 'cursor') {
          const coords = payload?.payload;
          if (!coords || coords.x === undefined || coords.y === undefined) return;
          setRemoteCursors(prev => {
            const filtrados = prev.filter(c => c.id !== emisorId);
            return [
              ...filtrados,
              {
                id: emisorId,
                name: payload.emisorNombre || 'Colaborador',
                color: coords.color || '#00E5FF',
                x: coords.x,
                y: coords.y
              }
            ];
          });
          return;
        }

        // 3. Movimiento fluido de nodos/tablas en tiempo real a 25 FPS (~40ms)
        if (tipo === 'nodo_mover') {
          const datos = payload?.payload;
          if (!datos || !datos.classId || datos.x === undefined || datos.y === undefined) return;
          const classId = datos.classId;
          const x = datos.x;
          const y = datos.y;
          const nombre = payload.emisorNombre || 'Colaborador';
          const color = datos.color || '#2f2c79';

          // Registrar quién está moviendo la tabla para mostrar indicador visual
          setRemoteDraggingNodes(prev => ({
            ...prev,
            [classId]: { name: nombre, color }
          }));

          // Limpiar automáticamente el estado tras 1.2s de inactividad
          if (timersRemoteDragRef.current[classId]) {
            clearTimeout(timersRemoteDragRef.current[classId]);
          }
          timersRemoteDragRef.current[classId] = setTimeout(() => {
            setRemoteDraggingNodes(prev => {
              const next = { ...prev };
              delete next[classId];
              return next;
            });
          }, 1200);

          // Actualizar posición de la tabla directamente en el diagrama local sin disparar eco
          esActualizacionRemotaRef.current = true;
          ultimaAplicacionRemotaRef.current = Date.now();
          diagramRef.current = {
            ...diagramRef.current,
            classes: diagramRef.current.classes.map(c =>
              c.id === classId ? { ...c, position: { x, y } } : c
            )
          };
          setDiagram(prev => {
            return {
              ...prev,
              classes: prev.classes.map(c =>
                c.id === classId ? { ...c, position: { x, y } } : c
              )
            };
          });
          return;
        }

        // 4. Recepción de diagrama modificado por un compañero (commit final)
        if (tipo === 'diagrama') {
          const datos = payload?.payload;
          if (!datos || typeof datos !== 'object') return;
          try {
            const remoto = diagramaDesdeBackend(datos);
            if (!Array.isArray(remoto.classes)) return;
            setRemoteDraggingNodes({});
            esActualizacionRemotaRef.current = true;
            ultimaAplicacionRemotaRef.current = Date.now();
            diagramRef.current = remoto;
            if (emisorId === 'sistema-revision') handleUpdateDiagram(remoto); else setDiagram(remoto);
          } catch {
            /* frame inválido: se ignora */
          }
        }
      },
      (estado) => {
        if (!activo) return;
        if (estado.includes('Conectado')) setEstadoColab('conectado');
        else if (estado.includes('Error') || estado.includes('sin conexión') || estado.includes('Desconectado')) {
          setEstadoColab('simulado');
          if (!reconnectTimer) reconnectTimer=setTimeout(()=>{if(activo)setConnectionAttempt(n=>n+1);},Math.min(15000,1000*Math.pow(2,Math.min(connectionAttempt,4))));
        }
        else setEstadoColab('conectando');
      }
    );
    stompRef.current = cliente;

    cliente.connect(7000)
      .then(() => {
        if (!activo) return;
        setEstadoColab('conectado');
        cliente.publicar('join', {
          texto: 'unirse a la sala',
          usuario: currentSession.currentUser
        });
        // Si no somos el anfitrión y no abrimos un proyecto específico, pedir el diagrama oficial de la sala
        if (!currentSession.currentUser.isHost && !initialDiagram && !diagramId) {
          cliente.publicar('solicitar_diagrama', {
            usuario: currentSession.currentUser
          });
          if (habitacionId && habitacionId !== 'LOCAL-MODE') {
            obtenerDiagramaSala(habitacionId)
              .then((datosSala: any) => {
                if (datosSala && datosSala.classes && datosSala.classes.length > 0) {
                  const modelo = diagramaDesdeBackend(datosSala);
                  esActualizacionRemotaRef.current = true;
                  ultimaAplicacionRemotaRef.current = Date.now();
                  diagramRef.current = modelo;
                  setDiagram(modelo);
                }
              })
              .catch(() => {});
          }
        } else {
          // Si somos el anfitrión, respaldar de inmediato el diagrama oficial en la memoria del backend
          if (!diagramId && habitacionId && habitacionId !== 'LOCAL-MODE' && diagramRef.current.classes?.length > 0) {
            actualizarDiagramaSala(habitacionId, diagramRef.current).catch(() => {});
          }
        }
      })
      .catch(() => {
        if (!activo) return;
        setEstadoColab('simulado');
      });

    return () => {
      activo = false;
      if(reconnectTimer)clearTimeout(reconnectTimer);
      stompRef.current?.disconnect();
      stompRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession.roomId, connectionAttempt,roomReady]);

  // Difunde los cambios locales del diagrama por STOMP con Trailing Debounce ultrarrápido (60ms)
  useEffect(() => {
    if (primeraCargaRef.current) {
      primeraCargaRef.current = false;
      return;
    }
    // Si el cambio proviene de una recepción remota por STOMP, no rebotarlo
    if (esActualizacionRemotaRef.current) {
      esActualizacionRemotaRef.current = false;
      return;
    }

    const cliente = stompRef.current;
    if (!cliente || !cliente.estaConectado()) return;

    // Reiniciar el temporizador trailing: garantiza que el estado final siempre se emita
    if (temporizadorDebounceRef.current) {
      clearTimeout(temporizadorDebounceRef.current);
    }

    const diagramaActual = diagram;

    temporizadorDebounceRef.current = setTimeout(() => {
      if (!stompRef.current?.estaConectado()) return;
      ultimaPublicacionRef.current = Date.now();
      const payload = construirPayloadDiagrama(diagramaActual);
      stompRef.current.publicar('diagrama', payload);

      // Las salas con diagrama guardado persisten la edición recibida por STOMP.
      if (!diagramId && !arrastreEnCursoRef.current && currentSession.roomId && currentSession.roomId !== 'LOCAL-MODE') {
        actualizarDiagramaSala(currentSession.roomId, diagramaActual).catch(() => {});
      }
    }, 60);

    return () => {
      if (temporizadorDebounceRef.current) {
        clearTimeout(temporizadorDebounceRef.current);
      }
    };
  }, [diagram]);

  // Manejador para emitir la posición del ratón en tiempo real al broker STOMP (~18 FPS)
  const manejarCursorMove = (pos: { x: number; y: number }) => {
    const ahora = Date.now();
    if (ahora - ultimoCursorLocalRef.current < 55) return;
    ultimoCursorLocalRef.current = ahora;
    const cliente = stompRef.current;
    if (!cliente || !cliente.estaConectado()) return;
    cliente.publicar('cursor', {
      x: pos.x,
      y: pos.y,
      color: currentSession.currentUser.avatarColor || '#2f2c79'
    });
  };

  // CU-03 · Emitir movimiento fluido de tablas/nodos en tiempo real (~25 FPS)
  const manejarNodeDrag = (classId: string, pos: { x: number; y: number }) => {
    const cliente = stompRef.current;
    if (!cliente || !cliente.estaConectado()) return;
    cliente.publicar('nodo_mover', {
      classId,
      x: pos.x,
      y: pos.y,
      color: currentSession.currentUser.avatarColor || '#2f2c79'
    });
  };

  /** CU-09 · Reenvía la cola offline desde la vista de configuración. */
  const manejarSincronizarCola = async (): Promise<void> => {
    try {
      const n = await sincronizarColaOffline();
      setSaveInfo({ tipo: 'ok', texto: n > 0
        ? `${n} operación(es) offline sincronizada(s) con la nube.`
        : 'La cola offline está vacía: todo sincronizado.' });
    } catch (err: any) {
      setSaveInfo({ tipo: 'error', texto: err?.message || 'No se pudo sincronizar la cola offline.' });
    }
  };

  const handleExportXmi = () => {
    const xml = generateXmiXml(diagram);
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${diagram.title.toLowerCase().replace(/\s+/g, '_')}_model.xmi`;
    link.click();
    reportArtifact('xmi');
    URL.revokeObjectURL(url);
  };

  /** Exportar XMI 1.1 nativo de Sparx para Enterprise Architect (clases + diagrama con layout). */
  const handleExportarEA = () => {
    const xml = exportarXmiEnterpriseArchitect(diagram);
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${diagram.title.toLowerCase().replace(/\s+/g, '_')}_enterprise_architect.xmi`;
    link.click();
    reportArtifact('xmi');
    URL.revokeObjectURL(url);
    setSaveInfo({
      tipo: 'ok',
      texto: 'XMI para Enterprise Architect descargado: en EA usa Herramientas → Importar/Exportar → Importar paquete desde XMI.'
    });
  };

  /** Exportar proyecto completo como archivo nativo portable .archai.json */
  const handleExportarArchivo = () => {
    try {
      exportProjectAsArchAi(diagram, diagram.title, currentSession?.currentUser?.name);
      reportArtifact('native');
      setSaveInfo({
        tipo: 'ok',
        texto: `Proyecto '${diagram.title}' exportado en formato nativo .archai.json.`
      });
    } catch (err: any) {
      setSaveInfo({
        tipo: 'error',
        texto: `Error al exportar archivo: ${err.message || 'Error inesperado'}`
      });
    }
  };

  /** Importar proyecto desde archivo nativo .archai.json o .json */
  const handleImportarArchivo = async () => {
    try {
      const file = await openProjectFileDialog();
      if (!file) return;

      const importedDiagram = await readAndImportProjectFile(file);
      handleUpdateDiagram(importedDiagram);
      setSaveInfo({
        tipo: 'ok',
        texto: `Proyecto '${importedDiagram.title}' importado (${importedDiagram.classes.length} clases, ${importedDiagram.relations.length} relaciones).`
      });
    } catch (err: any) {
      setSaveInfo({
        tipo: 'error',
        texto: `Error al importar archivo: ${err.message || 'Formato no compatible'}`
      });
    }
  };

  /** Manejar archivo arrastrado directamente al lienzo (Drag and Drop) */
  const handleDropFile = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.endsWith('.json') && !file.name.endsWith('.archai')) {
      setSaveInfo({
        tipo: 'error',
        texto: 'Por favor arrastra un archivo con extensión .archai.json o .json'
      });
      return;
    }

    try {
      const importedDiagram = await readAndImportProjectFile(file);
      handleUpdateDiagram(importedDiagram);
      setSaveInfo({
        tipo: 'ok',
        texto: `Proyecto '${importedDiagram.title}' cargado desde '${file.name}' (${importedDiagram.classes.length} clases).`
      });
    } catch (err: any) {
      setSaveInfo({
        tipo: 'error',
        texto: `Error al importar archivo arrastrado: ${err.message || 'Formato inválido'}`
      });
    }
  };

  const handleAddClass = (newClass: ClaseUml) => {
    handleUpdateDiagram(prev => ({
      ...prev,
      classes: [...prev.classes, newClass],
      updatedAt: new Date().toISOString()
    }));
    setSelectedClassId(newClass.id);
  };

  const handleDeleteClass = (classId: string) => {
    handleUpdateDiagram(prev => ({
      ...prev,
      classes: prev.classes.filter(c => c.id !== classId),
      relations: prev.relations.filter(r => r.sourceClassId !== classId && r.targetClassId !== classId),
      updatedAt: new Date().toISOString()
    }));
    if (selectedClassId === classId) {
      setSelectedClassId(null);
    }
  };

  const handleAddAttribute = (classId: string, attribute: AtributoUml) => {
    handleUpdateDiagram(prev => ({
      ...prev,
      classes: prev.classes.map(cls => {
        if (cls.id === classId || cls.name.toLowerCase() === classId.toLowerCase()) {
          return {
            ...cls,
            attributes: [...cls.attributes, attribute]
          };
        }
        return cls;
      }),
      updatedAt: new Date().toISOString()
    }));
  };

  const handleDeleteAttribute = (classId: string, attrId: string) => {
    handleUpdateDiagram(prev => ({
      ...prev,
      classes: prev.classes.map(cls => {
        if (cls.id === classId) {
          return {
            ...cls,
            attributes: cls.attributes.filter(a => a.id !== attrId)
          };
        }
        return cls;
      }),
      updatedAt: new Date().toISOString()
    }));
  };

  const handleAddMethod = (classId: string, method: MetodoUml) => {
    handleUpdateDiagram(prev => ({
      ...prev,
      classes: prev.classes.map(cls => {
        if (cls.id === classId) {
          return {
            ...cls,
            methods: [...cls.methods, method]
          };
        }
        return cls;
      }),
      updatedAt: new Date().toISOString()
    }));
  };

  const handleDeleteMethod = (classId: string, methodId: string) => {
    handleUpdateDiagram(prev => ({
      ...prev,
      classes: prev.classes.map(cls => {
        if (cls.id === classId) {
          return {
            ...cls,
            methods: cls.methods.filter(m => m.id !== methodId)
          };
        }
        return cls;
      }),
      updatedAt: new Date().toISOString()
    }));
  };

  const handleAddRelation = (relation: RelacionUml) => {
    handleUpdateDiagram(prev => ({
      ...prev,
      relations: [...prev.relations, relation],
      updatedAt: new Date().toISOString()
    }));
  };

  const handleDeleteRelation = (relationId: string) => {
    handleUpdateDiagram(prev => ({
      ...prev,
      relations: prev.relations.filter(r => r.id !== relationId),
      updatedAt: new Date().toISOString()
    }));
  };

  const handleChangeUserColor = (color: string) => {
    const updatedUser = { ...currentSession.currentUser, avatarColor: color };
    const updatedParticipants = currentSession.participants.map(p =>
      p.id === currentSession.currentUser.id ? { ...p, avatarColor: color } : p
    );
    const updatedSession: InformacionSesion = {
      ...currentSession,
      currentUser: updatedUser,
      participants: updatedParticipants
    };
    setCurrentSession(updatedSession);
    localStorage.setItem('archai_session', JSON.stringify(updatedSession));
  };

  const handleWhiteboardImport = (importedDiagram: ModeloDiagrama) => {
    const rawClasses = importedDiagram.classes || [];
    const rawRelations = importedDiagram.relations || [];

    // Garantizar que la digitalización de pizarra respete la arquitectura universal 3FN / UML 2.5
    const normalizado = normalizarDiagrama({
      className: importedDiagram.title || 'Diagrama Pizarra IA',
      classes: rawClasses,
      relations: rawRelations.map(r => ({
        sourceName: rawClasses.find(c => c.id === r.sourceClassId)?.name || r.sourceClassId,
        targetName: rawClasses.find(c => c.id === r.targetClassId)?.name || r.targetClassId,
        type: r.type,
        label: r.label,
        sourceMultiplicity: r.sourceMultiplicity,
        targetMultiplicity: r.targetMultiplicity,
        associationClassName: r.associationClassId ? rawClasses.find(c => c.id === r.associationClassId)?.name : undefined
      }))
    }, []);

    const diagramaFinal: ModeloDiagrama = {
      ...importedDiagram,
      classes: normalizado?.classes || rawClasses,
      relations: normalizado?.relations || rawRelations,
      updatedAt: new Date().toISOString()
    };

    handleUpdateDiagram(diagramaFinal);
    setShowWhiteboardModal(false);
    setSaveInfo({
      tipo: 'ok',
      texto: `Diagrama de pizarra digitalizado y normalizado en UML 2.5 (3FN): ${diagramaFinal.classes.length} clases y ${diagramaFinal.relations.length} relaciones.`
    });
  };

  const handleCopySharePin = () => {
    if (currentSession?.roomId) {
      const shareUrl = `${window.location.origin}/sala/${encodeURIComponent(currentSession.roomId)}`;
      navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  /** CU-03 · Cambiar o conectarse a otra sala en caliente */
  const manejarCambiarSala = async (nuevoPin: string) => {
    const pinLimpio = nuevoPin.trim().toUpperCase();
    if (!pinLimpio) return;

    if (stompRef.current) {
      stompRef.current.disconnect();
      stompRef.current = null;
    }

    const sesionActualizada: InformacionSesion = {
      ...currentSession,
      roomId: pinLimpio,
      roomName: `Sala ${pinLimpio}`
    };
    setCurrentSession(sesionActualizada);
    localStorage.setItem('archai_session', JSON.stringify(sesionActualizada));
    localStorage.setItem('archai_ultima_sala', pinLimpio);
    setShowShareModal(false);
    setPinCambioSala('');
    setSaveInfo({ tipo: 'ok', texto: `Conectado a la sala ${pinLimpio}. Sincronizando diagrama…` });

    const newParams = new URLSearchParams(location.search);
    newParams.set('roomId', pinLimpio);
    navigate({
      pathname: location.pathname,
      search: `?${newParams.toString()}`
    }, { replace: true });
  };

  const handleSelectRailTab = (tab: 'canvas' | 'team' | 'settings') => {
    setActiveRailTab(tab);
    if (tab !== 'canvas') {
      setIsProjectStructureOpen(false);
      proposals.setOpen(false);
    }
    const newParams = new URLSearchParams(location.search);
    if (tab === 'canvas') {
      newParams.delete('tab');
    } else {
      newParams.set('tab', tab);
    }
    const q = newParams.toString();
    navigate({
      pathname: location.pathname,
      search: q ? `?${q}` : ''
    }, { replace: true });
  };

  // ───────────────────────── CU-01 · Perfil · CU-05 · Nube/Versiones · CU-09 · Offline ─────────────────────────

  const [showGuardarModal, setShowGuardarModal] = useState<boolean>(false);
  const [showVersionesModal, setShowVersionesModal] = useState<boolean>(false);
  const [showPerfilModal, setShowPerfilModal] = useState<boolean>(false);
  const [versiones, setVersiones] = useState<any[]>([]);
  const [guardadoEn, setGuardadoEn] = useState<string | null>(diagramId || null);
  useEffect(() => {
    setGuardadoEn(diagramId || null);
    setVersiones([]);
  }, [diagramId]);
  const [saveInfo, setSaveInfo] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [online, setOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [guardando, setGuardando] = useState<boolean>(false);

  // ───────────────────────── RBAC, Madurez de Software & Cerebro de Código ─────────────────────────
  const [currentRole, setCurrentRole] = useState<RolEquipo>('Arquitecto de Software');
  const [userPermissions, setUserPermissions] = useState<PermisosUsuario>(() => obtenerPermisosRol('Arquitecto de Software'));
  const [isTeamModalOpen, setIsTeamModalOpen] = useState<boolean>(false);

  const [miembros, setMiembros] = useState<MiembroEquipo[]>([
    {
      id: currentSession.currentUser.id || 'usr-master',
      name: currentSession.currentUser.name || 'Carlos Criado',
      email: currentSession.currentUser.email || 'carlos.criado@archai.io',
      role: 'Arquitecto de Software',
      avatarColor: '#2f2c79',
      isHost: true,
      permissions: obtenerPermisosRol('Arquitecto de Software')
    },
    {
      id: 'usr-elena',
      name: 'Elena Ramos',
      email: 'elena.tech@archai.io',
      role: 'Líder Técnico',
      avatarColor: '#171a4a',
      isHost: false,
      permissions: obtenerPermisosRol('Líder Técnico')
    },
    {
      id: 'usr-lucas',
      name: 'Lucas Vaca',
      email: 'lucas.backend@archai.io',
      role: 'Desarrollador Backend',
      avatarColor: '#4a4891',
      isHost: false,
      permissions: obtenerPermisosRol('Desarrollador Backend')
    },
    {
      id: 'usr-sofia',
      name: 'Sofia Morales',
      email: 'sofia.front@archai.io',
      role: 'Ingeniero Frontend',
      avatarColor: '#5c688c',
      isHost: false,
      permissions: obtenerPermisosRol('Ingeniero Frontend')
    },
    {
      id: 'usr-diego',
      name: 'Diego Arze',
      email: 'diego.qa@archai.io',
      role: 'Analista QA',
      avatarColor: '#3a3670',
      isHost: false,
      permissions: obtenerPermisosRol('Analista QA')
    },
    {
      id: 'usr-guest',
      name: 'Observador Demo',
      email: 'stakeholder@demo.com',
      role: 'Observador',
      avatarColor: '#8892b0',
      isHost: false,
      permissions: obtenerPermisosRol('Observador')
    }
  ]);

  const maturityScore = useMemo(() => {
    return calcularMadurezProyecto(diagram).porcentajeGlobal;
  }, [diagram]);

  const handleRoleChange = (newRole: RolEquipo) => {
    setCurrentRole(newRole);
    const newPerms = obtenerPermisosRol(newRole);
    setUserPermissions(newPerms);
    setMiembros(prev => prev.map(m => m.id === currentSession.currentUser.id ? { ...m, role: newRole, permissions: newPerms } : m));
    setSaveInfo({ tipo: 'ok', texto: `Rol conmutado a: ${newRole}. Permisos aplicados en vivo.` });
  };

  const handleActualizarMiembro = (miembroActualizado: MiembroEquipo) => {
    setMiembros(prev => prev.map(m => m.id === miembroActualizado.id ? miembroActualizado : m));
    if (miembroActualizado.id === currentSession.currentUser.id) {
      setCurrentRole(miembroActualizado.role);
      setUserPermissions(miembroActualizado.permissions);
    }
    setSaveInfo({ tipo: 'ok', texto: `Permisos de ${miembroActualizado.name} actualizados.` });
  };

  const handleAutoCompletarClase = (classId: string) => {
    setDiagram(prev => {
      const cls = prev.classes.find(c => c.id === classId);
      if (!cls) return prev;
      const metodosSugeridos = generarMetodosSugeridos(cls.name);
      const nombresActuales = new Set(cls.methods.map(m => m.name.toLowerCase()));
      const metodosAInsertar = metodosSugeridos
        .filter(m => !nombresActuales.has(m.name.toLowerCase()))
        .map((m, idx) => ({
          id: `m-sug-${Date.now()}-${idx}`,
          name: m.name,
          returnType: m.returnType,
          visibility: m.visibility,
          parameters: m.parameters
        }));

      if (metodosAInsertar.length === 0) {
        setSaveInfo({ tipo: 'ok', texto: `La clase ${cls.name} ya cuenta con sus métodos de negocio clave.` });
        return prev;
      }

      setSaveInfo({ tipo: 'ok', texto: `${metodosAInsertar.length} método(s) de negocio autocompletados en ${cls.name}.` });

      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        classes: prev.classes.map(c => c.id === classId ? { ...c, methods: [...c.methods, ...metodosAInsertar] } : c)
      };
    });
  };

  useEffect(() => {
    const irEnLinea = () => setOnline(true);
    const irFueraDeLinea = () => setOnline(false);
    window.addEventListener('online', irEnLinea);
    window.addEventListener('offline', irFueraDeLinea);
    return () => {
      window.removeEventListener('online', irEnLinea);
      window.removeEventListener('offline', irFueraDeLinea);
    };
  }, []);

  // Auto-dismiss para notificaciones y toasts informativos (4 segundos)
  useEffect(() => {
    if (saveInfo) {
      const timer = setTimeout(() => setSaveInfo(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [saveInfo]);

  /** CU-05 · Guardar el diagrama en la nube (con fallback a cola offline CU-09). */
  const manejarGuardarEnNube = async () => {
    setGuardando(true);
    setSaveInfo(null);
    const payload = {...construirPayloadDiagrama(diagram, { creadorId: currentSession.currentUser.id }),...(diagramId?{id:diagramId}:{})};
    if (!online) {
      encolarOperacionOffline('guardar-diagrama', '/api/v1/diagramas', payload);
      setSaveInfo({ tipo: 'ok', texto: 'Sin conexión: el diagrama se encoló y se sincronizará automáticamente.' });
      setGuardando(false);
      return;
    }
    try {
      const guardado = await guardarDiagramaEnNube(diagram, undefined, currentSession.currentUser.id, diagramId);
      const id = guardado?.id;
      if (id) {
        if(diagramId)await proposals.saveSession();
        setGuardadoEn(id);
        localStorage.setItem('archai_diagrama_id', id);
        try {
          const contexto = proposals.exportarContexto();
          await guardarContextoDiagrama(id, contexto);
          const room = currentSession?.roomId;
          if (room && room !== 'LOCAL-MODE') {
            await guardarContextoSala(room, contexto);
          }
        } catch {
          // El diagrama se guardó; el contexto se intenta en el siguiente guardado.
        }
        setSaveInfo({ tipo: 'ok', texto: `Diagrama guardado en la nube (id: ${id}).` });
      }
    } catch (err: any) {
      const retryable = !('status' in err) || err.status === 0 || err.status >= 500;
      if(retryable)encolarOperacionOffline('guardar-diagrama', '/api/v1/diagramas', payload);
      setSaveInfo({ tipo: 'error', texto: `${err?.message || 'Error al guardar'}${retryable ? ' Se encoló para sincronizar después.' : ''}` });
    } finally {
      setGuardando(false);
    }
  };

  const handleSaveShortcut = () => {
    void manejarGuardarEnNube();
  };

  // Atajos de teclado globales a nivel de ventana para el estudio ArchAI
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement)?.tagName;
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag);

      // Guardar con Ctrl+S (funciona siempre, incluso dentro de inputs)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveShortcut();
        return;
      }

      if (isInputFocused) return;

      // Deshacer con Ctrl+Z (sin Shift)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Rehacer con Ctrl+Y o Ctrl+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Copiar con Ctrl+C
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        handleCopyClass();
        return;
      }

      // Pegar con Ctrl+V
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        handlePasteClass();
        return;
      }

      // Duplicar con Ctrl+D
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateClass();
        return;
      }

      // Búsqueda rápida Spotlight con Ctrl+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSearchOpen(prev => !prev);
        return;
      }

      // Ayuda de atajos con F1 o ?
      if (e.key === 'F1' || e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedClassId, diagram]);

  /** CU-05 · Listar versiones del diagrama guardado. */
  const cargarVersiones = async () => {
    if (!guardadoEn) {
      setVersiones([]);
      return;
    }
    try {
      const lista = await listarVersiones(guardadoEn);
      setVersiones(lista);
    } catch {
      setVersiones([]);
    }
  };

  const manejarAbrirVersiones = () => {
    setShowVersionesModal(true);
    cargarVersiones();
  };

  /** CU-05 · Crear una versión con etiqueta (o guardar primero si aún no existe). */
  const manejarCrearVersion = async (etiqueta: string, descripcion: string) => {
    try {
      let idDiagrama = guardadoEn;
      if (!idDiagrama) {
        const guardado = await guardarDiagramaEnNube(diagram, undefined, currentSession.currentUser.id, diagramId);
        idDiagrama = guardado?.id;
        if (idDiagrama) {
          setGuardadoEn(idDiagrama);
          localStorage.setItem('archai_diagrama_id', idDiagrama);
        }
      }
      if (idDiagrama) {
        await crearVersion(idDiagrama, etiqueta.trim() || undefined as any, descripcion.trim(), currentSession.currentUser.id);
        await cargarVersiones();
        try {
          const contexto = proposals.exportarContexto();
          await guardarContextoDiagrama(idDiagrama, contexto);
          const room = currentSession?.roomId;
          if (room && room !== 'LOCAL-MODE') {
            await guardarContextoSala(room, contexto);
          }
        } catch {
          // La versión se creó; el contexto se guarda en el próximo guardado explícito.
        }
      }
    } catch (err: any) {
      setSaveInfo({ tipo: 'error', texto: err?.message || 'No se pudo crear la versión.' });
    }
  };

  /** CU-05 · Restaurar una versión anterior en el lienzo. */
  const manejarRestaurarVersion = async (versionId: string) => {
    if (!guardadoEn) return;
    try {
      const restaurado = await restaurarVersion(guardadoEn, versionId);
      setDiagram(diagramaDesdeBackend(restaurado));
      setShowVersionesModal(false);
      setSaveInfo({ tipo: 'ok', texto: 'Versión restaurada en el lienzo.' });
    } catch (err: any) {
      setSaveInfo({ tipo: 'error', texto: err?.message || 'No se pudo restaurar la versión.' });
    }
  };

  /** CU-01 · Actualizar perfil de usuario en el backend. */
  const manejarActualizarPerfil = async (cambios: { name?: string; email?: string; role?: string; avatarColor?: string }) => {
    try {
      const perfil = await actualizarPerfil(currentSession.currentUser.id, cambios as any);
      const usuarioActualizado = { ...currentSession.currentUser, ...perfil };
      const sesionActualizada: InformacionSesion = {
        ...currentSession,
        currentUser: usuarioActualizado,
        participants: currentSession.participants.map(p =>
          p.id === currentSession.currentUser.id ? usuarioActualizado : p
        )
      };
      setCurrentSession(sesionActualizada);
      localStorage.setItem('archai_session', JSON.stringify(sesionActualizada));
      setShowPerfilModal(false);
      setSaveInfo({ tipo: 'ok', texto: 'Perfil actualizado en la nube.' });
    } catch (err: any) {
      setSaveInfo({ tipo: 'error', texto: err?.message || 'No se pudo actualizar el perfil.' });
    }
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      backgroundColor: 'var(--bg-app)',
      position: 'relative'
    }}>
      {/* 1. Barra Lateral de Navegación */}
      <BarraLateralNavegacion
        activeTab={activeRailTab}
        projectStructureOpen={activeRailTab === 'canvas' && isProjectStructureOpen}
        onToggleProjectStructure={() => {
          if (activeRailTab !== 'canvas') handleSelectRailTab('canvas');
          setIsProjectStructureOpen(open => activeRailTab !== 'canvas' || !open);
        }}
        assistantOpen={activeRailTab === 'canvas' && proposals.open}
        unreadChatCount={proposals.unread}
        onToggleAssistant={() => {
          if (activeRailTab !== 'canvas') handleSelectRailTab('canvas');
          proposals.setOpen(activeRailTab !== 'canvas' || !proposals.open);
        }}
        onSelectTab={handleSelectRailTab}
        currentUser={currentSession.currentUser}
        onLogout={onLogout}
        onOpenProjects={onOpenProjects}
      />

      {/* Área Central del Estudio */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        height: '100%',
        position: 'relative'
      }}>
        {/* 2. Barra Superior con Selector de Tema */}
        <BarraSuperior
          session={currentSession}
          projectName={projectName?.key === projectNameKey ? projectName.name : undefined}
          diagramTitle={diagram.title}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onExportXmi={handleExportXmi}
          onExportarEA={handleExportarEA}
          onExportarVisual={() => setShowExportarVisualModal(true)}
          onExportarArchivo={handleExportarArchivo}
          onImportarArchivo={handleImportarArchivo}
          onOpenQuickSearch={() => setIsQuickSearchOpen(true)}
          onToggleCodeDock={() => setIsCodeDockOpen(prev => !prev)}
          isCodeDockOpen={isCodeDockOpen}
          onShare={() => setShowShareModal(true)}
          onGuardarNube={() => setShowGuardarModal(true)}
          onVersiones={manejarAbrirVersiones}
          onPerfil={() => setShowPerfilModal(true)}
          online={online}
          onCambiarSala={manejarCambiarSala}
          maturityScore={maturityScore}
          userRole={currentRole}
          onQuickRoleChange={handleRoleChange}
          onOpenTeamModal={() => setIsTeamModalOpen(true)}
          onOpenMaturityAudit={() => {proposals.setOpen(true);proposals.request("Realiza una auditoría del diagrama actual: explica sus riesgos y propón solo mejoras concretas para revisar.");}}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={review.snapshot?!!review.snapshot.canUndo:canUndo}
          canRedo={review.snapshot?!!review.snapshot.canRedo:canRedo}
          onAbrirAtajos={() => setShowShortcutsModal(true)}
        />

        {/* Espacio de Trabajo Central (Lienzo + Paneles Flotantes + Dock) */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingFile(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsDraggingFile(false);
            }
          }}
          onDrop={handleDropFile}
          style={{
            flex: 1,
            display: 'flex',
            position: 'relative',
            minHeight: 0,
            overflow: 'hidden'
          }}
        >
          {/* Overlay visual para Drag-and-Drop de archivos .archai.json */}
          {isDraggingFile && (
            <div style={{
              position: 'absolute',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(7, 10, 28, 0.82)',
              backdropFilter: 'blur(10px)',
              border: '2px dashed #38bdf8',
              borderRadius: '12px',
              margin: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              color: '#38bdf8',
              pointerEvents: 'none',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(56, 189, 248, 0.4)'
              }}>
                <Upload size={32} color="#38bdf8" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', marginBottom: '4px' }}>
                  Suelta tu proyecto ArchAI (.archai.json) aquí
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  El diagrama y sus relaciones se cargarán instantáneamente en el lienzo
                </div>
              </div>
            </div>
          )}

          {/* Lienzo Interactivo UML (sólo visible en la vista "canvas") */}
          {activeRailTab === 'canvas' && (
            <>
          <LienzoInteractivoStudio
            diagram={diagram}
            proposalDraft={!review.hidden ? review.active?.diagram : undefined}
            onDraftMove={review.canModerate && !review.busy ? (id,pos)=>{void review.move(id,pos);} : undefined}
            onInspectDraft={id=>{review.setInspected(id);proposals.setOpen(true);}}
            session={currentSession}
            selectedClassId={selectedClassId}
            onSelectClass={setSelectedClassId}
            onUpdateDiagram={handleUpdateDiagram}
            onAddClass={handleAddClass}
            onDeleteClass={handleDeleteClass}
            onAddAttribute={handleAddAttribute}
            onDeleteAttribute={handleDeleteAttribute}
            onAddMethod={handleAddMethod}
            onDeleteMethod={handleDeleteMethod}
            onAddRelation={handleAddRelation}
            onDeleteRelation={handleDeleteRelation}
            onChangeUserColor={handleChangeUserColor}
            remoteCursors={remoteCursors}
            onCursorMove={manejarCursorMove}
            // CU-03 · Movimiento colaborativo fluido en tiempo real a 25 FPS
            onNodeDrag={manejarNodeDrag}
            remoteDraggingNodes={remoteDraggingNodes}
            onDragStateChange={(enCurso) => { arrastreEnCursoRef.current = enCurso; }}
            onOpenWhiteboard={() => setShowWhiteboardModal(true)}
            onToggleAiAssistant={() => proposals.setOpen(!proposals.open)}
            isAiAssistantOpen={proposals.open}
            userPermissions={review.snapshot && !review.canModerate ? {...userPermissions,canEditDiagram:false,canConnectRelations:false} : userPermissions}
            userRole={currentRole}
            onAutoCompletarClase={handleAutoCompletarClase}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={review.snapshot?!!review.snapshot.canUndo:canUndo}
            canRedo={review.snapshot?!!review.snapshot.canRedo:canRedo}
            onSaveShortcut={handleSaveShortcut}
            onOpenShortcutsModal={() => setShowShortcutsModal(true)}
            onCopyClass={handleCopyClass}
            onPasteClass={handlePasteClass}
            onDuplicateClass={handleDuplicateClass}
            focusTarget={focusTarget}
          />

          {/* 3. Panel Flotante de Estructura del Proyecto */}
          <PanelEstructuraProyecto
            isOpen={isProjectStructureOpen}
            onClose={() => setIsProjectStructureOpen(false)}
            classes={diagram.classes}
            selectedClassId={selectedClassId}
            onSelectClass={setSelectedClassId}
            usuarioId={currentSession.currentUser.id}
            onCargarDiagrama={(d) => {
              handleUpdateDiagram(d);
              setSaveInfo({ tipo: 'ok', texto: `Diagrama cargado: ${d.title}` });
            }}
            onNotificar={(texto, tipo = 'ok') => setSaveInfo({ tipo, texto })}
          />

          {/* Chat compartido: conversación, dictado y revisión de propuestas. */}
          <ProposalPanel state={proposals} host={currentSession.currentUser.isHost} review={review}/>
          <ProposalToolbar review={review} onInspect={()=>proposals.setOpen(true)}/>
          {/* 6. Panel Lateral de Generación de Código y DDL */}
          {isCodeDockOpen && (
            <Suspense fallback={null}>
              <PanelGeneracionCodigo
                isOpen={isCodeDockOpen}
                onClose={() => setIsCodeDockOpen(false)}
                diagram={diagram}
                onImportarDiagrama={(d) => {
                  handleUpdateDiagram(d);
                  setSaveInfo({ tipo: 'ok', texto: 'Diagrama reconstruido desde XMI.' });
                }}
              />
            </Suspense>
          )}

            </>
          )}

          {/* 7. Vista de Equipo y Colaboración en Vivo (CU-03) */}
          {activeRailTab === 'team' && (
            <div style={{
              position: 'absolute',
              inset: 0,
              zIndex: 28,
              overflowY: 'auto',
              padding: '20px'
            }}>
              <div style={{ maxWidth: '720px' }}>
                <PanelColaboracion key={currentSession.roomId} session={currentSession} onReconnect={() => setConnectionAttempt(attempt => attempt + 1)} />
                <div style={{
                  marginTop: '10px',
                  padding: '10px 16px',
                  borderRadius: '12px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: 'var(--glass-surface)',
                  border: '1px solid var(--glass-border-color)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {estadoColab === 'conectado'
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Radio size={12} color="#10B981" /> Edición en vivo: cada cambio del lienzo se transmite a los participantes de la sala.</span>
                    : estadoColab === 'conectando'
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Radio size={12} color="#F59E0B" /> Conectando al broker STOMP /ws-stomp…</span>
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Radio size={12} color="var(--text-muted)" /> Backend sin conexión: solo modo local (sin sincronización).</span>}
                  <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {currentSession.roomId}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeRailTab === 'settings' && (
            <StudioSettings
              key={currentSession.roomId}
              session={currentSession}
              theme={theme}
              onThemeChange={setTheme}
              pendingChanges={obtenerColaOffline().length}
              onSync={manejarSincronizarCola}
              state={proposals}
              review={review}
            />
          )}
        </div>
      </div>

      {/* Modal Escáner de Pizarra OCR */}
      {showWhiteboardModal && (
        <Suspense fallback={null}>
          <ModalEscanerPizarra
            onImportDiagram={handleWhiteboardImport}
            onClose={() => setShowWhiteboardModal(false)}
          />
        </Suspense>
      )}

      {/* Modal de Gestión de Equipo y Permisos RBAC */}
      {isTeamModalOpen && (
        <Suspense fallback={null}>
          <ModalGestionEquipo
            isOpen={isTeamModalOpen}
            onClose={() => setIsTeamModalOpen(false)}
            miembros={miembros}
            onActualizarMiembro={handleActualizarMiembro}
            onCambiarMiRol={handleRoleChange}
            currentUserId={currentSession.currentUser.id}
          />
        </Suspense>
      )}

      {/* Modal de Compartir PIN */}
      {showShareModal && (
        <GlassModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          title="Compartir Sesión Colaborativa"
          subtitle="Invita a otros ingenieros a colaborar en tiempo real con este PIN de sala"
          icon={<Share2 size={20} />}
          iconColor="#e8c39e"
          iconBg="rgba(232, 195, 158, 0.15)"
          maxWidth="460px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary, #8892b0)', lineHeight: '1.5' }}>
              Cualquier miembro de tu equipo con acceso a la red puede conectarse inmediatamente a este lienzo utilizando el código de sala activo.
            </p>

            {/* Showcase PIN Container */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(23, 26, 74, 0.75) 0%, rgba(47, 44, 121, 0.45) 100%)',
              border: '1px solid rgba(232, 195, 158, 0.28)',
              borderRadius: '14px',
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(245, 225, 206, 0.1)'
            }}>
              <div>
                <div style={{
                  fontSize: '0.68rem',
                  color: '#e8c39e',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    boxShadow: '0 0 8px #10b981',
                    display: 'inline-block'
                  }} />
                  Código de Sala (PIN)
                </div>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: '#f5e1ce',
                  letterSpacing: '0.1em',
                  marginTop: '4px',
                  textShadow: '0 0 12px rgba(245, 225, 206, 0.25)'
                }}>
                  {currentSession.roomId}
                </div>
              </div>

              <button
                onClick={handleCopySharePin}
                className="btn-studio-primary"
                style={{
                  padding: '9px 16px',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {shareCopied ? <Check size={15} /> : <Copy size={15} />}
                <span>{shareCopied ? '¡Copiado!' : 'Copiar PIN'}</span>
              </button>
            </div>

            {/* Badges / Stats Container */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px'
            }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(245, 225, 206, 0.1)',
                borderRadius: '10px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: 'rgba(232, 195, 158, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#e8c39e',
                  flexShrink: 0
                }}>
                  <UserCheck size={16} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #8892b0)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Anfitrión
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-primary, #f5e1ce)', fontWeight: 700, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {currentSession.hostName}
                  </div>
                </div>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(245, 225, 206, 0.1)',
                borderRadius: '10px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                  flexShrink: 0
                }}>
                  <Users size={16} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted, #8892b0)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Conectados
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-primary, #f5e1ce)', fontWeight: 700 }}>
                    {currentSession.participants.length} {currentSession.participants.length === 1 ? 'ingeniero' : 'ingenieros'}
                  </div>
                </div>
              </div>
            </div>

            {/* CU-03 · Cambiar o conectarse a otra sala en caliente */}
            <div style={{
              borderTop: '1px solid rgba(245, 225, 206, 0.1)',
              paddingTop: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary, #f5e1ce)' }}>
                Cambiar de sala o unirse a otro equipo:
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Ej: ARC-123456"
                  value={pinCambioSala}
                  onChange={e => setPinCambioSala(e.target.value.toUpperCase())}
                  style={{
                    flex: 1,
                    background: 'rgba(23, 26, 74, 0.45)',
                    border: '1px solid rgba(245, 225, 206, 0.18)',
                    borderRadius: '10px',
                    padding: '9px 12px',
                    fontSize: '0.84rem',
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text-primary, #f5e1ce)',
                    outline: 'none',
                    letterSpacing: '0.04em'
                  }}
                />
                <button
                  onClick={() => manejarCambiarSala(pinCambioSala)}
                  disabled={!pinCambioSala.trim()}
                  className="btn-studio-primary"
                  style={{
                    padding: '9px 16px',
                    fontSize: '0.8rem',
                    whiteSpace: 'nowrap',
                    opacity: pinCambioSala.trim() ? 1 : 0.5,
                    cursor: pinCambioSala.trim() ? 'pointer' : 'not-allowed',
                    borderRadius: '10px'
                  }}
                >
                  Conectar
                </button>
              </div>

              {/* Botón directo para unirse a la sala común de pruebas */}
              <button
                onClick={() => manejarCambiarSala('ARC-GRUPO04')}
                className="btn-studio-glass"
                style={{
                  padding: '10px 14px',
                  fontSize: '0.76rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  color: '#f5e1ce',
                  border: '1px solid rgba(232, 195, 158, 0.25)',
                  background: 'rgba(47, 44, 121, 0.55)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Zap size={12} color="var(--accent-primary)" /> Unirse a sala de prueba común: <strong style={{ color: '#e8c39e' }}>ARC-GRUPO04</strong></span>
              </button>
            </div>
          </div>
        </GlassModal>
      )}

      {/* CU-05 · Modal Guardar en la Nube */}
      {showGuardarModal && (
        <ModalGuardarNube
          tituloDiagrama={diagram.title}
          guardadoEn={guardadoEn}
          guardando={guardando}
          online={online}
          onGuardar={manejarGuardarEnNube}
          onAbrirVersiones={() => {
            setShowGuardarModal(false);
            manejarAbrirVersiones();
          }}
          onCerrar={() => setShowGuardarModal(false)}
        />
      )}

      {/* CU-05 · Modal de Versiones */}
      {showVersionesModal && (
        <ModalVersiones
          versiones={versiones}
          guardadoEn={guardadoEn}
          onCrearVersion={manejarCrearVersion}
          onRestaurar={manejarRestaurarVersion}
          onCerrar={() => setShowVersionesModal(false)}
        />
      )}

      {/* CU-01 · Modal de Perfil */}
      {showPerfilModal && (
        <ModalPerfilUsuario
          usuario={currentSession.currentUser}
          onGuardar={manejarActualizarPerfil}
          onCerrar={() => setShowPerfilModal(false)}
        />
      )}

      {/* Modal de Atajos de Teclado (F1 o ?) */}
      {showShortcutsModal && (
        <Suspense fallback={null}>
          <ModalAtajosTeclado onClose={() => setShowShortcutsModal(false)} />
        </Suspense>
      )}

      {/* Modal de Exportación Visual (PNG / SVG) */}
      {showExportarVisualModal && (
        <Suspense fallback={null}>
          <ModalExportarVisual
            isOpen={showExportarVisualModal}
            onClose={() => setShowExportarVisualModal(false)}
            diagram={diagram}
            onSuccess={(msg) => setSaveInfo({ tipo: 'ok', texto: msg })}
          />
        </Suspense>
      )}

      {/* Modal Spotlight de Búsqueda Rápida y Comandos (Ctrl + K) */}
      {isQuickSearchOpen && (
        <Suspense fallback={null}>
          <QuickSearchSpotlightModal
            isOpen={isQuickSearchOpen}
            onClose={() => setIsQuickSearchOpen(false)}
            diagram={diagram}
            onFocusClass={(classId) => {
              setFocusTarget({ classId, tick: Date.now() });
              setIsQuickSearchOpen(false);
            }}
            onNewClass={() => setActiveRailTab('canvas')}
            onAutoOrganize={() => setActiveRailTab('canvas')}
            onExportVisual={() => setShowExportarVisualModal(true)}
            onExportArchivo={handleExportarArchivo}
            onExportEA={handleExportarEA}
            onToggleTheme={handleToggleTheme}
            onOpenShortcuts={() => setShowShortcutsModal(true)}
            onToggleAiAssistant={() => proposals.setOpen(!proposals.open)}
            onToggleCodeDock={() => setIsCodeDockOpen(prev => !prev)}
            onOpenTeamModal={() => setIsTeamModalOpen(true)}
            onOpenVersions={manejarAbrirVersiones}
          />
        </Suspense>
      )}

      {/* Toast informativo (CU-01 / CU-05 / CU-09) */}
      {saveInfo && (
        <div
          style={{
            position: 'fixed',
            top: '72px',
            right: isCodeDockOpen ? '436px' : '24px',
            zIndex: 999,
            maxWidth: '380px',
            padding: '10px 16px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: saveInfo.tipo === 'ok' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            background: saveInfo.tipo === 'ok' ? 'rgba(16, 185, 129, 0.16)' : 'rgba(244, 63, 94, 0.16)',
            border: `1px solid ${saveInfo.tipo === 'ok' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.2s ease-out',
            transition: 'right 0.25s ease'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{saveInfo.tipo === 'ok' ? <CheckCircle2 size={14} color="#10B981" style={{ flexShrink: 0 }} /> : <AlertTriangle size={14} color="#F59E0B" style={{ flexShrink: 0 }} />}</span>
          <span style={{ flex: 1 }}>{saveInfo.texto}</span>
          <button
            onClick={() => setSaveInfo(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px', marginLeft: '4px' }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

/* ───────────── CU-05 · Modal Guardar en la Nube ───────────── */

interface ModalGuardarNubeProps {
  tituloDiagrama: string;
  guardadoEn: string | null;
  guardando: boolean;
  online: boolean;
  onGuardar: () => void;
  onAbrirVersiones: () => void;
  onCerrar: () => void;
}

const ModalGuardarNube: React.FC<ModalGuardarNubeProps> = ({
  tituloDiagrama,
  guardadoEn,
  guardando,
  online,
  onGuardar,
  onAbrirVersiones,
  onCerrar
}) => (
  <GlassModal
    isOpen={true}
    onClose={onCerrar}
    title="Guardar en la Nube"
    subtitle="Persistencia remota y sincronización automática en backend"
    icon={<Save size={20} />}
    iconColor="#10b981"
    iconBg="rgba(16, 185, 129, 0.15)"
    maxWidth="460px"
    footer={
      <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
        <button
          onClick={onGuardar}
          disabled={guardando}
          className="btn-studio-primary"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 16px',
            fontSize: '0.84rem',
            opacity: guardando ? 0.6 : 1,
            borderRadius: '10px',
            fontWeight: 700,
            cursor: guardando ? 'wait' : 'pointer'
          }}
        >
          {guardando ? <RefreshCw size={15} className="spin" /> : <Upload size={15} />}
          {guardando ? 'Guardando en la nube...' : 'Guardar ahora'}
        </button>
        <button
          onClick={onAbrirVersiones}
          className="btn-studio-glass"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 14px',
            fontSize: '0.82rem',
            borderRadius: '10px',
            cursor: 'pointer'
          }}
        >
          <History size={15} /> Ver versiones
        </button>
      </div>
    }
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(23, 26, 74, 0.6) 0%, rgba(47, 44, 121, 0.35) 100%)',
        border: '1px solid rgba(245, 225, 206, 0.12)',
        borderRadius: '12px',
        padding: '14px 16px'
      }}>
        <div style={{ fontSize: '0.7rem', color: '#e8c39e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Diagrama activo
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary, #f5e1ce)', marginTop: '4px' }}>
          {tituloDiagrama}
        </div>
        {guardadoEn && (
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #8892b0)', fontFamily: 'var(--font-mono, monospace)', marginTop: '6px' }}>
            Última sincronización: <strong style={{ color: 'var(--text-primary, #f5e1ce)' }}>{guardadoEn}</strong>
          </div>
        )}
      </div>

      {!online && (
        <div style={{
          padding: '12px 14px',
          borderRadius: '12px',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: '#e8c39e',
          background: 'rgba(232, 195, 158, 0.12)',
          border: '1px solid rgba(232, 195, 158, 0.3)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          lineHeight: 1.4
        }}>
          <CloudOff size={16} style={{ flexShrink: 0 }} />
          <span>Modo offline activo: el guardado se encola localmente y se sincroniza al restablecer conexión con el backend.</span>
        </div>
      )}
    </div>
  </GlassModal>
);

/* ───────────── CU-05 · Modal de Versiones ───────────── */

interface ModalVersionesProps {
  versiones: any[];
  guardadoEn: string | null;
  onCrearVersion: (etiqueta: string, descripcion: string) => void;
  onRestaurar: (versionId: string) => void;
  onCerrar: () => void;
}

const ModalVersiones: React.FC<ModalVersionesProps> = ({
  versiones,
  guardadoEn,
  onCrearVersion,
  onRestaurar,
  onCerrar
}) => {
  const [etiqueta, setEtiqueta] = useState('');
  const [descripcion, setDescripcion] = useState('');

  return (
    <GlassModal
      isOpen={true}
      onClose={onCerrar}
      title="Historial de Versiones"
      subtitle="Snapshots inmutables del modelo arquitectónico"
      icon={<History size={20} />}
      iconColor="#e8c39e"
      iconBg="rgba(232, 195, 158, 0.15)"
      maxWidth="560px"
      maxHeight="86vh"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {!guardadoEn && (
          <div style={{
            fontSize: '0.78rem',
            color: 'var(--text-muted, #8892b0)',
            background: 'rgba(255, 255, 255, 0.03)',
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid rgba(245, 225, 206, 0.1)'
          }}>
            El diagrama aún no se ha sincronizado en la nube. Crea una versión para fijar su estado actual.
          </div>
        )}

        {/* Formulario de nueva versión */}
        <div style={{
          background: 'rgba(23, 26, 74, 0.45)',
          border: '1px solid rgba(245, 225, 206, 0.12)',
          borderRadius: '14px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e8c39e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Guardar nuevo snapshot
          </div>
          <input
            value={etiqueta}
            onChange={e => setEtiqueta(e.target.value)}
            placeholder="Etiqueta de la versión (ej. v1.2-clases-finales)"
            style={{
              padding: '9px 12px',
              borderRadius: '10px',
              border: '1px solid rgba(245, 225, 206, 0.18)',
              background: 'rgba(255, 255, 255, 0.04)',
              color: 'var(--text-primary, #f5e1ce)',
              fontSize: '0.82rem',
              outline: 'none'
            }}
          />
          <input
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="Descripción del cambio (opcional)"
            style={{
              padding: '9px 12px',
              borderRadius: '10px',
              border: '1px solid rgba(245, 225, 206, 0.18)',
              background: 'rgba(255, 255, 255, 0.04)',
              color: 'var(--text-primary, #f5e1ce)',
              fontSize: '0.82rem',
              outline: 'none'
            }}
          />
          <button
            onClick={() => {
              onCrearVersion(etiqueta || 'versión sin etiqueta', descripcion);
              setEtiqueta('');
              setDescripcion('');
            }}
            className="btn-studio-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '9px 14px',
              fontSize: '0.82rem',
              borderRadius: '10px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Upload size={15} /> Crear versión
          </button>
        </div>

        {/* Lista de versiones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #8892b0)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Versiones registradas ({versiones.length})
          </div>

          {versiones.length === 0 && (
            <div style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted, #8892b0)',
              textAlign: 'center',
              padding: '24px 16px',
              border: '1px dashed rgba(245, 225, 206, 0.15)',
              borderRadius: '12px'
            }}>
              Sin versiones registradas todavía.
            </div>
          )}

          {versiones.map(v => (
            <div
              key={v.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid rgba(245, 225, 206, 0.12)',
                background: 'rgba(255, 255, 255, 0.03)',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    background: 'rgba(232, 195, 158, 0.2)',
                    color: '#e8c39e',
                    border: '1px solid rgba(232, 195, 158, 0.35)',
                    borderRadius: '6px',
                    padding: '2px 7px',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono, monospace)'
                  }}>
                    v{v.numeroVersion}
                  </span>
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary, #f5e1ce)' }}>
                    {v.etiqueta}
                  </span>
                </div>
                <div style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted, #8892b0)',
                  marginTop: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {v.descripcionCambio || '—'} · {v.autorNombre || 'anónimo'}
                </div>
              </div>
              <button
                onClick={() => onRestaurar(v.id)}
                className="btn-studio-glass"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.76rem',
                  padding: '7px 12px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                title="Restaurar esta versión en el lienzo"
              >
                <RotateCcw size={13} /> Restaurar
              </button>
            </div>
          ))}
        </div>
      </div>
    </GlassModal>
  );
};

/* ───────────── CU-01 · Modal de Perfil de Usuario ───────────── */

interface ModalPerfilUsuarioProps {
  usuario: PerfilUsuario;
  onGuardar: (cambios: { name?: string; email?: string; role?: string; avatarColor?: string }) => void;
  onCerrar: () => void;
}

const ROLES_PERFIL: RolUsuario[] = [
  'Arquitecto de Software',
  'Ingeniero de Datos',
  'Desarrollador Backend',
  'Ingeniero Frontend',
  'Líder Técnico'
];

const COLORES_AVATAR = ['#2f2c79', '#171a4a', '#4a4891', '#5c688c', '#8892b0', '#3a3670', '#1e2547'];

const ModalPerfilUsuario: React.FC<ModalPerfilUsuarioProps> = ({ usuario, onGuardar, onCerrar }) => {
  const [nombre, setNombre] = useState(usuario.name);
  const [correo, setCorreo] = useState(usuario.email);
  const [rol, setRol] = useState<RolUsuario>(usuario.role || 'Arquitecto de Software');
  const [color, setColor] = useState(usuario.avatarColor || COLORES_AVATAR[0]);

  return (
    <GlassModal
      isOpen={true}
      onClose={onCerrar}
      title="Mi Perfil de Ingeniero"
      subtitle="Configura tu identidad colaborativa en tiempo real"
      icon={<UserCircle size={20} />}
      iconColor="#e8c39e"
      iconBg="rgba(232, 195, 158, 0.15)"
      maxWidth="460px"
      footer={
        <button
          onClick={() => onGuardar({ name: nombre.trim(), email: correo.trim(), role: rol, avatarColor: color })}
          className="btn-studio-primary"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 16px',
            fontSize: '0.84rem',
            borderRadius: '10px',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <Upload size={15} /> Guardar cambios en la nube
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #8892b0)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Nombre completo
          <input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '9px 12px',
              borderRadius: '10px',
              border: '1px solid rgba(245, 225, 206, 0.18)',
              background: 'rgba(23, 26, 74, 0.45)',
              color: 'var(--text-primary, #f5e1ce)',
              fontSize: '0.85rem',
              outline: 'none',
              boxSizing: 'border-box',
              display: 'block'
            }}
          />
        </label>

        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #8892b0)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Correo electrónico
          <input
            value={correo}
            onChange={e => setCorreo(e.target.value)}
            type="email"
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '9px 12px',
              borderRadius: '10px',
              border: '1px solid rgba(245, 225, 206, 0.18)',
              background: 'rgba(23, 26, 74, 0.45)',
              color: 'var(--text-primary, #f5e1ce)',
              fontSize: '0.85rem',
              outline: 'none',
              boxSizing: 'border-box',
              display: 'block'
            }}
          />
        </label>

        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #8892b0)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Rol profesional
          <select
            value={rol}
            onChange={e => setRol(e.target.value as RolUsuario)}
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '9px 12px',
              borderRadius: '10px',
              border: '1px solid rgba(245, 225, 206, 0.18)',
              background: 'rgba(23, 26, 74, 0.85)',
              color: 'var(--text-primary, #f5e1ce)',
              fontSize: '0.85rem',
              outline: 'none',
              boxSizing: 'border-box',
              display: 'block',
              cursor: 'pointer'
            }}
          >
            {ROLES_PERFIL.map(r => (
              <option key={r} value={r} style={{ background: '#171a4a', color: '#f5e1ce' }}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #8892b0)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Color de avatar
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            {COLORES_AVATAR.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  backgroundColor: c,
                  border: color === c ? '2px solid #e8c39e' : '2px solid rgba(245, 225, 206, 0.15)',
                  cursor: 'pointer',
                  boxShadow: color === c ? '0 0 10px rgba(232, 195, 158, 0.5)' : 'none',
                  transition: 'all 0.15s ease',
                  transform: color === c ? 'scale(1.1)' : 'scale(1)'
                }}
                title={c}
              />
            ))}
          </div>
        </div>
      </div>
    </GlassModal>
  );
};

// Alias de retrocompatibilidad
export const PaginaEstudioCanvas = StudioPage;
export default StudioPage;
