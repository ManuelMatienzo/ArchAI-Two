import { DraftDiagram } from '../../services/proposalDraft';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
  Sparkles,
  LayoutGrid,
  Link as LinkIcon,
  Link2,
  Zap,
  Palette,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  Camera,
  Lock,
  Maximize2,
  Boxes,
  Mouse,
  ShoppingCart,
  HeartPulse,
  GraduationCap,
  ShieldCheck,
  Package,
  BookOpen,
  Building2,
  Settings,
  ArrowUpDown,
  Crosshair
} from 'lucide-react';
import { ModeloDiagrama, ClaseUml, AtributoUml, MetodoUml, RelacionUml, Visibilidad, TipoRelacion } from '../../types/uml';
import { InformacionSesion } from '../../types/auth';
import { PLANTILLAS_DISPONIBLES, instanciarPlantilla } from '../../services/plantillasDominio';
import { PermisosUsuario } from '../../types/rbac';
import { ToolboxUml25, DefClasificadorUml, DefPatronUml } from './ToolboxUml25';
import { inferirTablaIntermedia, inferirDireccionMaestroTransaccion, esClaseAsociativaUniversal, sanitizarDiagramaUML25 } from '../../services/semanticDomainEngine';
import { IntermediateTableDecomposerModal } from './IntermediateTableDecomposerModal';
import { ExtractSuperclassModal } from './ExtractSuperclassModal';
import { GlassModal } from '../glass/GlassModal';

import { CanvasBackdrop } from './CanvasBackdrop';
import { SvgDefs } from './SvgDefs';
import { RelationLayer } from './RelationLayer';
import { UmlNodeCard } from './UmlNodeCard';

interface InteractiveStudioCanvasProps {
  diagram: ModeloDiagrama;
  proposalDraft?: DraftDiagram;
  onDraftMove?: (id:string,position:{x:number;y:number})=>void;
  onInspectDraft?: (id:string)=>void;
  session: InformacionSesion;
  selectedClassId: string | null;
  onSelectClass: (classId: string | null) => void;
  onUpdateDiagram: (diagram: ModeloDiagrama) => void;
  onAddClass: (newClass: ClaseUml) => void;
  onDeleteClass: (classId: string) => void;
  onAddAttribute: (classId: string, attr: AtributoUml) => void;
  onDeleteAttribute: (classId: string, attrId: string) => void;
  onAddMethod?: (classId: string, method: MetodoUml) => void;
  onDeleteMethod?: (classId: string, methodId: string) => void;
  onAddRelation?: (relation: RelacionUml) => void;
  onDeleteRelation?: (relationId: string) => void;
  onChangeUserColor?: (color: string) => void;
  remoteCursors?: { id: string; name: string; color: string; x: number; y: number }[];
  onCursorMove?: (pos: { x: number; y: number }) => void;
  // ColaboraciÃ³n en vivo (CU-03): permite emitir el diagrama DURANTE el arrastre (no sÃ³lo al soltar)
  // y avisar al padre cuÃ¡ndo un arrastre estÃ¡ en curso (para evitar guardados masivos en la nube).
  onLiveDragUpdate?: (diagram: ModeloDiagrama) => void;
  onDragStateChange?: (dragging: boolean) => void;
  // CU-03 Â· Arrastre colaborativo fluido a 60 FPS
  onNodeDrag?: (classId: string, pos: { x: number; y: number }) => void;
  remoteDraggingNodes?: Record<string, { name: string; color: string }>;
  // Triggers externos desde la paleta de herramientas
  openNewClassTrigger?: number;
  openTemplatesTrigger?: number;
  openConnectTrigger?: number;
  openAutoOrganizeTrigger?: number;
  onOpenWhiteboard?: () => void;
  onToggleAiAssistant?: () => void;
  isAiAssistantOpen?: boolean;
  userPermissions?: PermisosUsuario;
  userRole?: string;
  onAutoCompletarClase?: (classId: string) => void;
  /** Atajos de teclado e historial universal */
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onSaveShortcut?: () => void;
  onOpenShortcutsModal?: () => void;
  onCopyClass?: () => void;
  onPasteClass?: () => void;
  onDuplicateClass?: () => void;
  /** Enfoque de cámara centrado sobre una clase (Spotlight Quick Search) */
  focusTarget?: { classId: string; tick: number } | null;
}

const PALETTE_COLORS = [
  { hex: '#334155', name: 'Gray Shadow (AnfitriÃ³n)' },
  { hex: '#4a4891', name: 'Ãndigo Sobrio (Colaborador A)' },
  { hex: '#8892b0', name: 'Gris Lunar (Colaborador B)' },
  { hex: '#e8c39e', name: 'Arena (Colaborador C)' },
  { hex: '#5c688c', name: 'Pizarra Azul (Colaborador D)' },
  { hex: '#a3adde', name: 'Azul Perla (Colaborador E)' }
];

