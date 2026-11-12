import React, { useState, useRef, useEffect, useId, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Share2, 
  Download, 
  Code2, 
  Boxes, 
  Sun,
  Moon,
  Save,
  History,
  UserCircle,
  MoreVertical,
  FileOutput,
  Undo2,
  Redo2,
  Keyboard,
  Image,
  Upload,
  FileJson,
  Search
} from 'lucide-react';
import { InformacionSesion } from '../../types/auth';
import { RolEquipo } from '../../types/rbac';
import { ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';
import './TopHeader.css';

interface HeaderMenuAction {
  label: string;
  icon: LucideIcon;
  run?: () => void;
  tooltip?: string;
  shortcut?: string;
}

interface TopHeaderProps {
  session: InformacionSesion;
  projectName?: string;
  diagramTitle: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onExportXmi: () => void;
  /** CU/EA · Exportar XMI 1.1 nativo de Sparx (con diagrama) para Enterprise Architect. */
  onExportarEA?: () => void;
  /** Exportar imagen visual de alta resolución PNG / SVG */
  onExportarVisual?: () => void;
  /** Exportar archivo nativo portable (.archai.json) */
  onExportarArchivo?: () => void;
  /** Importar archivo nativo portable (.archai.json) */
  onImportarArchivo?: () => void;
  /** Abrir búsqueda rápida Spotlight (Ctrl + K) */
  onOpenQuickSearch?: () => void;
  onToggleCodeDock: () => void;
  isCodeDockOpen: boolean;
  onShare: () => void;
  /** CU-05 · Guardar diagrama en la nube */
  onGuardarNube?: () => void;
  /** CU-05 · Abrir gestor de versiones */
  onVersiones?: () => void;
  /** CU-01 · Abrir modal de perfil */
  onPerfil?: () => void;
  /** CU-09 · Indicador de conexión (modo offline) */
  online?: boolean;
  /** CU-03 · Conmutar rápidamente de sala */
  onCambiarSala?: (pin: string) => void;
  /** Medidor global de madurez del software */
  maturityScore?: number;
  /** Rol actual y conmutador rápido para RBAC */
  userRole?: RolEquipo;
  onQuickRoleChange?: (newRole: RolEquipo) => void;
  /** Abrir modal de equipo y permisos */
  onOpenTeamModal?: () => void;
  onOpenMaturityAudit?: () => void;
  /** Deshacer última acción (Ctrl+Z) */
  onUndo?: () => void;
  /** Rehacer última acción (Ctrl+Y) */
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  /** Abrir modal de atajos de teclado (F1 o ?) */
  onAbrirAtajos?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  session,
  projectName,
  diagramTitle,
  theme,
  onToggleTheme,
  onExportXmi,
  onExportarEA,
  onExportarVisual,
  onExportarArchivo,
  onImportarArchivo,
  onOpenQuickSearch,
  onToggleCodeDock,
  isCodeDockOpen,
  onShare,
  onGuardarNube,
  onVersiones,
  onPerfil,
  online = true,
  onCambiarSala: _onCambiarSala,
  maturityScore,
  userRole,
  onQuickRoleChange,
  onOpenTeamModal,
  onOpenMaturityAudit,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onAbrirAtajos
}) => {
  const [activeHoveredUser, setActiveHoveredUser] = useState<string | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);
  const [moreMenuPosition, setMoreMenuPosition] = useState({ top: 0, anchorRight: 0 });
  const moreMenuId = useId();
  const moreMenuButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const hideUserTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    if (!isMoreMenuOpen) return;
    const trigger = moreMenuButtonRef.current;
    const header = trigger?.closest('header');
    if (!trigger || !header) return;

    const positionMenu = () => {
      const { right } = trigger.getBoundingClientRect();
      setMoreMenuPosition({ top: header.getBoundingClientRect().bottom + 6, anchorRight: window.innerWidth - right });
    };
    positionMenu();
    moreMenuRef.current?.querySelector('button')?.focus({ preventScroll: true });
    header.addEventListener('scroll', positionMenu);
    window.addEventListener('resize', positionMenu);
    window.visualViewport?.addEventListener('resize', positionMenu);
    return () => {
      header.removeEventListener('scroll', positionMenu);
      window.removeEventListener('resize', positionMenu);
      window.visualViewport?.removeEventListener('resize', positionMenu);
    };
  }, [isMoreMenuOpen]);

  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const closeOutside = (event: MouseEvent | FocusEvent) => {
      const target = event.target as Node;
      if (!moreMenuButtonRef.current?.contains(target) && !moreMenuRef.current?.contains(target)) {
        setIsMoreMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', closeOutside);
    window.addEventListener('focusin', closeOutside);
    return () => {
      window.removeEventListener('mousedown', closeOutside);
      window.removeEventListener('focusin', closeOutside);
    };
  }, [isMoreMenuOpen]);

  const closeMoreMenu = () => {
    setIsMoreMenuOpen(false);
    moreMenuButtonRef.current?.focus({ preventScroll: true });
  };

  const menuGroups: { title: string; actions: HeaderMenuAction[] }[] = [
    {
      title: 'Archivos',
      actions: [
        { label: 'Exportar XMI UML 2.5', icon: Download, run: onExportXmi },
        { label: 'Exportar para Enterprise Architect', icon: FileOutput, run: onExportarEA, tooltip: 'Exportar XMI 1.1 con el diseño del diagrama y sus conectores' },
        { label: 'Exportar respaldo (.archai.json)', icon: FileJson, run: onExportarArchivo, tooltip: 'Guardar una copia del proyecto en tu equipo' },
        { label: 'Importar respaldo (.archai.json)', icon: Upload, run: onImportarArchivo, tooltip: 'Cargar el proyecto desde un archivo local' },
        { label: 'Exportar imagen (PNG / SVG)', icon: Image, run: onExportarVisual, tooltip: 'Descargar como PNG de alta resolución o SVG vectorial' },
      ],
    },
    {
      title: 'Proyecto y equipo',
      actions: [
        { label: 'Historial de versiones', icon: History, run: onVersiones },
        { label: 'Compartir PIN de sala', icon: Share2, run: onShare },
        { label: 'Gestión de equipo y roles', icon: ShieldCheck, run: onOpenTeamModal },
        { label: 'Auditoría de madurez de código', icon: Sparkles, run: onOpenMaturityAudit },
      ],
    },
    {
      title: 'Preferencias y ayuda',
      actions: [
        { label: theme === 'light' ? 'Modo oscuro' : 'Modo claro', icon: theme === 'light' ? Moon : Sun, run: onToggleTheme },
        { label: 'Mi perfil', icon: UserCircle, run: onPerfil },
        { label: 'Atajos de teclado', icon: Keyboard, run: onAbrirAtajos, shortcut: 'F1 o ?' },
      ],
    },
  ];

  const handleUserHover = (userId: string) => {
    if (hideUserTimerRef.current) clearTimeout(hideUserTimerRef.current);
    setActiveHoveredUser(userId);
    hideUserTimerRef.current = setTimeout(() => {
      setActiveHoveredUser(null);
    }, 3500);
  };

  const handleUserLeave = () => {
    if (hideUserTimerRef.current) clearTimeout(hideUserTimerRef.current);
    hideUserTimerRef.current = setTimeout(() => {
      setActiveHoveredUser(null);
    }, 1200);
  };

  return (
    <header
      className="hud-topbar"
      style={{
        margin: '10px 14px 0 14px',
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 90,
        flexShrink: 0,
        gap: '12px'
      }}
    >
      {/* Logo y nombre del proyecto */}
      <div className="studio-header-context">
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: '#2f2c79',
            border: '1px solid rgba(232, 195, 158, 0.30)',
            padding: '5px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(0, 0, 32, 0.40)'
          }}>
            <Boxes size={17} color="#e8c39e" />
          </div>
          <span className="studio-header-wordmark" style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.18rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)'
          }}>
            Arch<span style={{ color: '#e8c39e', marginLeft: '1px' }}>AI</span>
          </span>
        </div>

        {/* Separator */}
        <div className="header-divider-hide-mobile" style={{ width: '1px', height: '18px', background: 'var(--glass-topbar-border)' }} />

        <span
          className="studio-header-title"
          title={projectName ? `Proyecto: ${projectName}\nDiagrama: ${diagramTitle}` : `Diagrama: ${diagramTitle}`}
        >
          {projectName || diagramTitle}
        </span>
      </div>

      <div className="studio-header-actions">
        {/* Acceso Rápido Spotlight (Ctrl + K) */}
        {onOpenQuickSearch && (
          <button
            type="button"
            onClick={onOpenQuickSearch}
            className="btn-studio-glass studio-header-search"
            aria-label="Buscar"
            aria-keyshortcuts="Control+K Meta+K"
            title="Buscar · Ctrl + K"
          >
            <Search size={15} aria-hidden="true" />
            <span>Buscar</span>
          </button>
        )}

        {/* Sala Colaborativa PIN Badge */}
        <button
          onClick={onShare}
          className="btn-studio-glass"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.72rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            background: '#2f2c79',
            border: '1px solid #2f2c79',
            color: '#e8c39e',
            padding: '4px 8px',
            borderRadius: '8px',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
          title="Ver PIN de la sala, copiar o cambiar de sala colaborativa"
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: online ? '#e8c39e' : '#fb7185',
              boxShadow: online ? '0 0 6px #e8c39e' : 'none'
            }}
          />
          <span>{session.roomId || 'LOCAL'}</span>
        </button>

        {/* Medidor de Madurez Global del Software */}
        {maturityScore !== undefined && (
          <button
            onClick={onOpenMaturityAudit}
            className="btn-studio-glass"
            style={{
              padding: '4px 10px',
              fontSize: '0.72rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              borderRadius: '8px',
              border: `1px solid ${maturityScore >= 85 ? '#10B981' : maturityScore >= 60 ? '#38BDF8' : '#F59E0B'}66`,
              background: `${maturityScore >= 85 ? '#10B981' : maturityScore >= 60 ? '#38BDF8' : '#F59E0B'}15`,
              color: maturityScore >= 85 ? '#10B981' : maturityScore >= 60 ? '#38BDF8' : '#F59E0B'
            }}
            title="Madurez arquitectónica del software. Clic para ver auditoría detallada"
          >
            <Sparkles size={12} />
            <span className="hide-on-mobile">Madurez:</span>
            <span>{maturityScore}%</span>
          </button>
        )}

        {/* Conmutador Rápido de Rol para Demostración RBAC */}
        {userRole && onQuickRoleChange && (
          <select
            value={userRole}
            onChange={e => onQuickRoleChange(e.target.value as any)}
            className="hide-on-mobile"
            style={{
              background: userRole === 'Observador' ? 'rgba(245, 158, 11, 0.18)' : 'var(--glass-surface-hover)',
              border: `1px solid ${userRole === 'Observador' ? '#F59E0B' : 'var(--glass-border-color)'}`,
              color: userRole === 'Observador' ? '#F59E0B' : 'var(--text-primary)',
              borderRadius: '8px',
              padding: '4px 8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="Cambiar rol activo para demostración de permisos RBAC en vivo"
          >
            <option value="Arquitecto de Software">Arquitecto</option>
            <option value="Desarrollador Backend">Backend</option>
            <option value="Ingeniero Frontend">Frontend</option>
            <option value="Analista QA">QA Tester</option>
            <option value="Observador">Observador</option>
          </select>
        )}

        {/* Avatares de Colaboradores (Compactos) */}
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
          {session.participants.slice(0, 4).map((p, idx) => {
            const isMe = p.id === session.currentUser?.id;
            const isHovered = activeHoveredUser === p.id;
            const color = p.avatarColor || (idx === 0 ? '#2f2c79' : idx === 1 ? '#171a4a' : '#5c688c');

            return (
              <div
                key={p.id}
                onMouseEnter={() => handleUserHover(p.id)}
                onMouseLeave={handleUserLeave}
                onClick={() => handleUserHover(p.id)}
                style={{ position: 'relative', cursor: 'pointer' }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: color,
                    border: '2px solid var(--bg-canvas)',
                    outline: isHovered ? '2px solid var(--text-primary)' : `1.5px solid ${color}88`,
                    marginLeft: idx === 0 ? 0 : '-6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.70rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    boxShadow: isHovered ? `0 0 12px ${color}` : `0 0 6px ${color}44`,
                    transform: isHovered ? 'scale(1.15) translateY(-2px)' : 'scale(1)',
                    transition: 'all 0.18s ease-out',
                    zIndex: isHovered ? 20 : 10 - idx
                  }}
                >
                  {p.name.charAt(0)}
                </div>

                {isHovered && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '36px',
                      right: 0,
                      background: 'var(--popover-bg)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: `1px solid ${color}88`,
                      borderRadius: '12px',
                      padding: '10px 14px',
                      minWidth: '190px',
                      boxShadow: `0 12px 32px rgba(0, 0, 0, 0.25), 0 0 15px ${color}33`,
                      zIndex: 100,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      animation: 'fadeIn 0.2s ease-out'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                        {p.name} {isMe && <span style={{ color, fontSize: '0.74rem' }}>(Tú)</span>}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {p.role || 'Colaborador'}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Botones de Historial: Deshacer y Rehacer */}
        {onUndo && (
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="btn-studio-glass"
            style={{
              padding: '6px 9px',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: canUndo ? 1 : 0.4,
              cursor: canUndo ? 'pointer' : 'not-allowed'
            }}
            title="Deshacer última acción (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
        )}
        {onRedo && (
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="btn-studio-glass"
            style={{
              padding: '6px 9px',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: canRedo ? 1 : 0.4,
              cursor: canRedo ? 'pointer' : 'not-allowed'
            }}
            title="Rehacer última acción (Ctrl+Y o Ctrl+Shift+Z)"
          >
            <Redo2 size={14} />
          </button>
        )}

        {/* Botón Principal Guardar en Nube (CU-05) */}
        {onGuardarNube && (
          <button
            type="button"
            onClick={onGuardarNube}
            className="btn-studio-primary"
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            aria-label="Guardar"
            aria-keyshortcuts="Control+S Meta+S"
            title="Guardar el diagrama en la nube · Ctrl + S"
          >
            <Save size={14} aria-hidden="true" />
            <span className="hide-on-mobile">Guardar</span>
          </button>
        )}

        {/* Botón Código y DDL Dock */}
        <button
          onClick={onToggleCodeDock}
          className="btn-studio-glass"
          style={{
            background: isCodeDockOpen ? 'var(--btn-studio-share-bg)' : undefined,
            borderColor: isCodeDockOpen ? 'var(--btn-studio-share-border)' : undefined,
            color: isCodeDockOpen ? 'var(--accent-primary)' : undefined,
            padding: '6px 12px',
            fontSize: '0.76rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="Alternar panel de generación de código Spring Boot y DDL"
        >
          <Code2 size={15} />
          <span className="hide-on-mobile">Código</span>
        </button>

        {/* ─── Menú Glass Desplegable de Más Opciones [ ⋯ ] ─── */}
        <button
          type="button"
          ref={moreMenuButtonRef}
          onClick={() => setIsMoreMenuOpen(open => !open)}
          className="btn-studio-glass"
          style={{ padding: '6px 10px', background: isMoreMenuOpen ? 'var(--glass-surface-hover)' : undefined }}
          aria-label="Más opciones de proyecto y configuración"
          title="Más opciones de proyecto y configuración"
          aria-expanded={isMoreMenuOpen}
          aria-controls={isMoreMenuOpen ? moreMenuId : undefined}
        >
          <MoreVertical size={16} />
        </button>

        {isMoreMenuOpen && createPortal(
          <div
            id={moreMenuId}
            ref={moreMenuRef}
            className="studio-more-menu"
            role="group"
            aria-label="Más opciones del proyecto"
            style={{
              '--studio-menu-top': `${moreMenuPosition.top}px`,
              '--studio-menu-anchor-right': `${moreMenuPosition.anchorRight}px`,
            } as React.CSSProperties}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                closeMoreMenu();
              }
            }}
          >
            {menuGroups.map(({ title, actions }) => (
              <div className="studio-more-menu-group" key={title} role="group" aria-label={title}>
                <div className="studio-more-menu-heading" aria-hidden="true">{title}</div>
                {actions.map(({ label, icon: Icon, run, tooltip, shortcut }) => run && (
                  <button
                    key={label}
                    type="button"
                    title={tooltip}
                    className="studio-more-menu-action"
                    onClick={() => {
                      closeMoreMenu();
                      run();
                    }}
                  >
                    <Icon size={15} aria-hidden="true" />
                    <span>{label}</span>
                    {shortcut && <kbd>{shortcut}</kbd>}
                  </button>
                ))}
              </div>
            ))}
          </div>,
          document.body
        )}
      </div>
    </header>
  );
};
