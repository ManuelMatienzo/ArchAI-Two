import React, { useState, useEffect } from 'react';
import { 
  FolderTree, 
  FileCode, 
  ChevronRight, 
  ChevronDown, 
  Layers, 
  Box, 
  Database,
  Minimize2,
  Plus,
  RefreshCw,
  Folder,
  Loader2
} from 'lucide-react';
import { ClaseUml, ModeloDiagrama } from '../../types/uml';
import {
  listarProyectos,
  crearProyecto,
  listarDiagramas,
  obtenerDiagrama,
  diagramaDesdeBackend
} from '../../services/api';

interface ProjectStructureFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClaseUml[];
  onSelectClass?: (classId: string) => void;
  selectedClassId?: string | null;
  /** CU-02 · Id del usuario propietario para listar/crear proyectos. */
  usuarioId?: string;
  /** CU-02 · Carga un diagrama de la nube en el lienzo. */
  onCargarDiagrama?: (diagrama: ModeloDiagrama) => void;
  /** CU-02 · Notificaciones reutilizando el toast de la página. */
  onNotificar?: (texto: string, tipo?: 'ok' | 'error') => void;
  /** Oculta el cursor personalizado del canvas al entrar/salir del panel */
  onMouseEnterPanel?: () => void;
  onMouseLeavePanel?: () => void;
}

