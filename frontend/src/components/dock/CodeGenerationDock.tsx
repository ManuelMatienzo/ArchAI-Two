import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Download, 
  Code2, 
  Database, 
  FileCode, 
  Layers, 
  Folder,
  FileCode2,
  Upload,
  Cloud,
  RefreshCw,
  Search,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Cpu,
  Radio,
  FileText,
  Settings,
  Sparkles,
  History,
  Trash2,
  Clock,
  CheckCircle2,
  Pencil,
  Eye,
  AlertTriangle,
  Package,
  Ruler,
  Building2,
  Globe,
  Zap,
  Smartphone,
  Server,
  Bot,
  Heart
} from 'lucide-react';
import { reportArtifact } from '../../services/projectActivity';
import { ModeloDiagrama } from '../../types/uml';
import { GeneracionHistorial } from '../../types/generation';
import { 
  generateSpringBootProject, 
  generatePostgreSqlDdl, 
  generatePostmanCollection, 
  generateXmiXml 
} from '../../services/codeGenerator';
import { exportarXmiEnterpriseArchitect } from '../../services/exportarXmiEA';
import { generateProjectoCompleto } from '../../services/codeGeneratorIA';
import { buildZip, ZipEntry } from '../../services/zipEncoder';
import {
  generarProyectoPreview,
  importarXmi,
  descargarZipApi,
  diagramaDesdeBackend,
  listarHistorialGeneraciones,
  eliminarGeneracionHistorial
} from '../../services/api';

type LayerType = 'all' | 'entity' | 'repository' | 'service' | 'controller' | 'dto' | 'config';

function getFileLayer(filename: string): 'entity' | 'repository' | 'service' | 'controller' | 'dto' | 'config' {
  if (filename.endsWith('Repository.java')) return 'repository';
  if (filename.endsWith('Service.java')) return 'service';
  if (filename.endsWith('Controller.java')) return 'controller';
  if (filename.endsWith('Dto.java')) return 'dto';
  if (
    filename === 'pom.xml' || 
    filename === 'application.properties' || 
    filename === 'Application.java' || 
    filename === 'CorsConfig.java' || 
    filename === 'GlobalExceptionHandler.java' || 
    filename === 'OpenApiConfig.java' || 
    filename === 'SwaggerConfig.java'
  ) return 'config';
  return 'entity';
}

function getLayerMeta(layer: string) {
  switch (layer) {
    case 'entity':
      return { label: 'Entidad', color: '#10B981', bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.35)' };
    case 'repository':
      return { label: 'Repositorio', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.35)' };
    case 'service':
      return { label: 'Servicio', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.14)', border: 'rgba(59, 130, 246, 0.35)' };
    case 'controller':
      return { label: 'Controlador', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.14)', border: 'rgba(139, 92, 246, 0.35)' };
    case 'dto':
      return { label: 'DTO', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.14)', border: 'rgba(6, 182, 212, 0.35)' };
    case 'config':
    default:
      return { label: 'Config', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.14)', border: 'rgba(148, 163, 184, 0.35)' };
  }
}

function getLayerIcon(layer: string, size = 12) {
  switch (layer) {
    case 'entity': return <Database size={size} color="#10B981" />;
    case 'repository': return <HardDrive size={size} color="#F59E0B" />;
    case 'service': return <Cpu size={size} color="#3B82F6" />;
    case 'controller': return <Radio size={size} color="#8B5CF6" />;
    case 'dto': return <FileText size={size} color="#06B6D4" />;
    case 'config': default: return <Settings size={size} color="#94A3B8" />;
  }
}

interface CodeGenerationDockProps {
  isOpen: boolean;
  onClose: () => void;
  diagram: ModeloDiagrama;
  /** CU-13 · Recibe el diagrama reconstruido desde un XMI importado. */
  onImportarDiagrama?: (diagrama: ModeloDiagrama) => void;
  /** Notifica modificaciones de código personalizadas para el Cerebro IA */
  onCustomCodeChange?: (customFiles: Record<string, string>) => void;
}

