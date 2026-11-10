import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderKanban,
  Plus,
  Search,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Boxes,
  Database,
  ShieldCheck,
  CheckCircle2,
  LogOut,
  Sun,
  Moon,
  Trash2,
  FileCode2,
  Edit3,
  Check,
  Upload,
  FileJson,
  KeyRound
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { InformacionSesion } from '../../types/auth';
import { ModeloDiagrama } from '../../types/uml';
import { ApiError, listarProyectos, listarDiagramas, guardarDiagramaEnNube, crearProyecto, unirseProyectoPorCodigo, Proyecto } from '../../services/api';
import { mergeProjectDiagrams, DiagramaResumen } from '../../services/projectDiagrams';
import { obtenerDiagramaPorId } from '../../services/diagramasPredefinidos';
import { GlassModal } from '../../components/glass/GlassModal';
import { LeftNavRail } from '../../components/layout/LeftNavRail';
import {
  openProjectFileDialog,
  readAndImportProjectFile,
  exportProjectAsArchAi
} from '../../services/nativeProjectService';

export interface ProjectsPageProps {
  session?: InformacionSesion;
  onLogout?: () => void;
  onOpenStudio?: (diagram?: ModeloDiagrama, projectTitle?: string, diagramId?: string) => void;
}

export type PaginaGestorProyectosProps = ProjectsPageProps;