export const ProjectStructureFlyout: React.FC<ProjectStructureFlyoutProps> = ({
  isOpen,
  onClose,
  classes,
  onSelectClass,
  selectedClassId,
  usuarioId,
  onCargarDiagrama,
  onNotificar,
  onMouseEnterPanel,
  onMouseLeavePanel
}) => {
  const [activeTab, setActiveTab] = useState<'structure' | 'xmi' | 'proyectos'>('structure');
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    domain: true,
    services: true,
    controllers: true,
    repositories: true,
    db: true
  });

  // ─────────── CU-02 · Gestión de Proyectos de Software ───────────
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [cargandoProyectos, setCargandoProyectos] = useState<boolean>(false);
  const [creandoProyecto, setCreandoProyecto] = useState<boolean>(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaDescripcion, setNuevaDescripcion] = useState('');
  const [proyectosAbiertos, setProyectosAbiertos] = useState<{ [id: string]: boolean }>({});
  const [diagramasPorProyecto, setDiagramasPorProyecto] = useState<{ [id: string]: any[] }>({});

  const cargarListaProyectos = async () => {
    setCargandoProyectos(true);
    try {
      const lista = await listarProyectos(usuarioId);
      setProyectos(lista || []);
    } catch (err: any) {
      onNotificar?.(err?.message || 'No se pudieron listar los proyectos de la nube.', 'error');
    } finally {
      setCargandoProyectos(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'proyectos') cargarListaProyectos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, usuarioId]);

  const manejarCrearProyecto = async () => {
    if (!nuevoNombre.trim()) return;
    try {
      const nuevo = await crearProyecto({
        nombre: nuevoNombre.trim(),
        descripcion: nuevaDescripcion.trim(),
        propietarioId: usuarioId || 'usr-local'
      });
      setProyectos(prev => [nuevo, ...prev]);
      setNuevoNombre('');
      setNuevaDescripcion('');
      setCreandoProyecto(false);
      setProyectosAbiertos(prev => ({ ...prev, [nuevo.id]: true }));
      onNotificar?.(`Proyecto '${nuevo.nombre}' creado en la nube.`);
    } catch (err: any) {
      onNotificar?.(err?.message || 'No se pudo crear el proyecto.', 'error');
    }
  };

  const toggleProyecto = async (proyectoId: string) => {
    const abierto = proyectosAbiertos[proyectoId];
    setProyectosAbiertos(prev => ({ ...prev, [proyectoId]: !abierto }));
    if (!abierto && !diagramasPorProyecto[proyectoId]) {
      try {
        const lista = await listarDiagramas(proyectoId);
        setDiagramasPorProyecto(prev => ({ ...prev, [proyectoId]: lista || [] }));
      } catch (err: any) {
        onNotificar?.(err?.message || 'No se pudieron cargar los diagramas del proyecto.', 'error');
      }
    }
  };

  const manejarCargarDiagrama = async (diagramaId: string) => {
    try {
      const dto = await obtenerDiagrama(diagramaId);
      onCargarDiagrama?.(diagramaDesdeBackend(dto));
      onNotificar?.('Diagrama cargado desde la nube.');
      setActiveTab('structure');
    } catch (err: any) {
      onNotificar?.(err?.message || 'No se pudo cargar el diagrama.', 'error');
    }
  };

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      className="glass-project-flyout"
      onWheel={e => e.stopPropagation()}
      onMouseEnter={onMouseEnterPanel}
      onMouseLeave={onMouseLeavePanel}
      style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        width: '260px',
        maxHeight: 'calc(100% - 100px)',
        background: 'var(--glass-flyout-bg)',
        backdropFilter: 'var(--glass-blur-lg)',
        WebkitBackdropFilter: 'var(--glass-blur-lg)',
        border: '1px solid var(--glass-flyout-border)',
        borderRadius: '16px',
        boxShadow: '0 24px 70px -12px rgba(0, 0, 20, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.04)',
        // Cajón: al expandirse se eleva sobre la Toolbox (z-index 40 > 35) y la tapa temporalmente.
        zIndex: 40,
        display: isOpen ? 'flex' : 'none',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'default'
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid var(--glass-flyout-border)',
          background: 'rgba(125, 125, 125, 0.04)',
          cursor: 'default'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderTree size={16} color="var(--accent-cyan)" />
          <span style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '0.82rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '0.01em'
          }}>
            Estructura del Proyecto
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px'
          }}
          title="Minimizar estructura"
        >
          <Minimize2 size={13} />
        </button>
      </div>

      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Tab Pill Switcher */}
          <div style={{
            display: 'flex',
            padding: '6px 10px',
            gap: '6px',
            background: 'rgba(125, 125, 125, 0.05)',
            borderBottom: '1px solid var(--glass-flyout-border)'
          }}>
            <button
              onClick={() => setActiveTab('structure')}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'structure' ? 'var(--btn-studio-share-bg)' : 'transparent',
                color: activeTab === 'structure' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-heading)',
                transition: 'all 0.15s ease'
              }}
            >
              Clases ({classes.length})
            </button>
            <button
              onClick={() => setActiveTab('xmi')}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'xmi' ? 'var(--btn-studio-share-bg)' : 'transparent',
                color: activeTab === 'xmi' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-heading)',
                transition: 'all 0.15s ease'
              }}
            >
              Archivos (XMI)
            </button>
            <button
              onClick={() => setActiveTab('proyectos')}
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'proyectos' ? 'var(--btn-studio-share-bg)' : 'transparent',
                color: activeTab === 'proyectos' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-heading)',
                transition: 'all 0.15s ease'
              }}
            >
              Proyectos
            </button>
          </div>

          {/* Tree View Body */}
          <div style={{
            padding: '8px 10px 12px',
            overflowY: 'auto',
            maxHeight: '320px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: '0.76rem',
            fontFamily: 'var(--font-mono)'
          }}>
            {activeTab === 'structure' ? (
              <>
                {/* Entities / Domain */}
                <div>
                  <div
                    onClick={() => toggleSection('domain')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      padding: '3px 4px',
                      borderRadius: '4px'
                    }}
                  >
                    {openSections.domain ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <Box size={13} color="var(--accent-amber)" />
                    <span style={{ fontWeight: 600 }}>domain.entities</span>
                  </div>

                  {openSections.domain && (
                    <div style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                      {classes.map(cls => (
                        <div
                          key={cls.id}
                          onClick={() => onSelectClass && onSelectClass(cls.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            background: selectedClassId === cls.id ? 'rgba(232, 195, 158, 0.16)' : 'transparent',
                            color: selectedClassId === cls.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                            borderLeft: selectedClassId === cls.id ? '2px solid var(--accent-cyan)' : '2px solid transparent'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Layers size={11} color="var(--accent-cyan)" />
                            <span>{cls.name}</span>
                          </div>
                          <span style={{ fontSize: '0.66rem', color: 'var(--text-subtle)' }}>
                            {cls.attributes.length} campos
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Services Section */}
                <div>
                  <div
                    onClick={() => toggleSection('services')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      padding: '3px 4px',
                      borderRadius: '4px'
                    }}
                  >
                    {openSections.services ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <FileCode size={13} color="var(--accent-primary)" />
                    <span style={{ fontWeight: 600 }}>service.layer</span>
                  </div>

                  {openSections.services && (
                    <div style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                      {classes.map(cls => (
                        <div
                          key={`srv-${cls.id}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 6px',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          <FileCode size={11} color="var(--accent-primary)" />
                          <span>{cls.name}Service.java</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Controllers Section */}
                <div>
                  <div
                    onClick={() => toggleSection('controllers')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      padding: '3px 4px',
                      borderRadius: '4px'
                    }}
                  >
                    {openSections.controllers ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <FileCode size={13} color="var(--accent-emerald)" />
                    <span style={{ fontWeight: 600 }}>controller.rest</span>
                  </div>

                  {openSections.controllers && (
                    <div style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                      {classes.map(cls => (
                        <div
                          key={`ctrl-${cls.id}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 6px',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          <FileCode size={11} color="var(--accent-emerald)" />
                          <span>{cls.name}Controller.java</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Repositories Section */}
                <div>
                  <div
                    onClick={() => toggleSection('repositories')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      padding: '3px 4px',
                      borderRadius: '4px'
                    }}
                  >
                    {openSections.repositories ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <Database size={13} color="var(--accent-amber)" />
                    <span style={{ fontWeight: 600 }}>repository.jpa</span>
                  </div>

                  {openSections.repositories && (
                    <div style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                      {classes.map(cls => (
                        <div
                          key={`repo-${cls.id}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 6px',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          <Database size={11} color="var(--accent-amber)" />
                          <span>{cls.name}Repository.java</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : activeTab === 'xmi' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '4px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--accent-cyan)',
                  fontWeight: 600
                }}>
                  <FileCode size={13} />
                  <span>archai_model_v2.5.xmi</span>
                </div>
                <p style={{ fontSize: '0.70rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Especificación OMG UML 2.5 serializada para exportación a Enterprise Architect y herramientas CASE.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '2px' }}>
                {/* Cabecera de acciones (CU-02) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={cargarListaProyectos}
                    disabled={cargandoProyectos}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: '1px solid var(--glass-flyout-border)',
                      background: 'rgba(125, 125, 125, 0.08)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                    title="Recargar la lista de proyectos desde la nube"
                  >
                    <RefreshCw size={11} className={cargandoProyectos ? 'animate-spin' : ''} />
                    {cargandoProyectos ? 'Cargando...' : 'Recargar'}
                  </button>
                  <button
                    onClick={() => setCreandoProyecto(prev => !prev)}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      background: 'rgba(16, 185, 129, 0.10)',
                      color: 'var(--accent-emerald)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                    title="Crear un nuevo proyecto de software"
                  >
                    <Plus size={11} />
                    {creandoProyecto ? 'Cancelar' : 'Nuevo'}
                  </button>
                </div>

                {/* Formulario de creación */}
                {creandoProyecto && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    border: '1px solid var(--glass-flyout-border)',
                    borderRadius: '8px',
                    padding: '8px'
                  }}>
                    <input
                      value={nuevoNombre}
                      onChange={e => setNuevoNombre(e.target.value)}
                      placeholder="Nombre del proyecto *"
                      style={{
                        padding: '7px 9px',
                        borderRadius: '6px',
                        border: '1px solid var(--glass-flyout-border)',
                        background: 'var(--glass-surface)',
                        color: 'var(--text-primary)',
                        fontSize: '0.74rem',
                        outline: 'none'
                      }}
                    />
                    <input
                      value={nuevaDescripcion}
                      onChange={e => setNuevaDescripcion(e.target.value)}
                      placeholder="Descripción (opcional)"
                      style={{
                        padding: '7px 9px',
                        borderRadius: '6px',
                        border: '1px solid var(--glass-flyout-border)',
                        background: 'var(--glass-surface)',
                        color: 'var(--text-primary)',
                        fontSize: '0.74rem',
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={manejarCrearProyecto}
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        borderRadius: '6px',
                        border: 'none',
                        background: 'var(--accent-emerald)',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px'
                      }}
                    >
                      <Plus size={11} /> Crear proyecto
                    </button>
                  </div>
                )}

                {/* Lista de proyectos */}
                {proyectos.length === 0 && !cargandoProyectos && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>
                    Sin proyectos en la nube todavía. Crea el primero desde aquí.
                  </div>
                )}

                {proyectos.map(proyecto => {
                  const abierto = proyectosAbiertos[proyecto.id];
                  const diagramas = diagramasPorProyecto[proyecto.id] || [];
                  return (
                    <div key={proyecto.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div
                        onClick={() => toggleProyecto(proyecto.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          cursor: 'pointer',
                          padding: '3px 4px',
                          borderRadius: '4px',
                          color: 'var(--text-primary)'
                        }}
                        title={`Abrir el proyecto '${proyecto.nombre}'`}
                      >
                        {abierto ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <Folder size={12} color={proyecto.iconoColor || 'var(--accent-amber)'} />
                        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>
                          {proyecto.nombre}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: 'var(--text-subtle)' }}>
                          {diagramas.length} diag.
                        </span>
                      </div>

                      {abierto && (
                        <div style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '1px' }}>
                          {diagramas.length === 0 && (
                            <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                              Sin diagramas. Usa «Guardar» en la nube para asociar el lienzo a este proyecto.
                            </div>
                          )}
                          {diagramas.map((d: any) => (
                            <div
                              key={d.id}
                              onClick={() => manejarCargarDiagrama(d.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 6px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: 'var(--accent-cyan)',
                                borderLeft: '2px solid rgba(232, 195, 158, 0.45)'
                              }}
                              title={`Cargar '${d.title}' en el lienzo`}
                            >
                              <Layers size={11} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                              <Loader2 size={10} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