export const CodeGenerationDock: React.FC<CodeGenerationDockProps> = ({
  isOpen,
  onClose,
  diagram,
  onImportarDiagrama,
  onCustomCodeChange
}) => {
  const [activeTab, setActiveTab] = useState<'spring' | 'postgres' | 'postman' | 'xmi' | 'ia'>('spring');
  const [xmiDialect, setXmiDialect] = useState<'ea' | 'omg'>('ea');
  const [selectedJavaFileIdx, setSelectedJavaFileIdx] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [downloadingZip, setDownloadingZip] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorTextareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Estados de revisión y personalización de código en vivo
  const [customCodeMap, setCustomCodeMap] = useState<Record<string, string>>({});
  const [fileStatusMap, setFileStatusMap] = useState<Record<string, 'generado' | 'modificado' | 'validado'>>({});
  const [isEditMode, setIsEditMode] = useState<boolean>(true);

  // Ancho y redimensionamiento del Dock
  const [dockWidth, setDockWidth] = useState<number>(580);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<LayerType>('all');
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = dockWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = startXRef.current - moveEvent.clientX;
      const newWidth = Math.min(960, Math.max(450, startWidthRef.current + delta));
      setDockWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // CU-10..CU-13 · Artefactos generados por el motor del backend (con fallback local)
  const [backendPreview, setBackendPreview] = useState<{
    files: any[];
    postgresDdl: string;
    postmanCollectionJson: string;
    xmiContent: string;
  } | null>(null);
  const [usandoBackend, setUsandoBackend] = useState<boolean>(false);
  const [generandoBackend, setGenerandoBackend] = useState<boolean>(false);

  // CU-10..CU-14 · Historial de generaciones registrado por el backend
  const [showHistorial, setShowHistorial] = useState<boolean>(false);
  const [historial, setHistorial] = useState<GeneracionHistorial[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState<boolean>(false);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);

  const cargarHistorial = async (tipoFiltro?: string) => {
    setCargandoHistorial(true);
    setErrorHistorial(null);
    try {
      const lista = await listarHistorialGeneraciones(tipoFiltro);
      setHistorial(lista || []);
    } catch (err: any) {
      setErrorHistorial(err?.message || 'No se pudo cargar el historial');
      setHistorial([]);
    } finally {
      setCargandoHistorial(false);
    }
  };

  useEffect(() => {
    let activo = true;
    if (activo) cargarHistorial();
    return () => { activo = false; };
  }, []);

  const eliminarDelHistorial = async (id: string) => {
    try {
      await eliminarGeneracionHistorial(id);
      setHistorial(prev => prev.filter(h => h.id !== id));
    } catch (err: any) {
      setErrorHistorial(err?.message || 'No se pudo eliminar la entrada');
    }
  };

  useEffect(() => {
    let activo = true;
    setGenerandoBackend(true);
    generarProyectoPreview(diagram)
      .then(res => {
        if (!activo) return;
        setBackendPreview({
          files: res?.files || [],
          postgresDdl: res?.postgresDdl || '',
          postmanCollectionJson: res?.postmanCollectionJson || '',
          xmiContent: res?.xmiContent || ''
        });
        setUsandoBackend(true);
      })
      .catch(() => {
        if (activo) setUsandoBackend(false);
      })
      .finally(() => {
        if (activo) setGenerandoBackend(false);
      });
    return () => { activo = false; };
  }, [diagram]);

  // Generate artifacts in real-time (fallback local)
  const springFiles = useMemo(() => generateSpringBootProject(diagram), [diagram]);
  const postgresDdl = useMemo(() => generatePostgreSqlDdl(diagram), [diagram]);
  const postmanJson = useMemo(() => generatePostmanCollection(diagram), [diagram]);
  const xmiXml = useMemo(() => generateXmiXml(diagram), [diagram]);
  const eaXmlFinal = useMemo(() => exportarXmiEnterpriseArchitect(diagram), [diagram]);

  const springFilesFinal = backendPreview?.files?.length ? backendPreview.files : springFiles;
  const postgresDdlFinal = backendPreview?.postgresDdl || postgresDdl;
  const postmanJsonFinal = backendPreview?.postmanCollectionJson || postmanJson;
  const xmiXmlFinal = backendPreview?.xmiContent || xmiXml;

  // ── Proyecto completo con IA local + Android + Flutter (tab 'ia') ──
  const [selectedIaFileIdx, setSelectedIaFileIdx] = useState<number>(0);
  const [iaBackendExpanded, setIaBackendExpanded] = useState<boolean>(true);
  const [iaFrontendExpanded, setIaFrontendExpanded] = useState<boolean>(true);
  const [iaFlutterExpanded, setIaFlutterExpanded] = useState<boolean>(true);
  const [downloadingIaZip, setDownloadingIaZip] = useState<boolean>(false);

  const iaProjectFiles = useMemo(() => generateProjectoCompleto(diagram), [diagram]);
  const iaBackendFiles = useMemo(() => iaProjectFiles.filter(f => f.path.startsWith('backend/')), [iaProjectFiles]);
  const iaFrontendFiles = useMemo(() => iaProjectFiles.filter(f => f.path.startsWith('frontend/')), [iaProjectFiles]);
  const iaFlutterFiles = useMemo(() => iaProjectFiles.filter(f => f.path.startsWith('frontend_flutter/')), [iaProjectFiles]);
  const iaSelectedFile = iaProjectFiles[Math.min(selectedIaFileIdx, Math.max(0, iaProjectFiles.length - 1))];

  /** CU-15 · Descarga el proyecto completo (backend IA + app React Native + Flutter) como ZIP cliente-side. */
  const handleDownloadIaZip = () => {
    setDownloadingIaZip(true);
    try {
      const entries: ZipEntry[] = iaProjectFiles.map(f => ({ path: f.path, content: f.content }));
      const blob = buildZip(entries);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(diagram.title || 'archai-ia-project').toLowerCase().replace(/[^a-z0-9]/g, '-')}-ia-suite-completa.zip`;
      link.click();
      reportArtifact('suite_zip');
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error empaquetando ZIP Suite Completa:', err);
      alert('No se pudo empaquetar el ZIP: ' + (err as Error)?.message);
    } finally {
      setDownloadingIaZip(false);
    }
  };

  /** Descarga exclusivamente la aplicación móvil en Flutter */
  const handleDownloadFlutterZip = () => {
    setDownloadingIaZip(true);
    try {
      const entries: ZipEntry[] = iaFlutterFiles.map(f => ({
        path: f.path.replace(/^frontend_flutter\//, ''),
        content: f.content
      }));
      const blob = buildZip(entries);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(diagram.title || 'archai-flutter-app').toLowerCase().replace(/[^a-z0-9]/g, '-')}-flutter.zip`;
      link.click();
      reportArtifact('flutter_zip');
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error empaquetando ZIP Flutter:', err);
      alert('No se pudo empaquetar el ZIP Flutter: ' + (err as Error)?.message);
    } finally {
      setDownloadingIaZip(false);
    }
  };

  const idxSeguro = Math.min(selectedJavaFileIdx, Math.max(0, springFilesFinal.length - 1));

  const baseContent = useMemo<string>(() => {
    switch (activeTab) {
      case 'spring':
        return springFilesFinal[idxSeguro]?.content || '// No se encontraron archivos Java generados';
      case 'postgres':
        return postgresDdlFinal;
      case 'postman':
        return postmanJsonFinal;
      case 'xmi':
        return xmiDialect === 'ea' ? eaXmlFinal : xmiXmlFinal;
      case 'ia':
        return iaSelectedFile?.content || '// Selecciona un archivo del proyecto IA + Android';
      default:
        return '';
    }
  }, [activeTab, springFilesFinal, idxSeguro, postgresDdlFinal, postmanJsonFinal, xmiXmlFinal, eaXmlFinal, xmiDialect, iaSelectedFile]);

  const activeFilename = useMemo(() => {
    switch (activeTab) {
      case 'spring':
        return springFilesFinal[idxSeguro]?.filename || 'ProductController.java';
      case 'postgres':
        return 'schema_postgres.sql';
      case 'postman':
        return 'postman_collection.json';
      case 'xmi':
        return xmiDialect === 'ea'
          ? `${(diagram.title || 'archai_model').toLowerCase().replace(/\s+/g, '_')}_enterprise_architect.xmi`
          : 'model.xmi';
      case 'ia':
        return iaSelectedFile?.filename || 'file';
    }
  }, [activeTab, springFilesFinal, idxSeguro, iaSelectedFile, xmiDialect, diagram.title]);

  // Contenido final: si el usuario lo editó, muestra su versión personalizada
  const activeContent = customCodeMap[activeFilename] !== undefined ? customCodeMap[activeFilename] : baseContent;
  const currentStatus = fileStatusMap[activeFilename] || 'generado';

  // Métricas de progreso de revisión y completitud
  const allFileKeys = useMemo(() => {
    const list = springFilesFinal.map(f => f.filename);
    const eaName = `${(diagram.title || 'archai_model').toLowerCase().replace(/\s+/g, '_')}_enterprise_architect.xmi`;
    list.push('schema_postgres.sql', 'postman_collection.json', 'model.xmi', eaName);
    return list;
  }, [springFilesFinal, diagram.title]);

  // Categorización y filtrado de archivos Spring Boot
  const filesWithLayers = useMemo(() => {
    return springFilesFinal.map((file, originalIdx) => ({
      file,
      originalIdx,
      layer: getFileLayer(file.filename)
    }));
  }, [springFilesFinal]);

  const layerCounts = useMemo(() => {
    const counts: Record<LayerType, number> = {
      all: springFilesFinal.length,
      entity: 0,
      repository: 0,
      service: 0,
      controller: 0,
      dto: 0,
      config: 0
    };
    filesWithLayers.forEach(item => {
      counts[item.layer] = (counts[item.layer] || 0) + 1;
    });
    return counts;
  }, [filesWithLayers, springFilesFinal.length]);

  const filteredSpringFiles = useMemo(() => {
    return filesWithLayers.filter(item => {
      const matchesCategory = categoryFilter === 'all' || item.layer === categoryFilter;
      const matchesSearch = !searchTerm.trim() || 
        item.file.filename.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        item.file.path.toLowerCase().includes(searchTerm.toLowerCase().trim());
      return matchesCategory && matchesSearch;
    });
  }, [filesWithLayers, categoryFilter, searchTerm]);

  const finalWidth = isExpanded ? Math.max(dockWidth, 860) : dockWidth;

  const validatedCount = useMemo(() => {
    return allFileKeys.filter(k => fileStatusMap[k] === 'validado').length;
  }, [allFileKeys, fileStatusMap]);

  const modifiedCount = useMemo(() => {
    return allFileKeys.filter(k => fileStatusMap[k] === 'modificado').length;
  }, [allFileKeys, fileStatusMap]);

  const reviewPercentage = allFileKeys.length > 0 
    ? Math.round((validatedCount / allFileKeys.length) * 100) 
    : 0;

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setCustomCodeMap(prev => {
      const next = { ...prev, [activeFilename]: newText };
      onCustomCodeChange?.(next);
      return next;
    });
    setFileStatusMap(prev => ({
      ...prev,
      [activeFilename]: 'modificado'
    }));
  };

  const handleMarkValidated = () => {
    setFileStatusMap(prev => ({
      ...prev,
      [activeFilename]: 'validado'
    }));
  };

  const handleResetToDefault = () => {
    setCustomCodeMap(prev => {
      const next = { ...prev };
      delete next[activeFilename];
      onCustomCodeChange?.(next);
      return next;
    });
    setFileStatusMap(prev => ({
      ...prev,
      [activeFilename]: 'generado'
    }));
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const updated = val.substring(0, start) + '    ' + val.substring(end);
      setCustomCodeMap(prev => {
        const next = { ...prev, [activeFilename]: updated };
        onCustomCodeChange?.(next);
        return next;
      });
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }, 0);
    }
  };

  const handleScrollSync = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([activeContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activeFilename;
    link.click();
      reportArtifact('code');
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    try {
      setDownloadingZip(true);
      // CU-14 · ZIP generado por el backend con el payload transformado
      const blob = await descargarZipApi(diagram);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(diagram.title || 'archai-backend').toLowerCase().replace(/[^a-z0-9]/g, '-')}.zip`;
      link.click();
      reportArtifact('backend_zip');
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Backend ZIP endpoint no disponible, descargando archivo individual:', err);
      handleDownload();
    } finally {
      setDownloadingZip(false);
    }
  };

  /** CU-13 · Importar un documento XMI desde el disco y reconstruir el diagrama editable. */
  const handleImportarXmi = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const contenido = await file.text();
      const importado = await importarXmi(contenido, diagram.title);
      onImportarDiagrama?.(diagramaDesdeBackend(importado));
    } catch (err: any) {
      alert(`No se pudo importar el XMI: ${err?.message || 'formato no válido'}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  const lines: string[] = activeContent.split('\n');

  return (
    <aside
      className="glass-code-dock"
      style={{
        width: `${finalWidth}px`,
        height: '100%',
        background: 'var(--glass-dock-bg)',
        backdropFilter: 'var(--glass-blur-lg)',
        WebkitBackdropFilter: 'var(--glass-blur-lg)',
        borderLeft: '1px solid var(--glass-dock-border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 80,
        flexShrink: 0,
        boxShadow: 'var(--glass-dock-shadow)',
        position: 'relative',
        transition: isDraggingRef.current ? 'none' : 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Tirador de Redimensionamiento Horizontal (Drag Handle) */}
      <div
        onMouseDown={handleMouseDownResize}
        title="Arrastra horizontalmente para redimensionar el panel de código"
        style={{
          position: 'absolute',
          left: -3,
          top: 0,
          bottom: 0,
          width: '7px',
          cursor: 'col-resize',
          zIndex: 90,
          background: 'transparent',
          transition: 'background 0.15s ease'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-cyan)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      />

      {/* Top Dock Header */}
      <div
        style={{
          minHeight: '52px',
          padding: '0 16px',
          borderBottom: '1px solid var(--glass-dock-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--glass-dock-header-bg)',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'var(--btn-studio-share-bg)',
            border: '1px solid var(--btn-studio-share-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Code2 size={16} color="var(--accent-primary)" />
          </div>
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '0.90rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '0.01em'
          }}>
            Previsualizador de Código & DDL
          </span>

          <span style={{
            fontSize: '0.64rem',
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: usandoBackend ? 'rgba(16, 185, 129, 0.12)' : 'rgba(125, 125, 125, 0.10)',
            border: `1px solid ${usandoBackend ? 'rgba(16, 185, 129, 0.35)' : 'var(--glass-topbar-border)'}`,
            color: usandoBackend ? 'var(--accent-emerald)' : 'var(--text-muted)'
          }}>
            {generandoBackend ? <RefreshCw size={10} className="animate-spin" /> : usandoBackend ? <Cloud size={10} /> : <Code2 size={10} />}
            {usandoBackend ? 'Motor backend' : 'Generador local'}
          </span>

          {/* Badge de Sincronización con el Diagrama */}
          <span style={{
            fontSize: '0.64rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(6, 182, 212, 0.12)',
            border: '1px solid rgba(6, 182, 212, 0.35)',
            color: 'var(--accent-cyan)'
          }}>
            <Sparkles size={10} />
            {diagram.classes?.length || 0} Clases · {diagram.relations?.length || 0} Relaciones
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Botón Historial de Generaciones (CU-10..CU-14) */}
          <button
            onClick={() => {
              setShowHistorial(!showHistorial);
              if (!showHistorial) cargarHistorial();
            }}
            style={{
              background: showHistorial ? 'var(--btn-studio-share-bg)' : 'transparent',
              border: showHistorial ? '1px solid var(--accent-cyan)' : 'none',
              color: showHistorial ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            title="Historial de generaciones (CU-10..CU-14)"
          >
            <History size={16} />
          </button>

          {/* Botón Maximizar / Restaurar Ancho */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: isExpanded ? 'var(--btn-studio-share-bg)' : 'transparent',
              border: 'none',
              color: isExpanded ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            title={isExpanded ? 'Restaurar ancho normal (580px)' : 'Modo expandido panorámico (860px)'}
          >
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Cerrar panel de generación"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Tab Switcher Pills */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--glass-dock-border)',
          background: 'var(--glass-dock-header-bg)'
        }}
      >
        <button
          onClick={() => setActiveTab('spring')}
          style={{
            flex: 1,
            padding: '10px 8px',
            fontSize: '0.78rem',
            fontWeight: 700,
            border: 'none',
            borderBottom: activeTab === 'spring' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            background: activeTab === 'spring' ? 'var(--btn-studio-share-bg)' : 'transparent',
            color: activeTab === 'spring' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontFamily: 'var(--font-heading)',
            transition: 'all 0.15s ease'
          }}
        >
          <FileCode size={14} color={activeTab === 'spring' ? 'var(--accent-primary)' : 'var(--text-muted)'} />
          Spring Boot
        </button>

        <button
          onClick={() => setActiveTab('postgres')}
          style={{
            flex: 1,
            padding: '10px 8px',
            fontSize: '0.78rem',
            fontWeight: 700,
            border: 'none',
            borderBottom: activeTab === 'postgres' ? '2px solid var(--accent-amber)' : '2px solid transparent',
            background: activeTab === 'postgres' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
            color: activeTab === 'postgres' ? 'var(--accent-amber)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontFamily: 'var(--font-heading)',
            transition: 'all 0.15s ease'
          }}
        >
          <Database size={14} color={activeTab === 'postgres' ? 'var(--accent-amber)' : 'var(--text-muted)'} />
          PostgreSQL DDL
        </button>

        <button
          onClick={() => setActiveTab('postman')}
          style={{
            flex: 1,
            padding: '10px 8px',
            fontSize: '0.78rem',
            fontWeight: 700,
            border: 'none',
            borderBottom: activeTab === 'postman' ? '2px solid var(--accent-rose)' : '2px solid transparent',
            background: activeTab === 'postman' ? 'rgba(244, 63, 94, 0.15)' : 'transparent',
            color: activeTab === 'postman' ? 'var(--accent-rose)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontFamily: 'var(--font-heading)',
            transition: 'all 0.15s ease'
          }}
        >
          <Layers size={14} color={activeTab === 'postman' ? 'var(--accent-rose)' : 'var(--text-muted)'} />
          Postman
        </button>

        <button
          onClick={() => setActiveTab('xmi')}
          style={{
            flex: 1,
            padding: '10px 8px',
            fontSize: '0.78rem',
            fontWeight: 700,
            border: 'none',
            borderBottom: activeTab === 'xmi' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
            background: activeTab === 'xmi' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
            color: activeTab === 'xmi' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontFamily: 'var(--font-heading)',
            transition: 'all 0.15s ease'
          }}
        >
          <FileCode2 size={14} color={activeTab === 'xmi' ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
          XMI / EA
        </button>

        <button
          onClick={() => setActiveTab('ia')}
          style={{
            flex: 1,
            padding: '10px 8px',
            fontSize: '0.78rem',
            fontWeight: 700,
            border: 'none',
            borderBottom: activeTab === 'ia' ? '2px solid #10B981' : '2px solid transparent',
            background: activeTab === 'ia' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
            color: activeTab === 'ia' ? '#10B981' : 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontFamily: 'var(--font-heading)',
            transition: 'all 0.15s ease'
          }}
        >
          <Cpu size={14} color={activeTab === 'ia' ? '#10B981' : 'var(--text-muted)'} />
          IA + Android
        </button>
      </div>

      {/* Spring Boot File Explorer - Rediseño Profesional con Filtros y Buscador */}
      {activeTab === 'spring' && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(0, 0, 0, 0.12)',
            borderBottom: '1px solid var(--glass-dock-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          {/* Barra Superior del Explorador: Título, Contador y Buscador */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px'
          }}>
            <button
              onClick={() => setIsExplorerCollapsed(!isExplorerCollapsed)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.74rem',
                fontWeight: 800,
                letterSpacing: '0.03em'
              }}
            >
              {isExplorerCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span>ARCHIVOS DEL PROYECTO ({springFilesFinal.length})</span>
            </button>

            {/* Buscador de Archivos en Tiempo Real */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--glass-dock-border)',
              borderRadius: '6px',
              padding: '3px 8px',
              width: finalWidth >= 640 ? '220px' : '150px'
            }}>
              <Search size={11} color="var(--text-muted)" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar archivo o clase..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.70rem',
                  fontFamily: 'var(--font-mono)',
                  width: '100%'
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '0.70rem'
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {!isExplorerCollapsed && (
            <>
              {/* Pestañas de Filtro por Capa (Clean Architecture) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                overflowX: 'auto',
                paddingBottom: '2px'
              }}>
                {(
                  [
                    { key: 'all', label: `Todos (${layerCounts.all})`, color: 'var(--accent-primary)' },
                    { key: 'entity', label: `Entidades (${layerCounts.entity})`, color: '#10B981' },
                    { key: 'repository', label: `Repositorios (${layerCounts.repository})`, color: '#F59E0B' },
                    { key: 'service', label: `Servicios (${layerCounts.service})`, color: '#3B82F6' },
                    { key: 'controller', label: `Controladores (${layerCounts.controller})`, color: '#8B5CF6' },
                    { key: 'dto', label: `DTOs (${layerCounts.dto})`, color: '#06B6D4' },
                    { key: 'config', label: `Config (${layerCounts.config})`, color: '#94A3B8' }
                  ] as const
                ).map(tab => {
                  const isActive = categoryFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setCategoryFilter(tab.key)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: isActive ? `1px solid ${tab.color}` : '1px solid transparent',
                        background: isActive ? 'var(--btn-studio-share-bg)' : 'rgba(125, 125, 125, 0.06)',
                        color: isActive ? tab.color : 'var(--text-muted)',
                        fontSize: '0.68rem',
                        fontWeight: isActive ? 700 : 500,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Lista Cómoda de Archivos Generados */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: finalWidth >= 680 ? '1fr 1fr' : '1fr',
                gap: '6px',
                maxHeight: isExpanded ? '260px' : '160px',
                overflowY: 'auto',
                paddingRight: '4px'
              }}>
                {filteredSpringFiles.length > 0 ? (
                  filteredSpringFiles.map(({ file, originalIdx, layer }) => {
                    const isSelected = selectedJavaFileIdx === originalIdx;
                    const meta = getLayerMeta(layer);
                    const status = fileStatusMap[file.filename];

                    return (
                      <button
                        key={originalIdx}
                        onClick={() => setSelectedJavaFileIdx(originalIdx)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid rgba(255, 255, 255, 0.08)',
                          background: isSelected 
                            ? 'rgba(6, 182, 212, 0.12)' 
                            : 'rgba(0, 0, 0, 0.20)',
                          boxShadow: isSelected ? '0 0 12px rgba(6, 182, 212, 0.20)' : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          textAlign: 'left',
                          transition: 'all 0.15s ease'
                        }}
                        title={file.path}
                      >
                        {/* Icono de Capa con Badge Colorizado */}
                        <div style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '5px',
                          background: meta.bg,
                          border: `1px solid ${meta.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {getLayerIcon(layer, 12)}
                        </div>

                        {/* Nombre del Archivo y Subtítulo de Capa */}
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.74rem',
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {file.filename}
                          </span>
                          <span style={{
                            fontSize: '0.62rem',
                            color: meta.color,
                            fontWeight: 600,
                            letterSpacing: '0.02em',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {meta.label} · {file.path.replace('src/main/java/com/archai/', '')}
                          </span>
                        </div>

                        {/* Indicador de Estado */}
                        <span style={{ fontSize: '0.68rem', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          {status === 'validado' ? <CheckCircle2 size={13} color="#10B981" /> : status === 'modificado' ? <Pencil size={13} color="#F59E0B" /> : ''}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div style={{
                    gridColumn: '1 / -1',
                    padding: '16px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.74rem'
                  }}>
                    No se encontraron archivos con el filtro o búsqueda actual.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Proyecto Completo IA + Android — Explorador de archivos (tab 'ia') */}
      {activeTab === 'ia' && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(0, 0, 0, 0.12)',
            borderBottom: '1px solid var(--glass-dock-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          {/* Resumen del stack generado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.64rem',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '6px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#10B981',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Cpu size={10} /> Ollama qwen2.5:3b · H2 embebida · JWT
            </span>
            <span style={{
              fontSize: '0.64rem',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '6px',
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              color: '#60A5FA',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Smartphone size={11} color="#60A5FA" /> React Native + <Heart size={11} color="#38BDF8" /> Flutter
            </span>
            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
              {iaProjectFiles.length} archivos · offline
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={handleDownloadIaZip}
              className="btn-studio-primary"
              disabled={downloadingIaZip}
              style={{
                padding: '8px 12px',
                fontSize: '0.76rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                width: '100%',
                borderRadius: '8px'
              }}
              title="Descargar ZIP completo: backend Spring Boot + IA local (Ollama) + app React Native + app Flutter"
            >
              <Download size={13} />
              {downloadingIaZip ? 'Empaquetando ZIP…' : 'Descargar Suite Completa (Backend + RN + Flutter)'}
            </button>

            <button
              onClick={handleDownloadFlutterZip}
              className="btn-studio-glass"
              disabled={downloadingIaZip}
              style={{
                padding: '7px 12px',
                fontSize: '0.74rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                width: '100%',
                borderRadius: '8px',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                color: '#38BDF8',
                background: 'rgba(56, 189, 248, 0.10)'
              }}
              title="Descargar únicamente el proyecto Flutter listo para correr con flutter run"
            >
              <Download size={12} />
              <span><Heart size={12} color="#38BDF8" /> Descargar Proyecto Flutter</span>
            </button>
          </div>

          {/* Sección Backend */}
          <button
            onClick={() => setIaBackendExpanded(!iaBackendExpanded)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.74rem',
              fontWeight: 800,
              letterSpacing: '0.03em'
            }}
          >
            {iaBackendExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span><Server size={13} color="var(--text-secondary)" /> BACKEND SPRING BOOT + IA LOCAL ({iaBackendFiles.length})</span>
          </button>
          {iaBackendExpanded && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: finalWidth >= 680 ? '1fr 1fr' : '1fr',
              gap: '5px',
              maxHeight: isExpanded ? '220px' : '130px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}>
              {iaBackendFiles.map((file, idx) => {
                const globalIdx = idx + 1; // +1 por el README raíz
                const isSelected = selectedIaFileIdx === globalIdx;
                return (
                  <button
                    key={`iab-${idx}`}
                    onClick={() => setSelectedIaFileIdx(globalIdx)}
                    style={{
                      padding: '5px 9px',
                      borderRadius: '6px',
                      border: isSelected ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.08)',
                      background: isSelected ? 'rgba(16,185,129,0.14)' : 'rgba(0,0,0,0.20)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      textAlign: 'left',
                      gap: 2,
                      transition: 'all 0.15s ease'
                    }}
                    title={file.path}
                  >
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.70rem',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? '#10B981' : 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {file.filename}
                    </span>
                    <span style={{
                      fontSize: '0.58rem',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {file.path.split('/').slice(1).join('/')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Sección Frontend React Native */}
          <button
            onClick={() => setIaFrontendExpanded(!iaFrontendExpanded)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.74rem',
              fontWeight: 800,
              letterSpacing: '0.03em'
            }}
          >
            {iaFrontendExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span><Smartphone size={13} color="var(--text-secondary)" /> FRONTEND REACT NATIVE ANDROID ({iaFrontendFiles.length})</span>
          </button>
          {iaFrontendExpanded && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: finalWidth >= 680 ? '1fr 1fr' : '1fr',
              gap: '5px',
              maxHeight: isExpanded ? '220px' : '130px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}>
              {iaFrontendFiles.map((file, idx) => {
                const globalIdx = iaBackendFiles.length + 1 + idx;
                const isSelected = selectedIaFileIdx === globalIdx;
                return (
                  <button
                    key={`iaf-${idx}`}
                    onClick={() => setSelectedIaFileIdx(globalIdx)}
                    style={{
                      padding: '5px 9px',
                      borderRadius: '6px',
                      border: isSelected ? '1px solid #60A5FA' : '1px solid rgba(255,255,255,0.08)',
                      background: isSelected ? 'rgba(59,130,246,0.14)' : 'rgba(0,0,0,0.20)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      textAlign: 'left',
                      gap: 2,
                      transition: 'all 0.15s ease'
                    }}
                    title={file.path}
                  >
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.70rem',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? '#60A5FA' : 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {file.filename}
                    </span>
                    <span style={{
                      fontSize: '0.58rem',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {file.path.split('/').slice(1).join('/')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Sección Frontend Flutter */}
          <button
            onClick={() => setIaFlutterExpanded(!iaFlutterExpanded)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.74rem',
              fontWeight: 800,
              letterSpacing: '0.03em',
              marginTop: 6
            }}
          >
            {iaFlutterExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span><Heart size={13} color="#38BDF8" /> FRONTEND FLUTTER DART ({iaFlutterFiles.length})</span>
          </button>
          {iaFlutterExpanded && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: finalWidth >= 680 ? '1fr 1fr' : '1fr',
              gap: '5px',
              maxHeight: isExpanded ? '220px' : '130px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}>
              {iaFlutterFiles.map((file, idx) => {
                const globalIdx = iaBackendFiles.length + iaFrontendFiles.length + 1 + idx;
                const isSelected = selectedIaFileIdx === globalIdx;
                return (
                  <button
                    key={`iafl-${idx}`}
                    onClick={() => setSelectedIaFileIdx(globalIdx)}
                    style={{
                      padding: '5px 9px',
                      borderRadius: '6px',
                      border: isSelected ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.08)',
                      background: isSelected ? 'rgba(56,189,248,0.14)' : 'rgba(0,0,0,0.20)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      textAlign: 'left',
                      gap: 2,
                      transition: 'all 0.15s ease'
                    }}
                    title={file.path}
                  >
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.70rem',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? '#38BDF8' : 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {file.filename}
                    </span>
                    <span style={{
                      fontSize: '0.58rem',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {file.path.split('/').slice(1).join('/')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pestaña XMI: Selector de Dialecto (Enterprise Architect vs Estándar OMG) + Guía de Importación */}
      {activeTab === 'xmi' && (
        <div
          style={{
            padding: '12px 14px',
            background: 'rgba(0, 0, 0, 0.16)',
            borderBottom: '1px solid var(--glass-dock-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {/* Dialect Switcher Segmented Control */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '0.04em'
            }}>
              DIALECTO XMI:
            </span>

            <div style={{
              display: 'flex',
              gap: '6px',
              background: 'rgba(0, 0, 0, 0.25)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--glass-dock-border)'
            }}>
              <button
                onClick={() => setXmiDialect('ea')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: xmiDialect === 'ea' ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                  background: xmiDialect === 'ea' ? 'rgba(6, 182, 212, 0.18)' : 'transparent',
                  color: xmiDialect === 'ea' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  fontSize: '0.70rem',
                  fontWeight: xmiDialect === 'ea' ? 800 : 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span><Building2 size={12} color="var(--text-secondary)" /> Sparx Enterprise Architect (XMI 1.1 + Diagrama)</span>
              </button>

              <button
                onClick={() => setXmiDialect('omg')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: xmiDialect === 'omg' ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  background: xmiDialect === 'omg' ? 'var(--btn-studio-share-bg)' : 'transparent',
                  color: xmiDialect === 'omg' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  fontSize: '0.70rem',
                  fontWeight: xmiDialect === 'omg' ? 800 : 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span><Globe size={12} color="var(--text-secondary)" /> Estándar OMG (XMI 2.1)</span>
              </button>
            </div>
          </div>

          {/* Guía Operativa y Características del Dialecto Seleccionado */}
          {xmiDialect === 'ea' ? (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                  <Zap size={12} color="var(--accent-cyan)" style={{ verticalAlign: '-1px' }} /> Compatible con Sparx Enterprise Architect (v13, v14, v15, v16+)
                </span>
                <span style={{
                  fontSize: '0.64rem',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: 'rgba(6, 182, 212, 0.2)',
                  color: 'var(--accent-cyan)',
                  fontWeight: 700
                }}>
                  Geometría + Conectores + Tipos OK
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px' }}>
                <div style={{ background: 'rgba(0,0,0,0.22)', padding: '6px 8px', borderRadius: '6px', fontSize: '0.68rem', lineHeight: '1.4' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>1. Descargar XMI</div>
                  <div style={{ color: 'var(--text-secondary)' }}>Haz clic en <strong>Descargar Archivo</strong> abajo para guardar el <code>.xmi</code>.</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.22)', padding: '6px 8px', borderRadius: '6px', fontSize: '0.68rem', lineHeight: '1.4' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>2. Importar en EA</div>
                  <div style={{ color: 'var(--text-secondary)' }}>En EA, clic derecho en un paquete ➔ <em>Import/Export</em> ➔ <em>Import Package from XMI...</em> (o <code>Ctrl+Alt+I</code>).</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.22)', padding: '6px 8px', borderRadius: '6px', fontSize: '0.68rem', lineHeight: '1.4' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>3. Visualización Completa</div>
                  <div style={{ color: 'var(--text-secondary)' }}>Abre el diagrama: clases, atributos PK, tipos de parámetros, cardinalidades y posiciones se abren tal como en ArchAI.</div>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '0.70rem',
                color: 'var(--text-secondary)',
                lineHeight: '1.4'
              }}
            >
              <strong>Dialecto Estándar OMG XMI 2.1:</strong> Diseñado para importar/exportar la estructura abstracta en herramientas UML genéricas (MagicDraw, Papyrus, StarUML, Eclipse UML2).
            </div>
          )}
        </div>
      )}

      {/* File Action Toolbar (Copy & Download) */}
      <div
        style={{
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--glass-dock-border)',
          background: 'var(--glass-dock-header-bg)'
        }}
      >
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.74rem',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}>
          <Folder size={12} color="var(--accent-cyan)" />
          {activeFilename}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleCopy}
            className="btn-studio-glass"
            style={{ padding: '4px 10px', fontSize: '0.74rem' }}
            title="Copiar código al portapapeles"
          >
            {copied ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
            <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="btn-studio-glass"
            style={{ padding: '4px 10px', fontSize: '0.74rem' }}
            title="Descargar archivo individual"
          >
            <Download size={12} />
            <span>Archivo</span>
          </button>

          <button
            onClick={activeTab === 'ia' ? handleDownloadIaZip : handleDownloadZip}
            className="btn-studio-primary"
            style={{
              padding: '4px 12px',
              fontSize: '0.74rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title={activeTab === 'ia'
              ? 'Descargar ZIP completo: backend Spring Boot + IA local (Ollama) + app React Native Android'
              : 'Descargar proyecto Maven completo con Spring Boot 3, SQL DDL, Postman y XMI'}
            disabled={activeTab === 'ia' ? downloadingIaZip : downloadingZip}
          >
            <Download size={12} />
            <span>
              {activeTab === 'ia'
                ? (downloadingIaZip ? 'Empaquetando…' : 'ZIP IA + Android')
                : (downloadingZip ? 'Empaquetando...' : 'ZIP Completo')}
            </span>
          </button>

          {onImportarDiagrama && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-studio-glass"
              style={{
                padding: '4px 10px',
                fontSize: '0.74rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                color: 'var(--accent-cyan)'
              }}
              title="Importar un archivo XMI 2.1 y reconstruir el diagrama (CU-13)"
            >
              <Upload size={12} />
              <span>Importar XMI</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xmi,.xml"
            onChange={handleImportarXmi}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Barra de Estado de Revisión y Madurez del Archivo */}
      <div
        style={{
          padding: '6px 14px',
          background: 'rgba(0, 0, 0, 0.18)',
          borderBottom: '1px solid var(--glass-dock-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.72rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.68rem',
            background: currentStatus === 'validado'
              ? 'rgba(16, 185, 129, 0.2)'
              : currentStatus === 'modificado'
              ? 'rgba(245, 158, 11, 0.2)'
              : 'rgba(56, 189, 248, 0.2)',
            color: currentStatus === 'validado'
              ? '#10B981'
              : currentStatus === 'modificado'
              ? '#F59E0B'
              : 'var(--accent-cyan)',
            border: `1px solid ${
              currentStatus === 'validado'
                ? 'rgba(16, 185, 129, 0.4)'
                : currentStatus === 'modificado'
                ? 'rgba(245, 158, 11, 0.4)'
                : 'rgba(56, 189, 248, 0.4)'
            }`
          }}>
            {currentStatus === 'validado' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} color="#10B981" /> Validado</span> : currentStatus === 'modificado' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Pencil size={13} color="#F59E0B" /> Modificado</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Bot size={13} color="#38BDF8" /> Generado por IA</span>}
          </span>

          <span style={{ color: 'var(--text-muted)' }}>
            Revisión del Software: <strong style={{ color: 'var(--accent-primary)' }}>{reviewPercentage}%</strong> ({validatedCount}/{allFileKeys.length} listos{modifiedCount > 0 ? `, ${modifiedCount} editados` : ''})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {currentStatus !== 'validado' ? (
            <button
              onClick={handleMarkValidated}
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#10B981',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="Marcar archivo como revisado y validado"
            >
              <Check size={11} />
              Validar
            </button>
          ) : (
            <button
              onClick={() => setFileStatusMap(prev => ({ ...prev, [activeFilename]: 'modificado' }))}
              style={{
                background: 'transparent',
                border: '1px solid var(--glass-dock-border)',
                color: 'var(--text-muted)',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '0.68rem',
                cursor: 'pointer'
              }}
            >
              Reabrir
            </button>
          )}

          {customCodeMap[activeFilename] !== undefined && (
            <button
              onClick={handleResetToDefault}
              style={{
                background: 'transparent',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#EF4444',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '0.68rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title="Descartar cambios personalizados y volver al código generado original"
            >
              <RefreshCw size={10} />
              Restablecer
            </button>
          )}

          <button
            onClick={() => setIsEditMode(!isEditMode)}
            style={{
              background: isEditMode ? 'var(--btn-studio-share-bg)' : 'transparent',
              border: '1px solid var(--glass-dock-border)',
              color: isEditMode ? 'var(--accent-primary)' : 'var(--text-muted)',
              borderRadius: '6px',
              padding: '2px 8px',
              fontSize: '0.68rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="Alternar entre modo editor en vivo y solo lectura"
          >
            {isEditMode ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Pencil size={13} /> Editable</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Eye size={13} /> Lectura</span>}
          </button>
        </div>
      </div>

      {/* Code Editor View with Line Numbers */}
      <div style={{ flex: 1, padding: '12px', minHeight: 0, display: 'flex' }}>
        <div
          style={{
            flex: 1,
            overflowY: 'hidden',
            overflowX: 'hidden',
            padding: '12px 14px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.80rem',
            lineHeight: '1.65',
            background: 'var(--glass-dock-editor-bg)',
            backdropFilter: 'var(--glass-blur-md)',
            WebkitBackdropFilter: 'var(--glass-blur-md)',
            border: '1px solid var(--glass-dock-editor-border)',
            borderRadius: '12px',
            color: 'var(--glass-dock-editor-text)',
            display: 'flex',
            boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.04)'
          }}
        >
          {/* Line Numbers Gutter */}
          <div
            ref={gutterRef}
            style={{
              userSelect: 'none',
              color: 'var(--glass-dock-gutter-text)',
              paddingRight: '14px',
              textAlign: 'right',
              minWidth: '32px',
              borderRight: '1px solid var(--glass-dock-gutter-border)',
              marginRight: '14px',
              opacity: 0.75,
              overflowY: 'hidden'
            }}
          >
            {lines.map((_, i) => (
              <div key={i} style={{ height: '1.65em' }}>{i + 1}</div>
            ))}
          </div>

          {/* Code Content (Editable Textarea or Readonly Pre) */}
          {isEditMode ? (
            <textarea
              ref={editorTextareaRef}
              value={activeContent}
              onChange={handleCodeChange}
              onKeyDown={handleEditorKeyDown}
              onScroll={handleScrollSync}
              spellCheck={false}
              style={{
                margin: 0,
                flex: 1,
                height: '100%',
                resize: 'none',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--glass-dock-editor-text)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.80rem',
                lineHeight: '1.65',
                whiteSpace: 'pre',
                overflowX: 'auto',
                overflowY: 'auto',
                padding: 0
              }}
              placeholder="Puedes escribir o modificar el código Java/SQL directamente aquí..."
            />
          ) : (
            <pre style={{ margin: 0, overflow: 'auto', flex: 1, color: 'var(--glass-dock-editor-text)', fontWeight: 500 }}>
              <code>{activeContent}</code>
            </pre>
          )}
        </div>
      </div>

      {/* Historial de Generaciones (CU-10..CU-14) — Panel Overlay */}
      {showHistorial && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--glass-dock-bg)',
            backdropFilter: 'var(--glass-blur-lg)',
            WebkitBackdropFilter: 'var(--glass-blur-lg)',
            borderLeft: '1px solid var(--glass-dock-border)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 95
          }}
        >
          {/* Encabezado del panel */}
          <div style={{
            minHeight: '52px',
            padding: '0 16px',
            borderBottom: '1px solid var(--glass-dock-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--glass-dock-header-bg)',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'var(--btn-studio-share-bg)',
                border: '1px solid var(--btn-studio-share-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <History size={15} color="var(--accent-primary)" />
              </div>
              <span style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.88rem',
                fontWeight: 800,
                color: 'var(--text-primary)'
              }}>
                Historial de Generaciones
              </span>
              <span style={{
                fontSize: '0.64rem',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '6px',
                background: 'rgba(6, 182, 212, 0.12)',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                color: 'var(--accent-cyan)'
              }}>
                CU-10 … CU-14
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => cargarHistorial()}
                className="btn-studio-glass"
                style={{ padding: '4px 8px', fontSize: '0.70rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Refrescar historial"
              >
                <RefreshCw size={12} className={cargandoHistorial ? 'animate-spin' : ''} />
                Actualizar
              </button>
              <button
                onClick={() => setShowHistorial(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Cerrar historial"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Lista de generaciones registradas */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {errorHistorial && (
              <div style={{
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '0.72rem',
                fontWeight: 600,
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#F87171'
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={14} color="#F87171" />
                {errorHistorial}
              </span>
              </div>
            )}

            {cargandoHistorial && historial.length === 0 && (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.76rem',
                gap: '8px'
              }}>
                <RefreshCw size={14} className="animate-spin" />
                Cargando historial…
              </div>
            )}

            {!cargandoHistorial && historial.length === 0 && !errorHistorial && (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '8px',
                color: 'var(--text-muted)',
                fontSize: '0.76rem',
                textAlign: 'center',
                padding: '20px'
              }}>
                <Clock size={28} opacity={0.5} />
                <span>Aún no hay generaciones registradas.</span>
                <span style={{ fontSize: '0.68rem', opacity: 0.75 }}>
                  Genera código, DDL, Postman, XMI o ZIP para que aparezcan aquí.
                </span>
              </div>
            )}

            {historial.map(entry => {
              const meta: Record<string, { label: string; color: string; bg: string; border: string }> = {
                SPRING_BOOT: { label: 'Spring Boot', color: '#10B981', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.35)' },
                DDL: { label: 'PostgreSQL DDL', color: '#F59E0B', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.35)' },
                POSTMAN: { label: 'Colección Postman', color: '#F43F5E', bg: 'rgba(244,63,94,0.14)', border: 'rgba(244,63,94,0.35)' },
                XMI: { label: 'Modelo XMI 2.1', color: '#06B6D4', bg: 'rgba(6,182,212,0.14)', border: 'rgba(6,182,212,0.35)' },
                ZIP: { label: 'Paquete ZIP', color: '#8B5CF6', bg: 'rgba(139,92,246,0.14)', border: 'rgba(139,92,246,0.35)' }
              };
              const m = meta[entry.tipo] || meta.SPRING_BOOT;
              const fecha = entry.fechaCreacion ? new Date(entry.fechaCreacion) : null;
              const tamano = entry.tamanoBytes
                ? entry.tamanoBytes > 1024 * 1024
                  ? `${(entry.tamanoBytes / (1024 * 1024)).toFixed(2)} MB`
                  : `${(entry.tamanoBytes / 1024).toFixed(1)} KB`
                : null;

              return (
                <div
                  key={entry.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(0, 0, 0, 0.20)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: m.bg,
                    border: `1px solid ${m.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    color: m.color
                  }}>
                    {entry.tipo === 'ZIP' ? <Package size={14} color={m.color} /> : entry.tipo === 'XMI' ? <Ruler size={14} color={m.color} /> : <Code2 size={13} color={m.color} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {entry.tituloDiagrama || 'Diagrama sin título'}
                      </span>
                      <span style={{
                        fontSize: '0.60rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '5px',
                        background: m.bg,
                        border: `1px solid ${m.border}`,
                        color: m.color
                      }}>
                        {m.label}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '0.66rem',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap'
                    }}>
                      {entry.nombreArchivo && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FileText size={12} style={{ flexShrink: 0 }} /> {entry.nombreArchivo}</span>}
                      {tamano && <span>{tamano}</span>}
                      {fecha && !isNaN(fecha.getTime()) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={12} style={{ flexShrink: 0 }} /> {fecha.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => eliminarDelHistorial(entry.id)}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#F87171',
                      borderRadius: '6px',
                      padding: '4px 6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                    title="Eliminar entrada del historial"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};