export const InteractiveStudioCanvas: React.FC<InteractiveStudioCanvasProps> = ({
  diagram,
  proposalDraft, onDraftMove, onInspectDraft,
  session,
  selectedClassId,
  onSelectClass,
  onUpdateDiagram,
  onAddClass,
  onDeleteClass,
  onAddAttribute,
  onDeleteAttribute,
  onAddMethod,
  onDeleteMethod,
  onAddRelation,
  onDeleteRelation,
  onChangeUserColor,
  remoteCursors = [],
  onCursorMove,
  onLiveDragUpdate,
  onDragStateChange,
  onNodeDrag,
  remoteDraggingNodes = {},
  openNewClassTrigger,
  openTemplatesTrigger,
  openConnectTrigger,
  openAutoOrganizeTrigger,
  onOpenWhiteboard,
  onToggleAiAssistant,
  isAiAssistantOpen,
  userPermissions,
  userRole,
  onAutoCompletarClase,
  onUndo,
  onRedo,
  onSaveShortcut,
  onOpenShortcutsModal,
  onCopyClass,
  onPasteClass,
  onDuplicateClass,
  focusTarget
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Modo de rueda de ratÃ³n: 'zoom' (la rueda hace zoom directamente) o 'pan' (la rueda desplaza el lienzo; Ctrl+rueda hace zoom)
  const [wheelZoomMode, setWheelZoomMode] = useState<'zoom' | 'pan'>(() => {
    try {
      const saved = localStorage.getItem('archai_wheel_zoom_mode');
      return saved === 'pan' ? 'pan' : 'zoom';
    } catch {
      return 'zoom';
    }
  });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [draggingClassId, setDraggingClassId] = useState<string | null>(null);

  // Estado del Dock de herramientas unificado (desplegado / minimizado)
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);

  // Estado de la Toolbox UML 2.5+ (desplegada / minimizada)
  const [isToolboxOpen, setIsToolboxOpen] = useState<boolean>(false);
  const [insertStaggerCount, setInsertStaggerCount] = useState<number>(0);

  // Modales asistidos para modelado manual acelerado
  const [showNewClassModal, setShowNewClassModal] = useState<boolean>(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState<boolean>(false);

  // Formulario Asistido de Nueva Clase
  const [newClassName, setNewClassName] = useState<string>('');
  const [newClassStereotype, setNewClassStereotype] = useState<ClaseUml['stereotype']>('Entity');
  const [newClassWithIdPk, setNewClassWithIdPk] = useState<boolean>(true);
  const [newClassWithNombre, setNewClassWithNombre] = useState<boolean>(true);
  const [newClassWithDesc, setNewClassWithDesc] = useState<boolean>(false);
  const [newClassWithPrecio, setNewClassWithPrecio] = useState<boolean>(false);
  const [newClassWithFecha, setNewClassWithFecha] = useState<boolean>(false);
  const [newClassWithActivo, setNewClassWithActivo] = useState<boolean>(true);
  const [newClassLinkWithTargetId, setNewClassLinkWithTargetId] = useState<string>('');
  const [newClassLinkRelType, setNewClassLinkRelType] = useState<TipoRelacion>('ASSOCIATION_1_N');

  // Enlazador RÃ¡pido desde la Tarjeta (Fast Linker Popover)
  const [cardFastLinkerClassId, setCardFastLinkerClassId] = useState<string | null>(null);
  const [fastLinkTargetClassId, setFastLinkTargetClassId] = useState<string>('');
  const [fastLinkRelType, setFastLinkRelType] = useState<TipoRelacion>('ASSOCIATION_1_N');
  const [fastLinkLabel, setFastLinkLabel] = useState<string>('');

  // Renombrado Inline de Clase en Tarjeta
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingClassName, setEditingClassName] = useState<string>('');
  const [editingClassStereotype, setEditingClassStereotype] = useState<ClaseUml['stereotype']>('Entity');

  // Adding Attribute inline state
  const [addingAttrClassId, setAddingAttrClassId] = useState<string | null>(null);
  const [attrName, setAttrName] = useState<string>('');
  const [attrType, setAttrType] = useState<AtributoUml['type']>('String');
  const [attrVis, setAttrVis] = useState<Visibilidad>('-');
  const [attrIsPk, setAttrIsPk] = useState<boolean>(false);

  // Adding Method inline state
  const [addingMethodClassId, setAddingMethodClassId] = useState<string | null>(null);
  const [methodName, setMethodName] = useState<string>('');
  const [methodReturnType, setMethodReturnType] = useState<string>('void');
  const [methodParams, setMethodParams] = useState<string>('');
  const [methodVis, setMethodVis] = useState<Visibilidad>('+');

  // Connection Linking mode state
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [connectingMousePos, setConnectingMousePos] = useState<{ x: number; y: number } | null>(null);
  const [selectedRelationType, setSelectedRelationType] = useState<TipoRelacion>('ASSOCIATION_1_N');
  const [isRelationMode, setIsRelationMode] = useState<boolean>(false);

  // Toast flotante reactivo para confirmaciones en lienzo (descomposiciÃ³n N:M, etc.)
  const [canvasToast, setCanvasToast] = useState<string | null>(null);
  const canvasToastTimerRef = useRef<any>(null);

  const showCanvasToast = (msg: string) => {
    if (canvasToastTimerRef.current) clearTimeout(canvasToastTimerRef.current);
    setCanvasToast(msg);
    canvasToastTimerRef.current = setTimeout(() => {
      setCanvasToast(null);
    }, 4500);
  };

  // Estados de interacciÃ³n con relaciones (hover, selecciÃ³n y eliminaciÃ³n rÃ¡pida)
  const [hoveredRelationId, setHoveredRelationId] = useState<string | null>(null);
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
  const [relationBarPosition, setRelationBarPosition] = useState<'top' | 'bottom'>('top');
  const [isRelationBarCollapsed, setIsRelationBarCollapsed] = useState<boolean>(false);

  // Estado de arrastre activo sobre el lienzo (feedback visual de soltar)
  const [isDragOverCanvas, setIsDragOverCanvas] = useState<boolean>(false);

  // Dimensiones reales medidas de cada nodo UML para calcular anclajes perfectos que nunca corten las tarjetas
  const nodeDimensionsRef = useRef<Map<string, { w: number; h: number }>>(new Map());
  const [dimensionTick, setDimensionTick] = useState<number>(0);

  // Refs sincronizados para atajos de teclado sin stale-closures
  const selectedRelationIdRef = useRef<string | null>(null);
  const selectedClassIdRef = useRef<string | null>(null);
  const editingClassIdRef = useRef<string | null>(null);

  // Selección múltiple de clases UML (Shift + Clic, Marquee Box, Ctrl+A)
  const [selectedClassIds, setSelectedClassIdsState] = useState<Set<string>>(() => {
    return selectedClassId ? new Set([selectedClassId]) : new Set();
  });
  const selectedClassIdsRef = useRef<Set<string>>(new Set());

  const setSelectedClassIds = useCallback((next: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setSelectedClassIdsState(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      selectedClassIdsRef.current = resolved;
      return resolved;
    });
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      setSelectedClassIds(prev => {
        if (prev.has(selectedClassId) && prev.size === 1) return prev;
        return new Set([selectedClassId]);
      });
    } else {
      setSelectedClassIds(prev => (prev.size <= 1 ? new Set() : prev));
    }
  }, [selectedClassId, setSelectedClassIds]);

  // Arrastre coordinado a 60 FPS en selección múltiple
  const multiDragInitialPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const multiDragDeltaRef = useRef<{ deltaX: number; deltaY: number } | null>(null);
  const [multiDragDelta, setMultiDragDelta] = useState<{ deltaX: number; deltaY: number } | null>(null);

  // Herramienta activa del lienzo ('pan' para mano de desplazamiento, 'select' para selección por recuadro)
  const [canvasTool, setCanvasTool] = useState<'pan' | 'select'>('pan');

  // Recuadro de selección Marquee (Figma / Miro style)
  const isMarqueeSelectingRef = useRef<boolean>(false);
  const marqueeBoxRef = useRef<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  // Pulso visual de enfoque (Spotlight / Quick Search)
  const [focusedClassPulseId, setFocusedClassPulseId] = useState<string | null>(null);

  // Enfocar suavemente una clase en el centro del viewport del lienzo
  const handleFocusClass = useCallback((classId: string, zoomLevel?: number) => {
    const target = diagram.classes.find(c => c.id === classId);
    if (!target || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const pos = target.position || { x: 100, y: 100 };
    const dims = nodeDimensionsRef.current.get(classId) || { w: 330, h: 200 };
    const targetZoom = zoomLevel ?? Math.max(0.75, Math.min(1.15, zoomRef.current));

    const centerX = pos.x + dims.w / 2;
    const centerY = pos.y + dims.h / 2;

    const newPanX = Math.round(rect.width / 2 - centerX * targetZoom);
    const newPanY = Math.round(rect.height / 2 - centerY * targetZoom);

    setZoom(targetZoom);
    zoomRef.current = targetZoom;
    setPan({ x: newPanX, y: newPanY });
    panRef.current = { x: newPanX, y: newPanY };

    onSelectClass(classId);
    setSelectedClassIds(new Set([classId]));

    setFocusedClassPulseId(classId);
    setTimeout(() => {
      setFocusedClassPulseId(prev => (prev === classId ? null : prev));
    }, 2400);
  }, [diagram.classes, onSelectClass, setSelectedClassIds]);

  useEffect(() => {
    if (focusTarget && focusTarget.classId) {
      handleFocusClass(focusTarget.classId);
    }
  }, [focusTarget, handleFocusClass]);

  useEffect(() => { selectedRelationIdRef.current = selectedRelationId; }, [selectedRelationId]);
  useEffect(() => { selectedClassIdRef.current = selectedClassId; }, [selectedClassId]);
  useEffect(() => { editingClassIdRef.current = editingClassId; }, [editingClassId]);

  // Triggers externos desde la paleta vertical
  useEffect(() => {
    if (openNewClassTrigger) setShowNewClassModal(true);
  }, [openNewClassTrigger]);

  useEffect(() => {
    if (openTemplatesTrigger) setShowTemplatesModal(true);
  }, [openTemplatesTrigger]);

  useEffect(() => {
    if (openConnectTrigger) {
      setIsRelationMode(true);
      if (selectedClassId) {
        setConnectingSourceId(selectedClassId);
      } else {
        setConnectingSourceId(null);
      }
    }
  }, [openConnectTrigger, selectedClassId]);

  useEffect(() => {
    if (openAutoOrganizeTrigger) handleAutoOrganize();
  }, [openAutoOrganizeTrigger]);

  // Helper unificado para eliminar relaciones de forma segura (con callback o directo al modelo)
  const handleDeleteRelationSafe = (relationId: string) => {
    if (onDeleteRelation) {
      onDeleteRelation(relationId);
    } else {
      onUpdateDiagram({
        ...diagram,
        relations: diagram.relations.filter(r => r.id !== relationId),
        updatedAt: new Date().toISOString()
      });
    }
    if (selectedRelationIdRef.current === relationId || selectedRelationId === relationId) {
      setSelectedRelationId(null);
      selectedRelationIdRef.current = null;
    }
  };

  // Tracks when mouse is over a UI overlay panel (Toolbox, etc.) so canvas wheel zoom doesn't interfere
  const isMouseOverUiPanel = useRef<boolean>(false);

  // Color picker popover state
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);

  // Modales interactivos de personalizaciÃ³n arquitectÃ³nica manual (UML 2.5 / 3FN)
  const [decomposerModalData, setDecomposerModalData] = useState<{ srcClass: ClaseUml; tgtClass: ClaseUml; relIdToRemove?: string } | null>(null);
  const [extractSuperclassClasses, setExtractSuperclassClasses] = useState<ClaseUml[] | null>(null);

  // Cursores de colaboradores remotos en vivo (CU-03 Â· STOMP)
  // Ãšnicamente se muestran los cursores de compaÃ±eros REALES transmitidos por WebSocket (nunca el propio)
  const activeRemoteCursors = useMemo(() => {
    return (remoteCursors || []).filter(c => c.id !== session.currentUser?.id);
  }, [remoteCursors, session.currentUser?.id]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [ghostPosition,setGhostPosition] = useState<{id:string;x:number;y:number}|null>(null);
  const ghostCleanup=useRef<(()=>void)|null>(null);
  useEffect(()=>()=>ghostCleanup.current?.(),[]);
  useEffect(()=>{setGhostPosition(null);},[proposalDraft]);
  const previewKey=proposalDraft?.classes.map(c=>c.id).join('|') || '';
  const ghostIds=new Set(proposalDraft?.classes.map(c=>c.id) || []);
  const ghostRelationIds=new Set(proposalDraft?.relations.map(r=>r.id) || []);
  const onGhostMouseDown=(event:React.MouseEvent,cls:ClaseUml)=>{
    event.stopPropagation(); onSelectClass(null);setSelectedClassIds(new Set());setSelectedRelationId(null);onInspectDraft?.(cls.id);
    if(!onDraftMove || event.button!==0)return;
    event.preventDefault(); ghostCleanup.current?.();
    const origin=cls.position || {x:0,y:0}; const start={x:event.clientX,y:event.clientY}; let position=origin;
    const move=(e:MouseEvent)=>{position={x:Math.max(0,origin.x+(e.clientX-start.x)/zoom),y:Math.max(0,origin.y+(e.clientY-start.y)/zoom)};setGhostPosition({id:cls.id,...position});};
    const cleanup=()=>{window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up);};
    const up=()=>{cleanup();onDraftMove(cls.id,position);};
    ghostCleanup.current=cleanup; window.addEventListener('mousemove',move);window.addEventListener('mouseup',up,{once:true});
  };

  // --- Optimized drag/pan with requestAnimationFrame & Grid Snapping ---
  const frameRef = useRef<number | null>(null);
  const lastMoveRef = useRef<{ clientX: number; clientY: number; left: number; top: number } | null>(null);
  const draggingClassIdRef = useRef<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const dragPosRef = useRef<{ x: number; y: number } | null>(null);
  // Cooldown para evitar que el evento mousedown fantasma tras un drop inicie un paneo no deseado
  const lastDropTimeRef = useRef<number>(0);

  // ColaboraciÃ³n en vivo (CU-03): throttle para publicar el diagrama DURANTE el arrastre
  const lastLivePublishRef = useRef<number>(0);

  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Refs sincronizados para callbacks de atajos de teclado sin stale-closures
  const onUndoRef = useRef(onUndo);
  const onRedoRef = useRef(onRedo);
  const onSaveShortcutRef = useRef(onSaveShortcut);
  const onOpenShortcutsModalRef = useRef(onOpenShortcutsModal);
  const onCopyClassRef = useRef(onCopyClass);
  const onPasteClassRef = useRef(onPasteClass);
  const onDuplicateClassRef = useRef(onDuplicateClass);
  const diagramStateRef = useRef(diagram);
  const onUpdateDiagramRef = useRef(onUpdateDiagram);

  useEffect(() => { onUndoRef.current = onUndo; }, [onUndo]);
  useEffect(() => { onRedoRef.current = onRedo; }, [onRedo]);
  useEffect(() => { onSaveShortcutRef.current = onSaveShortcut; }, [onSaveShortcut]);
  useEffect(() => { onOpenShortcutsModalRef.current = onOpenShortcutsModal; }, [onOpenShortcutsModal]);
  useEffect(() => { onCopyClassRef.current = onCopyClass; }, [onCopyClass]);
  useEffect(() => { onPasteClassRef.current = onPasteClass; }, [onPasteClass]);
  useEffect(() => { onDuplicateClassRef.current = onDuplicateClass; }, [onDuplicateClass]);
  useEffect(() => { diagramStateRef.current = diagram; }, [diagram]);
  useEffect(() => { onUpdateDiagramRef.current = onUpdateDiagram; }, [onUpdateDiagram]);

  // Sincronizar ref de modo rueda de ratÃ³n ('zoom' | 'pan') y persistir en localStorage
  const wheelZoomModeRef = useRef(wheelZoomMode);
  useEffect(() => {
    wheelZoomModeRef.current = wheelZoomMode;
    try {
      localStorage.setItem('archai_wheel_zoom_mode', wheelZoomMode);
    } catch {
      // ignore
    }
  }, [wheelZoomMode]);

  // Zoom centrado en el viewport (para dock + / - y atajos Ctrl + / -)
  const handleZoomStep = (delta: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const currentZoom = zoomRef.current;
    const currentPan = panRef.current;

    const nextZoom = Math.max(0.05, Math.min(4.0, Number((currentZoom + delta).toFixed(2))));
    if (nextZoom === currentZoom) return;

    const worldX = (centerX - currentPan.x) / currentZoom;
    const worldY = (centerY - currentPan.y) / currentZoom;

    const nextPanX = Math.round(centerX - worldX * nextZoom);
    const nextPanY = Math.round(centerY - worldY * nextZoom);

    zoomRef.current = nextZoom;
    panRef.current = { x: nextPanX, y: nextPanY };

    setZoom(nextZoom);
    setPan({ x: nextPanX, y: nextPanY });
  };

  // Atajo de teclado: Mantener barra espaciadora para paneo ultra fluido estilo Figma/Miro
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const isSpacePressedRef = useRef<boolean>(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement)?.tagName;
      const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag);

      // 1. Guardar: Ctrl+S funciona SIEMPRE (incluso con foco en un input) y previene guardar HTML del navegador
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        onSaveShortcutRef.current?.();
        return;
      }

      // Si el usuario estÃ¡ escribiendo texto en un input/textarea, no interceptar atajos de ediciÃ³n de nodos
      if (isInputFocused) return;

      // 2. Deshacer: Ctrl+Z (sin Shift)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndoRef.current?.();
        return;
      }

      // 3. Rehacer: Ctrl+Y o Ctrl+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        onRedoRef.current?.();
        return;
      }

      // 4. Copiar Clase: Ctrl+C
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        onCopyClassRef.current?.();
        return;
      }

      // 5. Pegar Clase: Ctrl+V
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        onPasteClassRef.current?.();
        return;
      }

      // 6. Duplicar Clase: Ctrl+D
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        onDuplicateClassRef.current?.();
        return;
      }

      // 7. Zoom: Ctrl + + / =
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleZoomStep(0.15);
        return;
      }

      // 8. Zoom: Ctrl + -
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        handleZoomStep(-0.15);
        return;
      }

      // 9. Zoom: Ctrl + 0 (Reset al 100%)
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
        return;
      }

      // 9b. Alternar modo de rueda del ratÃ³n (Zoom continuo vs Desplazamiento): Alt + M
      if (e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setWheelZoomMode(m => m === 'zoom' ? 'pan' : 'zoom');
        return;
      }

      // 10. Ayuda de atajos: F1 o ?
      if (e.key === 'F1' || e.key === '?') {
        e.preventDefault();
        onOpenShortcutsModalRef.current?.();
        return;
      }

      // 10b. Seleccionar todo el diagrama: Ctrl + A o Cmd + A
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
        if (!isInput && !editingClassIdRef.current) {
          e.preventDefault();
          const allIds = new Set(diagramStateRef.current.classes.map(c => c.id));
          setSelectedClassIds(allIds);
          if (allIds.size > 0) {
            onSelectClass(diagramStateRef.current.classes[0].id);
          }
          return;
        }
      }

      // 11. Barra espaciadora para paneo ultra fluido estilo Figma/Miro
      if (e.code === 'Space' && !isSpacePressedRef.current) {
        isSpacePressedRef.current = true;
        setIsSpacePressed(true);
      }

      // 12. Micro-desplazamiento con teclas de flecha (Nudge de 8px o 40px con Shift)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && (selectedClassIdsRef.current.size > 0 || selectedClassIdRef.current) && !editingClassIdRef.current) {
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
        if (isInput) return;

        e.preventDefault();
        const step = e.shiftKey ? 40 : 8;
        const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
        const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
        const currentDiagram = diagramStateRef.current;
        const activeIds = selectedClassIdsRef.current.size > 0
          ? selectedClassIdsRef.current
          : (selectedClassIdRef.current ? new Set([selectedClassIdRef.current]) : new Set<string>());

        onUpdateDiagramRef.current({
          ...currentDiagram,
          classes: currentDiagram.classes.map(c => {
            if (activeIds.has(c.id)) {
              const currentPos = c.position || { x: 100, y: 100 };
              return {
                ...c,
                position: {
                  x: Math.max(0, currentPos.x + dx),
                  y: Math.max(0, currentPos.y + dy)
                }
              };
            }
            return c;
          }),
          updatedAt: new Date().toISOString()
        });
        return;
      }

      // 13. Suprimir / Retroceso para eliminar la relación o clases seleccionadas
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
        if (isInput || editingClassIdRef.current) return;

        if (selectedRelationIdRef.current) {
          e.preventDefault();
          handleDeleteRelationSafe(selectedRelationIdRef.current);
        } else if (selectedClassIdsRef.current.size > 1) {
          e.preventDefault();
          const toDelete = selectedClassIdsRef.current;
          const currentDiagram = diagramStateRef.current;
          onUpdateDiagramRef.current({
            ...currentDiagram,
            classes: currentDiagram.classes.filter(c => !toDelete.has(c.id)),
            relations: currentDiagram.relations.filter(r => !toDelete.has(r.sourceClassId) && !toDelete.has(r.targetClassId)),
            updatedAt: new Date().toISOString()
          });
          setSelectedClassIds(new Set());
          onSelectClass(null);
        } else if (selectedClassIdRef.current) {
          e.preventDefault();
          onDeleteClass(selectedClassIdRef.current);
          setSelectedClassIds(new Set());
        }
      } else if (e.key === 'Escape') {
        setSelectedClassIds(new Set());
        onSelectClass(null);
        setSelectedRelationId(null);
        selectedRelationIdRef.current = null;
        setConnectingSourceId(null);
        setConnectingMousePos(null);
        setIsRelationMode(false);
        setCardFastLinkerClassId(null);
        setAddingAttrClassId(null);
        setAddingMethodClassId(null);
        setEditingClassId(null);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Auto-pan continuo al arrastrar una tabla cerca del borde (elimina por completo el "muro")
  const autoPanRafRef = useRef<number | null>(null);
  const autoPanVelocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });

  const stopAutoPanLoop = () => {
    if (autoPanRafRef.current !== null) {
      cancelAnimationFrame(autoPanRafRef.current);
      autoPanRafRef.current = null;
    }
    autoPanVelocityRef.current = { vx: 0, vy: 0 };
  };

  const startAutoPanLoop = () => {
    if (autoPanRafRef.current !== null) return;

    const tick = () => {
      if (!draggingClassIdRef.current) {
        stopAutoPanLoop();
        return;
      }

      const { vx, vy } = autoPanVelocityRef.current;
      if (vx !== 0 || vy !== 0) {
        // Desplazar el lienzo suavemente en la direcciÃ³n del borde
        const nextPanX = panRef.current.x - vx;
        const nextPanY = panRef.current.y - vy;
        panRef.current = { x: nextPanX, y: nextPanY };
        setPan({ x: nextPanX, y: nextPanY });

        // Actualizar la posiciÃ³n de la tabla en tiempo real en coordenadas de mundo durante el auto-pan
        if (lastMoveRef.current) {
          const data = lastMoveRef.current;
          const mX = data.clientX - data.left;
          const mY = data.clientY - data.top;
          const currentWorldMouseX = (mX - nextPanX) / zoomRef.current;
          const currentWorldMouseY = (mY - nextPanY) / zoomRef.current;
          const currentX = currentWorldMouseX - dragOffsetRef.current.x;
          const currentY = currentWorldMouseY - dragOffsetRef.current.y;
          const SNAP = 8;
          const next = {
            x: Math.round(currentX / SNAP) * SNAP,
            y: Math.round(currentY / SNAP) * SNAP
          };
          dragPosRef.current = next;
          setDragPos(next);
        }
      }

      autoPanRafRef.current = requestAnimationFrame(tick);
    };

    autoPanRafRef.current = requestAnimationFrame(tick);
  };

  // Local drag position (committed to the diagram on mouse up)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  // Handle Dragging of UML Class Cards
  const handleClassMouseDown = (e: React.MouseEvent, cls: ClaseUml) => {
    // Solo permitir iniciar arrastre con el botón izquierdo del ratón
    if (e.button !== 0) return;
    e.stopPropagation();

    // Si estamos en modo de conexión
    if (isRelationMode || connectingSourceId) {
      if (!connectingSourceId) {
        // Primer clic: definir clase origen
        setConnectingSourceId(cls.id);
        return;
      }
      if (connectingSourceId !== cls.id) {
        handleCompleteRelation(connectingSourceId, cls.id);
      }
      setConnectingSourceId(null);
      setConnectingMousePos(null);
      setIsRelationMode(false);
      return;
    }

    // Deseleccionar cualquier relación activa al interactuar con una tabla
    setSelectedRelationId(null);

    // Lógica de selección múltiple (Shift + clic / Ctrl + clic)
    const isShiftOrCtrl = e.shiftKey || e.ctrlKey || e.metaKey;
    let nextSelected = new Set(selectedClassIdsRef.current);

    if (isShiftOrCtrl) {
      if (nextSelected.has(cls.id)) {
        nextSelected.delete(cls.id);
      } else {
        nextSelected.add(cls.id);
      }
      setSelectedClassIds(nextSelected);
      onSelectClass(nextSelected.size > 0 ? (nextSelected.has(cls.id) ? cls.id : Array.from(nextSelected)[0]) : null);
    } else {
      // Si la clase ya estaba en la selección múltiple, preservamos el grupo para arrastrarlo junto
      if (!nextSelected.has(cls.id)) {
        nextSelected = new Set([cls.id]);
        setSelectedClassIds(nextSelected);
        onSelectClass(cls.id);
      } else {
        onSelectClass(cls.id);
      }
    }

    // Si el usuario no tiene permisos de edición (ej. Observador), no permitir arrastrar
    if (userPermissions && !userPermissions.canEditDiagram) {
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldMouseX = (mouseX - panRef.current.x) / zoomRef.current;
    const worldMouseY = (mouseY - panRef.current.y) / zoomRef.current;

    const pos = cls.position || { x: 100, y: 100 };
    const offsetX = worldMouseX - pos.x;
    const offsetY = worldMouseY - pos.y;
    setDraggingClassId(cls.id);
    draggingClassIdRef.current = cls.id;
    dragOffsetRef.current = { x: offsetX, y: offsetY };
    setDragPos(null);
    dragPosRef.current = null;

    // Si hay varias clases seleccionadas que incluyen a esta, capturar las posiciones iniciales de todas
    if (nextSelected.size > 1 && nextSelected.has(cls.id)) {
      const initialMap = new Map<string, { x: number; y: number }>();
      diagram.classes.forEach(c => {
        if (nextSelected.has(c.id)) {
          initialMap.set(c.id, c.position || { x: 100, y: 100 });
        }
      });
      multiDragInitialPositionsRef.current = initialMap;
      multiDragDeltaRef.current = { deltaX: 0, deltaY: 0 };
      setMultiDragDelta({ deltaX: 0, deltaY: 0 });
    } else {
      multiDragInitialPositionsRef.current.clear();
      multiDragDeltaRef.current = null;
      setMultiDragDelta(null);
    }

    // CU-03 · Notificar inicio de arrastre para que el padre no castigue la nube con guardados intermedios
    onDragStateChange?.(true);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Ignorar mousedown espurio/fantasma generado por el navegador tras soltar (drop) un elemento
    if (Date.now() - lastDropTimeRef.current < 400) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (e.button === 0 || e.button === 1) {
      const target = e.target as HTMLElement;
      const isInteractive = Boolean(
        target.closest('.uml-class-node') ||
        target.closest('.uml-relation-interactive') ||
        target.closest('.relation-action-bar') ||
        target.closest('.glass-dock') ||
        target.closest('.glass-flyout') ||
        target.closest('.glass-command-dock-toggle') ||
        target.closest('.glass-toolbox-panel') ||
        target.closest('.glass-toolbox-minimized-trigger') ||
        target.closest('.collaborative-cursor') ||
        target.closest('.fast-linker-popover') ||
        target.closest('.color-picker-popover') ||
        target.closest('button') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('textarea')
      );

      // Si es selección por recuadro (Shift + clic o herramienta "select" en zona vacía)
      if (!isInteractive && e.button === 0 && (e.shiftKey || canvasTool === 'select')) {
        const rect = canvasRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - panRef.current.x) / zoomRef.current;
        const worldY = (mouseY - panRef.current.y) / zoomRef.current;

        isMarqueeSelectingRef.current = true;
        marqueeBoxRef.current = {
          startX: worldX,
          startY: worldY,
          currentX: worldX,
          currentY: worldY
        };
        setMarqueeBox(marqueeBoxRef.current);
        if (!e.shiftKey) {
          setSelectedClassIds(new Set());
          onSelectClass(null);
        }
        return;
      }

      // Si es botón central, barra espaciadora, o clic en cualquier zona no interactiva del lienzo
      if (e.button === 1 || isSpacePressedRef.current || !isInteractive) {
        if (e.button === 1 || isSpacePressedRef.current) {
          e.preventDefault();
        }
        onSelectClass(null);
        setSelectedClassIds(new Set());
        setSelectedRelationId(null);
        setConnectingSourceId(null);
        setConnectingMousePos(null);
        setIsRelationMode(false);
        isPanningRef.current = true;
        setIsPanning(true);
        const startX = e.clientX - panRef.current.x;
        const startY = e.clientY - panRef.current.y;
        panStartRef.current = { x: startX, y: startY };
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    // Auto-recuperaciÃ³n ante desincronizaciÃ³n de eventos de ratÃ³n:
    // Si ningÃºn botÃ³n fÃ­sico del ratÃ³n estÃ¡ presionado (e.buttons === 0),
    // es IMPOSIBLE que el usuario estÃ© arrastrando o paneando activamente.
    // Si quedaron banderas residuales por drops o pÃ©rdida de foco, cancelamos de inmediato.
    if (e.buttons === 0) {
      if (isPanningRef.current || draggingClassIdRef.current) {
        handleMouseUp();
        return;
      }
    }

    const rect = canvasRef.current.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // CU-03 Â· Emitir coordenadas del ratÃ³n en tiempo real al broker STOMP para compaÃ±eros remotos
    if (onCursorMove) {
      const worldX = Math.round((mouseX - panRef.current.x) / zoomRef.current);
      const worldY = Math.round((mouseY - panRef.current.y) / zoomRef.current);
      onCursorMove({ x: worldX, y: worldY });
    }

    // Seguimiento de cursor para la línea elástica de conexión activa (Rubber-band)
    if (connectingSourceId) {
      const worldX = Math.round((mouseX - panRef.current.x) / zoomRef.current);
      const worldY = Math.round((mouseY - panRef.current.y) / zoomRef.current);
      setConnectingMousePos({ x: worldX, y: worldY });
    }

    // Seguimiento del recuadro de selección Marquee
    if (isMarqueeSelectingRef.current && marqueeBoxRef.current) {
      const worldX = Math.round((mouseX - panRef.current.x) / zoomRef.current);
      const worldY = Math.round((mouseY - panRef.current.y) / zoomRef.current);
      marqueeBoxRef.current = {
        ...marqueeBoxRef.current,
        currentX: worldX,
        currentY: worldY
      };
      setMarqueeBox({ ...marqueeBoxRef.current });
      return;
    }

    // Buffer dragging/panning to requestAnimationFrame
    if (draggingClassIdRef.current) {
      lastMoveRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        left: rect.left,
        top: rect.top
      };

      // Auto-pan continuo al acercarse a los bordes de la pantalla (elimina por completo el "muro")
      const EDGE_ZONE = 90;
      const MAX_SPEED = 32;
      let vx = 0;
      let vy = 0;

      if (mouseX < EDGE_ZONE) {
        vx = -Math.round(Math.pow((EDGE_ZONE - mouseX) / EDGE_ZONE, 1.2) * MAX_SPEED);
      } else if (mouseX > rect.width - EDGE_ZONE) {
        vx = Math.round(Math.pow((mouseX - (rect.width - EDGE_ZONE)) / EDGE_ZONE, 1.2) * MAX_SPEED);
      }

      if (mouseY < EDGE_ZONE) {
        vy = -Math.round(Math.pow((EDGE_ZONE - mouseY) / EDGE_ZONE, 1.2) * MAX_SPEED);
      } else if (mouseY > rect.height - EDGE_ZONE) {
        vy = Math.round(Math.pow((mouseY - (rect.height - EDGE_ZONE)) / EDGE_ZONE, 1.2) * MAX_SPEED);
      }

      autoPanVelocityRef.current = { vx, vy };
      if (vx !== 0 || vy !== 0) {
        startAutoPanLoop();
      } else {
        stopAutoPanLoop();
      }

      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const data = lastMoveRef.current;
        if (!data || !draggingClassIdRef.current) return;

        const mX = data.clientX - data.left;
        const mY = data.clientY - data.top;
        const currentWorldMouseX = (mX - panRef.current.x) / zoomRef.current;
        const currentWorldMouseY = (mY - panRef.current.y) / zoomRef.current;

        const currentX = currentWorldMouseX - dragOffsetRef.current.x;
        const currentY = currentWorldMouseY - dragOffsetRef.current.y;
        
        // AlineaciÃ³n limpia a grilla de 8px (Snap to Grid)
        const SNAP = 8;
        const nextX = Math.round(currentX / SNAP) * SNAP;
        const nextY = Math.round(currentY / SNAP) * SNAP;

        const next = { x: nextX, y: nextY };
        dragPosRef.current = next;
        setDragPos(next);

        const targetId = draggingClassIdRef.current;

        // Coordinación de arrastre grupal a 60 FPS en selección múltiple
        if (targetId && multiDragInitialPositionsRef.current && multiDragInitialPositionsRef.current.size > 1) {
          const origin = multiDragInitialPositionsRef.current.get(targetId) || { x: 0, y: 0 };
          const deltaX = nextX - origin.x;
          const deltaY = nextY - origin.y;
          multiDragDeltaRef.current = { deltaX, deltaY };
          setMultiDragDelta({ deltaX, deltaY });
        }

        // CU-03 · Colaboración fluida en tiempo real: transmitir coordenadas del nodo a ~33 FPS (~30ms)
        const ahora = Date.now();
        if (targetId && onNodeDrag && ahora - lastLivePublishRef.current >= 30) {
          lastLivePublishRef.current = ahora;
          onNodeDrag(targetId, next);
        } else if (onLiveDragUpdate && ahora - lastLivePublishRef.current >= 150) {
          lastLivePublishRef.current = ahora;
          if (targetId) {
            onLiveDragUpdate({
              ...diagram,
              classes: diagram.classes.map(c => c.id === targetId ? { ...c, position: next } : c),
              updatedAt: new Date().toISOString()
            });
          }
        }
      });
    } else if (isPanningRef.current) {
      lastMoveRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        left: rect.left,
        top: rect.top
      };

      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const data = lastMoveRef.current;
        if (!data || !isPanningRef.current) return;

        const nextX = data.clientX - panStartRef.current.x;
        const nextY = data.clientY - panStartRef.current.y;
        panRef.current = { x: nextX, y: nextY };
        setPan({
          x: nextX,
          y: nextY
        });
      });
    }
  };

  const handleMouseEnter = () => {};

  const handleMouseUp = () => {
    stopAutoPanLoop();
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    // Finalizar selección por recuadro (Marquee Box)
    if (isMarqueeSelectingRef.current && marqueeBoxRef.current) {
      isMarqueeSelectingRef.current = false;
      const box = marqueeBoxRef.current;
      marqueeBoxRef.current = null;
      setMarqueeBox(null);

      const minX = Math.min(box.startX, box.currentX);
      const maxX = Math.max(box.startX, box.currentX);
      const minY = Math.min(box.startY, box.currentY);
      const maxY = Math.max(box.startY, box.currentY);

      if ((maxX - minX) > 8 || (maxY - minY) > 8) {
        const newlySelected = new Set<string>();
        diagram.classes.forEach(cls => {
          const pos = cls.position || { x: 100, y: 100 };
          const dims = nodeDimensionsRef.current.get(cls.id);
          const w = dims?.w && dims.w > 80 ? dims.w : 330;
          const h = dims?.h && dims.h > 80 ? dims.h : 200;
          if (pos.x + w >= minX && pos.x <= maxX && pos.y + h >= minY && pos.y <= maxY) {
            newlySelected.add(cls.id);
          }
        });

        setSelectedClassIds(newlySelected);
        if (newlySelected.size > 0) {
          onSelectClass(Array.from(newlySelected)[0]);
        } else {
          onSelectClass(null);
        }
      }
      return;
    }

    const targetClassId = draggingClassIdRef.current || draggingClassId;
    let finalPos = dragPosRef.current;

    // Si había un movimiento en buffer pendiente de rAF, computar la posición exacta final ahora en coordenadas de mundo
    if (!finalPos && lastMoveRef.current && targetClassId) {
      const data = lastMoveRef.current;
      const mX = data.clientX - data.left;
      const mY = data.clientY - data.top;
      const currentWorldMouseX = (mX - panRef.current.x) / zoomRef.current;
      const currentWorldMouseY = (mY - panRef.current.y) / zoomRef.current;
      const currentX = currentWorldMouseX - dragOffsetRef.current.x;
      const currentY = currentWorldMouseY - dragOffsetRef.current.y;
      const SNAP = 8;
      finalPos = {
        x: Math.round(currentX / SNAP) * SNAP,
        y: Math.round(currentY / SNAP) * SNAP
      };
    }

    if (targetClassId && finalPos) {
      const SNAP = 8;
      let updatedClasses = diagram.classes;

      if (selectedClassIdsRef.current.size > 1 && selectedClassIdsRef.current.has(targetClassId) && multiDragDeltaRef.current) {
        const { deltaX, deltaY } = multiDragDeltaRef.current;
        updatedClasses = diagram.classes.map(c => {
          if (selectedClassIdsRef.current.has(c.id)) {
            const origin = multiDragInitialPositionsRef.current.get(c.id) || c.position || { x: 100, y: 100 };
            return {
              ...c,
              position: {
                x: Math.round((origin.x + deltaX) / SNAP) * SNAP,
                y: Math.round((origin.y + deltaY) / SNAP) * SNAP
              }
            };
          }
          return c;
        });
      } else {
        updatedClasses = diagram.classes.map(c => {
          if (c.id === targetClassId) {
            return {
              ...c,
              position: { x: finalPos.x, y: finalPos.y }
            };
          }
          return c;
        });
      }

      onUpdateDiagram({
        ...diagram,
        classes: updatedClasses,
        updatedAt: new Date().toISOString()
      });
    }

    multiDragInitialPositionsRef.current.clear();
    multiDragDeltaRef.current = null;
    setMultiDragDelta(null);

    isPanningRef.current = false;
    setIsPanning(false);
    draggingClassIdRef.current = null;
    lastMoveRef.current = null;
    dragPosRef.current = null;
    setDraggingClassId(null);
    setDragPos(null);
    // CU-03 · Fin del arrastre: restablecer el guard de nube del padre para que el commit final se respalde
    onDragStateChange?.(false);
  };

  // Captura global de mousemove y mouseup para arrastre ultra fluido y continuo sin perder foco
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!draggingClassIdRef.current && !isPanningRef.current && !isMarqueeSelectingRef.current) return;
      if (e.buttons === 0) {
        handleMouseUp();
        return;
      }
      handleMouseMove(e as unknown as React.MouseEvent);
    };
    const handleGlobalMouseUp = () => {
      if (draggingClassIdRef.current || isPanningRef.current || isMarqueeSelectingRef.current) {
        handleMouseUp();
      }
    };
    const handleGlobalBlur = () => {
      if (draggingClassIdRef.current || isPanningRef.current || isMarqueeSelectingRef.current) {
        handleMouseUp();
      }
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('blur', handleGlobalBlur);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('blur', handleGlobalBlur);
    };
  }, [diagram, draggingClassId]);

  const handleMouseLeave = () => {};

  // Doble clic en cualquier zona libre del lienzo para centrar y auto-ajustar inmediatamente a pantalla
  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractive = Boolean(
      target.closest('.uml-class-node') ||
      target.closest('.glass-dock') ||
      target.closest('.fast-linker-popover') ||
      target.closest('.color-picker-popover') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('textarea')
    );
    if (!isInteractive) {
      handleFitToScreen();
    }
  };

  // Control dual de rueda de ratÃ³n:
  // - Modo 'zoom' (predeterminado): La rueda hace zoom focal sobre el cursor. Shift+rueda desplaza horizontal. Alt+rueda desplaza vertical.
  // - Modo 'pan': La rueda desplaza verticalmente y horizontalmente el lienzo. Ctrl+rueda (o gesto trackpad pinch) hace zoom focal continuo.
  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // Si el cursor estÃ¡ sobre un panel flotante (Toolbox, dock, etc.),
      // dejar que el navegador haga scroll nativo dentro del panel
      // en lugar de interactuar con el lienzo.
      const objetivo = e.target as HTMLElement | null;
      const sobrePanelUi =
        isMouseOverUiPanel.current ||
        (objetivo != null &&
          typeof objetivo.closest === 'function' &&
          objetivo.closest('.glass-toolbox-panel, .glass-command-dock, .glass-command-dock-toggle, .glass-flyout, .glass-panel, .modal-backdrop'));
      if (sobrePanelUi) return;

      e.preventDefault();

      // Desplazamiento horizontal si se mantiene presionada la tecla Shift
      if (e.shiftKey) {
        const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        const nextPanX = Math.round(panRef.current.x - delta * 0.85);
        panRef.current = { ...panRef.current, x: nextPanX };
        setPan(prev => ({
          ...prev,
          x: nextPanX
        }));
        return;
      }

      const isPinchOrCtrl = e.ctrlKey || e.metaKey;
      const isZoomMode = wheelZoomModeRef.current === 'zoom';

      // En modo 'zoom', Alt + Rueda permite desplazamiento vertical directo sin cambiar de modo
      if (isZoomMode && e.altKey) {
        const nextPanY = Math.round(panRef.current.y - e.deltaY * 0.85);
        panRef.current = { ...panRef.current, y: nextPanY };
        setPan(prev => ({
          ...prev,
          y: nextPanY
        }));
        return;
      }

      // Determinar si esta interacciÃ³n debe hacer zoom o desplazamiento (pan):
      // - Si estÃ¡ en modo 'zoom': Hace zoom continuo focal sobre el cursor.
      // - Si estÃ¡ en modo 'pan': Solo hace zoom si se presiona Ctrl/Meta (o gesto pinch de trackpad).
      const shouldZoom = isZoomMode || isPinchOrCtrl;

      if (!shouldZoom) {
        // MODO DESPLAZAMIENTO (PAN): La rueda desplaza verticalmente (y horizontalmente si hay deltaX)
        const deltaX = e.deltaX || 0;
        const deltaY = e.deltaY || 0;
        const nextPanX = Math.round(panRef.current.x - deltaX * 0.85);
        const nextPanY = Math.round(panRef.current.y - deltaY * 0.85);
        panRef.current = { x: nextPanX, y: nextPanY };
        setPan({ x: nextPanX, y: nextPanY });
        return;
      }

      // MODO ZOOM: Zoom fluido focalizado exactamente en las coordenadas del cursor (Miro/Figma style)
      const rect = canvasEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;

      // Coordenadas del mundo en el punto exacto bajo el cursor
      const worldX = (mouseX - currentPan.x) / currentZoom;
      const worldY = (mouseY - currentPan.y) / currentZoom;

      // Factor de zoom fluido y continuo (soporta rueda de ratÃ³n estÃ¡ndar o trackpad pinch)
      let zoomFactor: number;
      if (Math.abs(e.deltaY) < 25) {
        zoomFactor = 1 - e.deltaY * 0.006;
      } else {
        zoomFactor = e.deltaY < 0 ? 1.10 : 0.90;
      }

      // Rango masivo desbloqueado de 0.05x (visiÃ³n global de 100k px) a 4.0x (ultra-detalle)
      const nextZoom = Math.max(0.05, Math.min(4.0, Number((currentZoom * zoomFactor).toFixed(3))));
      if (nextZoom === currentZoom) return;

      // Mantener fija en pantalla la posiciÃ³n del elemento apuntado por el cursor
      const nextPanX = Math.round(mouseX - worldX * nextZoom);
      const nextPanY = Math.round(mouseY - worldY * nextZoom);

      zoomRef.current = nextZoom;
      panRef.current = { x: nextPanX, y: nextPanY };

      setZoom(nextZoom);
      setPan({ x: nextPanX, y: nextPanY });
    };

    // Soporte táctil nativo (Tablets, iPads, laptops touch y móviles): Paneo fluido y Zoom con Pinzas (Pinch-to-zoom)
    const touchState = {
      mode: 'none' as 'none' | 'pan' | 'pinch',
      startX: 0,
      startY: 0,
      startPanX: 0,
      startPanY: 0,
      initialDist: 0,
      initialZoom: 1,
      worldFocalX: 0,
      worldFocalY: 0,
    };
    let touchRaf: number | null = null;

    const handleNativeTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target != null &&
        typeof target.closest === 'function' &&
        target.closest(
          '.glass-toolbox-panel, .glass-command-dock, .glass-command-dock-toggle, .glass-flyout, .glass-panel, .modal-backdrop, input, textarea, button, form'
        )
      ) {
        return;
      }

      if (e.touches.length === 1) {
        touchState.mode = 'pan';
        touchState.startX = e.touches[0].clientX;
        touchState.startY = e.touches[0].clientY;
        touchState.startPanX = panRef.current.x;
        touchState.startPanY = panRef.current.y;
      } else if (e.touches.length === 2) {
        e.preventDefault();
        touchState.mode = 'pinch';
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        touchState.initialDist = Math.max(dist, 10);
        touchState.initialZoom = zoomRef.current;

        const rect = canvasEl.getBoundingClientRect();
        const midX = (t0.clientX + t1.clientX) / 2 - rect.left;
        const midY = (t0.clientY + t1.clientY) / 2 - rect.top;

        touchState.worldFocalX = (midX - panRef.current.x) / zoomRef.current;
        touchState.worldFocalY = (midY - panRef.current.y) / zoomRef.current;
      }
    };

    const handleNativeTouchMove = (e: TouchEvent) => {
      if (touchState.mode === 'none') return;

      if (touchState.mode === 'pan' && e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchState.startX;
        const dy = e.touches[0].clientY - touchState.startY;

        if (Math.hypot(dx, dy) > 4) {
          e.preventDefault();
          const nextPanX = Math.round(touchState.startPanX + dx);
          const nextPanY = Math.round(touchState.startPanY + dy);
          panRef.current = { x: nextPanX, y: nextPanY };

          if (touchRaf === null) {
            touchRaf = requestAnimationFrame(() => {
              setPan({ x: panRef.current.x, y: panRef.current.y });
              touchRaf = null;
            });
          }
        }
      } else if (touchState.mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        const factor = dist / touchState.initialDist;

        const nextZoom = Math.max(
          0.05,
          Math.min(4.0, Number((touchState.initialZoom * factor).toFixed(3)))
        );
        if (nextZoom === zoomRef.current) return;

        const rect = canvasEl.getBoundingClientRect();
        const midX = (t0.clientX + t1.clientX) / 2 - rect.left;
        const midY = (t0.clientY + t1.clientY) / 2 - rect.top;

        const nextPanX = Math.round(midX - touchState.worldFocalX * nextZoom);
        const nextPanY = Math.round(midY - touchState.worldFocalY * nextZoom);

        zoomRef.current = nextZoom;
        panRef.current = { x: nextPanX, y: nextPanY };

        if (touchRaf === null) {
          touchRaf = requestAnimationFrame(() => {
            setZoom(zoomRef.current);
            setPan({ x: panRef.current.x, y: panRef.current.y });
            touchRaf = null;
          });
        }
      }
    };

    const handleNativeTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        touchState.mode = 'none';
        if (touchRaf !== null) {
          cancelAnimationFrame(touchRaf);
          touchRaf = null;
        }
      } else if (e.touches.length === 1 && touchState.mode === 'pinch') {
        touchState.mode = 'pan';
        touchState.startX = e.touches[0].clientX;
        touchState.startY = e.touches[0].clientY;
        touchState.startPanX = panRef.current.x;
        touchState.startPanY = panRef.current.y;
      }
    };

    canvasEl.addEventListener('wheel', handleNativeWheel, { passive: false });
    canvasEl.addEventListener('touchstart', handleNativeTouchStart, { passive: false });
    canvasEl.addEventListener('touchmove', handleNativeTouchMove, { passive: false });
    canvasEl.addEventListener('touchend', handleNativeTouchEnd, { passive: true });
    canvasEl.addEventListener('touchcancel', handleNativeTouchEnd, { passive: true });

    return () => {
      canvasEl.removeEventListener('wheel', handleNativeWheel);
      canvasEl.removeEventListener('touchstart', handleNativeTouchStart);
      canvasEl.removeEventListener('touchmove', handleNativeTouchMove);
      canvasEl.removeEventListener('touchend', handleNativeTouchEnd);
      canvasEl.removeEventListener('touchcancel', handleNativeTouchEnd);
      if (touchRaf !== null) {
        cancelAnimationFrame(touchRaf);
      }
    };
  }, []);

  // Submit new attribute
  const handleSaveAttribute = (e: React.FormEvent, classId: string) => {
    e.preventDefault();
    if (!attrName.trim()) return;

    const newAttr: AtributoUml = {
      id: 'attr-' + Date.now(),
      name: attrName.trim(),
      type: attrType,
      visibility: attrVis,
      isPrimaryKey: attrIsPk,
      isNullable: false
    };

    onAddAttribute(classId, newAttr);
    setAttrName('');
    setAttrIsPk(false);
    setAddingAttrClassId(null);
  };

  // 1-Click Attribute Preset Chip
  const handleAddAttributePreset = (classId: string, presetName: string, presetType: AtributoUml['type'], isPk = false) => {
    const newAttr: AtributoUml = {
      id: 'attr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name: presetName,
      type: presetType,
      visibility: '-',
      isPrimaryKey: isPk,
      isNullable: false
    };
    onAddAttribute(classId, newAttr);
  };

  // 1-Click 4 Audit Fields
  const handleAddAuditFields = (classId: string) => {
    const fields: { name: string; type: AtributoUml['type'] }[] = [
      { name: 'creadoEn', type: 'LocalDateTime' },
      { name: 'actualizadoEn', type: 'LocalDateTime' },
      { name: 'creadoPor', type: 'String' },
      { name: 'activo', type: 'Boolean' }
    ];
    fields.forEach((f, idx) => {
      setTimeout(() => {
        onAddAttribute(classId, {
          id: 'attr-audit-' + Date.now() + '-' + idx,
          name: f.name,
          type: f.type,
          visibility: '-',
          isPrimaryKey: false,
          isNullable: true
        });
      }, idx * 15);
    });
  };

  // â”€â”€â”€ DescomposiciÃ³n N:M en Clase Asociativa (UML 2.5 / 3FN) â”€â”€â”€
  const createIntermediateTableNM = (
    srcClass: ClaseUml,
    tgtClass: ClaseUml,
    existingRelIdToRemove?: string
  ) => {
    // Inferencia semÃ¡ntica universal mediante el motor de ontologÃ­as de dominio (9 dominios + universal)
    const sugerencia = inferirTablaIntermedia(srcClass, tgtClass, diagram.classes);

    const srcPos = srcClass.position || { x: 100, y: 100 };
    const tgtPos = tgtClass.position || { x: 500, y: 100 };
    const intermediatePos = {
      x: Math.round((srcPos.x + tgtPos.x) / 2),
      y: Math.max(srcPos.y, tgtPos.y) + 240
    };

    const intermediateClass: ClaseUml = {
      id: sugerencia.id,
      name: sugerencia.nombreClase,
      stereotype: 'AssociationClass',
      isAbstract: false,
      isInterface: false,
      position: intermediatePos,
      attributes: sugerencia.atributos,
      methods: sugerencia.metodos
    };

    // En UML 2.5 estÃ¡ndar, la relaciÃ³n de asociaciÃ³n entre las dos entidades principales (ej. Venta y Producto)
    // se conserva con multiplicidades '*' y '1..*', y se enlaza la Clase Asociativa mediante associationClassId
    // para trazar la lÃ­nea punteada reglamentaria.
    let updatedRelations: RelacionUml[];
    if (existingRelIdToRemove) {
      updatedRelations = diagram.relations.map(r => {
        if (r.id === existingRelIdToRemove) {
          return {
            ...r,
            type: 'ASSOCIATION_N_M' as const,
            sourceMultiplicity: r.sourceMultiplicity?.includes('*') ? r.sourceMultiplicity : '*',
            targetMultiplicity: r.targetMultiplicity?.includes('*') ? r.targetMultiplicity : '1..*',
            associationClassId: intermediateClass.id
          };
        }
        return r;
      });
    } else {
      updatedRelations = [
        ...diagram.relations,
        {
          id: `rel-assoc-${Date.now()}`,
          sourceClassId: srcClass.id,
          targetClassId: tgtClass.id,
          type: 'ASSOCIATION_N_M' as const,
          sourceMultiplicity: '*',
          targetMultiplicity: '1..*',
          associationClassId: intermediateClass.id,
          label: sugerencia.nombreClase
        }
      ];
    }

    const updatedClasses = [...diagram.classes, intermediateClass];

    onUpdateDiagram({
      ...diagram,
      classes: updatedClasses,
      relations: updatedRelations,
      updatedAt: new Date().toISOString()
    });

    onSelectClass(sugerencia.id);
    setSelectedRelationId(null);
    selectedRelationIdRef.current = null;

    showCanvasToast(`Tabla intermedia "${sugerencia.nombreClase}" (${sugerencia.dominio}) creada con 2 relaciones 1:N (UML 2.5 / 3FN)`);
  };

  // Confirmar creaciÃ³n personalizada desde IntermediateTableDecomposerModal
  const handleConfirmDecomposerModal = (
    newClass: ClaseUml,
    _rel1Config: { sourceMultiplicity: string; targetMultiplicity: string; label: string },
    _rel2Config: { sourceMultiplicity: string; targetMultiplicity: string; label: string }
  ) => {
    if (!decomposerModalData) return;
    const { srcClass, tgtClass, relIdToRemove } = decomposerModalData;

    // UML 2.5: La clase creada es una Clase Asociativa sin ID artificial
    const intermediateClass: ClaseUml = {
      ...newClass,
      stereotype: 'AssociationClass',
      attributes: (newClass.attributes || []).filter(a => a.name.toLowerCase() !== 'id').map(a => ({ ...a, isPrimaryKey: false, isNullable: true }))
    };

    let updatedRelations: RelacionUml[];
    if (relIdToRemove) {
      updatedRelations = diagram.relations.map(r => {
        if (r.id === relIdToRemove) {
          return {
            ...r,
            type: 'ASSOCIATION_N_M' as const,
            sourceMultiplicity: r.sourceMultiplicity?.includes('*') ? r.sourceMultiplicity : '*',
            targetMultiplicity: r.targetMultiplicity?.includes('*') ? r.targetMultiplicity : '1..*',
            associationClassId: intermediateClass.id,
            label: intermediateClass.name
          };
        }
        return r;
      });
    } else {
      updatedRelations = [
        ...diagram.relations,
        {
          id: `rel-assoc-${Date.now()}`,
          sourceClassId: srcClass.id,
          targetClassId: tgtClass.id,
          type: 'ASSOCIATION_N_M' as const,
          sourceMultiplicity: '*',
          targetMultiplicity: '1..*',
          associationClassId: intermediateClass.id,
          label: intermediateClass.name
        }
      ];
    }

    // Purgar de inmediato cualquier arista binaria hacia la clase asociativa
    updatedRelations = updatedRelations.filter(r =>
      r.sourceClassId !== intermediateClass.id && r.targetClassId !== intermediateClass.id
    );

    const updatedClasses = [...diagram.classes, intermediateClass];

    const finalDiagram = sanitizarDiagramaUML25({
      ...diagram,
      classes: updatedClasses,
      relations: updatedRelations,
      updatedAt: new Date().toISOString()
    });

    onUpdateDiagram(finalDiagram);

    onSelectClass(intermediateClass.id);
    setSelectedRelationId(null);
    selectedRelationIdRef.current = null;
    setDecomposerModalData(null);
    showCanvasToast(`Clase asociativa "${intermediateClass.name}" creada con Ã©xito (UML 2.5)`);
  };

  // Confirmar extracciÃ³n de superclase desde ExtractSuperclassModal
  const handleConfirmExtractSuperclass = (
    superclass: ClaseUml,
    updatedSubclasses: ClaseUml[],
    inheritanceRelations: RelacionUml[]
  ) => {
    const updatedSubclassMap = new Map(updatedSubclasses.map(c => [c.id, c]));
    const nextClasses = diagram.classes.map(c => updatedSubclassMap.get(c.id) || c);
    nextClasses.push(superclass);

    const nextRelations = [...diagram.relations, ...inheritanceRelations];

    onUpdateDiagram({
      ...diagram,
      classes: nextClasses,
      relations: nextRelations,
      updatedAt: new Date().toISOString()
    });

    onSelectClass(superclass.id);
    setExtractSuperclassClasses(null);
    showCanvasToast(`Superclase "${superclass.name}" extraÃ­da con ${inheritanceRelations.length} relaciones de herencia (â”€â”€â–·)`);
  };

  // Enlace rÃ¡pido directo desde el popover de la tarjeta
  const handleFastLinkSubmit = (sourceClassId: string, customSrcMult?: string, customTgtMult?: string) => {
    if (!fastLinkTargetClassId || sourceClassId === fastLinkTargetClassId) return;

    let defaultLabel = 'asocia';
    if (fastLinkRelType === 'COMPOSITION') defaultLabel = 'compone';
    else if (fastLinkRelType === 'AGGREGATION') defaultLabel = 'agrega';
    else if (fastLinkRelType === 'INHERITANCE') defaultLabel = 'extiende';
    else if (fastLinkRelType === 'REALIZATION') defaultLabel = 'implementa';
    else if (fastLinkRelType === 'DEPENDENCY' || fastLinkRelType === 'USAGE') defaultLabel = 'Â«useÂ»';
    else if (fastLinkRelType === 'PACKAGE_IMPORT') defaultLabel = 'Â«importÂ»';
    else if (fastLinkRelType === 'NON_NAVIGABLE') defaultLabel = 'no_navegable';
    else if (fastLinkRelType === 'ASSOCIATION_1_N') defaultLabel = 'tiene';
    else if (fastLinkRelType === 'ASSOCIATION_N_M') defaultLabel = 'vincula';

    const isSpecial = ['INHERITANCE', 'REALIZATION', 'DEPENDENCY', 'USAGE', 'PACKAGE_IMPORT', 'ASSOCIATION_BINARY'].includes(fastLinkRelType);
    const srcMult = isSpecial ? '' : (customSrcMult !== undefined ? customSrcMult : (fastLinkRelType === 'ASSOCIATION_N_M' ? '*' : '1'));
    const tgtMult = isSpecial ? '' : (customTgtMult !== undefined ? customTgtMult : (fastLinkRelType === 'COMPOSITION' ? '1..*' : fastLinkRelType === 'ASSOCIATION_1_1' ? '1' : fastLinkRelType === 'NON_NAVIGABLE' ? '0' : '*'));

    // Regla UML 2.5 / 3FN: Si la relaciÃ³n es N:M (o multiplicidad * y *), descomponer automÃ¡ticamente en tabla intermedia
    if (fastLinkRelType === 'ASSOCIATION_N_M' || (srcMult === '*' && tgtMult === '*')) {
      const srcClass = diagram.classes.find(c => c.id === sourceClassId);
      const tgtClass = diagram.classes.find(c => c.id === fastLinkTargetClassId);
      if (srcClass && tgtClass) {
        createIntermediateTableNM(srcClass, tgtClass);
        setCardFastLinkerClassId(null);
        setFastLinkTargetClassId('');
        setFastLinkLabel('');
        return;
      }
    }

    let finalSourceId = sourceClassId;
    let finalTargetId = fastLinkTargetClassId;

    if (fastLinkRelType === 'ASSOCIATION_1_N') {
      const srcCls = diagram.classes.find(c => c.id === sourceClassId);
      const tgtCls = diagram.classes.find(c => c.id === fastLinkTargetClassId);
      if (srcCls && tgtCls) {
        const dir = inferirDireccionMaestroTransaccion(srcCls.name, tgtCls.name);
        if (!dir.origenEsMaestro) {
          finalSourceId = fastLinkTargetClassId;
          finalTargetId = sourceClassId;
        }
      }
    }

    const newRel: RelacionUml = {
      id: `rel-${Date.now()}`,
      sourceClassId: finalSourceId,
      targetClassId: finalTargetId,
      type: fastLinkRelType,
      sourceMultiplicity: srcMult,
      targetMultiplicity: tgtMult,
      label: fastLinkLabel.trim() || defaultLabel
    };

    if (onAddRelation) {
      onAddRelation(newRel);
    } else {
      onUpdateDiagram({
        ...diagram,
        relations: [...diagram.relations, newRel],
        updatedAt: new Date().toISOString()
      });
    }

    // Seleccionar automÃ¡ticamente la nueva relaciÃ³n para desplegar la barra de cardinalidad
    setSelectedRelationId(newRel.id);
    selectedRelationIdRef.current = newRel.id;

    setCardFastLinkerClassId(null);
    setFastLinkTargetClassId('');
    setFastLinkLabel('');
  };

  // Crear clase desde el Asistente Modal
  const handleCreateAssistedClass = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = newClassName.trim() || `Entidad${diagram.classes.length + 1}`;
    const newId = 'cls-' + Date.now();

    const initialAttrs: AtributoUml[] = [];
    if (newClassWithIdPk) {
      initialAttrs.push({
        id: `a-${Date.now()}-pk`,
        name: 'id',
        type: 'Long',
        visibility: '-',
        isPrimaryKey: true
      });
    }
    if (newClassWithNombre) {
      initialAttrs.push({
        id: `a-${Date.now()}-nom`,
        name: 'nombre',
        type: 'String',
        visibility: '-'
      });
    }
    if (newClassWithDesc) {
      initialAttrs.push({
        id: `a-${Date.now()}-desc`,
        name: 'descripcion',
        type: 'String',
        visibility: '-'
      });
    }
    if (newClassWithPrecio) {
      initialAttrs.push({
        id: `a-${Date.now()}-prec`,
        name: 'precio',
        type: 'Double',
        visibility: '-'
      });
    }
    if (newClassWithFecha) {
      initialAttrs.push({
        id: `a-${Date.now()}-fec`,
        name: 'fechaCreacion',
        type: 'LocalDateTime',
        visibility: '-'
      });
    }
    if (newClassWithActivo) {
      initialAttrs.push({
        id: `a-${Date.now()}-act`,
        name: 'activo',
        type: 'Boolean',
        visibility: '-'
      });
    }

    const initialMethods: MetodoUml[] = [];
    if (newClassStereotype === 'Entity') {
      initialMethods.push({
        id: `m-${Date.now()}-1`,
        name: 'validar',
        returnType: 'Boolean',
        visibility: '+'
      });
    } else if (newClassStereotype === 'Service') {
      initialMethods.push({
        id: `m-${Date.now()}-1`,
        name: `ejecutar${cleanName}`,
        returnType: 'void',
        visibility: '+'
      });
    }

    // UbicaciÃ³n inteligente para evitar solapamientos y no desbordar
    const index = diagram.classes.length;
    const maxCols = 3;
    const posX = 60 + (index % maxCols) * 350;
    const posY = 60 + Math.floor(index / maxCols) * 280;

    const createdClass: ClaseUml = {
      id: newId,
      name: cleanName,
      stereotype: newClassStereotype,
      attributes: initialAttrs,
      methods: initialMethods,
      position: { x: posX, y: posY }
    };

    onAddClass(createdClass);
    setTimeout(() => {
      handleFitToScreen([...diagram.classes, createdClass]);
    }, 60);

    // Si seleccionÃ³ enlace inmediato con otra tabla
    if (newClassLinkWithTargetId) {
      const target = diagram.classes.find(c => c.id === newClassLinkWithTargetId);
      if (target) {
        setTimeout(() => {
          let defaultLabel = 'asocia';
          if (newClassLinkRelType === 'COMPOSITION') defaultLabel = 'compone';
          else if (newClassLinkRelType === 'INHERITANCE') defaultLabel = 'extiende';
          else if (newClassLinkRelType === 'ASSOCIATION_1_N') defaultLabel = 'tiene';

          const newRel: RelacionUml = {
            id: `rel-${Date.now()}`,
            sourceClassId: newId,
            targetClassId: newClassLinkWithTargetId,
            type: newClassLinkRelType,
            sourceMultiplicity: '1',
            targetMultiplicity: newClassLinkRelType === 'COMPOSITION' ? '0..*' : '*',
            label: defaultLabel
          };
          if (onAddRelation) onAddRelation(newRel);
        }, 80);
      }
    }

    setNewClassName('');
    setNewClassLinkWithTargetId('');
    setShowNewClassModal(false);
  };

  // Insertar arquitectura de plantilla de dominio
  const handleApplyTemplate = (plantillaId: string, replace: boolean) => {
    const inst = instanciarPlantilla(plantillaId, replace ? undefined : diagram);
    if (!inst) return;

    if (replace) {
      onUpdateDiagram({
        title: diagram.title,
        classes: inst.classes,
        relations: inst.relations,
        updatedAt: new Date().toISOString()
      });
    } else {
      onUpdateDiagram({
        ...diagram,
        classes: [...diagram.classes, ...inst.classes],
        relations: [...diagram.relations, ...inst.relations],
        updatedAt: new Date().toISOString()
      });
    }
    setShowTemplatesModal(false);
    setTimeout(() => {
      handleFitToScreen(replace ? inst.classes : [...diagram.classes, ...inst.classes]);
    }, 80);
  };

  // Renombrado Inline de Clase
  const handleStartEditingClass = (cls: ClaseUml, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClassId(cls.id);
    setEditingClassName(cls.name);
    setEditingClassStereotype(cls.stereotype || 'Entity');
  };

  const handleSaveEditingClass = (classId: string, e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!editingClassName.trim()) return;

    const updated = diagram.classes.map(c => {
      if (c.id === classId) {
        return {
          ...c,
          name: editingClassName.trim(),
          stereotype: editingClassStereotype
        };
      }
      return c;
    });

    onUpdateDiagram({
      ...diagram,
      classes: updated,
      updatedAt: new Date().toISOString()
    });

    setEditingClassId(null);
  };

  // Submit new method
  const handleSaveMethod = (e: React.FormEvent, classId: string) => {
    e.preventDefault();
    if (!methodName.trim()) return;

    const newMethod: MetodoUml = {
      id: 'm-' + Date.now(),
      name: methodName.trim(),
      returnType: methodReturnType.trim() || 'void',
      parameters: methodParams.trim(),
      visibility: methodVis
    };

    if (onAddMethod) {
      onAddMethod(classId, newMethod);
    } else {
      // Fallback update diagram
      const updated = diagram.classes.map(cls => {
        if (cls.id === classId) {
          return {
            ...cls,
            methods: [...cls.methods, newMethod]
          };
        }
        return cls;
      });
      onUpdateDiagram({ ...diagram, classes: updated, updatedAt: new Date().toISOString() });
    }

    setMethodName('');
    setMethodParams('');
    setAddingMethodClassId(null);
  };

  // Create relation between two nodes (UML 2.5 rigorous mappings)
  const handleCompleteRelation = (sourceId: string, targetId: string) => {
    const srcClass = diagram.classes.find(c => c.id === sourceId);
    const tgtClass = diagram.classes.find(c => c.id === targetId);
    if (!srcClass || !tgtClass) return;

    // Regla UML 2.5 / 3FN: Si la relaciÃ³n seleccionada es Muchos a Muchos (N:M), descomponer automÃ¡ticamente en tabla intermedia
    if (selectedRelationType === 'ASSOCIATION_N_M') {
      createIntermediateTableNM(srcClass, tgtClass);
      setConnectingMousePos(null);
      return;
    }

    let defaultLabel = 'asocia';
    let srcMult = '1';
    let tgtMult = '*';

    switch (selectedRelationType) {
      case 'ASSOCIATION_1_1':
        defaultLabel = 'asocia';
        srcMult = '1';
        tgtMult = '1';
        break;
      case 'ASSOCIATION_1_N':
        defaultLabel = 'asocia';
        srcMult = '1';
        tgtMult = '0..*';
        break;
      case 'COMPOSITION':
        defaultLabel = 'compone';
        srcMult = '1';
        tgtMult = '1..*';
        break;
      case 'AGGREGATION':
        defaultLabel = 'agrega';
        srcMult = '1';
        tgtMult = '0..*';
        break;
      case 'INHERITANCE':
        defaultLabel = 'extiende';
        srcMult = '';
        tgtMult = '';
        break;
      case 'REALIZATION':
        defaultLabel = 'implementa';
        srcMult = '';
        tgtMult = '';
        break;
      case 'DEPENDENCY':
      case 'USAGE':
        defaultLabel = 'Â«useÂ»';
        srcMult = '';
        tgtMult = '';
        break;
      case 'PACKAGE_IMPORT':
        defaultLabel = 'Â«importÂ»';
        srcMult = '';
        tgtMult = '';
        break;
      case 'ASSOCIATION_BINARY':
        defaultLabel = 'asocia';
        srcMult = '';
        tgtMult = '';
        break;
      case 'NON_NAVIGABLE':
        defaultLabel = 'no_navegable';
        srcMult = '1';
        tgtMult = '0';
        break;
    }

    let finalSourceId = sourceId;
    let finalTargetId = targetId;

    if (selectedRelationType === 'ASSOCIATION_1_N') {
      const dir = inferirDireccionMaestroTransaccion(srcClass.name, tgtClass.name);
      if (!dir.origenEsMaestro) {
        finalSourceId = targetId;
        finalTargetId = sourceId;
      }
    }

    const newRel: RelacionUml = {
      id: `rel-${Date.now()}`,
      sourceClassId: finalSourceId,
      targetClassId: finalTargetId,
      type: selectedRelationType,
      sourceMultiplicity: srcMult,
      targetMultiplicity: tgtMult,
      label: defaultLabel
    };

    if (onAddRelation) {
      onAddRelation(newRel);
    } else {
      onUpdateDiagram({
        ...diagram,
        relations: [...diagram.relations, newRel],
        updatedAt: new Date().toISOString()
      });
    }

    // Seleccionar automÃ¡ticamente la nueva relaciÃ³n para gestionar su cardinalidad en la barra superior
    setSelectedRelationId(newRel.id);
    selectedRelationIdRef.current = newRel.id;
  };

  // â”€â”€â”€ GestiÃ³n Integral de Relaciones y Cardinalidad UML 2.5 â”€â”€â”€

  const handleUpdateRelation = (relationId: string, updates: Partial<RelacionUml>) => {
    const updated = diagram.relations.map(r => {
      if (r.id !== relationId) return r;
      return { ...r, ...updates };
    });

    onUpdateDiagram({
      ...diagram,
      relations: updated,
      updatedAt: new Date().toISOString()
    });
  };

  const handleChangeRelationType = (relationId: string, newType: TipoRelacion) => {
    let defaultLabel = 'asocia';
    let srcMult = '1';
    let tgtMult = '*';

    switch (newType) {
      case 'ASSOCIATION_1_1':
        defaultLabel = 'asocia';
        srcMult = '1';
        tgtMult = '1';
        break;
      case 'ASSOCIATION_1_N':
        defaultLabel = 'asocia';
        srcMult = '1';
        tgtMult = '0..*';
        break;
      case 'ASSOCIATION_N_M':
        defaultLabel = 'asocia';
        srcMult = '*';
        tgtMult = '*';
        break;
      case 'COMPOSITION':
        defaultLabel = 'compone';
        srcMult = '1';
        tgtMult = '1..*';
        break;
      case 'AGGREGATION':
        defaultLabel = 'agrega';
        srcMult = '1';
        tgtMult = '0..*';
        break;
      case 'INHERITANCE':
        defaultLabel = 'extiende';
        srcMult = '';
        tgtMult = '';
        break;
      case 'REALIZATION':
        defaultLabel = 'implementa';
        srcMult = '';
        tgtMult = '';
        break;
      case 'DEPENDENCY':
      case 'USAGE':
        defaultLabel = 'Â«useÂ»';
        srcMult = '';
        tgtMult = '';
        break;
      case 'PACKAGE_IMPORT':
        defaultLabel = 'Â«importÂ»';
        srcMult = '';
        tgtMult = '';
        break;
      case 'ASSOCIATION_BINARY':
        defaultLabel = 'asocia';
        srcMult = '';
        tgtMult = '';
        break;
      case 'NON_NAVIGABLE':
        defaultLabel = 'no_navegable';
        srcMult = '1';
        tgtMult = '0';
        break;
    }

    handleUpdateRelation(relationId, {
      type: newType,
      sourceMultiplicity: srcMult,
      targetMultiplicity: tgtMult,
      label: defaultLabel
    });
  };

  const handleInvertRelation = (relationId: string) => {
    const rel = diagram.relations.find(r => r.id === relationId);
    if (!rel) return;
    handleUpdateRelation(relationId, {
      sourceClassId: rel.targetClassId,
      targetClassId: rel.sourceClassId,
      sourceMultiplicity: rel.targetMultiplicity || '1',
      targetMultiplicity: rel.sourceMultiplicity || '*'
    });
  };

  const UML_MULTIPLICITY_CYCLE = ['1', '0..1', '*', '1..*', '0..*'];

  const handleCycleMultiplicity = (relationId: string, end: 'source' | 'target') => {
    const rel = diagram.relations.find(r => r.id === relationId);
    if (!rel) return;
    const current = end === 'source' ? (rel.sourceMultiplicity || '1') : (rel.targetMultiplicity || '*');
    const idx = UML_MULTIPLICITY_CYCLE.indexOf(current);
    const next = idx >= 0 ? UML_MULTIPLICITY_CYCLE[(idx + 1) % UML_MULTIPLICITY_CYCLE.length] : '1';

    handleUpdateRelation(relationId, {
      [end === 'source' ? 'sourceMultiplicity' : 'targetMultiplicity']: next
    });
  };

  // â”€â”€â”€ Handlers de la Toolbox UML 2.5+ â”€â”€â”€

  const handleInsertClassifierFromToolbox = (def: DefClasificadorUml) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const stagger = (insertStaggerCount % 6) * 35;
    setInsertStaggerCount(prev => prev + 1);

    const centerX = rect ? Math.round((rect.width / 2 - pan.x) / zoom) + stagger : 300 + stagger;
    const centerY = rect ? Math.round((rect.height / 2 - pan.y) / zoom) + stagger : 200 + stagger;

    const baseName = def.name.replace(/[^a-zA-Z0-9]/g, '') || 'Clase';
    let finalName = baseName;
    let counter = 1;
    while (diagram.classes.some(c => c.name.toLowerCase() === finalName.toLowerCase())) {
      counter++;
      finalName = `${baseName}${counter}`;
    }

    const ts = Date.now();
    const newCls: ClaseUml = {
      id: `cls-${def.stereotype?.toLowerCase() || 'item'}-${ts}`,
      name: finalName,
      stereotype: def.stereotype,
      isAbstract: def.isAbstract,
      isInterface: def.isInterface,
      isInstance: def.isInstance || def.stereotype === 'Instance',
      templateParams: def.templateParams || (def.stereotype === 'Template' ? 'T' : undefined),
      noteText: def.isNote ? def.defaultNoteText : undefined,
      position: { x: centerX, y: centerY },
      attributes: (def.defaultAttributes || []).map((a, idx) => ({
        id: `attr-${ts}-${idx}`,
        name: a.name,
        type: a.type,
        visibility: a.visibility,
        isPrimaryKey: a.isPrimaryKey,
        isStatic: a.isStatic,
        isDerived: a.isDerived,
        isReadOnly: a.isReadOnly,
        defaultValue: a.defaultValue,
        multiplicity: a.multiplicity
      })),
      methods: (def.defaultMethods || []).map((m, idx) => ({
        id: `m-${ts}-${idx}`,
        name: m.name,
        returnType: m.returnType,
        visibility: m.visibility,
        parameters: m.parameters,
        isStatic: m.isStatic,
        isQuery: m.isQuery
      }))
    };

    onAddClass(newCls);
    onSelectClass(newCls.id);
  };

  const handleActivateRelationFromToolbox = (relType: TipoRelacion) => {
    setSelectedRelationType(relType);
    setIsRelationMode(true);
    if (selectedClassId) {
      setConnectingSourceId(selectedClassId);
    } else {
      // Dejar que el usuario elija libremente la clase origen con el primer clic
      setConnectingSourceId(null);
    }
  };

  const handleInsertPatternFromToolbox = (patron: DefPatronUml) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const centerX = rect ? Math.round((rect.width / 2 - pan.x) / zoom) : 400;
    const centerY = rect ? Math.round((rect.height / 2 - pan.y) / zoom) : 250;

    const built = patron.builder({ x: centerX, y: centerY });
    onUpdateDiagram({
      ...diagram,
      classes: [...diagram.classes, ...built.classes],
      relations: [...diagram.relations, ...built.relations],
      updatedAt: new Date().toISOString()
    });
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
    }
    if (!isDragOverCanvas) {
      setIsDragOverCanvas(true);
    }
  };

  const handleCanvasDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setIsDragOverCanvas(false);
    }
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    lastDropTimeRef.current = Date.now();
    setIsDragOverCanvas(false);

    // Resetear inmediatamente cualquier arrastre o paneo residual
    isPanningRef.current = false;
    setIsPanning(false);
    draggingClassIdRef.current = null;
    setDraggingClassId(null);
    lastMoveRef.current = null;
    dragPosRef.current = null;
    stopAutoPanLoop();
    onDragStateChange?.(false);

    let rawData = e.dataTransfer.getData('application/archai-toolbox');
    if (!rawData) {
      rawData = e.dataTransfer.getData('text/plain');
    }
    if (!rawData) return;
    try {
      const { type, item } = JSON.parse(rawData);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      // Centrar el elemento exactamente debajo del cursor (tarjeta de 330px de ancho y ~160px de alto)
      const dropX = Math.round((e.clientX - rect.left - pan.x) / zoom) - 165;
      const dropY = Math.round((e.clientY - rect.top - pan.y) / zoom) - 40;

      if (type === 'classifier') {
        const baseName = item.name?.replace(/[^a-zA-Z0-9]/g, '') || 'Clase';
        let finalName = baseName;
        let counter = 1;
        while (diagram.classes.some(c => c.name.toLowerCase() === finalName.toLowerCase())) {
          counter++;
          finalName = `${baseName}${counter}`;
        }

        const ts = Date.now();
        const newCls: ClaseUml = {
          id: `cls-${item.stereotype?.toLowerCase() || 'item'}-${ts}`,
          name: finalName,
          stereotype: item.stereotype,
          isAbstract: item.isAbstract,
          isInterface: item.isInterface,
          isInstance: item.isInstance || item.stereotype === 'Instance',
          templateParams: item.templateParams || (item.stereotype === 'Template' ? 'T' : undefined),
          noteText: item.isNote ? item.defaultNoteText : undefined,
          position: { x: dropX, y: dropY },
          attributes: (item.defaultAttributes || []).map((a: any, idx: number) => ({
            id: `attr-${ts}-${idx}`,
            name: a.name,
            type: a.type,
            visibility: a.visibility,
            isPrimaryKey: a.isPrimaryKey,
            isStatic: a.isStatic,
            isDerived: a.isDerived,
            isReadOnly: a.isReadOnly,
            defaultValue: a.defaultValue,
            multiplicity: a.multiplicity
          })),
          methods: (item.defaultMethods || []).map((m: any, idx: number) => ({
            id: `m-${ts}-${idx}`,
            name: m.name,
            returnType: m.returnType,
            visibility: m.visibility,
            parameters: m.parameters,
            isStatic: m.isStatic,
            isQuery: m.isQuery
          }))
        };
        onAddClass(newCls);
        onSelectClass(newCls.id);
      } else if (type === 'pattern') {
        const built = item.builder ? item.builder({ x: dropX, y: dropY }) : null;
        if (built) {
          onUpdateDiagram({
            ...diagram,
            classes: [...diagram.classes, ...built.classes],
            relations: [...diagram.relations, ...built.relations],
            updatedAt: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error('Error al procesar drop en el lienzo:', err);
    }
  };

  // Ajustar todo el diagrama a la pantalla visible (Auto-Fit & Centrado inteligente sin desbordamiento)
  const handleFitToScreen = (customClasses?: ClaseUml[]) => {
    const classesToFit = customClasses || [...diagram.classes,...(proposalDraft?.classes || [])];
    if (!canvasRef.current || classesToFit.length === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    // Calcular lÃ­mites envolventes (bounding box) de todas las clases
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    classesToFit.forEach(cls => {
      const pos = cls.position || { x: 60, y: 40 };
      const cardH = nodeDimensionsRef.current.get(cls.id)?.h || Math.max(220, 180 + (cls.attributes?.length || 0) * 38 + (cls.methods?.length || 0) * 38);
      const cardW = 330;

      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x + cardW > maxX) maxX = pos.x + cardW;
      if (pos.y + cardH > maxY) maxY = pos.y + cardH;
    });

    if (!isFinite(minX) || !isFinite(minY)) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const diagramW = Math.max(100, maxX - minX);
    const diagramH = Math.max(100, maxY - minY);

    // MÃ¡rgenes seguros: 40px a los lados, 40px arriba, 95px abajo para librar el Dock perfectamente
    const reserved = proposalDraft && rect.width > 900 ? 410 : 0;
    const padX = 40;
    const padTop = proposalDraft ? 100 : 40;
    const padBottom = 95;

    const availW = Math.max(200, rect.width - padX * 2 - reserved);
    const availH = Math.max(200, rect.height - padTop - padBottom);

    const scaleX = availW / diagramW;
    const scaleY = availH / diagramH;
    // Si cabe al 100%, dejamos 1.0. Si no cabe, escalamos fluidamente hasta 0.08
    const idealZoom = Number(Math.min(1.0, Math.max(0.08, Math.min(scaleX, scaleY))).toFixed(2));

    // Centrar en el Ã¡rea visible segura
    const targetCenterX = reserved + padX + availW / 2;
    const targetCenterY = padTop + availH / 2;

    const diagramCenterX = minX + diagramW / 2;
    const diagramCenterY = minY + diagramH / 2;

    const targetPanX = Math.round(targetCenterX - diagramCenterX * idealZoom);
    const targetPanY = Math.round(targetCenterY - diagramCenterY * idealZoom);

    zoomRef.current = idealZoom;
    panRef.current = { x: targetPanX, y: targetPanY };
    setZoom(idealZoom);
    setPan({ x: targetPanX, y: targetPanY });
  };

  // Auto-Organizar en capas arquitectÃ³nicas limpias, compactas y proporcionales
  const handleAutoOrganize = () => {
    const layerCols: Record<string, ClaseUml[]> = {
      Controller: [],
      Service: [],
      Repository: [],
      Entity: [],
      Other: []
    };

    diagram.classes.forEach(c => {
      const st = c.stereotype || 'Entity';
      if (layerCols[st]) {
        layerCols[st].push(c);
      } else {
        layerCols.Other.push(c);
      }
    });

    const arranged: ClaseUml[] = [];
    const totalClasses = diagram.classes.length;

    if (totalClasses <= 4) {
      // DistribuciÃ³n limpia y compacta de 2 niveles:
      // Nivel Superior (y: 40): Controller -> Service -> Repository
      // Nivel Inferior (y: 300): Entity
      const controllers = layerCols.Controller;
      const services = layerCols.Service;
      const repos = layerCols.Repository;
      const entities = layerCols.Entity;
      const others = layerCols.Other;

      let colX = 60;
      controllers.forEach(c => {
        arranged.push({ ...c, position: { x: colX, y: 40 } });
        colX += 350;
      });
      services.forEach(c => {
        arranged.push({ ...c, position: { x: colX, y: 40 } });
        colX += 350;
      });
      repos.forEach(c => {
        arranged.push({ ...c, position: { x: colX, y: 40 } });
        colX += 350;
      });

      // Entities en el nivel inferior (alineada con el repositorio si existe o centrada)
      const entityX = repos.length > 0 ? 760 : (services.length > 0 ? 410 : 60);
      entities.forEach((c, idx) => {
        arranged.push({ ...c, position: { x: entityX, y: 300 + idx * 280 } });
      });
      others.forEach((c, idx) => {
        arranged.push({ ...c, position: { x: 60 + idx * 350, y: 300 } });
      });
    } else {
      // DistribuciÃ³n multi-columna para arquitecturas grandes (mÃ¡ximo 3 columnas de 350px)
      const MAX_COLS = 3;
      const colOrder = ['Controller', 'Service', 'Repository', 'Entity', 'Other'];
      const allOrdered: ClaseUml[] = [];
      colOrder.forEach(k => allOrdered.push(...layerCols[k]));

      allOrdered.forEach((item, idx) => {
        const col = idx % MAX_COLS;
        const row = Math.floor(idx / MAX_COLS);
        arranged.push({
          ...item,
          position: {
            x: 60 + col * 350,
            y: 40 + row * 280
          }
        });
      });
    }

    onUpdateDiagram({
      ...diagram,
      classes: arranged,
      updatedAt: new Date().toISOString()
    });

    // Auto-ajustar inmediatamente el zoom y pan a la nueva disposiciÃ³n compacta
    setTimeout(() => {
      handleFitToScreen(arranged);
    }, 60);
  };

  // Auto-ajustar automÃ¡ticamente al cargar o cambiar de diagrama
  const lastFittedDiagramRef = useRef<string | null>(null);

  useEffect(() => {
    const key = `${diagram.title}-${diagram.classes.length}-${previewKey}`;
    if (lastFittedDiagramRef.current !== key && diagram.classes.length > 0) {
      lastFittedDiagramRef.current = key;
      const timer = setTimeout(() => {
        handleFitToScreen();
      }, 70);
      return () => clearTimeout(timer);
    }
  }, [diagram.title, diagram.classes.length, previewKey]);

  // Re-ajustar si el usuario redimensiona la ventana
  useEffect(() => {
    const handleResize = () => {
      if (diagram.classes.length > 0) {
        handleFitToScreen();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [diagram.classes, proposalDraft]);

  // Local preview of classes while dragging (committed to the diagram on mouse up)
  const officialDisplayedClasses = useMemo(() => {
    if (!draggingClassId || !dragPos) return diagram.classes;
    if (multiDragDelta && selectedClassIds.size > 1 && selectedClassIds.has(draggingClassId)) {
      const { deltaX, deltaY } = multiDragDelta;
      return diagram.classes.map(c => {
        if (selectedClassIds.has(c.id)) {
          const origin = multiDragInitialPositionsRef.current.get(c.id) || c.position || { x: 100, y: 100 };
          return {
            ...c,
            position: {
              x: origin.x + deltaX,
              y: origin.y + deltaY
            }
          };
        }
        return c;
      });
    }
    return diagram.classes.map(c =>
      c.id === draggingClassId ? { ...c, position: dragPos } : c
    );
  }, [diagram.classes, draggingClassId, dragPos, multiDragDelta, selectedClassIds]);

  const displayedClasses=useMemo(()=>[...officialDisplayedClasses,...(proposalDraft?.classes || []).map(c=>ghostPosition?.id===c.id?{...c,position:{x:ghostPosition.x,y:ghostPosition.y}}:c)],[officialDisplayedClasses,proposalDraft,ghostPosition]);

  // Calculate SVG connector paths dynamically with ultra-smooth cubic bezier S-curves and true node bounding boxes
  const relationPaths = useMemo(() => {
    const renderRelations=[...diagram.relations,...(proposalDraft?.relations || [])];
    // Helper para estimar altura si el elemento aÃºn no ha sido medido en el DOM
    const estimarAlturaFallback = (cls: ClaseUml, totalRelaciones: number): number => {
      const attrCount = cls.attributes?.length || 0;
      const methodCount = cls.methods?.length || 0;
      const headerH = 78;
      const attrH = 34 + attrCount * 30;
      const methodH = 34 + methodCount * 30;
      const connH = totalRelaciones > 0 ? (28 + totalRelaciones * 28 + 8) : 0;
      return Math.max(160, headerH + attrH + methodH + connH + 16);
    };

    const classMap = new Map<string, { x: number; y: number; w: number; h: number; cx: number; cy: number }>();

    displayedClasses.forEach(cls => {
      const pos = cls.position || { x: 100, y: 100 };
      const measured = nodeDimensionsRef.current.get(cls.id);
      const connCount = renderRelations.filter(r => r.sourceClassId === cls.id || r.targetClassId === cls.id).length;
      const w = measured?.w && measured.w > 80 ? measured.w : 330;
      const h = measured?.h && measured.h > 80 ? measured.h : estimarAlturaFallback(cls, connCount);
      classMap.set(cls.id, {
        x: pos.x,
        y: pos.y,
        w,
        h,
        cx: pos.x + w / 2,
        cy: pos.y + h / 2
      });
    });

    type AnchorSide = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
    interface RelMeta {
      rel: RelacionUml;
      src: { x: number; y: number; w: number; h: number; cx: number; cy: number };
      tgt: { x: number; y: number; w: number; h: number; cx: number; cy: number };
      srcSide: AnchorSide;
      tgtSide: AnchorSide;
      isSelf?: boolean;
    }

    const relMetas: RelMeta[] = [];
    const srcSideBuckets = new Map<string, string[]>();
    const tgtSideBuckets = new Map<string, string[]>();

    // UML 2.5: Identificar clases asociativas activas vinculadas
    const activeAssocClassIds = new Set<string>();
    renderRelations.forEach(r => {
      if (r.associationClassId) activeAssocClassIds.add(r.associationClassId);
    });
    displayedClasses.forEach(c => {
      if (esClaseAsociativaUniversal(c, renderRelations)) activeAssocClassIds.add(c.id);
    });

    // Descartar aristas binarias directas hacia clases asociativas en el trazado visual (UML 2.5)
    const relationsToRender = renderRelations.filter(rel => {
      // Si la arista apunta o nace de una clase asociativa, NO renderizarla como lÃ­nea binaria
      if (activeAssocClassIds.has(rel.sourceClassId) || activeAssocClassIds.has(rel.targetClassId)) {
        return false;
      }
      return true;
    });

    relationsToRender.forEach(rel => {
      const src = classMap.get(rel.sourceClassId);
      const tgt = classMap.get(rel.targetClassId);
      if (!src || !tgt) return;

      if (rel.sourceClassId === rel.targetClassId) {
        relMetas.push({ rel, src, tgt, srcSide: 'RIGHT', tgtSide: 'TOP', isSelf: true });
        return;
      }

      const dx = tgt.cx - src.cx;
      const dy = tgt.cy - src.cy;

      const gapRight = tgt.x - (src.x + src.w);
      const gapLeft = src.x - (tgt.x + tgt.w);
      const gapBottom = tgt.y - (src.y + src.h);
      const gapTop = src.y - (tgt.y + tgt.h);

      let srcSide: AnchorSide = 'RIGHT';
      let tgtSide: AnchorSide = 'LEFT';

      if (gapRight > 10 && gapRight >= Math.max(gapBottom, gapTop)) {
        srcSide = 'RIGHT';
        tgtSide = 'LEFT';
      } else if (gapLeft > 10 && gapLeft >= Math.max(gapBottom, gapTop)) {
        srcSide = 'LEFT';
        tgtSide = 'RIGHT';
      } else if (gapBottom > 10 && gapBottom >= Math.max(gapRight, gapLeft)) {
        srcSide = 'BOTTOM';
        tgtSide = 'TOP';
      } else if (gapTop > 10 && gapTop >= Math.max(gapRight, gapLeft)) {
        srcSide = 'TOP';
        tgtSide = 'BOTTOM';
      } else {
        const normX = Math.abs(dx) / ((src.w + tgt.w) / 2);
        const normY = Math.abs(dy) / ((src.h + tgt.h) / 2);

        if (normX >= normY) {
          if (dx >= 0) {
            srcSide = 'RIGHT';
            tgtSide = 'LEFT';
          } else {
            srcSide = 'LEFT';
            tgtSide = 'RIGHT';
          }
        } else {
          if (dy >= 0) {
            srcSide = 'BOTTOM';
            tgtSide = 'TOP';
          } else {
            srcSide = 'TOP';
            tgtSide = 'BOTTOM';
          }
        }
      }

      relMetas.push({ rel, src, tgt, srcSide, tgtSide });

      const srcKey = `${rel.sourceClassId}_${srcSide}`;
      const tgtKey = `${rel.targetClassId}_${tgtSide}`;
      if (!srcSideBuckets.has(srcKey)) srcSideBuckets.set(srcKey, []);
      srcSideBuckets.get(srcKey)!.push(rel.id);
      if (!tgtSideBuckets.has(tgtKey)) tgtSideBuckets.set(tgtKey, []);
      tgtSideBuckets.get(tgtKey)!.push(rel.id);
    });

    return relMetas.map(({ rel, src, tgt, srcSide, tgtSide, isSelf }) => {
      if (isSelf) {
        const startX = src.x + src.w;
        const startY = src.y + 45;
        const endX = src.x + src.w - 45;
        const endY = src.y;

        // Línea ortogonal en L para relación autológica (UML 2.5)
        const loopSize = 55;
        const cornerX = startX + loopSize;
        const cornerY = startY - loopSize;
        const pathD = `M ${startX} ${startY} L ${cornerX} ${startY} L ${cornerX} ${cornerY} L ${endX} ${cornerY} L ${endX} ${endY}`;
        const midX = cornerX;
        const midY = cornerY - 15;

        return {
          id: rel.id,
          pathD,
          label: rel.label || '',
          srcMultiplicity: rel.sourceMultiplicity || '1',
          tgtMultiplicity: rel.targetMultiplicity || '0..*',
          type: rel.type,
          sourceClassId: rel.sourceClassId,
          targetClassId: rel.targetClassId,
          startX,
          startY,
          endX,
          endY,
          midX,
          midY,
          srcMultX: startX + 10,
          srcMultY: startY + 16,
          tgtMultX: endX - 10,
          tgtMultY: endY - 14
        };
      }
      const srcKey = `${rel.sourceClassId}_${srcSide}`;
      const srcList = srcSideBuckets.get(srcKey) || [rel.id];
      const srcIdx = srcList.indexOf(rel.id);
      const srcOffset = srcList.length > 1 ? (srcIdx - (srcList.length - 1) / 2) * 22 : 0;

      const tgtKey = `${rel.targetClassId}_${tgtSide}`;
      const tgtList = tgtSideBuckets.get(tgtKey) || [rel.id];
      const tgtIdx = tgtList.indexOf(rel.id);
      const tgtOffset = tgtList.length > 1 ? (tgtIdx - (tgtList.length - 1) / 2) * 22 : 0;

      let startX = src.cx;
      let startY = src.cy;
      let endX = tgt.cx;
      let endY = tgt.cy;

      // Anclaje en el origen (siempre sobre el borde perimetral exterior de la tarjeta)
      if (srcSide === 'RIGHT') {
        startX = src.x + src.w;
        const overlapTop = Math.max(src.y, tgt.y);
        const overlapBottom = Math.min(src.y + src.h, tgt.y + tgt.h);
        if (overlapBottom - overlapTop > 24) {
          startY = (overlapTop + overlapBottom) / 2 + srcOffset;
        } else {
          startY = Math.max(src.y + 40, Math.min(src.y + src.h - 40, src.cy)) + srcOffset;
        }
      } else if (srcSide === 'LEFT') {
        startX = src.x;
        const overlapTop = Math.max(src.y, tgt.y);
        const overlapBottom = Math.min(src.y + src.h, tgt.y + tgt.h);
        if (overlapBottom - overlapTop > 24) {
          startY = (overlapTop + overlapBottom) / 2 + srcOffset;
        } else {
          startY = Math.max(src.y + 40, Math.min(src.y + src.h - 40, src.cy)) + srcOffset;
        }
      } else if (srcSide === 'BOTTOM') {
        startY = src.y + src.h;
        const overlapLeft = Math.max(src.x, tgt.x);
        const overlapRight = Math.min(src.x + src.w, tgt.x + tgt.w);
        if (overlapRight - overlapLeft > 24) {
          startX = (overlapLeft + overlapRight) / 2 + srcOffset;
        } else {
          startX = Math.max(src.x + 40, Math.min(src.x + src.w - 40, src.cx)) + srcOffset;
        }
      } else if (srcSide === 'TOP') {
        startY = src.y;
        const overlapLeft = Math.max(src.x, tgt.x);
        const overlapRight = Math.min(src.x + src.w, tgt.x + tgt.w);
        if (overlapRight - overlapLeft > 24) {
          startX = (overlapLeft + overlapRight) / 2 + srcOffset;
        } else {
          startX = Math.max(src.x + 40, Math.min(src.x + src.w - 40, src.cx)) + srcOffset;
        }
      }

      // Anclaje en el destino (siempre sobre el borde perimetral exterior de la tarjeta)
      if (tgtSide === 'LEFT') {
        endX = tgt.x;
        const overlapTop = Math.max(src.y, tgt.y);
        const overlapBottom = Math.min(src.y + src.h, tgt.y + tgt.h);
        if (overlapBottom - overlapTop > 24 && srcSide === 'RIGHT') {
          endY = startY;
        } else {
          endY = Math.max(tgt.y + 40, Math.min(tgt.y + tgt.h - 40, tgt.cy)) + tgtOffset;
        }
      } else if (tgtSide === 'RIGHT') {
        endX = tgt.x + tgt.w;
        const overlapTop = Math.max(src.y, tgt.y);
        const overlapBottom = Math.min(src.y + src.h, tgt.y + tgt.h);
        if (overlapBottom - overlapTop > 24 && srcSide === 'LEFT') {
          endY = startY;
        } else {
          endY = Math.max(tgt.y + 40, Math.min(tgt.y + tgt.h - 40, tgt.cy)) + tgtOffset;
        }
      } else if (tgtSide === 'TOP') {
        endY = tgt.y;
        const overlapLeft = Math.max(src.x, tgt.x);
        const overlapRight = Math.min(src.x + src.w, tgt.x + tgt.w);
        if (overlapRight - overlapLeft > 24 && srcSide === 'BOTTOM') {
          endX = startX;
        } else {
          endX = Math.max(tgt.x + 40, Math.min(tgt.x + tgt.w - 40, tgt.cx)) + tgtOffset;
        }
      } else if (tgtSide === 'BOTTOM') {
        endY = tgt.y + tgt.h;
        const overlapLeft = Math.max(src.x, tgt.x);
        const overlapRight = Math.min(src.x + src.w, tgt.x + tgt.w);
        if (overlapRight - overlapLeft > 24 && srcSide === 'TOP') {
          endX = startX;
        } else {
          endX = Math.max(tgt.x + 40, Math.min(tgt.x + tgt.w - 40, tgt.cx)) + tgtOffset;
        }
      }

      // Líneas ortogonales UML 2.5: solo segmentos rectos con ángulos de 90°
      // (sin curvas Bézier). Un solo escalón intermedio cuando hay desnivel.
      const orthogonalPath = (
        sX: number, sY: number, eX: number, eY: number,
        sSide: AnchorSide, tSide: AnchorSide
      ): { pathD: string; midX: number; midY: number } => {
        // Puntos intermedios para el escalón (mitad del trayecto dominante)
        const midX = (sX + eX) / 2;
        const midY = (sY + eY) / 2;

        let pathD: string;
        let labelMidX: number;
        let labelMidY: number;

        // Casos opuestos horizontales: RIGHT->LEFT o LEFT->RIGHT
        if ((sSide === 'RIGHT' && tSide === 'LEFT') || (sSide === 'LEFT' && tSide === 'RIGHT')) {
          if (Math.abs(sY - eY) < 2) {
            // Misma altura: línea recta horizontal
            pathD = `M ${sX} ${sY} L ${eX} ${eY}`;
            labelMidX = midX;
            labelMidY = sY;
          } else {
            // Escalón: horizontal -> vertical -> horizontal en punto medio X
            pathD = `M ${sX} ${sY} L ${midX} ${sY} L ${midX} ${eY} L ${eX} ${eY}`;
            labelMidX = midX;
            labelMidY = (sY + eY) / 2;
          }
        }
        // Casos opuestos verticales: BOTTOM->TOP o TOP->BOTTOM
        else if ((sSide === 'BOTTOM' && tSide === 'TOP') || (sSide === 'TOP' && tSide === 'BOTTOM')) {
          if (Math.abs(sX - eX) < 2) {
            // Misma vertical: línea recta vertical
            pathD = `M ${sX} ${sY} L ${eX} ${eY}`;
            labelMidX = sX;
            labelMidY = midY;
          } else {
            // Escalón: vertical -> horizontal -> vertical en punto medio Y
            pathD = `M ${sX} ${sY} L ${sX} ${midY} L ${eX} ${midY} L ${eX} ${eY}`;
            labelMidX = (sX + eX) / 2;
            labelMidY = midY;
          }
        }
        // Lados adyacentes: giro en L con un solo ángulo de 90°
        else {
          // Elegir el punto de giro que minimice el trazado: ir primero en la dirección del origen
          let cornerX: number, cornerY: number;
          if (sSide === 'RIGHT' || sSide === 'LEFT') {
            // Salir horizontalmente del origen, luego girar verticalmente hacia el destino
            cornerX = eX;
            cornerY = sY;
            // Si el punto de giro cae dentro del destino, ajustar para no entrar en la caja
            if (tSide === 'TOP' || tSide === 'BOTTOM') {
              cornerX = sSide === 'RIGHT' ? Math.min(eX, sX + Math.abs(eX - sX) * 0.5) : Math.max(eX, sX - Math.abs(eX - sX) * 0.5);
            }
          } else {
            // Salir verticalmente del origen, luego girar horizontalmente hacia el destino
            cornerX = sX;
            cornerY = eY;
          }
          pathD = `M ${sX} ${sY} L ${cornerX} ${cornerY} L ${eX} ${eY}`;
          labelMidX = (sX + cornerX + eX) / 3;
          labelMidY = (sY + cornerY + eY) / 3;
        }

        return { pathD, midX: labelMidX, midY: labelMidY };
      };

      const { pathD, midX, midY } = orthogonalPath(startX, startY, endX, endY, srcSide, tgtSide);

      // Multiplicidad en coordenadas seguras exteriores (fuera de las cajas de clase)
      let srcMultX = startX;
      let srcMultY = startY;
      if (srcSide === 'RIGHT') {
        srcMultX = startX + 10;
        srcMultY = startY - 8;
      } else if (srcSide === 'LEFT') {
        srcMultX = startX - 22;
        srcMultY = startY - 8;
      } else if (srcSide === 'BOTTOM') {
        srcMultX = startX + 10;
        srcMultY = startY + 16;
      } else if (srcSide === 'TOP') {
        srcMultX = startX + 10;
        srcMultY = startY - 10;
      }

      let tgtMultX = endX;
      let tgtMultY = endY;
      if (tgtSide === 'LEFT') {
        tgtMultX = endX - 22;
        tgtMultY = endY - 8;
      } else if (tgtSide === 'RIGHT') {
        tgtMultX = endX + 10;
        tgtMultY = endY - 8;
      } else if (tgtSide === 'TOP') {
        tgtMultX = endX + 10;
        tgtMultY = endY - 10;
      } else if (tgtSide === 'BOTTOM') {
        tgtMultX = endX + 10;
        tgtMultY = endY + 16;
      }

      // UML 2.5: CÃ¡lculo del conector punteado para la Clase Asociativa
      let assocClassPathD: string | undefined = undefined;
      let assocId = rel.associationClassId;

      if (!assocId && (rel.type === 'ASSOCIATION_N_M' || (rel.sourceMultiplicity?.includes('*') && rel.targetMultiplicity?.includes('*')))) {
        // Inferencia automÃ¡tica universal para diagramas con clase asociativa si no estÃ¡ explÃ­citamente seteada
        const candidateAssoc = displayedClasses.find(c =>
          activeAssocClassIds.has(c.id) &&
          c.id !== rel.sourceClassId &&
          c.id !== rel.targetClassId
        );
        if (candidateAssoc) {
          assocId = candidateAssoc.id;
        }
      }

      if (assocId) {
        const assoc = classMap.get(assocId);
        if (assoc) {
          let targetX = assoc.cx;
          let targetY = assoc.y;

          if (midY < assoc.y) {
            targetX = Math.max(assoc.x + 20, Math.min(assoc.x + assoc.w - 20, midX));
            targetY = assoc.y;
          } else if (midY > assoc.y + assoc.h) {
            targetX = Math.max(assoc.x + 20, Math.min(assoc.x + assoc.w - 20, midX));
            targetY = assoc.y + assoc.h;
          } else if (midX < assoc.x) {
            targetX = assoc.x;
            targetY = Math.max(assoc.y + 20, Math.min(assoc.y + assoc.h - 20, midY));
          } else {
            targetX = assoc.x + assoc.w;
            targetY = Math.max(assoc.y + 20, Math.min(assoc.y + assoc.h - 20, midY));
          }

          assocClassPathD = `M ${midX} ${midY} L ${targetX} ${targetY}`;
        }
      }

      return {
        id: rel.id,
        pathD,
        label: rel.label || '',
        srcMultiplicity: rel.sourceMultiplicity || '1',
        tgtMultiplicity: rel.targetMultiplicity || '*',
        type: rel.type,
        sourceClassId: rel.sourceClassId,
        targetClassId: rel.targetClassId,
        startX,
        startY,
        endX,
        endY,
        midX,
        midY,
        srcMultX,
        srcMultY,
        tgtMultX,
        tgtMultY,
        assocClassPathD,
        associationClassId: assocId
      };
    });
  }, [displayedClasses, diagram.relations, dimensionTick, proposalDraft]);

  const userColor = session.currentUser?.avatarColor || 'var(--accent-primary)';

  // ============================================================================
  // REFACTOR 2026-09-26 Ã‚Â· RENDIMIENTO 60 FPS
  // Callbacks ESTABLES (identidad constante) para React.memo de UmlNodeCard y
  // RelationLayer. Patron "latest-ref": un ref se re-asigna en cada render con
  // los handlers frescos, y los useCallback con deps vacias delegan en ese ref.
  // Asi las tarjetas NO se re-renderizan al arrastrar una clase (solo la clase
  // arrastrada), manteniendo el mismo comportamiento previo (incluido STOMP).
  // ============================================================================
  const handleStartCanvasLinking = useCallback((classId: string) => {
    setCardFastLinkerClassId(null);
    setConnectingSourceId(classId);
    setConnectingMousePos(null);
  }, []);

  const handleSelectRelation = useCallback((relationId: string) => {
    setSelectedRelationId(relationId);
    selectedRelationIdRef.current = relationId;
    onSelectClass(null);
  }, [onSelectClass]);

  const handleHoverRelation = useCallback((relationId: string | null) => {
    setHoveredRelationId(relationId);
  }, []);

  const handleClearClassSelection = useCallback(() => {
    setSelectedClassIds(new Set());
    onSelectClass(null);
  }, [onSelectClass, setSelectedClassIds]);

  // Alinear Horizontalmente (Borde Superior)
  const handleAlignTop = () => {
    if (selectedClassIdsRef.current.size < 2) return;
    let minY = Infinity;
    diagram.classes.forEach(c => {
      if (selectedClassIdsRef.current.has(c.id)) {
        minY = Math.min(minY, c.position?.y ?? 100);
      }
    });
    if (!isFinite(minY)) return;

    onUpdateDiagram({
      ...diagram,
      classes: diagram.classes.map(c => selectedClassIdsRef.current.has(c.id) ? { ...c, position: { x: c.position?.x ?? 100, y: minY } } : c),
      updatedAt: new Date().toISOString()
    });
  };

  // Alinear Verticalmente (Borde Izquierdo)
  const handleAlignLeft = () => {
    if (selectedClassIdsRef.current.size < 2) return;
    let minX = Infinity;
    diagram.classes.forEach(c => {
      if (selectedClassIdsRef.current.has(c.id)) {
        minX = Math.min(minX, c.position?.x ?? 100);
      }
    });
    if (!isFinite(minX)) return;

    onUpdateDiagram({
      ...diagram,
      classes: diagram.classes.map(c => selectedClassIdsRef.current.has(c.id) ? { ...c, position: { x: minX, y: c.position?.y ?? 100 } } : c),
      updatedAt: new Date().toISOString()
    });
  };

  // Distribuir Horizontalmente
  const handleDistributeHorizontal = () => {
    if (selectedClassIdsRef.current.size < 3) return;
    const selected = diagram.classes
      .filter(c => selectedClassIdsRef.current.has(c.id))
      .sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0));

    const firstX = selected[0].position?.x ?? 0;
    const lastX = selected[selected.length - 1].position?.x ?? 0;
    const totalSpan = lastX - firstX;
    const spacing = totalSpan / (selected.length - 1);

    const posMap = new Map<string, number>();
    selected.forEach((cls, idx) => {
      posMap.set(cls.id, Math.round((firstX + idx * spacing) / 8) * 8);
    });

    onUpdateDiagram({
      ...diagram,
      classes: diagram.classes.map(c => posMap.has(c.id) ? { ...c, position: { x: posMap.get(c.id) ?? (c.position?.x ?? 100), y: c.position?.y ?? 100 } } : c),
      updatedAt: new Date().toISOString()
    });
  };

  // Duplicar Clases Seleccionadas
  const handleDuplicateSelected = () => {
    if (selectedClassIdsRef.current.size === 0) return;
    const newClasses: ClaseUml[] = [];
    const newSelected = new Set<string>();

    diagram.classes.forEach(c => {
      if (selectedClassIdsRef.current.has(c.id)) {
        const newId = `cls-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const dup: ClaseUml = {
          ...c,
          id: newId,
          name: `${c.name}Copy`,
          position: {
            x: (c.position?.x ?? 100) + 40,
            y: (c.position?.y ?? 100) + 40
          },
          attributes: (c.attributes || []).map(a => ({ ...a, id: `attr-${newId}-${Math.random().toString(36).slice(2, 6)}` })),
          methods: (c.methods || []).map(m => ({ ...m, id: `m-${newId}-${Math.random().toString(36).slice(2, 6)}` }))
        };
        newClasses.push(dup);
        newSelected.add(newId);
      }
    });

    onUpdateDiagram({
      ...diagram,
      classes: [...diagram.classes, ...newClasses],
      updatedAt: new Date().toISOString()
    });
    setSelectedClassIds(newSelected);
  };

  // Eliminar Clases Seleccionadas
  const handleDeleteSelected = () => {
    if (selectedClassIdsRef.current.size === 0) return;
    const toDelete = selectedClassIdsRef.current;
    onUpdateDiagram({
      ...diagram,
      classes: diagram.classes.filter(c => !toDelete.has(c.id)),
      relations: diagram.relations.filter(r => !toDelete.has(r.sourceClassId) && !toDelete.has(r.targetClassId)),
      updatedAt: new Date().toISOString()
    });
    setSelectedClassIds(new Set());
    onSelectClass(null);
  };

  const canvasHandlersRef = useRef<{
    handleClassMouseDown: typeof handleClassMouseDown;
    handleStartEditingClass: typeof handleStartEditingClass;
    handleSaveEditingClass: typeof handleSaveEditingClass;
    handleSaveAttribute: typeof handleSaveAttribute;
    handleSaveMethod: typeof handleSaveMethod;
    handleAddAttributePreset: typeof handleAddAttributePreset;
    handleAddAuditFields: typeof handleAddAuditFields;
    handleFastLinkSubmit: typeof handleFastLinkSubmit;
    handleDeleteRelationSafe: typeof handleDeleteRelationSafe;
    handleStartCanvasLinking: typeof handleStartCanvasLinking;
    handleSelectRelation: typeof handleSelectRelation;
    handleHoverRelation: typeof handleHoverRelation;
    handleClearClassSelection: typeof handleClearClassSelection;
    handleCycleMultiplicity: typeof handleCycleMultiplicity;
    handleUpdateRelation: typeof handleUpdateRelation;
  }>({
    handleClassMouseDown,
    handleStartEditingClass,
    handleSaveEditingClass,
    handleSaveAttribute,
    handleSaveMethod,
    handleAddAttributePreset,
    handleAddAuditFields,
    handleFastLinkSubmit,
    handleDeleteRelationSafe,
    handleStartCanvasLinking,
    handleSelectRelation,
    handleHoverRelation,
    handleClearClassSelection,
    handleCycleMultiplicity,
    handleUpdateRelation
  });
  useEffect(() => {
    canvasHandlersRef.current = {
      handleClassMouseDown,
      handleStartEditingClass,
      handleSaveEditingClass,
      handleSaveAttribute,
      handleSaveMethod,
      handleAddAttributePreset,
      handleAddAuditFields,
      handleFastLinkSubmit,
      handleDeleteRelationSafe,
      handleStartCanvasLinking,
      handleSelectRelation,
      handleHoverRelation,
      handleClearClassSelection,
      handleCycleMultiplicity,
      handleUpdateRelation
    };
  });

  const stableOnClassMouseDown = useCallback((e: React.MouseEvent, cls: ClaseUml) => {
    canvasHandlersRef.current.handleClassMouseDown(e, cls);
  }, []);
  const stableOnStartEditingClass = useCallback((cls: ClaseUml, e: React.MouseEvent) => {
    canvasHandlersRef.current.handleStartEditingClass(cls, e);
  }, []);
  const stableOnSaveEditingClass = useCallback((classId: string, e?: React.FormEvent | React.MouseEvent) => {
    canvasHandlersRef.current.handleSaveEditingClass(classId, e);
  }, []);
  const stableOnSaveAttribute = useCallback((e: React.FormEvent, classId: string) => {
    canvasHandlersRef.current.handleSaveAttribute(e, classId);
  }, []);
  const stableOnSaveMethod = useCallback((e: React.FormEvent, classId: string) => {
    canvasHandlersRef.current.handleSaveMethod(e, classId);
  }, []);
  const stableOnAddAttributePreset = useCallback((classId: string, presetName: string, presetType: AtributoUml['type'], isPk?: boolean) => {
    canvasHandlersRef.current.handleAddAttributePreset(classId, presetName, presetType, isPk);
  }, []);
  const stableOnAddAuditFields = useCallback((classId: string) => {
    canvasHandlersRef.current.handleAddAuditFields(classId);
  }, []);
  const stableOnFastLinkSubmit = useCallback((sourceClassId: string, srcMult?: string, tgtMult?: string) => {
    canvasHandlersRef.current.handleFastLinkSubmit(sourceClassId, srcMult, tgtMult);
  }, []);
  const stableOnDeleteRelation = useCallback((relationId: string) => {
    canvasHandlersRef.current.handleDeleteRelationSafe(relationId);
  }, []);
  const stableOnStartCanvasLinking = useCallback((classId: string) => {
    canvasHandlersRef.current.handleStartCanvasLinking(classId);
  }, []);
  const stableOnSelectRelation = useCallback((relationId: string) => {
    canvasHandlersRef.current.handleSelectRelation(relationId);
  }, []);
  const stableOnHoverRelation = useCallback((relationId: string | null) => {
    canvasHandlersRef.current.handleHoverRelation(relationId);
  }, []);
  const stableOnClearClassSelection = useCallback(() => {
    canvasHandlersRef.current.handleClearClassSelection();
  }, []);
  const stableOnCycleMultiplicity = useCallback((relationId: string, end: 'source' | 'target') => {
    canvasHandlersRef.current.handleCycleMultiplicity(relationId, end);
  }, []);

  return (
    <div
      ref={canvasRef}
      className={`studio-canvas-root ${isPanning ? 'is-panning' : ''} ${(isRelationMode || connectingSourceId) ? 'is-connecting' : ''} ${isSpacePressed ? 'is-space-pressed' : ''}`}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleCanvasDoubleClick}
      onDragOver={handleCanvasDragOver}
      onDragLeave={handleCanvasDragLeave}
      onDrop={handleCanvasDrop}
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        position: 'relative',
        // Pan and zoom use transforms. Clipping prevents keyboard focus from scrolling this viewport.
        overflow: 'clip',
        background: 'var(--bg-canvas)',
        cursor: isPanning ? 'grabbing' : ((isRelationMode || connectingSourceId) ? 'crosshair' : (isSpacePressed ? 'grab' : 'default'))
      }}
    >
      {/* Overlay visual de soltar elemento sobre el lienzo */}
      {isDragOverCanvas && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 45,
            border: '3px dashed var(--accent-primary)',
            background: 'rgba(59, 130, 246, 0.08)',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(2px)'
          }}
        >
          <div
            style={{
              background: 'var(--popover-bg)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '14px',
              padding: '14px 28px',
              color: 'var(--text-primary)',
              fontWeight: 800,
              fontSize: '0.96rem',
              boxShadow: '0 12px 35px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <Plus size={20} color="var(--accent-primary)" />
            <span>Suelta aquÃ­ para colocar el clasificador en el lienzo</span>
          </div>
        </div>
      )}
      {/* Ambient Grid & Dot Pattern Sincronizado 1:1 con Pan y Zoom */}
        <CanvasBackdrop pan={pan} zoom={zoom} />

      {/* SVG Definitions & Relation Lines Layer (Ãrea masiva de 200,000px sin fronteras ni cortes) */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '200000px',
          height: '200000px',
          overflow: 'visible',
          pointerEvents: 'none',
          zIndex: 15,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        <SvgDefs />

        {/* Render Connection Lines (UML 2.5 rigorous rendering) */}
        <RelationLayer
          deletionIds={new Set((proposalDraft?.deletions||[]).flatMap(d=>d.kind==='relation'?[d.targetId]:d.affectedRelationIds))}
          draftIds={ghostRelationIds}
          paths={relationPaths}
          selectedRelationId={selectedRelationId}
          hoveredRelationId={hoveredRelationId}
          onSelectRelation={id=>{if(ghostRelationIds.has(id))onInspectDraft?.(id);else stableOnSelectRelation(id);}}
          onHoverRelation={stableOnHoverRelation}
          onDeleteRelation={stableOnDeleteRelation}
          onClearClassSelection={stableOnClearClassSelection}
          onCycleMultiplicity={stableOnCycleMultiplicity}
        />

        {/* LÃ­nea elÃ¡stica interactiva que sigue el ratÃ³n mientras se conecta (Rubber-band) */}
        {connectingSourceId && connectingMousePos && (() => {
          const src = diagram.classes.find(c => c.id === connectingSourceId);
          if (!src) return null;
          const srcDims = nodeDimensionsRef.current.get(connectingSourceId) || { w: 330, h: 160 };
          const srcX = (src.position?.x || 100) + srcDims.w / 2;
          const srcY = (src.position?.y || 100) + srcDims.h / 2;
          return (
            <g pointerEvents="none" className="rubber-band-layer">
              <line
                x1={srcX}
                y1={srcY}
                x2={connectingMousePos.x}
                y2={connectingMousePos.y}
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                style={{ filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.8))' }}
              />
              <circle
                cx={connectingMousePos.x}
                cy={connectingMousePos.y}
                r="6"
                fill="#38bdf8"
                style={{ filter: 'drop-shadow(0 0 8px #38bdf8)' }}
              />
            </g>
          );
        })()}

        {/* Recuadro de Selección Múltiple (Marquee / Box Selection) */}
        {marqueeBox && (
          <g pointerEvents="none" className="marquee-selection-box">
            <rect
              x={Math.min(marqueeBox.startX, marqueeBox.currentX)}
              y={Math.min(marqueeBox.startY, marqueeBox.currentY)}
              width={Math.abs(marqueeBox.currentX - marqueeBox.startX)}
              height={Math.abs(marqueeBox.currentY - marqueeBox.startY)}
              fill="rgba(56, 189, 248, 0.12)"
              stroke="#38bdf8"
              strokeWidth={1.5 / zoom}
              strokeDasharray={`${4 / zoom} ${3 / zoom}`}
              rx={3 / zoom}
            />
          </g>
        )}
      </svg>

      {/* Connecting Mode Banner */}
      {(isRelationMode || connectingSourceId) && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--popover-bg)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--accent-cyan)',
            borderRadius: '12px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 30px var(--glow-cyan)',
            zIndex: 60
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <LinkIcon size={16} color="var(--accent-cyan)" />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {connectingSourceId
                ? `Conectar: [${diagram.classes.find(c => c.id === connectingSourceId)?.name || 'Origen'}] âž” Haz clic en la tabla DESTINO`
                : 'Modo ConexiÃ³n: Haz clic en la tabla ORIGEN en el lienzo'}
            </span>
            {selectedRelationType === 'ASSOCIATION_N_M' && (
              <span style={{
                background: 'rgba(168, 85, 247, 0.25)',
                border: '1px solid #a855f7',
                color: '#e9d5ff',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.68rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Sparkles size={11} color="#fef08a" />
                <span>Auto-descomposiciÃ³n en Tabla Intermedia (UML 2.5 / 3FN)</span>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {([
              { key: 'ASSOCIATION_1_1' as TipoRelacion, label: '1:1' },
              { key: 'ASSOCIATION_1_N' as TipoRelacion, label: '1:N' },
              { key: 'ASSOCIATION_N_M' as TipoRelacion, label: 'N:M' },
              { key: 'ASSOCIATION_BINARY' as TipoRelacion, label: 'Binaria' },
              { key: 'AGGREGATION' as TipoRelacion, label: 'AgregaciÃ³n' },
              { key: 'COMPOSITION' as TipoRelacion, label: 'ComposiciÃ³n' },
              { key: 'INHERITANCE' as TipoRelacion, label: 'Herencia' },
              { key: 'REALIZATION' as TipoRelacion, label: 'RealizaciÃ³n' },
              { key: 'DEPENDENCY' as TipoRelacion, label: 'Dependencia' },
              { key: 'USAGE' as TipoRelacion, label: 'Â«useÂ»' },
              { key: 'PACKAGE_IMPORT' as TipoRelacion, label: 'Â«importÂ»' },
              { key: 'NON_NAVIGABLE' as TipoRelacion, label: 'No Nav. âœ•' }
            ]).map(rt => (
              <button
                key={rt.key}
                onClick={() => setSelectedRelationType(rt.key)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.70rem',
                  fontWeight: 700,
                  border: 'none',
                  background: selectedRelationType === rt.key ? 'var(--accent-primary)' : 'var(--glass-surface-hover)',
                  color: selectedRelationType === rt.key ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                {rt.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setConnectingSourceId(null);
              setConnectingMousePos(null);
              setIsRelationMode(false);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Cancelar conexiÃ³n"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Barra Flotante de GestiÃ³n de RelaciÃ³n Seleccionada (HUD ErgonÃ³mico y Compacto) */}
      {selectedRelationId && (() => {
        const rel = diagram.relations.find(r => r.id === selectedRelationId);
        if (!rel) return null;
        const src = diagram.classes.find(c => c.id === rel.sourceClassId);
        const tgt = diagram.classes.find(c => c.id === rel.targetClassId);
        const canEdit = !userPermissions || userPermissions.canEditDiagram;
        const isSpecialNoMult = ['INHERITANCE', 'REALIZATION', 'DEPENDENCY', 'USAGE', 'PACKAGE_IMPORT'].includes(rel.type);
        const isManyToMany = rel.type === 'ASSOCIATION_N_M' ||
          (['*', '0..*', '1..*'].includes(rel.sourceMultiplicity || '') && ['*', '0..*', '1..*'].includes(rel.targetMultiplicity || ''));

        // Modo colapsado (pÃ­ldora minimalista que no tapa nada en el lienzo)
        if (isRelationBarCollapsed) {
          return (
            <div
              className="relation-action-bar"
              style={{
                position: 'absolute',
                top: relationBarPosition === 'top' ? '16px' : 'auto',
                bottom: relationBarPosition === 'bottom' ? '82px' : 'auto',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(23, 26, 74, 0.94)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(232, 195, 158, 0.35)',
                borderRadius: '24px',
                padding: '5px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 8px 24px rgba(0, 0, 32, 0.65), 0 0 16px rgba(232, 195, 158, 0.15)',
                zIndex: 70,
                animation: 'fadeIn 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Link2 size={14} color="#e8c39e" />
                <span style={{ color: '#f5e1ce', fontWeight: 800, fontSize: '0.76rem' }}>
                  {src?.name || 'Origen'}
                </span>
                <span style={{ color: '#e8c39e', fontSize: '0.72rem' }}>âž”</span>
                <span style={{ color: '#f5e1ce', fontWeight: 800, fontSize: '0.76rem' }}>
                  {tgt?.name || 'Destino'}
                </span>
              </div>

              <span style={{
                background: 'rgba(232, 195, 158, 0.18)',
                color: '#e8c39e',
                border: '1px solid rgba(232, 195, 158, 0.3)',
                borderRadius: '6px',
                padding: '2px 6px',
                fontSize: '0.68rem',
                fontWeight: 800,
                fontFamily: 'monospace'
              }}>
                {rel.type.replace('ASSOCIATION_', '')} {!isSpecialNoMult && `(${rel.sourceMultiplicity || '1'}:${rel.targetMultiplicity || '*'})`}
              </span>

              <div style={{ width: '1px', height: '16px', background: 'rgba(245, 225, 206, 0.15)' }} />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRelationBarCollapsed(false);
                }}
                className="btn-studio-glass"
                style={{
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#f5e1ce',
                  borderRadius: '6px',
                  border: '1px solid rgba(232, 195, 158, 0.25)'
                }}
                title="Expandir panel de relaciÃ³n"
              >
                <span>Editar</span>
                <ChevronDown size={13} />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRelationBarPosition(p => p === 'top' ? 'bottom' : 'top');
                }}
                className="btn-studio-glass"
                style={{
                  padding: '3px 6px',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title={relationBarPosition === 'top' ? 'Mover al fondo' : 'Mover al tope'}
              >
                <ArrowUpDown size={13} />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRelationId(null);
                  selectedRelationIdRef.current = null;
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '3px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Deseleccionar relaciÃ³n (Escape)"
              >
                <X size={14} />
              </button>
            </div>
          );
        }

        // Modo completo: HUD estructurado en 2 filas compactas, sin scrollbar horizontal
        return (
          <div
            className="relation-action-bar"
            style={{
              position: 'absolute',
              top: relationBarPosition === 'top' ? '14px' : 'auto',
              bottom: relationBarPosition === 'bottom' ? '82px' : 'auto',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(23, 26, 74, 0.96)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(232, 195, 158, 0.32)',
              borderRadius: '16px',
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow: '0 12px 40px rgba(0, 0, 32, 0.65), 0 0 20px rgba(232, 195, 158, 0.14)',
              zIndex: 70,
              maxWidth: '96vw',
              width: 'max-content',
              animation: 'scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Fila 1: Entidades conectadas, Rol/Etiqueta y Acciones principales */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
              {/* Clases conectadas con botÃ³n de inversiÃ³n */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: 'rgba(232, 195, 158, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#e8c39e',
                  flexShrink: 0
                }}>
                  <Link2 size={13} />
                </div>

                <span style={{
                  color: '#f5e1ce',
                  background: 'rgba(47, 44, 121, 0.55)',
                  border: '1px solid rgba(232, 195, 158, 0.25)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-heading)'
                }}>
                  {src?.name || 'Origen'}
                </span>

                {canEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInvertRelation(rel.id);
                    }}
                    className="btn-studio-glass"
                    style={{
                      padding: '3px 7px',
                      fontSize: '0.72rem',
                      borderRadius: '6px',
                      color: '#e8c39e',
                      cursor: 'pointer',
                      border: '1px solid rgba(232, 195, 158, 0.25)'
                    }}
                    title="Invertir direcciÃ³n Origen â‡„ Destino"
                  >
                    â‡„
                  </button>
                )}

                <span style={{
                  color: '#f5e1ce',
                  background: 'rgba(47, 44, 121, 0.55)',
                  border: '1px solid rgba(232, 195, 158, 0.25)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-heading)'
                }}>
                  {tgt?.name || 'Destino'}
                </span>
              </div>

              {/* Rol / Etiqueta de la relaciÃ³n */}
              {canEdit && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.70rem', color: '#e8c39e', fontWeight: 700, textTransform: 'uppercase' }}>
                    Rol:
                  </span>
                  <input
                    type="text"
                    value={rel.label || ''}
                    placeholder="ej. tiene, compone"
                    onChange={(e) => {
                      e.stopPropagation();
                      handleUpdateRelation(rel.id, { label: e.target.value });
                    }}
                    style={{
                      width: '120px',
                      background: 'rgba(15, 23, 42, 0.65)',
                      border: '1px solid rgba(245, 225, 206, 0.18)',
                      color: '#f5e1ce',
                      borderRadius: '7px',
                      padding: '4px 8px',
                      fontSize: '0.74rem',
                      outline: 'none'
                    }}
                  />
                </div>
              )}

              {/* Botones de acciÃ³n derecha */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {/* Descomponer N:M si corresponde */}
                {canEdit && isManyToMany && src && tgt && (
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        createIntermediateTableNM(src, tgt, rel.id);
                      }}
                      className="btn-studio-primary"
                      style={{
                        background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                        border: '1px solid rgba(168, 85, 247, 0.6)',
                        padding: '4px 9px',
                        fontSize: '0.72rem',
                        borderRadius: '7px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 2px 10px rgba(124, 58, 237, 0.4)'
                      }}
                      title="Descomponer automÃ¡ticamente en Tabla Intermedia (UML 2.5 / 3FN)"
                    >
                      <Sparkles size={12} color="#fef08a" />
                      <span>Descomponer (3FN)</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDecomposerModalData({ srcClass: src, tgtClass: tgt, relIdToRemove: rel.id });
                      }}
                      className="btn-studio-glass"
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.72rem',
                        borderRadius: '7px',
                        color: '#e9d5ff',
                        border: '1px solid rgba(168, 85, 247, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Personalizar tabla intermedia a mano"
                    >
                      <Settings size={12} />
                    </button>
                  </div>
                )}

                {/* BotÃ³n Eliminar */}
                {canEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRelationSafe(rel.id);
                    }}
                    style={{
                      background: 'rgba(244, 63, 94, 0.16)',
                      border: '1px solid rgba(244, 63, 94, 0.4)',
                      color: '#fb7185',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      padding: '4px 8px',
                      borderRadius: '7px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                    title="Eliminar esta conexiÃ³n (Tecla Supr)"
                  >
                    <Trash2 size={12} />
                    <span>Eliminar</span>
                  </button>
                )}

                <div style={{ width: '1px', height: '16px', background: 'rgba(245, 225, 206, 0.15)', margin: '0 2px' }} />

                {/* BotÃ³n de Alternar PosiciÃ³n Arriba/Abajo */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRelationBarPosition(p => p === 'top' ? 'bottom' : 'top');
                  }}
                  className="btn-studio-glass"
                  style={{
                    padding: '4px 6px',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    borderRadius: '5px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={relationBarPosition === 'top' ? 'Mover barra al fondo de la pantalla' : 'Mover barra a la parte superior'}
                >
                  <ArrowUpDown size={13} />
                </button>

                {/* BotÃ³n Minimizar */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRelationBarCollapsed(true);
                  }}
                  className="btn-studio-glass"
                  style={{
                    padding: '4px 6px',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    borderRadius: '5px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Minimizar barra a pÃ­ldora compacta"
                >
                  <ChevronUp size={13} />
                </button>

                {/* BotÃ³n Cerrar selecciÃ³n */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRelationId(null);
                    selectedRelationIdRef.current = null;
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '5px'
                  }}
                  title="Deseleccionar conexiÃ³n (Escape)"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Fila 2: SemÃ¡ntica UML, Multiplicidades y Presets en 1 clic */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderTop: '1px solid rgba(245, 225, 206, 0.1)',
              paddingTop: '8px'
            }}>
              {/* Selector de Tipo de RelaciÃ³n */}
              {canEdit && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.68rem', color: '#e8c39e', fontWeight: 700, textTransform: 'uppercase' }}>
                    Tipo:
                  </span>
                  <select
                    value={rel.type}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleChangeRelationType(rel.id, e.target.value as TipoRelacion);
                    }}
                    style={{
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: '1px solid rgba(232, 195, 158, 0.28)',
                      color: '#f5e1ce',
                      borderRadius: '7px',
                      padding: '4px 8px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="ASSOCIATION_1_N">1:N (Uno a Muchos)</option>
                    <option value="ASSOCIATION_1_1">1:1 (Uno a Uno)</option>
                    <option value="ASSOCIATION_N_M">N:M (Muchos a Muchos)</option>
                    <option value="ASSOCIATION_BINARY">Binaria Simple</option>
                    <option value="ASSOCIATION_CLASS">Clase Asociativa (â•Œ)</option>
                    <option value="COMPOSITION">ComposiciÃ³n (â—† Todo-Parte)</option>
                    <option value="AGGREGATION">AgregaciÃ³n (â—‡ Agregado)</option>
                    <option value="INHERITANCE">Herencia (â–³ Extiende)</option>
                    <option value="REALIZATION">RealizaciÃ³n (â•Œâ–³ Implementa)</option>
                    <option value="DEPENDENCY">Dependencia (â•Œ&gt; Usa)</option>
                    <option value="USAGE">Â«useÂ» (Uso)</option>
                    <option value="PACKAGE_IMPORT">Â«importÂ»</option>
                    <option value="NON_NAVIGABLE">No Navegable (âœ•)</option>
                  </select>
                </div>
              )}

              {/* Selectores de Cardinalidad / Multiplicidad */}
              {canEdit && !isSpecialNoMult && (
                <>
                  <div style={{ width: '1px', height: '18px', background: 'rgba(245, 225, 206, 0.12)', flexShrink: 0 }} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Card:</span>
                    <select
                      value={rel.sourceMultiplicity || '1'}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleUpdateRelation(rel.id, { sourceMultiplicity: e.target.value });
                      }}
                      style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(232, 195, 158, 0.35)',
                        color: '#e8c39e',
                        borderRadius: '6px',
                        padding: '3px 6px',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        cursor: 'pointer'
                      }}
                      title="Multiplicidad del extremo origen"
                    >
                      <option value="1">1</option>
                      <option value="0..1">0..1</option>
                      <option value="*">*</option>
                      <option value="0..*">0..*</option>
                      <option value="1..*">1..*</option>
                    </select>

                    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>âž”</span>

                    <select
                      value={rel.targetMultiplicity || '*'}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleUpdateRelation(rel.id, { targetMultiplicity: e.target.value });
                      }}
                      style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(232, 195, 158, 0.35)',
                        color: '#e8c39e',
                        borderRadius: '6px',
                        padding: '3px 6px',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        cursor: 'pointer'
                      }}
                      title="Multiplicidad del extremo destino"
                    >
                      <option value="*">*</option>
                      <option value="0..*">0..*</option>
                      <option value="1..*">1..*</option>
                      <option value="1">1</option>
                      <option value="0..1">0..1</option>
                    </select>
                  </div>

                  <div style={{ width: '1px', height: '18px', background: 'rgba(245, 225, 206, 0.12)', flexShrink: 0 }} />

                  {/* Presets RÃ¡pidos de Cardinalidad en 1 clic */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '2px' }}>
                      Presets:
                    </span>
                    {[
                      { label: '1:N', src: '1', tgt: '0..*', type: 'ASSOCIATION_1_N' },
                      { label: '1:1', src: '1', tgt: '1', type: 'ASSOCIATION_1_1' },
                      { label: 'N:M', src: '*', tgt: '*', type: 'ASSOCIATION_N_M' },
                      { label: '0..1 : 1', src: '0..1', tgt: '1', type: 'ASSOCIATION_1_1' },
                      { label: '1 : 1..*', src: '1', tgt: '1..*', type: 'COMPOSITION' }
                    ].map(p => {
                      const isActive = (rel.sourceMultiplicity === p.src && rel.targetMultiplicity === p.tgt);
                      return (
                        <button
                          key={p.label}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateRelation(rel.id, {
                              sourceMultiplicity: p.src,
                              targetMultiplicity: p.tgt,
                              type: p.type as TipoRelacion
                            });
                          }}
                          style={{
                            padding: '3px 7px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            background: isActive ? 'rgba(232, 195, 158, 0.24)' : 'rgba(255, 255, 255, 0.05)',
                            border: isActive ? '1px solid #e8c39e' : '1px solid rgba(245, 225, 206, 0.12)',
                            color: isActive ? '#f5e1ce' : 'var(--text-secondary)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          title={`Aplicar cardinalidad ${p.label}`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Selector de Clase Asociativa Vinculada (UML 2.5) */}
                  <div style={{ width: '1px', height: '18px', background: 'rgba(245, 225, 206, 0.12)', flexShrink: 0 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.66rem', color: '#e8c39e', fontWeight: 700 }} title="Vincular con una Clase Asociativa (LÃ­nea discontinua UML 2.5)">
                      Clase Asoc:
                    </span>
                    <select
                      value={rel.associationClassId || ''}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleUpdateRelation(rel.id, { associationClassId: e.target.value || undefined });
                      }}
                      style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(232, 195, 158, 0.28)',
                        color: '#f5e1ce',
                        borderRadius: '6px',
                        padding: '3px 6px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">(Ninguna)</option>
                      {diagram.classes
                        .filter(c => c.id !== rel.sourceClassId && c.id !== rel.targetClassId)
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.stereotype === 'AssociationClass' ? 'Â«AssocÂ»' : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Banner de Modo Solo Lectura (RBAC) */}
      {userPermissions && !userPermissions.canEditDiagram && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(232, 195, 158, 0.16)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(232, 195, 158, 0.4)',
            borderRadius: '12px',
            padding: '8px 18px',
            zIndex: 65,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#e8c39e',
            fontSize: '0.78rem',
            fontWeight: 700,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)'
          }}
        >
          <Lock size={15} />
          <span>Modo Solo Lectura (Rol: {userRole || 'Observador'}) Â· EdiciÃ³n y arrastre de tablas restringidos</span>
        </div>
      )}

      {/* Main Canvas Workspace */}
      <div
        id="canvas-workspace-layer"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: '200000px',
          height: '200000px',
          overflow: 'visible',
          pointerEvents: 'none',
          zIndex: 10
        }}
      >
        {/* Render Interactive UML Class Nodes */}
        {displayedClasses.map(cls => (
          <UmlNodeCard
            key={cls.id}
            proposedDeletion={proposalDraft?.deletions?.some(d=>d.kind==='class'?d.targetId===cls.id:d.classId===cls.id)}
            cls={cls}
            draft={ghostIds.has(cls.id)}
            diagram={ghostIds.has(cls.id)?{...diagram,classes:displayedClasses,relations:[...diagram.relations,...(proposalDraft?.relations || [])]}:diagram}
            isSelected={selectedClassIds.has(cls.id) || selectedClassId === cls.id}
            isConnectingSource={connectingSourceId === cls.id}
            isConnectingTarget={Boolean(connectingSourceId && connectingSourceId !== cls.id)}
            isDragging={draggingClassId === cls.id || Boolean(draggingClassId && selectedClassIds.has(draggingClassId) && selectedClassIds.has(cls.id))}
            isRemoteDragging={Boolean(remoteDraggingNodes?.[cls.id] && draggingClassId !== cls.id)}
            remoteDragInfo={remoteDraggingNodes?.[cls.id]}
            canEdit={!ghostIds.has(cls.id) && (!userPermissions || userPermissions.canEditDiagram)}
            editingClassId={editingClassId}
            editingClassName={editingClassName}
            editingClassStereotype={editingClassStereotype}
            cardFastLinkerClassId={cardFastLinkerClassId}
            fastLinkTargetClassId={fastLinkTargetClassId}
            fastLinkRelType={fastLinkRelType}
            fastLinkLabel={fastLinkLabel}
            addingAttrClassId={addingAttrClassId}
            attrName={attrName}
            attrType={attrType}
            attrVis={attrVis}
            attrIsPk={attrIsPk}
            addingMethodClassId={addingMethodClassId}
            methodName={methodName}
            methodReturnType={methodReturnType}
            methodParams={methodParams}
            methodVis={methodVis}
            selectedRelationId={selectedRelationId}
            nodeDimensionsRef={nodeDimensionsRef}
            setDimensionTick={setDimensionTick}
            onMouseDown={ghostIds.has(cls.id)?onGhostMouseDown:stableOnClassMouseDown}
            onStartEditingClass={stableOnStartEditingClass}
            onSaveEditingClass={stableOnSaveEditingClass}
            onDeleteClass={onDeleteClass}
            onDeleteAttribute={onDeleteAttribute}
            onDeleteMethod={onDeleteMethod}
            onSaveAttribute={stableOnSaveAttribute}
            onSaveMethod={stableOnSaveMethod}
            onAddAttributePreset={stableOnAddAttributePreset}
            onAddAuditFields={stableOnAddAuditFields}
            onFastLinkSubmit={stableOnFastLinkSubmit}
            onStartCanvasLinking={stableOnStartCanvasLinking}
            onDeleteRelation={stableOnDeleteRelation}
            onAutoCompletarClase={onAutoCompletarClase}
            setEditingClassStereotype={setEditingClassStereotype}
            setEditingClassName={setEditingClassName}
            setEditingClassId={setEditingClassId}
            setCardFastLinkerClassId={setCardFastLinkerClassId}
            setFastLinkTargetClassId={setFastLinkTargetClassId}
            setFastLinkRelType={setFastLinkRelType}
            setFastLinkLabel={setFastLinkLabel}
            setAddingAttrClassId={setAddingAttrClassId}
            setAttrName={setAttrName}
            setAttrType={setAttrType}
            setAttrVis={setAttrVis}
            setAttrIsPk={setAttrIsPk}
            setAddingMethodClassId={setAddingMethodClassId}
            setMethodName={setMethodName}
            setMethodReturnType={setMethodReturnType}
            setMethodParams={setMethodParams}
            setMethodVis={setMethodVis}
            setSelectedRelationId={setSelectedRelationId}
          />
        ))}

        {/* Halo de Enfoque Activo (Spotlight Quick Search) */}
        {focusedClassPulseId && (() => {
          const focusedCls = displayedClasses.find(c => c.id === focusedClassPulseId);
          if (!focusedCls) return null;
          const pos = focusedCls.position || { x: 100, y: 100 };
          const dims = nodeDimensionsRef.current.get(focusedClassPulseId) || { w: 330, h: 220 };
          return (
            <div
              style={{
                position: 'absolute',
                left: `${pos.x - 10}px`,
                top: `${pos.y - 10}px`,
                width: `${dims.w + 20}px`,
                height: `${dims.h + 20}px`,
                borderRadius: '14px',
                border: '2px solid #38bdf8',
                boxShadow: '0 0 40px rgba(56, 189, 248, 0.8), inset 0 0 20px rgba(56, 189, 248, 0.3)',
                pointerEvents: 'none',
                zIndex: 35,
                animation: 'pulse 0.9s ease-in-out infinite'
              }}
            />
          );
        })()}

        {/* Ã°Å¸â€˜Â¥ Remote Collaborators Cursors Layer (Diagram World Space - CU-03) */}
        {!session.isLocalMode && activeRemoteCursors.map(c => (
          <div
            key={c.id}
            className="collaborative-cursor"
            style={{
              position: 'absolute',
              left: `${c.x}px`,
              top: `${c.y}px`,
              zIndex: 50,
              pointerEvents: 'none',
              transition: 'left 0.08s ease-out, top 0.08s ease-out'
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              style={{
                filter: `drop-shadow(0 2px 6px ${c.color}99)`,
                overflow: 'visible'
              }}
            >
              <path
                d="M 1 1 L 7.5 19.5 L 10.5 12.5 L 17.5 9.5 Z"
                fill={c.color}
                stroke="#ffffff"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            <div
              className="cursor-pill"
              style={{
                backgroundColor: c.color,
                marginTop: '2px',
                marginLeft: '10px'
              }}
            >
              <Sparkles size={10} />
              <span>{c.name}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbox de Modelado UML 2.5+ (Clasificadores, Conectores, Patrones) */}
      {isToolboxOpen && (
        <ToolboxUml25
          onInsertClassifier={handleInsertClassifierFromToolbox}
          onActivateRelationMode={handleActivateRelationFromToolbox}
          onInsertPattern={handleInsertPatternFromToolbox}
          isRelationModeActive={Boolean(connectingSourceId)}
          activeRelationType={selectedRelationType}
          onCancelRelationMode={() => setConnectingSourceId(null)}
          onMouseEnterToolbox={() => {
            isMouseOverUiPanel.current = true;
          }}
          onMouseLeaveToolbox={() => {
            isMouseOverUiPanel.current = false;
          }}
          onDragEndToolbox={() => {
            setIsDragOverCanvas(false);
            isPanningRef.current = false;
            setIsPanning(false);
            draggingClassIdRef.current = null;
            setDraggingClassId(null);
            stopAutoPanLoop();
            onDragStateChange?.(false);
          }}
        />
      )}

      {/* Dock Unificado de Comandos y Herramientas del Lienzo (Glassmorphism HUD) */}
      {isDockCollapsed ? (
        <button
          onClick={() => setIsDockCollapsed(false)}
          className="glass-command-dock-toggle"
          title="Desplegar barra de herramientas y comandos"
          style={{
            position: 'absolute',
            bottom: '18px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 45,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--glass-topbar-bg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--glass-topbar-border)',
            borderRadius: '20px',
            padding: '6px 14px',
            boxShadow: 'var(--glass-topbar-shadow)',
            color: 'var(--text-primary)',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <Zap size={14} color="var(--accent-primary)" />
          <span>ArchAI Dock</span>
          <ChevronUp size={14} color="var(--text-secondary)" />
        </button>
      ) : (
        <div
          className="glass-command-dock"
          style={{
            position: 'absolute',
            bottom: '18px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 45,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--glass-topbar-bg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--glass-topbar-border)',
            borderRadius: '16px',
            padding: '6px 10px',
            boxShadow: 'var(--glass-topbar-shadow)',
            maxWidth: 'calc(100% - 24px)',
            overflowX: 'auto'
          }}
        >
          {/* BotÃ³n de Acceso Directo a Toolbox UML 2.5+ */}
          <button
            onClick={() => setIsToolboxOpen(prev => !prev)}
            aria-expanded={isToolboxOpen}
            className="btn-studio-glass dock-btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              color: isToolboxOpen ? '#e8c39e' : 'var(--text-secondary)',
              background: isToolboxOpen ? 'rgba(232, 195, 158, 0.20)' : undefined,
              borderColor: isToolboxOpen ? 'rgba(232, 195, 158, 0.50)' : undefined,
              boxShadow: isToolboxOpen ? '0 0 14px rgba(232, 195, 158, 0.30)' : undefined,
              whiteSpace: 'nowrap'
            }}
            title="Toolbox UML 2.5+ (Clasificadores, Conectores y Patrones)"
          >
            <Boxes size={14} color="#e8c39e" />
            <span className="dock-btn-label">Toolbox UML 2.5+</span>
          </button>

          {/* Grupo 1: Acciones de Modelado */}
          <button
            onClick={() => setShowNewClassModal(true)}
            className="btn-studio-primary dock-btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              whiteSpace: 'nowrap'
            }}
            title="Crear nueva tabla/clase con asistente de campos y enlace rÃ¡pido"
          >
            <Plus size={14} />
            <span className="dock-btn-label">Nueva Tabla</span>
          </button>

          <button
            onClick={() => setShowTemplatesModal(true)}
            className="btn-studio-glass dock-btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap'
            }}
            title="Insertar arquitectura completa en 1 clic (E-Commerce, Hospital, Universidad, RBAC)"
          >
            <Zap size={14} color="#e8c39e" />
            <span className="dock-btn-label">Plantillas</span>
          </button>

          {diagram.classes.length >= 2 && (
            <button
              onClick={() => setExtractSuperclassClasses(diagram.classes)}
              className="btn-studio-glass dock-btn"
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                color: '#a78bfa',
                background: 'rgba(167, 139, 250, 0.12)',
                borderColor: 'rgba(167, 139, 250, 0.35)',
                whiteSpace: 'nowrap'
              }}
              title="Detectar atributos comunes y extraer una Superclase abstracta con relaciones de Herencia (UML 2.5)"
            >
              <Sparkles size={14} color="#a78bfa" />
              <span className="dock-btn-label">Extraer Herencia</span>
            </button>
          )}

          <button
            onClick={() => {
              if (diagram.classes.length >= 2) {
                setConnectingSourceId(diagram.classes[0].id);
              }
            }}
            className="btn-studio-glass dock-btn"
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              whiteSpace: 'nowrap'
            }}
            title="Activar modo de conexiÃ³n visual entre clases del lienzo"
          >
            <Link2 size={14} color="#e8c39e" />
            <span className="dock-btn-label">Conectar</span>
          </button>

          {/* Divisor */}
          <div className="dock-divider" style={{ width: '1px', height: '18px', background: 'var(--glass-topbar-border)', margin: '0 2px' }} />

          {/* Grupo 2: Herramientas del Lienzo */}
          <button
            onClick={handleAutoOrganize}
            className="btn-studio-glass dock-btn"
            style={{
              padding: '6px 10px',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              whiteSpace: 'nowrap'
            }}
            title="Auto-organizar clases en columnas arquitectÃ³nicas limpias"
          >
            <LayoutGrid size={14} />
            <span className="dock-btn-label">Auto-Organizar</span>
          </button>

          {onOpenWhiteboard && (
            <button
              onClick={onOpenWhiteboard}
              className="btn-studio-glass dock-btn"
              style={{
                padding: '6px 10px',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap'
              }}
              title="Digitalizar diagrama dibujado a mano con IA"
            >
              <Camera size={14} />
              <span className="dock-btn-label">Pizarra OCR</span>
            </button>
          )}

          {onToggleAiAssistant && (
            <button
              onClick={onToggleAiAssistant}
              className="btn-studio-glass dock-btn"
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                color: isAiAssistantOpen ? '#000020' : '#e8c39e',
                background: isAiAssistantOpen ? '#e8c39e' : '#2f2c79',
                borderColor: isAiAssistantOpen ? '#e8c39e' : 'rgba(245, 225, 206, 0.14)',
                boxShadow: isAiAssistantOpen ? '0 0 16px rgba(232, 195, 158, 0.45)' : undefined,
                whiteSpace: 'nowrap'
              }}
              title="Alternar asistente de IA por voz y lenguaje natural"
            >
              <Sparkles size={14} color={isAiAssistantOpen ? '#000020' : '#e8c39e'} />
              <span className="dock-btn-label">Asistente IA</span>
            </button>
          )}

          {/* Divisor */}
          <div className="dock-divider" style={{ width: '1px', height: '18px', background: 'var(--glass-topbar-border)', margin: '0 2px' }} />

          {/* Grupo 3: Zoom, Vista y Paleta de Cursor */}
          <button
            onClick={() => handleZoomStep(-0.15)}
            className="dock-icon-btn"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '5px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Alejar (Zoom Out)"
          >
            <ZoomOut size={15} />
          </button>

          <button
            onClick={() => handleFitToScreen()}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '0.74rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              minWidth: '42px',
              textAlign: 'center',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: '4px'
            }}
            title="Click o Doble Clic en el fondo del lienzo para centrar y auto-ajustar todo (Zoom 5% - 400%)"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            onClick={() => handleZoomStep(0.15)}
            className="dock-icon-btn"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '5px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Acercar (Zoom In)"
          >
            <ZoomIn size={15} />
          </button>

          <button
            onClick={() => handleFitToScreen()}
            className="dock-icon-btn"
            style={{
              background: '#2f2c79',
              border: '1px solid #171a4a',
              color: '#f5e1ce',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.74rem',
              fontWeight: 700
            }}
            title="Ajustar y centrar diagrama a la pantalla (evita desbordamientos)"
          >
            <Maximize2 size={13} />
            <span className="dock-btn-label">Ajustar</span>
          </button>

          {/* Selector de Modo de Rueda del RatÃ³n: Zoom vs Desplazamiento (Alt + M) */}
          <button
            onClick={() => setWheelZoomMode(m => m === 'zoom' ? 'pan' : 'zoom')}
            className="dock-icon-btn"
            style={{
              background: wheelZoomMode === 'zoom' ? 'rgba(77, 163, 255, 0.16)' : 'rgba(255, 255, 255, 0.06)',
              border: `1px solid ${wheelZoomMode === 'zoom' ? 'rgba(77, 163, 255, 0.42)' : 'rgba(255, 255, 255, 0.14)'}`,
              color: wheelZoomMode === 'zoom' ? '#60a5fa' : 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              fontWeight: 600,
              transition: 'all 0.15s ease'
            }}
            title={
              wheelZoomMode === 'zoom'
                ? 'Modo Rueda: ZOOM ACTIVO (la rueda hace zoom). Clic para cambiar a Desplazamiento de lienzo (Alt + M)'
                : 'Modo Rueda: DESPLAZAMIENTO ACTIVO (la rueda hace scroll, Ctrl+Rueda hace zoom). Clic para cambiar a Zoom directo (Alt + M)'
            }
          >
            <Mouse size={13} />
            <span className="dock-btn-label">
              {wheelZoomMode === 'zoom' ? 'Rueda: Zoom' : 'Rueda: Scroll'}
            </span>
          </button>

          {/* Selector de Herramienta: Modo Selección (Marquee) vs Modo Mano (Pan) */}
          <button
            onClick={() => setCanvasTool(t => t === 'select' ? 'pan' : 'select')}
            className="dock-icon-btn"
            style={{
              background: canvasTool === 'select' ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.06)',
              border: `1px solid ${canvasTool === 'select' ? 'rgba(56, 189, 248, 0.42)' : 'rgba(255, 255, 255, 0.14)'}`,
              color: canvasTool === 'select' ? '#38bdf8' : 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              fontWeight: 600,
              transition: 'all 0.15s ease'
            }}
            title={
              canvasTool === 'select'
                ? 'Herramienta SELECCIÓN MÚLTIPLE activa (arrastra en el lienzo para encerrar clases). Usa Shift+Arrastrar en cualquier momento.'
                : 'Herramienta MANO / PAN activa (arrastra en el lienzo para mover la vista). Usa Shift+Arrastrar para seleccionar por recuadro.'
            }
          >
            <Crosshair size={13} />
            <span className="dock-btn-label">
              {canvasTool === 'select' ? 'Herramienta: Selección' : 'Herramienta: Pan'}
            </span>
          </button>

          {/* Selector de Color de Cursor */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="dock-icon-btn"
              style={{
                background: 'transparent',
                border: 'none',
                color: userColor,
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Elegir el color de mi Cursor / Avatar"
            >
              <Palette size={15} />
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: userColor,
                boxShadow: `0 0 8px ${userColor}`
              }} />
            </button>

            {showColorPicker && (
              <div style={{
                position: 'absolute',
                bottom: '42px',
                right: 0,
                background: 'var(--popover-bg)',
                border: '1px solid var(--popover-border)',
                borderRadius: '10px',
                padding: '8px',
                display: 'flex',
                gap: '6px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
                zIndex: 90
              }}>
                {PALETTE_COLORS.map(c => (
                  <button
                    key={c.hex}
                    onClick={() => {
                      if (onChangeUserColor) onChangeUserColor(c.hex);
                      setShowColorPicker(false);
                    }}
                    title={c.name}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: c.hex,
                      border: userColor === c.hex ? '2px solid var(--text-primary)' : '1px solid rgba(125,125,125,0.3)',
                      boxShadow: userColor === c.hex ? `0 0 12px ${c.hex}` : 'none',
                      cursor: 'pointer',
                      transform: userColor === c.hex ? 'scale(1.15)' : 'scale(1)'
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Divisor */}
          <div className="dock-divider" style={{ width: '1px', height: '18px', background: 'var(--glass-topbar-border)', margin: '0 2px' }} />

          {/* BotÃ³n Minimizar Dock */}
          <button
            onClick={() => setIsDockCollapsed(true)}
            className="dock-icon-btn"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px 6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Minimizar barra de comandos"
          >
            <ChevronDown size={15} />
          </button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* Barra Flotante de Acciones en Selección Múltiple (Paso 4)    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {selectedClassIds.size > 1 && (
        <div
          className="glass-dock"
          style={{
            position: 'absolute',
            bottom: isDockCollapsed ? '48px' : '76px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 85,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 14px',
            background: 'rgba(10, 15, 35, 0.90)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(56, 189, 248, 0.45)',
            borderRadius: '24px',
            boxShadow: '0 10px 35px rgba(0, 0, 0, 0.45), 0 0 16px rgba(56, 189, 248, 0.25)',
            color: '#f8fafc',
            fontSize: '0.76rem',
            userSelect: 'none'
          }}
        >
          <span style={{ color: '#38bdf8', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle2 size={14} color="#38bdf8" />
            <span>{selectedClassIds.size} clases seleccionadas</span>
          </span>

          <div style={{ width: '1px', height: '16px', background: 'rgba(255, 255, 255, 0.2)', margin: '0 2px' }} />

          {/* Alinear Superior */}
          <button
            onClick={handleAlignTop}
            className="dock-icon-btn"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'var(--text-primary)',
              borderRadius: '6px',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              fontSize: '0.72rem',
              fontWeight: 600
            }}
            title="Alinear horizontalmente al borde superior (misma Y)"
          >
            <span>Alinear ⬆</span>
          </button>

          {/* Alinear Izquierda */}
          <button
            onClick={handleAlignLeft}
            className="dock-icon-btn"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'var(--text-primary)',
              borderRadius: '6px',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              fontSize: '0.72rem',
              fontWeight: 600
            }}
            title="Alinear verticalmente al borde izquierdo (misma X)"
          >
            <span>Alinear ⬅</span>
          </button>

          {/* Distribuir Horizontal */}
          <button
            onClick={handleDistributeHorizontal}
            className="dock-icon-btn"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'var(--text-primary)',
              borderRadius: '6px',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              fontSize: '0.72rem',
              fontWeight: 600
            }}
            title="Distribuir espaciado horizontal equitativo"
          >
            <span>Distribuir ↔</span>
          </button>

          {/* Duplicar Selección */}
          <button
            onClick={handleDuplicateSelected}
            className="dock-icon-btn"
            style={{
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              borderRadius: '6px',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              fontSize: '0.72rem',
              fontWeight: 600
            }}
            title="Duplicar todas las clases seleccionadas con sus atributos y métodos"
          >
            <span>Duplicar</span>
          </button>

          {/* Eliminar Selección */}
          <button
            onClick={handleDeleteSelected}
            className="dock-icon-btn"
            style={{
              background: 'rgba(244, 63, 94, 0.14)',
              border: '1px solid rgba(244, 63, 94, 0.35)',
              color: '#fb7185',
              borderRadius: '6px',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              fontSize: '0.72rem',
              fontWeight: 600
            }}
            title="Eliminar todas las clases seleccionadas (Del)"
          >
            <Trash2 size={13} color="#fb7185" />
            <span>Eliminar</span>
          </button>

          {/* Deseleccionar */}
          <button
            onClick={() => {
              setSelectedClassIds(new Set());
              onSelectClass(null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '2px 4px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Deseleccionar (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* Modal Asistido: Crear Nueva Tabla / Clase UML               */}
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showNewClassModal && (
        <GlassModal
          onClose={() => setShowNewClassModal(false)}
          title="Nueva Tabla / Clase UML"
          subtitle="Asistente de modelado rÃ¡pido con campos y enlaces automÃ¡ticos"
          icon={<Plus size={18} color="#e8c39e" />}
          maxWidth="540px"
          zIndex={1250}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
              <button
                type="button"
                onClick={() => setShowNewClassModal(false)}
                className="btn-studio-glass"
                style={{ padding: '8px 16px', fontSize: '0.8rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleCreateAssistedClass()}
                className="btn-studio-primary"
                style={{
                  padding: '8px 20px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <CheckCircle2 size={16} />
                <span>Crear Tabla</span>
              </button>
            </div>
          }
        >
          {/* Nombre de la Clase */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Nombre de la Tabla / Entidad:
              </label>
              <input
                type="text"
                placeholder="ej. Factura, Cliente, DetalleVenta"
                value={newClassName}
                onChange={e => setNewClassName(e.target.value)}
                autoFocus
                style={{
                  background: 'var(--glass-surface)',
                  border: '1px solid var(--glass-border-color)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '0.92rem',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  color: 'var(--text-primary)'
                }}
              />

              {/* Chips RÃ¡pidos de Nombres de Dominio */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '4px' }}>Sugerencias:</span>
                {['Cliente', 'Producto', 'Pedido', 'Factura', 'Usuario', 'Rol', 'Categoria', 'Proveedor', 'Pago', 'Empleado'].map(sug => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setNewClassName(sug)}
                    style={{
                      background: newClassName === sug ? 'var(--accent-primary)' : 'var(--glass-surface)',
                      border: '1px solid var(--glass-border-color)',
                      color: newClassName === sug ? '#fff' : 'var(--text-primary)',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Estereotipo ArquitectÃ³nico */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Capa ArquitectÃ³nica (Estereotipo):
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {[
                  { key: 'Class' as const, label: 'Class', color: '#2f2c79' },
                  { key: 'Entity' as const, label: 'Entity', color: '#171a4a' },
                  { key: 'Interface' as const, label: 'Interface', color: '#4a4891' },
                  { key: 'Abstract' as const, label: 'Abstract', color: '#5c688c' },
                  { key: 'Service' as const, label: 'Service', color: '#8892b0' },
                  { key: 'Controller' as const, label: 'Controller', color: '#2f2c79' },
                  { key: 'Repository' as const, label: 'Repository', color: '#4a4891' },
                  { key: 'Enum' as const, label: 'Enum', color: '#171a4a' },
                  { key: 'DTO' as const, label: 'DTO', color: '#5c688c' },
                  { key: 'Component' as const, label: 'Component', color: '#8892b0' },
                  { key: 'Template' as const, label: 'Template', color: '#4a4891' },
                  { key: 'Package' as const, label: 'Package', color: '#2f2c79' },
                  { key: 'Instance' as const, label: 'Instance', color: '#e8c39e' },
                  { key: 'DataType' as const, label: 'DataType', color: '#171a4a' },
                  { key: 'Primitive' as const, label: 'Primitive', color: '#8892b0' },
                  { key: 'Signal' as const, label: 'Signal', color: '#5c688c' },
                  { key: 'AssociationClass' as const, label: 'AssocClass', color: '#4a4891' }
                ].map(st => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setNewClassStereotype(st.key as any)}
                    style={{
                      padding: '5px 2px',
                      borderRadius: '8px',
                      border: newClassStereotype === st.key ? `2px solid ${st.color}` : '1px solid var(--glass-border-color)',
                      background: newClassStereotype === st.key ? '#2f2c79' : 'var(--glass-surface)',
                      color: newClassStereotype === st.key ? '#f5e1ce' : 'var(--text-secondary)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    &laquo;{st.label}&raquo;
                  </button>
                ))}
              </div>
            </div>

            {/* Atributos Iniciales en 1 Clic */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Campos / Atributos iniciales:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newClassWithIdPk} onChange={e => setNewClassWithIdPk(e.target.checked)} />
                  <span>id (Long PK)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newClassWithNombre} onChange={e => setNewClassWithNombre(e.target.checked)} />
                  <span>nombre (String)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newClassWithDesc} onChange={e => setNewClassWithDesc(e.target.checked)} />
                  <span>descripcion (String)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newClassWithPrecio} onChange={e => setNewClassWithPrecio(e.target.checked)} />
                  <span>precio (Double)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newClassWithFecha} onChange={e => setNewClassWithFecha(e.target.checked)} />
                  <span>fechaCreacion</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newClassWithActivo} onChange={e => setNewClassWithActivo(e.target.checked)} />
                  <span>activo (Boolean)</span>
                </label>
              </div>
            </div>

            {/* Enlace Inmediato con otra Tabla Existente */}
            {diagram.classes.length > 0 && (
              <div style={{
                background: 'var(--glass-surface)',
                border: '1px solid var(--glass-border-color)',
                borderRadius: '10px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Link2 size={14} color="var(--accent-cyan)" />
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Enlazar inmediatamente con tabla existente (opcional):
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={newClassLinkWithTargetId}
                    onChange={e => setNewClassLinkWithTargetId(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'var(--glass-node-bg)',
                      border: '1px solid var(--glass-border-color)',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      fontSize: '0.74rem',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="">(No enlazar al crear)</option>
                    {diagram.classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.stereotype || 'Entity'})
                      </option>
                    ))}
                  </select>

                  {newClassLinkWithTargetId && (
                    <select
                      value={newClassLinkRelType}
                      onChange={e => setNewClassLinkRelType(e.target.value as TipoRelacion)}
                      style={{
                        flex: 1,
                        background: 'var(--glass-node-bg)',
                        border: '1px solid var(--glass-border-color)',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        fontSize: '0.74rem',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="ASSOCIATION_1_N">1:N (Uno a Muchos)</option>
                      <option value="ASSOCIATION_N_M">N:M (Muchos a Muchos)</option>
                      <option value="ASSOCIATION_1_1">1:1 (Uno a Uno)</option>
                      <option value="ASSOCIATION_BINARY">Binaria</option>
                      <option value="COMPOSITION">ComposiciÃ³n</option>
                      <option value="AGGREGATION">AgregaciÃ³n</option>
                      <option value="INHERITANCE">Herencia</option>
                      <option value="REALIZATION">RealizaciÃ³n</option>
                      <option value="DEPENDENCY">Dependencia</option>
                      <option value="USAGE">Â«useÂ»</option>
                      <option value="PACKAGE_IMPORT">Â«importÂ»</option>
                      <option value="NON_NAVIGABLE">No Navegable âœ•</option>
                    </select>
                  )}
                </div>
              </div>
            )}

        </GlassModal>
      )}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* Modal: Plantillas de Negocio / Arquitecturas en 1 Clic     */}
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showTemplatesModal && (
        <GlassModal
          onClose={() => setShowTemplatesModal(false)}
          title="Plantillas de Arquitectura de Negocio"
          subtitle="Modela sistemas empresariales completos en 1 solo clic con tablas y relaciones tipadas"
          icon={<Zap size={20} color="#e8c39e" />}
          maxWidth="700px"
          maxHeight="86vh"
          zIndex={1250}
        >
          {/* Grid de Plantillas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {PLANTILLAS_DISPONIBLES.map(plantilla => (
                <div
                  key={plantilla.id}
                  style={{
                    background: 'var(--glass-surface)',
                    border: `1px solid ${plantilla.color}44`,
                    borderLeft: `4px solid ${plantilla.color}`,
                    borderRadius: '12px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: `${plantilla.color}1a`, color: plantilla.color, flexShrink: 0 }}>
                        {plantilla.id === 'ecommerce' && <ShoppingCart size={18} />}
                        {plantilla.id === 'hospital' && <HeartPulse size={18} />}
                        {plantilla.id === 'universidad' && <GraduationCap size={18} />}
                        {plantilla.id === 'seguridad-rbac' && <ShieldCheck size={18} />}
                        {plantilla.id === 'inventario' && <Package size={18} />}
                        {plantilla.id === 'biblioteca' && <BookOpen size={18} />}
                        {plantilla.id === 'hotel' && <Building2 size={18} />}
                      </span>
                      <div>
                        <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                          {plantilla.nombre}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: plantilla.color, fontWeight: 700 }}>
                          {plantilla.categoria} Â· {plantilla.classesCount} Tablas Â· {plantilla.relationsCount} Relaciones
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => handleApplyTemplate(plantilla.id, false)}
                        className="btn-studio-primary"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="AÃ±adir estas tablas conservando lo que ya tienes"
                      >
                        <Plus size={13} />
                        <span>AÃ±adir al Lienzo</span>
                      </button>

                      <button
                        onClick={() => handleApplyTemplate(plantilla.id, true)}
                        className="btn-studio-glass"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.74rem',
                          fontWeight: 700
                        }}
                        title="Reemplazar el lienzo actual con esta plantilla limpia"
                      >
                        Reemplazar Todo
                      </button>
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {plantilla.descripcion}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {plantilla.diagrama.classes.map(c => (
                      <span
                        key={c.id}
                        style={{
                          background: 'var(--glass-node-attr-item-bg)',
                          border: '1px solid var(--glass-border-color)',
                          borderRadius: '4px',
                          padding: '1px 6px',
                          fontSize: '0.68rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-primary)'
                        }}
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
        </GlassModal>
      )}

      {/* Modal Interactivo de DescomposiciÃ³n Manual N:M en Tabla Intermedia (UML 2.5 / 3FN) */}
      {decomposerModalData && (
        <IntermediateTableDecomposerModal
          sourceClass={decomposerModalData.srcClass}
          targetClass={decomposerModalData.tgtClass}
          existingClasses={diagram.classes}
          onConfirm={handleConfirmDecomposerModal}
          onClose={() => setDecomposerModalData(null)}
        />
      )}

      {/* Modal Interactivo de ExtracciÃ³n de Superclase / Herencia Generalizada (UML 2.5) */}
      {extractSuperclassClasses && (
        <ExtractSuperclassModal
          selectedClasses={extractSuperclassClasses}
          onConfirm={handleConfirmExtractSuperclass}
          onClose={() => setExtractSuperclassClasses(null)}
        />
      )}

      {/* Toast informativo reactivo del lienzo */}
      {canvasToast && (
        <div
          style={{
            position: 'absolute',
            bottom: '26px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid #10b981',
            borderRadius: '10px',
            padding: '9px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#ecfdf5',
            fontSize: '0.80rem',
            fontWeight: 700,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(16, 185, 129, 0.3)',
            zIndex: 100,
            pointerEvents: 'none',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <Sparkles size={15} color="#34d399" />
          <span>{canvasToast}</span>
        </div>
      )}
    </div>
  );
};