// CU-02 · El hub solo muestra proyectos reales del backend para la cuenta autenticada.
export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  session: propSession,
  onLogout: propOnLogout,
  onOpenStudio: propOnOpenStudio
}) => {
  const navigate = useNavigate();
  const [session, setSession] = useState<InformacionSesion>(() => {
    if (propSession) return propSession;
    const guardado = localStorage.getItem('archai_session');
    if (guardado) {
      try {
        const parsed = JSON.parse(guardado);
        if (parsed?.currentUser) return parsed;
      } catch {}
    }
    return {
      roomId: 'ARC-MAIN',
      roomName: 'Espacio Principal',
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
      setSession(propSession);
    } else {
      const guardado = localStorage.getItem('archai_session');
      if (!guardado) {
        navigate('/login', { replace: true });
      }
    }
  }, [propSession, navigate]);

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

  const onOpenStudio = (diagram?: ModeloDiagrama, projectTitle?: string, diagramId?: string) => {
    try {
      localStorage.setItem('archai_current_view', 'estudio');
      if (diagramId) localStorage.setItem('archai_selected_diagram_id', diagramId);
      else localStorage.removeItem('archai_selected_diagram_id');

      if (projectTitle) localStorage.setItem('archai_selected_project_title', projectTitle);
      else localStorage.removeItem('archai_selected_project_title');

      if (diagram) localStorage.setItem('archai_selected_diagram', JSON.stringify(diagram));
      else localStorage.removeItem('archai_selected_diagram');
    } catch (e) {
      console.warn('Error al guardar estado de navegación local', e);
    }

    if (propOnOpenStudio) {
      propOnOpenStudio(diagram, projectTitle, diagramId);
    }
    const search = new URLSearchParams();
    if (diagramId) search.set('diagramId', diagramId);
    if (projectTitle) search.set('title', projectTitle);
    navigate({
      pathname: diagramId ? `/studio/${diagramId}` : '/studio',
      search: search.toString() ? `?${search.toString()}` : ''
    }, { state: { diagram, projectTitle, diagramId } });
  };
  const [proyectos, setProyectos] = useState<Array<Proyecto & { diagramas?: DiagramaResumen[] }>>(() => {
    try {
      // Caché aislada por cuenta: una sesión nunca lee los proyectos de otra.
      const clave = `archai_proyectos_locales_${session.currentUser?.id || 'anon'}`;
      const guardado = localStorage.getItem(clave);
      if (guardado) return JSON.parse(guardado);
    } catch {}
    return [];
  });

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'ACTIVO' | 'EN_PROGRESO'>('TODOS');
  
  // Modales
  const [modalNuevoProyecto, setModalNuevoProyecto] = useState(false);
  const [modalUnirseProyecto, setModalUnirseProyecto] = useState(false);
  const [codigoProyecto, setCodigoProyecto] = useState('');
  const [unirseError, setUnirseError] = useState<string | null>(null);
  const [uniendose, setUniendose] = useState(false);
  const [modalNuevoDiagrama, setModalNuevoDiagrama] = useState<string | null>(null);
  const [modalEditarProyecto, setModalEditarProyecto] = useState<Proyecto | null>(null);
  const [modalEditarDiagrama, setModalEditarDiagrama] = useState<{ proyectoId: string; diagrama: DiagramaResumen } | null>(null);

  // Estados de formularios
  const [nombreNuevoProyecto, setNombreNuevoProyecto] = useState('');
  const [descNuevoProyecto, setDescNuevoProyecto] = useState('');
  const [colorNuevoProyecto, setColorNuevoProyecto] = useState('#e8c39e');
  const [nombreNuevoDiagrama, setNombreNuevoDiagrama] = useState('');

  // Edición de Proyecto
  const [editNombreProyecto, setEditNombreProyecto] = useState('');
  const [editDescProyecto, setEditDescProyecto] = useState('');
  const [editColorProyecto, setEditColorProyecto] = useState('#e8c39e');
  const [editEstadoProyecto, setEditEstadoProyecto] = useState<'ACTIVO' | 'EN_PROGRESO' | 'ARCHIVADO'>('ACTIVO');

  // Edición de Diagrama
  const [editTituloDiagrama, setEditTituloDiagrama] = useState('');

  const [cargando, setCargando] = useState(false);
  const [errorNuevoProyecto, setErrorNuevoProyecto] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Tema
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('archai_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('archai_theme', theme);
  }, [theme]);

  const isDark = theme === 'dark';

  // Paleta armónica Midnight Navy & Warm Sand (vault 01-ARQUITECTURA): sobria,
  // alto contraste, sin tonos "arcoíris" estridentes en iconos/cabeceras/KPIs.
  const c = useMemo(() => ({
    bgApp: isDark ? '#000020' : '#faf3ec',
    headerBg: isDark ? '#171a4a' : 'rgba(255, 255, 255, 0.75)',
    headerBorder: isDark ? 'rgba(232, 195, 158, 0.20)' : 'rgba(232, 195, 158, 0.58)',

    cardBg: isDark ? 'rgba(23, 26, 74, 0.85)' : 'rgba(255, 255, 255, 0.82)',
    cardBorder: isDark ? 'rgba(245, 225, 206, 0.12)' : 'rgba(232, 195, 158, 0.65)',
    cardShadow: isDark 
      ? '0 16px 40px rgba(0, 0, 32, 0.75), inset 0 1px 1px 0 rgba(245, 225, 206, 0.10)' 
      : '0 12px 32px -4px rgba(23, 26, 74, 0.08), 0 2px 8px -2px rgba(23, 26, 74, 0.04), inset 0 1px 1px 0 rgba(255, 255, 255, 0.90)',

    diagramBoxBg: isDark ? 'rgba(0, 0, 32, 0.35)' : 'rgba(247, 239, 230, 0.60)',
    diagramBoxBorder: isDark ? 'rgba(245, 225, 206, 0.08)' : 'rgba(232, 195, 158, 0.45)',
    diagramItemBg: isDark ? 'rgba(0, 0, 32, 0.30)' : 'rgba(255, 255, 255, 0.90)',
    diagramItemBorder: isDark ? 'rgba(245, 225, 206, 0.06)' : 'rgba(232, 195, 158, 0.40)',

    textPrimary: isDark ? '#f5e1ce' : '#000020',
    textSecondary: isDark ? '#e8c39e' : '#131247',
    textMuted: isDark ? '#8892b0' : '#5c5a86',

    inputBg: isDark ? 'rgba(0, 0, 32, 0.45)' : 'rgba(255, 255, 255, 0.75)',
    inputBorder: isDark ? 'rgba(245, 225, 206, 0.12)' : 'rgba(232, 195, 158, 0.60)',
    inputText: isDark ? '#f5e1ce' : '#000020',

    pillBg: isDark ? '#171a4a' : 'rgba(255, 255, 255, 0.78)',
    pillBorder: isDark ? 'rgba(232, 195, 158, 0.25)' : 'rgba(232, 195, 158, 0.65)',

    btnGhostBg: isDark ? '#2f2c79' : 'rgba(255, 255, 255, 0.80)',
    btnGhostBorder: isDark ? '#171a4a' : 'rgba(232, 195, 158, 0.60)',
    btnGhostText: isDark ? '#e8c39e' : '#171a4a',

    modalBg: isDark ? 'rgba(23, 26, 74, 0.97)' : 'rgba(255, 255, 255, 0.96)',
    modalBorder: isDark ? 'rgba(245, 225, 206, 0.16)' : 'rgba(232, 195, 158, 0.65)',
    modalOverlay: isDark ? 'rgba(0, 0, 32, 0.82)' : 'rgba(23, 26, 74, 0.40)',

    // Pastillas KPI (Warm Sand & Midnight Navy)
    kpiPrjBg: isDark ? 'rgba(232, 195, 158, 0.12)' : 'rgba(245, 225, 206, 0.45)',
    kpiPrjBorder: isDark ? 'rgba(232, 195, 158, 0.30)' : 'rgba(232, 195, 158, 0.65)',
    kpiPrjText: isDark ? '#e8c39e' : '#171a4a',

    kpiDiagBg: isDark ? 'rgba(245, 225, 206, 0.10)' : 'rgba(245, 225, 206, 0.30)',
    kpiDiagBorder: isDark ? 'rgba(245, 225, 206, 0.25)' : 'rgba(232, 195, 158, 0.55)',
    kpiDiagText: isDark ? '#f5e1ce' : '#171a4a',

    kpiClsBg: isDark ? 'rgba(136, 146, 176, 0.12)' : 'rgba(245, 225, 206, 0.30)',
    kpiClsBorder: isDark ? 'rgba(136, 146, 176, 0.30)' : 'rgba(232, 195, 158, 0.55)',
    kpiClsText: isDark ? '#8892b0' : '#171a4a',

    kpiMatBg: isDark ? '#2f2c79' : 'rgba(232, 195, 158, 0.25)',
    kpiMatBorder: isDark ? '#171a4a' : 'rgba(232, 195, 158, 0.65)',
    kpiMatText: isDark ? '#e8c39e' : '#171a4a',

    // Filtros (Navy & Sand en ambos temas)
    chipActiveBg: isDark ? 'rgba(232, 195, 158, 0.20)' : '#e8c39e',
    chipActiveBorder: isDark ? '#e8c39e' : '#e8c39e',
    chipActiveText: isDark ? '#e8c39e' : '#000020',
    chipInactiveBg: isDark ? '#2f2c79' : 'rgba(255, 255, 255, 0.70)',
    chipInactiveBorder: isDark ? '#171a4a' : 'rgba(232, 195, 158, 0.55)',
    chipInactiveText: isDark ? '#aab5ff' : '#5c5a86',

    // Código acceso
    codePillBg: isDark ? 'rgba(232, 195, 158, 0.10)' : 'rgba(245, 225, 206, 0.50)',
    codePillBorder: isDark ? 'rgba(232, 195, 158, 0.30)' : 'rgba(232, 195, 158, 0.65)',
    codePillText: isDark ? '#e8c39e' : '#171a4a',

    // Badge CU-02
    badgeBg: isDark ? 'rgba(232, 195, 158, 0.12)' : 'rgba(245, 225, 206, 0.50)',
    badgeBorder: isDark ? 'rgba(232, 195, 158, 0.30)' : 'rgba(232, 195, 158, 0.65)',
    badgeText: isDark ? '#e8c39e' : '#171a4a',

    // Acento CTA (Arena Cálida + texto Azul Marino)
    accentBg: '#e8c39e',
    accentText: '#000020',
    accentShadow: '0 0 16px rgba(232, 195, 158, 0.35)'
  }), [isDark]);

  // CU-02 · Cargar solo los proyectos de la cuenta autenticada (propietario o miembro)
  const usuarioActualId = session.currentUser?.id;
  useEffect(() => {
    if (!usuarioActualId) return;
    let montado = true;
    listarProyectos(usuarioActualId)
      .then(async datos => {
        if(!Array.isArray(datos)) return;
        const remote=await Promise.allSettled(datos.map(p=>listarDiagramas(p.id)));
        if(montado)setProyectos(prev=>datos.map((p,index)=>{
          const existing=prev.find(ep=>ep.id===p.id);
          const response=remote[index];
          return {...p,diagramas:response.status==='fulfilled'
            ? mergeProjectDiagrams(p.id,response.value,existing?.diagramas)
            : existing?.diagramas || []};
        }));
      })
      .catch(error => {
        if (montado && !(error instanceof ApiError && error.status === 401)) {
          notificar('No se pudieron cargar tus proyectos. Intenta de nuevo más tarde.');
        }
      });
    return () => {
      montado = false;
    };
  }, [usuarioActualId]);

  // Persistir en localStorage (caché aislada por cuenta)
  useEffect(() => {
    try {
      const clave = `archai_proyectos_locales_${usuarioActualId || 'anon'}`;
      localStorage.setItem(clave, JSON.stringify(proyectos));
    } catch {}
  }, [proyectos, usuarioActualId]);

  // Métricas globales
  const metricas = useMemo(() => {
    const totalPrj = proyectos.length;
    let totalDiag = 0;
    let totalClases = 0;
    proyectos.forEach(p => {
      const diags = p.diagramas || [];
      totalDiag += diags.length;
      diags.forEach(d => {
        totalClases += d.totalClases || 0;
      });
    });
    return {
      totalProyectos: totalPrj,
      totalDiagramas: totalDiag,
      totalClases: totalClases,
      madurezPromedio: Math.min(95, 60 + totalDiag * 8 + totalClases * 2)
    };
  }, [proyectos]);

  // Proyectos filtrados
  const proyectosFiltrados = useMemo(() => {
    return proyectos.filter(p => {
      const coincideBusqueda =
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(busqueda.toLowerCase())) ||
        (p.codigoAcceso && p.codigoAcceso.toLowerCase().includes(busqueda.toLowerCase()));
      const coincideFiltro = filtroEstado === 'TODOS' || p.estado === filtroEstado;
      return coincideBusqueda && coincideFiltro;
    });
  }, [proyectos, busqueda, filtroEstado]);

  const notificar = (msg: string) => {
    setMensajeExito(msg);
    setTimeout(() => setMensajeExito(null), 3000);
  };

  /** Importar proyecto desde archivo nativo .archai.json o .json */
  const handleImportarArchivo = async () => {
    try {
      const file = await openProjectFileDialog();
      if (!file) return;

      const importedDiagram = await readAndImportProjectFile(file);
      const prjId = 'prj-' + Date.now();
      const diagId = 'diag-' + Date.now();

      const nuevoPrj: Proyecto & { diagramas: DiagramaResumen[] } = {
        id: prjId,
        nombre: importedDiagram.title || file.name.replace(/\.[^/.]+$/, ''),
        descripcion: `Modelo importado desde '${file.name}' con ${importedDiagram.classes.length} clases y ${importedDiagram.relations.length} relaciones UML.`,
        codigoAcceso: 'PRJ-' + Math.floor(1000 + Math.random() * 9000),
        iconoColor: '#38bdf8',
        estado: 'ACTIVO',
        propietarioId: session.currentUser.id,
        propietarioNombre: session.currentUser.name,
        totalDiagramas: 1,
        diagramas: [
          {
            id: diagId,
            proyectoId: prjId,
            titulo: importedDiagram.title || 'Diagrama Principal',
            totalClases: importedDiagram.classes.length,
            totalRelaciones: importedDiagram.relations.length,
            actualizadoEn: 'Recién importado',
            data: importedDiagram
          }
        ]
      };

      setProyectos(prev => [nuevoPrj, ...prev]);
      notificar(`Proyecto '${nuevoPrj.nombre}' importado con éxito.`);
      onOpenStudio(importedDiagram, nuevoPrj.nombre, diagId);
    } catch (err: any) {
      alert(`Error al importar archivo: ${err.message || 'Formato JSON inválido'}`);
    }
  };

  /** Exportar un diagrama individual como .archai.json */
  const handleExportarDiagrama = (proyecto: Proyecto & { diagramas?: DiagramaResumen[] }, diag: DiagramaResumen, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const diagModelo = diag.data || obtenerDiagramaPorId(diag.id, diag.titulo, { nombre: proyecto.nombre, descripcion: proyecto.descripcion });
      exportProjectAsArchAi(diagModelo, diag.titulo, session.currentUser.name);
      notificar(`Diagrama '${diag.titulo}' exportado a .archai.json`);
    } catch (err: any) {
      alert(`Error al exportar: ${err.message || 'Error inesperado'}`);
    }
  };

  const handleCrearProyecto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreNuevoProyecto.trim() || cargando) return;

    setCargando(true);
    setErrorNuevoProyecto(null);

    try {
      // CU-02 · El proyecto se crea en el backend y se usa su ID real (sin IDs locales falsos).
      const creado = await crearProyecto({
        nombre: nombreNuevoProyecto.trim(),
        descripcion: descNuevoProyecto.trim() || 'Proyecto de arquitectura de software y modelado UML.',
        iconoColor: colorNuevoProyecto,
        propietarioId: session.currentUser.id
      });

      const saved=await guardarDiagramaEnNube({title:`Modelo Dominio - ${creado.nombre}`,classes:[],relations:[],updatedAt:new Date().toISOString()},creado.id,session.currentUser.id);
      const nuevoPrj:Proyecto & {diagramas:DiagramaResumen[]}={...creado,diagramas:mergeProjectDiagrams(creado.id,[saved],[])};

      setProyectos(prev => [nuevoPrj, ...prev]);
      setNombreNuevoProyecto('');
      setDescNuevoProyecto('');
      setModalNuevoProyecto(false);
      notificar(`Proyecto "${creado.nombre}" creado exitosamente.`);
    } catch (error) {
      setErrorNuevoProyecto(error instanceof ApiError ? error.message : 'No se pudo crear el proyecto. Intenta de nuevo más tarde.');
    } finally {
      setCargando(false);
    }
  };

  /** CU-02 · Unirse a un proyecto compartido mediante su código de acceso. */
  const handleUnirseProyecto = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigo = codigoProyecto.trim().toUpperCase();
    if (!codigo || uniendose) return;

    setUniendose(true);
    setUnirseError(null);
    try {
      const proyecto = await unirseProyectoPorCodigo(codigo, session.currentUser.id);
      const [diagramas] = await Promise.allSettled([listarDiagramas(proyecto.id)]);
      setProyectos(prev => {
        const existente = prev.find(p => p.id === proyecto.id);
        const actualizado = {
          ...proyecto,
          diagramas: diagramas.status === 'fulfilled'
            ? mergeProjectDiagrams(proyecto.id, diagramas.value, existente?.diagramas)
            : existente?.diagramas || []
        };
        return existente
          ? prev.map(p => p.id === proyecto.id ? actualizado : p)
          : [actualizado, ...prev];
      });
      setModalUnirseProyecto(false);
      setCodigoProyecto('');
      notificar(`Te uniste al proyecto "${proyecto.nombre}".`);
    } catch (err: any) {
      setUnirseError(err?.message || 'No se pudo unir al proyecto. Verifica el código.');
    } finally {
      setUniendose(false);
    }
  };

  // Abrir modal de edición de proyecto
  const abrirEditarProyecto = (proyecto: Proyecto, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalEditarProyecto(proyecto);
    setEditNombreProyecto(proyecto.nombre);
    setEditDescProyecto(proyecto.descripcion || '');
    setEditColorProyecto(proyecto.iconoColor || '#e8c39e');
    setEditEstadoProyecto((proyecto.estado as any) || 'ACTIVO');
  };

  // Guardar edición de proyecto
  const handleGuardarEditarProyecto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditarProyecto || !editNombreProyecto.trim()) return;

    setProyectos(prev =>
      prev.map(p => {
        if (p.id === modalEditarProyecto.id) {
          return {
            ...p,
            nombre: editNombreProyecto.trim(),
            descripcion: editDescProyecto.trim(),
            iconoColor: editColorProyecto,
            estado: editEstadoProyecto
          };
        }
        return p;
      })
    );

    setModalEditarProyecto(null);
    notificar(`Proyecto "${editNombreProyecto.trim()}" actualizado.`);
  };

  // Eliminar / archivar proyecto
  const handleEliminarProyecto = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('¿Seguro que deseas archivar o eliminar este proyecto?')) {
      setProyectos(prev => prev.filter(p => p.id !== id));
      notificar('Proyecto archivado.');
    }
  };

  // Crear diagrama dentro de un proyecto
  const handleCrearDiagrama = async (proyectoId:string) => {
    if(!nombreNuevoDiagrama.trim()||cargando)return;setCargando(true);
    try {
      const model:ModeloDiagrama={title:nombreNuevoDiagrama.trim(),classes:[],relations:[],updatedAt:new Date().toISOString()};
      const saved=await guardarDiagramaEnNube(model,proyectoId,session.currentUser.id);
      const [nuevo]=mergeProjectDiagrams(proyectoId,[saved],[]);
      setProyectos(prev=>prev.map(p=>p.id===proyectoId?{...p,diagramas:[nuevo,...(p.diagramas||[])],totalDiagramas:(p.diagramas?.length||0)+1}:p));
      setNombreNuevoDiagrama('');setModalNuevoDiagrama(null);notificar(`Diagrama "${nuevo.titulo}" añadido.`);
      onOpenStudio(nuevo.data,nuevo.titulo,nuevo.id);
    }catch(e){notificar(e instanceof Error?e.message:'No se pudo guardar el diagrama. Intenta nuevamente.');}finally{setCargando(false);}
  };

  // Abrir modal de edición de diagrama
  const abrirEditarDiagrama = (proyectoId: string, diagrama: DiagramaResumen, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalEditarDiagrama({ proyectoId, diagrama });
    setEditTituloDiagrama(diagrama.titulo);
  };

  // Guardar edición de diagrama
  const handleGuardarEditarDiagrama = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditarDiagrama || !editTituloDiagrama.trim()) return;

    const { proyectoId, diagrama } = modalEditarDiagrama;
    setProyectos(prev =>
      prev.map(p => {
        if (p.id === proyectoId && p.diagramas) {
          return {
            ...p,
            diagramas: p.diagramas.map(d =>
              d.id === diagrama.id ? { ...d, titulo: editTituloDiagrama.trim() } : d
            )
          };
        }
        return p;
      })
    );

    setModalEditarDiagrama(null);
    notificar(`Diagrama renombrado a "${editTituloDiagrama.trim()}".`);
  };

  // Eliminar diagrama
  const handleEliminarDiagrama = (proyectoId: string, diagramaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('¿Seguro que deseas eliminar este diagrama?')) {
      setProyectos(prev =>
        prev.map(p => {
          if (p.id === proyectoId && p.diagramas) {
            const restantes = p.diagramas.filter(d => d.id !== diagramaId);
            return {
              ...p,
              totalDiagramas: restantes.length,
              diagramas: restantes
            };
          }
          return p;
        })
      );
      notificar('Diagrama eliminado del proyecto.');
    }
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        overflow: 'hidden',
        backgroundColor: c.bgApp,
        position: 'relative'
      }}
    >
      {/* 0. Barra Lateral de Navegación Unificada (CU-02 & Studio) */}
      <LeftNavRail
        activeTab="projects"
        currentUser={session.currentUser}
        onLogout={onLogout}
        onOpenProjects={() => {
          const scrollContainer = document.querySelector('.gestor-proyectos-scroll');
          if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenStudio={() => {
          const primerDiagMeta = proyectos[0]?.diagramas?.[0];
          const diagId = primerDiagMeta?.id || 'diag-core-mvc';
          const diagTitulo = primerDiagMeta?.titulo || 'Sistema de Comercio Electrónico v1.2';
          const diagModelo = primerDiagMeta?.data || obtenerDiagramaPorId(diagId, diagTitulo);
          onOpenStudio(diagModelo, diagTitulo, diagId);
        }}
        onSelectTab={(tab) => {
          if (tab === 'canvas') {
            const primerDiagMeta = proyectos[0]?.diagramas?.[0];
            const diagId = primerDiagMeta?.id || 'diag-core-mvc';
            const diagTitulo = primerDiagMeta?.titulo || 'Sistema de Comercio Electrónico v1.2';
            const diagModelo = primerDiagMeta?.data || obtenerDiagramaPorId(diagId, diagTitulo);
            onOpenStudio(diagModelo, diagTitulo, diagId);
          } else if (tab === 'team') {
            navigate('/team');
          } else if (tab === 'settings') {
            navigate('/settings');
          }
        }}
      />

      {/* Contenedor Principal con Scroll */}
      <div
        className="gestor-proyectos-scroll"
        style={{
          flex: 1,
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          backgroundColor: c.bgApp,
          backgroundImage: isDark
            ? 'radial-gradient(ellipse at 50% 0%, rgba(47, 44, 121, 0.25) 0%, transparent 70%)'
            : 'radial-gradient(circle at 20% 20%, rgba(232, 195, 158, 0.28), transparent 50%), radial-gradient(circle at 80% 80%, rgba(23, 26, 74, 0.05), transparent 50%)',
          color: c.textPrimary,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
          transition: 'background-color 0.2s ease, color 0.2s ease',
          minWidth: 0,
          position: 'relative'
        }}
      >
      {/* 1. Header Superior Compacto (52px) */}
      <header style={{
        height: '52px',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: c.headerBg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${c.headerBorder}`,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        flexShrink: 0,
        boxShadow: isDark ? 'none' : '0 1px 3px rgba(15, 23, 42, 0.05)',
        transition: 'background-color 0.2s ease, border-color 0.2s ease'
      }}>
        {/* Marca ArchAI & Nombre del Módulo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            background: '#e8c39e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#000020',
            boxShadow: '0 3px 10px rgba(232, 195, 158, 0.35)',
            flexShrink: 0
          }}>
            <Boxes size={16} color="#000020" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.10rem',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: c.textPrimary
            }}>
              Arch<span style={{ color: isDark ? '#e8c39e' : '#171a4a' }}>AI</span>
            </span>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              background: c.badgeBg,
              border: `1px solid ${c.badgeBorder}`,
              color: c.badgeText,
              padding: '2px 7px',
              borderRadius: '5px',
              letterSpacing: '0.04em'
            }}>
              Hub de Proyectos · CU-02
            </span>
          </div>
        </div>

        {/* Acciones Rápidas del Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Botón Acceso Rápido al Estudio */}
          <button
            onClick={() => onOpenStudio(obtenerDiagramaPorId('diag-core-mvc', 'Sistema de Comercio Electrónico v1.2'), 'Sistema de Comercio Electrónico v1.2', 'diag-core-mvc')}
            className="btn-studio-glass"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: c.badgeText,
              background: c.badgeBg,
              border: `1px solid ${c.badgeBorder}`,
              borderRadius: '7px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Ir directamente al lienzo de modelado UML"
          >
            <Sparkles size={14} color={c.badgeText} />
            <span>Lienzo UML Directo</span>
          </button>

          {/* Botón Importar Archivo .archai.json */}
          <button
            onClick={handleImportarArchivo}
            className="btn-studio-glass"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: isDark ? '#38bdf8' : '#0284c7',
              background: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.08)',
              border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(2, 132, 199, 0.25)'}`,
              borderRadius: '7px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Importar proyecto o diagrama desde archivo local (.archai.json)"
          >
            <Upload size={14} color={isDark ? '#38bdf8' : '#0284c7'} />
            <span>Importar (.archai.json)</span>
          </button>

          {/* Botón Unirse con Código (invitados CU-02) */}
          <button
            onClick={() => {
              setUnirseError(null);
              setModalUnirseProyecto(true);
            }}
            className="btn-studio-glass"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: c.badgeText,
              background: c.badgeBg,
              border: `1px solid ${c.badgeBorder}`,
              borderRadius: '7px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Unirse a un proyecto compartido con su código de acceso"
          >
            <KeyRound size={14} color={c.badgeText} />
            <span>Unirse con Código</span>
          </button>

          {/* Botón Nuevo Proyecto */}
          <button
            onClick={() => {
                setErrorNuevoProyecto(null);
                setModalNuevoProyecto(true);
              }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 13px',
              fontSize: '0.78rem',
              fontWeight: 800,
              color: '#000020',
              background: '#e8c39e',
              border: 'none',
              borderRadius: '7px',
              cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(232, 195, 158, 0.35)',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={15} />
            <span>Nuevo Proyecto</span>
          </button>

          {/* Selector Tema */}
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '7px',
              background: c.btnGhostBg,
              border: `1px solid ${c.btnGhostBorder}`,
              color: c.textMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Alternar modo claro / oscuro"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Perfil Usuario */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '3px 8px',
            background: c.btnGhostBg,
            border: `1px solid ${c.btnGhostBorder}`,
            borderRadius: '8px'
          }}>
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: isDark ? '#2f2c79' : '#171a4a',
              border: '1px solid rgba(232, 195, 158, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.70rem',
              fontWeight: 800,
              color: '#e8c39e',
              boxShadow: '0 2px 6px rgba(23, 26, 74, 0.20)'
            }}>
              {session.currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, lineHeight: 1.1, color: c.textPrimary }}>
                {session.currentUser.name}
              </span>
              <span style={{ fontSize: '0.62rem', color: c.textMuted }}>
                {session.currentUser.role}
              </span>
            </div>
            <button
              onClick={onLogout}
              style={{
                background: 'transparent',
                border: 'none',
                color: c.textMuted,
                cursor: 'pointer',
                padding: '3px',
                marginLeft: '2px'
              }}
              title="Cerrar sesión"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Notificación Toast */}
      {mensajeExito && (
        <div style={{
          position: 'fixed',
          top: '64px',
          right: '20px',
          background: 'rgba(16, 185, 129, 0.95)',
          color: '#ffffff',
          padding: '8px 16px',
          borderRadius: '7px',
          fontSize: '0.78rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <CheckCircle2 size={15} />
          <span>{mensajeExito}</span>
        </div>
      )}

      {/* 2. Contenido Principal */}
      <main style={{
        maxWidth: '1360px',
        width: '100%',
        margin: '0 auto',
        padding: '16px 20px 40px 20px',
        flex: 1
      }}>
        {/* Barra Superior Compacta con KPIs Integrados */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '14px',
          background: c.pillBg,
          border: `1px solid ${c.pillBorder}`,
          borderRadius: '12px',
          padding: '10px 16px',
          boxShadow: c.cardShadow,
          transition: 'all 0.2s ease'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FolderKanban size={15} color={isDark ? '#e8c39e' : '#171a4a'} />
              <h1 style={{
                fontSize: '1.05rem',
                fontWeight: 800,
                fontFamily: 'var(--font-heading)',
                margin: 0,
                color: c.textPrimary
              }}>
                Espacios de Trabajo y Proyectos UML
              </h1>
            </div>
            <span style={{ fontSize: '0.72rem', color: c.textMuted }}>
              Selecciona o edita cualquier proyecto para abrir sus modelos en el estudio interactivo.
            </span>
          </div>

          {/* Pastillas Métricas Rápidas */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '7px',
              background: c.kpiPrjBg,
              border: `1px solid ${c.kpiPrjBorder}`,
              fontSize: '0.72rem',
              fontWeight: 700,
              color: c.kpiPrjText
            }}>
              <FolderKanban size={13} color={c.kpiPrjText} />
              <span><strong>{metricas.totalProyectos}</strong> Proyectos</span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '7px',
              background: c.kpiDiagBg,
              border: `1px solid ${c.kpiDiagBorder}`,
              fontSize: '0.72rem',
              fontWeight: 700,
              color: c.kpiDiagText
            }}>
              <Layers size={13} color={c.kpiDiagText} />
              <span><strong>{metricas.totalDiagramas}</strong> Diagramas UML</span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '7px',
              background: c.kpiClsBg,
              border: `1px solid ${c.kpiClsBorder}`,
              fontSize: '0.72rem',
              fontWeight: 700,
              color: c.kpiClsText
            }}>
              <Database size={13} color={c.kpiClsText} />
              <span><strong>{metricas.totalClases}</strong> Clases</span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '7px',
              background: c.kpiMatBg,
              border: `1px solid ${c.kpiMatBorder}`,
              fontSize: '0.72rem',
              fontWeight: 700,
              color: c.kpiMatText
            }}>
              <ShieldCheck size={13} color={c.kpiMatText} />
              <span><strong>{metricas.madurezPromedio}%</strong> Madurez</span>
            </div>
          </div>
        </div>

        {/* Controles de Búsqueda y Filtros Compactos */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          marginBottom: '16px'
        }}>
          {/* Barra de Búsqueda */}
          <div style={{
            position: 'relative',
            minWidth: '260px',
            flex: '1 1 300px'
          }}>
            <Search size={14} color={c.textMuted} style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Buscar proyecto o diagrama por título, código..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                fontSize: '0.80rem',
                background: c.inputBg,
                border: `1px solid ${c.inputBorder}`,
                borderRadius: '8px',
                color: c.inputText,
                outline: 'none',
                boxSizing: 'border-box',
                boxShadow: isDark ? 'none' : 'inset 0 1px 2px rgba(0,0,0,0.03)'
              }}
            />
          </div>

          {/* Filtros por Estado */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['TODOS', 'ACTIVO', 'EN_PROGRESO'] as const).map(estado => {
              const activo = filtroEstado === estado;
              return (
                <button
                  key={estado}
                  onClick={() => setFiltroEstado(estado)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: `1px solid ${activo ? c.chipActiveBorder : c.chipInactiveBorder}`,
                    background: activo ? c.chipActiveBg : c.chipInactiveBg,
                    color: activo ? c.chipActiveText : c.chipInactiveText,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {estado === 'TODOS' ? 'Todos' : estado === 'ACTIVO' ? 'Activos' : 'En Progreso'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cuadrícula de Proyectos Compacta */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '16px'
        }}>
          {proyectosFiltrados.map(proyecto => (
            <div
              key={proyecto.id}
              style={{
                background: c.cardBg,
                border: `1px solid ${c.cardBorder}`,
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.18s ease',
                boxShadow: c.cardShadow,
                position: 'relative'
              }}
            >
              {/* Header del Card */}
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: isDark ? 'rgba(47, 44, 121, 0.60)' : '#171a4a',
                      border: '1px solid rgba(232, 195, 158, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#e8c39e',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(23, 26, 74, 0.18)'
                    }}>
                      <FolderKanban size={16} color="#e8c39e" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{
                        fontSize: '0.98rem',
                        fontWeight: 800,
                        margin: 0,
                        fontFamily: 'var(--font-heading)',
                        color: c.textPrimary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {proyecto.nombre}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span style={{
                          fontSize: '0.64rem',
                          fontFamily: 'var(--font-mono, monospace)',
                          color: c.codePillText,
                          background: c.codePillBg,
                          border: `1px solid ${c.codePillBorder}`,
                          padding: '1px 5px',
                          borderRadius: '4px'
                        }}>
                          {proyecto.codigoAcceso || 'PRJ-LOCAL'}
                        </span>
                        <span style={{ fontSize: '0.66rem', color: c.textMuted }}>
                          Por {proyecto.propietarioNombre || 'Arquitecto'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones Rápidas del Card: Editar y Archivar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button
                      onClick={(e) => abrirEditarProyecto(proyecto, e)}
                      style={{
                        background: c.btnGhostBg,
                        border: `1px solid ${c.btnGhostBorder}`,
                        color: c.btnGhostText,
                        cursor: 'pointer',
                        padding: '5px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Editar metadatos del proyecto (Nombre, Descripción, Color, Estado)"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={(e) => handleEliminarProyecto(proyecto.id, e)}
                      style={{
                        background: c.btnGhostBg,
                        border: `1px solid ${c.btnGhostBorder}`,
                        color: isDark ? '#8892b0' : '#5c5a86',
                        cursor: 'pointer',
                        padding: '5px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Archivar o eliminar proyecto"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <p style={{
                  fontSize: '0.76rem',
                  color: c.textSecondary,
                  lineHeight: 1.4,
                  margin: '0 0 12px 0',
                  minHeight: '28px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {proyecto.descripcion}
                </p>

                {/* Lista de Diagramas dentro del Proyecto con Edición Individual */}
                <div style={{
                  background: c.diagramBoxBg,
                  borderRadius: '8px',
                  border: `1px solid ${c.diagramBoxBorder}`,
                  padding: '8px 10px',
                  marginBottom: '12px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: c.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '6px'
                  }}>
                    <span>Diagramas UML ({(proyecto.diagramas || []).length})</span>
                    <button
                      onClick={() => setModalNuevoDiagrama(proyecto.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: isDark ? '#e8c39e' : '#171a4a',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      <Plus size={12} /> Añadir
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {(proyecto.diagramas && proyecto.diagramas.length > 0) ? (
                      proyecto.diagramas.map(diag => (
                        <div
                          key={diag.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '5px 8px',
                            borderRadius: '6px',
                            background: c.diagramItemBg,
                            border: `1px solid ${c.diagramItemBorder}`,
                            transition: 'all 0.12s ease'
                          }}
                        >
                          {/* Clic en título abre el estudio con su arquitectura de dominio dedicada */}
                          <div
                            onClick={() => onOpenStudio((diag.data || obtenerDiagramaPorId(diag.id, diag.titulo, { nombre: proyecto.nombre, descripcion: proyecto.descripcion })), diag.titulo, diag.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              minWidth: 0,
                              flex: 1
                            }}
                            title="Abrir este diagrama en el estudio interactivo"
                          >
                            <FileCode2 size={13} color={isDark ? '#e8c39e' : '#171a4a'} style={{ flexShrink: 0 }} />
                            <span style={{
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              color: c.textPrimary,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {diag.titulo}
                            </span>
                          </div>

                          {/* Acciones sobre el diagrama: Editar nombre, eliminar, o abrir */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.64rem', color: c.textMuted }}>
                              {diag.totalClases} cl.
                            </span>
                            <button
                              onClick={(e) => abrirEditarDiagrama(proyecto.id, diag, e)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: c.textMuted,
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Renombrar / Editar título del diagrama"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button
                              onClick={(e) => handleExportarDiagrama(proyecto, diag, e)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: isDark ? '#38bdf8' : '#0284c7',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Exportar respaldo como archivo nativo (.archai.json)"
                            >
                              <FileJson size={11} />
                            </button>
                            <button
                              onClick={(e) => handleEliminarDiagrama(proyecto.id, diag.id, e)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: isDark ? '#8892b0' : '#5c5a86',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Eliminar este diagrama"
                            >
                              <Trash2 size={11} />
                            </button>
                            <button
                              onClick={() => onOpenStudio((diag.data || obtenerDiagramaPorId(diag.id, diag.titulo, { nombre: proyecto.nombre, descripcion: proyecto.descripcion })), diag.titulo, diag.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: isDark ? '#e8c39e' : '#171a4a',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title="Abrir en lienzo interactivo"
                            >
                              <ChevronRight size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '0.72rem', color: c.textMuted, textAlign: 'center', padding: '4px 0' }}>
                        Sin diagramas aún. ¡Crea el primero!
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Botones de Acción del Card */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                paddingTop: '10px',
                borderTop: `1px solid ${c.cardBorder}`
              }}>
                <button
                  onClick={() => {
                    const primerDiag = proyecto.diagramas?.[0];
                    const diagId = primerDiag?.id || `diag-${proyecto.id}`;
                    const diagTitulo = primerDiag?.titulo || proyecto.nombre;
                    onOpenStudio(primerDiag?.data || obtenerDiagramaPorId(diagId, diagTitulo, { nombre: proyecto.nombre, descripcion: proyecto.descripcion }), diagTitulo, diagId);
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    padding: '7px 10px',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    color: '#000020',
                    background: '#e8c39e',
                    border: 'none',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    boxShadow: '0 3px 8px rgba(232, 195, 158, 0.30)',
                    transition: 'all 0.15s ease'
                  }}
                  title="Abrir el modelo UML en el estudio interactivo"
                >
                  <ExternalLink size={13} /> Abrir en Estudio
                </button>

                <button
                  onClick={() => setModalNuevoDiagrama(proyecto.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '7px 10px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    color: c.btnGhostText,
                    background: c.btnGhostBg,
                    border: `1px solid ${c.btnGhostBorder}`,
                    borderRadius: '7px',
                    cursor: 'pointer'
                  }}
                  title="Añadir nuevo modelo UML a este proyecto"
                >
                  <Plus size={13} /> Diagrama
                </button>

                <button
                  onClick={(e) => abrirEditarProyecto(proyecto, e)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '7px 10px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    color: c.btnGhostText,
                    background: c.btnGhostBg,
                    border: `1px solid ${c.btnGhostBorder}`,
                    borderRadius: '7px',
                    cursor: 'pointer'
                  }}
                  title="Editar nombre, alcance y estado del proyecto"
                >
                  <Edit3 size={13} /> Editar
                </button>
              </div>
            </div>
          ))}
        </div>

        {proyectosFiltrados.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            background: c.cardBg,
            borderRadius: '12px',
            border: `1px dashed ${c.cardBorder}`,
            marginTop: '20px'
          }}>
            <FolderKanban size={36} color={c.textMuted} style={{ marginBottom: '10px' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 6px 0', color: c.textPrimary }}>
              No se encontraron proyectos
            </h3>
            <p style={{ fontSize: '0.78rem', color: c.textMuted, margin: '0 0 14px 0' }}>
              Intenta con otra búsqueda, crea un nuevo proyecto o únete con un código compartido.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                setErrorNuevoProyecto(null);
                setModalNuevoProyecto(true);
              }}
                style={{
                  background: '#e8c39e',
                  color: '#000020',
                  border: 'none',
                  padding: '7px 16px',
                  borderRadius: '7px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                <Plus size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Crear Nuevo Proyecto
              </button>
              <button
                onClick={() => {
                  setUnirseError(null);
                  setModalUnirseProyecto(true);
                }}
                style={{
                  background: c.btnGhostBg,
                  color: c.btnGhostText,
                  border: `1px solid ${c.btnGhostBorder}`,
                  padding: '7px 16px',
                  borderRadius: '7px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                <KeyRound size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                Unirme con Código
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: Crear Nuevo Proyecto (CU-02) */}
      <GlassModal
        isOpen={modalNuevoProyecto}
        onClose={() => {
          setModalNuevoProyecto(false);
          setErrorNuevoProyecto(null);
        }}
        title="Crear Nuevo Proyecto"
        subtitle="Gestor de Espacios de Trabajo · CU-02"
        icon={<Plus size={18} />}
        iconBg={isDark ? 'rgba(47, 44, 121, 0.60)' : '#171a4a'}
        iconColor="#e8c39e"
        maxWidth="460px"
      >
        <form onSubmit={handleCrearProyecto}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: c.textPrimary, marginBottom: '5px' }}>
              Nombre del Proyecto *
            </label>
            <input
              type="text"
              required
              placeholder="ej. Core Bancario Transaccional"
              value={nombreNuevoProyecto}
              onChange={e => setNombreNuevoProyecto(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '0.80rem',
                background: c.inputBg,
                border: `1px solid ${c.inputBorder}`,
                borderRadius: '7px',
                color: c.inputText,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: c.textPrimary, marginBottom: '5px' }}>
              Descripción de la Arquitectura
            </label>
            <textarea
              rows={2}
              placeholder="Detalla el alcance, patrones y módulos del sistema..."
              value={descNuevoProyecto}
              onChange={e => setDescNuevoProyecto(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '0.80rem',
                background: c.inputBg,
                border: `1px solid ${c.inputBorder}`,
                borderRadius: '7px',
                color: c.inputText,
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: c.textPrimary, marginBottom: '5px' }}>
              Color Identificador
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['#e8c39e', '#2f2c79', '#8892b0', '#f5e1ce', '#5c688c', '#3a3670'].map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setColorNuevoProyecto(color)}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: color,
                    border: colorNuevoProyecto === color ? `2px solid ${c.textPrimary}` : '2px solid transparent',
                    cursor: 'pointer',
                    transform: colorNuevoProyecto === color ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.15s ease'
                  }}
                />
              ))}
            </div>
          </div>

          {errorNuevoProyecto && (
            <div style={{
              marginBottom: '12px',
              padding: '7px 10px',
              fontSize: '0.74rem',
              fontWeight: 600,
              color: '#f87171',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '7px'
            }}>
              {errorNuevoProyecto}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setModalNuevoProyecto(false);
                setErrorNuevoProyecto(null);
              }}
              style={{
                padding: '7px 14px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: c.btnGhostText,
                background: c.btnGhostBg,
                border: `1px solid ${c.btnGhostBorder}`,
                borderRadius: '7px',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              style={{
                padding: '7px 16px',
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#000020',
                background: '#e8c39e',
                border: 'none',
                borderRadius: '7px',
                cursor: cargando ? 'wait' : 'pointer',
                boxShadow: '0 3px 10px rgba(232, 195, 158, 0.35)'
              }}
            >
              {cargando ? 'Guardando...' : 'Crear Proyecto'}
            </button>
          </div>
        </form>
      </GlassModal>

      {/* MODAL: Unirse a un Proyecto con Código (CU-02 · invitados) */}
      <GlassModal
        isOpen={modalUnirseProyecto}
        onClose={() => {
          setModalUnirseProyecto(false);
          setUnirseError(null);
        }}
        title="Unirse a un Proyecto"
        subtitle="Acceso compartido por código · CU-02"
        icon={<KeyRound size={18} />}
        iconBg={isDark ? 'rgba(47, 44, 121, 0.60)' : '#171a4a'}
        iconColor="#e8c39e"
        maxWidth="420px"
      >
        <form onSubmit={handleUnirseProyecto}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: c.textPrimary, marginBottom: '5px' }}>
              Código de acceso *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="ej. SISTEM-1071"
              value={codigoProyecto}
              onChange={e => setCodigoProyecto(e.target.value.toUpperCase())}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '0.86rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                background: c.inputBg,
                border: `1px solid ${c.inputBorder}`,
                borderRadius: '7px',
                color: c.inputText,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <p style={{ fontSize: '0.70rem', color: c.textMuted, margin: '6px 0 0 0' }}>
              Pídele al propietario el código del proyecto. Al unirte podrás abrirlo desde este hub.
            </p>
          </div>

          {unirseError && (
            <div style={{
              marginBottom: '12px',
              padding: '7px 10px',
              fontSize: '0.74rem',
              fontWeight: 600,
              color: '#f87171',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '7px'
            }}>
              {unirseError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setModalUnirseProyecto(false);
                setUnirseError(null);
              }}
              style={{
                padding: '7px 14px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: c.btnGhostText,
                background: c.btnGhostBg,
                border: `1px solid ${c.btnGhostBorder}`,
                borderRadius: '7px',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={uniendose || !codigoProyecto.trim()}
              style={{
                padding: '7px 16px',
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#000020',
                background: '#e8c39e',
                border: 'none',
                borderRadius: '7px',
                cursor: uniendose ? 'wait' : 'pointer',
                opacity: uniendose || !codigoProyecto.trim() ? 0.6 : 1,
                boxShadow: '0 3px 10px rgba(232, 195, 158, 0.35)'
              }}
            >
              {uniendose ? 'Uniéndose...' : 'Unirme al Proyecto'}
            </button>
          </div>
        </form>
      </GlassModal>

      {/* MODAL: Editar Metadatos del Proyecto (CU-02) */}
      <GlassModal
        isOpen={Boolean(modalEditarProyecto)}
        onClose={() => setModalEditarProyecto(null)}
        title="Editar Proyecto"
        subtitle={modalEditarProyecto ? `Código: ${modalEditarProyecto.codigoAcceso}` : ''}
        icon={<Edit3 size={17} />}
        iconBg={isDark ? 'rgba(47, 44, 121, 0.60)' : '#171a4a'}
        iconColor="#e8c39e"
        maxWidth="460px"
      >
        <form onSubmit={handleGuardarEditarProyecto}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: c.textPrimary, marginBottom: '5px' }}>
              Nombre del Proyecto *
            </label>
            <input
              type="text"
              required
              value={editNombreProyecto}
              onChange={e => setEditNombreProyecto(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '0.80rem',
                background: c.inputBg,
                border: `1px solid ${c.inputBorder}`,
                borderRadius: '7px',
                color: c.inputText,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: c.textPrimary, marginBottom: '5px' }}>
              Descripción de la Arquitectura
            </label>
            <textarea
              rows={2}
              value={editDescProyecto}
              onChange={e => setEditDescProyecto(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '0.80rem',
                background: c.inputBg,
                border: `1px solid ${c.inputBorder}`,
                borderRadius: '7px',
                color: c.inputText,
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'none'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: c.textPrimary, marginBottom: '5px' }}>
                Estado
              </label>
              <select
                value={editEstadoProyecto}
                onChange={e => setEditEstadoProyecto(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '7px 8px',
                  fontSize: '0.78rem',
                  background: c.inputBg,
                  border: `1px solid ${c.inputBorder}`,
                  borderRadius: '7px',
                  color: c.inputText,
                  outline: 'none'
                }}
              >
                <option value="ACTIVO">Activo</option>
                <option value="EN_PROGRESO">En Progreso</option>
                <option value="ARCHIVADO">Archivado</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: c.textPrimary, marginBottom: '5px' }}>
                Color Identificador
              </label>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                {['#e8c39e', '#2f2c79', '#8892b0', '#f5e1ce', '#5c688c', '#3a3670'].map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setEditColorProyecto(color)}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      border: editColorProyecto === color ? `2px solid ${c.textPrimary}` : '2px solid transparent',
                      cursor: 'pointer',
                      transform: editColorProyecto === color ? 'scale(1.15)' : 'scale(1)',
                      transition: 'all 0.15s ease'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setModalEditarProyecto(null)}
              style={{
                padding: '7px 14px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: c.btnGhostText,
                background: c.btnGhostBg,
                border: `1px solid ${c.btnGhostBorder}`,
                borderRadius: '7px',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                padding: '7px 16px',
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#000020',
                background: '#e8c39e',
                border: 'none',
                borderRadius: '7px',
                cursor: 'pointer',
                boxShadow: '0 3px 10px rgba(232, 195, 158, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Check size={14} /> Guardar Cambios
            </button>
          </div>
        </form>
      </GlassModal>

      {/* MODAL: Editar / Renombrar Diagrama */}
      <GlassModal
        isOpen={Boolean(modalEditarDiagrama)}
        onClose={() => setModalEditarDiagrama(null)}
        title="Renombrar Diagrama"
        subtitle="Editar título del modelo UML"
        icon={<Edit3 size={17} />}
        iconBg={isDark ? 'rgba(47, 44, 121, 0.60)' : '#171a4a'}
        iconColor="#e8c39e"
        maxWidth="420px"
      >
        <form onSubmit={handleGuardarEditarDiagrama}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: c.textPrimary, marginBottom: '5px' }}>
              Título del Diagrama *
            </label>
            <input
              type="text"
              required
              value={editTituloDiagrama}
              onChange={e => setEditTituloDiagrama(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '0.80rem',
                background: c.inputBg,
                border: `1px solid ${c.inputBorder}`,
                borderRadius: '7px',
                color: c.inputText,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setModalEditarDiagrama(null)}
              style={{
                padding: '7px 14px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: c.btnGhostText,
                background: c.btnGhostBg,
                border: `1px solid ${c.btnGhostBorder}`,
                borderRadius: '7px',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                padding: '7px 16px',
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#000020',
                background: '#e8c39e',
                border: 'none',
                borderRadius: '7px',
                cursor: 'pointer',
                boxShadow: '0 3px 10px rgba(232, 195, 158, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Check size={14} /> Guardar
            </button>
          </div>
        </form>
      </GlassModal>

      {/* MODAL: Añadir Nuevo Diagrama a un Proyecto */}
      <GlassModal
        isOpen={Boolean(modalNuevoDiagrama)}
        onClose={() => setModalNuevoDiagrama(null)}
        title="Añadir Diagrama UML"
        subtitle="Nuevo modelo en este proyecto"
        icon={<FileCode2 size={18} />}
        iconBg={isDark ? 'rgba(47, 44, 121, 0.60)' : '#171a4a'}
        iconColor="#e8c39e"
        maxWidth="420px"
      >
        <form onSubmit={e => {
          e.preventDefault();
          if (modalNuevoDiagrama) handleCrearDiagrama(modalNuevoDiagrama);
        }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: c.textPrimary, marginBottom: '5px' }}>
              Título del Diagrama *
            </label>
            <input
              type="text"
              required
              placeholder="ej. Módulo de Pagos y Liquidación"
              value={nombreNuevoDiagrama}
              onChange={e => setNombreNuevoDiagrama(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '0.80rem',
                background: c.inputBg,
                border: `1px solid ${c.inputBorder}`,
                borderRadius: '7px',
                color: c.inputText,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setModalNuevoDiagrama(null)}
              style={{
                padding: '7px 14px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: c.btnGhostText,
                background: c.btnGhostBg,
                border: `1px solid ${c.btnGhostBorder}`,
                borderRadius: '7px',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                padding: '7px 16px',
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#000020',
                background: '#e8c39e',
                border: 'none',
                borderRadius: '7px',
                cursor: 'pointer',
                boxShadow: '0 3px 10px rgba(232, 195, 158, 0.35)'
              }}
            >
              Crear y Abrir en Estudio
            </button>
          </div>
        </form>
      </GlassModal>
      </div>
    </div>
  );
};

// Alias de retrocompatibilidad
export const PaginaGestorProyectos = ProjectsPage;
export default ProjectsPage;
