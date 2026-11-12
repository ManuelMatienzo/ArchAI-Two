import React from 'react';
import { 
  LayoutGrid, 
  Users, 
  Settings, 
  Boxes,
  LogOut,
  FolderKanban,
  FolderTree,
  MessageSquare
} from 'lucide-react';
import { PerfilUsuario } from '../../types/auth';

export type NavRailTab = 'canvas' | 'team' | 'settings' | 'projects';

export interface LeftNavRailProps {
  activeTab: NavRailTab;
  onSelectTab?: (tab: 'canvas' | 'team' | 'settings') => void;
  currentUser?: PerfilUsuario;
  onLogout?: () => void;
  onOpenProjects?: () => void;
  onOpenStudio?: () => void;
  onToggleProjectStructure?: () => void;
  projectStructureOpen?: boolean;
  onToggleAssistant?: () => void;
  assistantOpen?: boolean;
  unreadChatCount?: number;
}

export const LeftNavRail: React.FC<LeftNavRailProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  onLogout,
  onOpenProjects,
  onOpenStudio,
  onToggleProjectStructure,
  projectStructureOpen = false,
  onToggleAssistant,
  assistantOpen = false,
  unreadChatCount = 0
}) => {
  const user = currentUser || {
    id: 'usr-default',
    name: 'Arquitecto ArchAI',
    email: 'arquitecto@archai.io',
    role: 'ARQUITECTO' as any,
    avatarColor: '#3b82f6',
    isHost: true
  };

  return (
    <aside style={{
      width: '56px',
      background: 'var(--glass-rail-bg)',
      backdropFilter: 'var(--glass-blur-lg)',
      WebkitBackdropFilter: 'var(--glass-blur-lg)',
      borderRight: '1px solid var(--glass-rail-border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 0',
      zIndex: 100,
      flexShrink: 0
    }}>
      {/* Top Icons */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
        {/* Brand Icon */}
        <div
          onClick={onOpenProjects || onOpenStudio}
          title="ArchAI - Estudio de Arquitectura UML & IA"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--glass-accent), var(--glass-accent-secondary))',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--glow-accent)',
            marginBottom: '8px',
            cursor: (onOpenProjects || onOpenStudio) ? 'pointer' : 'default'
          }}
        >
          <Boxes size={19} color="#ffffff" />
        </div>

        {/* Hub de Proyectos (CU-02) */}
        <button
          onClick={onOpenProjects}
          title="Hub de Proyectos y Diagramas"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            border: activeTab === 'projects' ? '1px solid color-mix(in srgb, var(--glass-accent) 55%, transparent)' : '1px solid transparent',
            background: activeTab === 'projects' ? 'color-mix(in srgb, var(--glass-accent) 22%, transparent)' : 'transparent',
            color: activeTab === 'projects' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: activeTab === 'projects' ? '0 0 12px color-mix(in srgb, var(--glass-accent) 40%, transparent)' : 'none',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={e => {
            if (activeTab !== 'projects') {
              e.currentTarget.style.color = '#38bdf8';
              e.currentTarget.style.background = 'rgba(47, 44, 121, 0.12)';
            }
          }}
          onMouseLeave={e => {
            if (activeTab !== 'projects') {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <FolderKanban size={18} />
        </button>

        {/* Estudio UML Canvas */}
        <button
          onClick={() => {
            if (onOpenStudio) {
              onOpenStudio();
            } else if (onSelectTab) {
              onSelectTab('canvas');
            }
          }}
          title="Studio Canvas UML"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            border: activeTab === 'canvas' ? '1px solid color-mix(in srgb, var(--glass-accent) 55%, transparent)' : '1px solid transparent',
            background: activeTab === 'canvas' ? 'color-mix(in srgb, var(--glass-accent) 22%, transparent)' : 'transparent',
            color: activeTab === 'canvas' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: activeTab === 'canvas' ? '0 0 12px color-mix(in srgb, var(--glass-accent) 40%, transparent)' : 'none',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={e => {
            if (activeTab !== 'canvas') {
              e.currentTarget.style.color = '#38bdf8';
              e.currentTarget.style.background = 'rgba(47, 44, 121, 0.12)';
            }
          }}
          onMouseLeave={e => {
            if (activeTab !== 'canvas') {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <LayoutGrid size={18} />
        </button>

        {onToggleProjectStructure && (
          <button
            type="button"
            onClick={onToggleProjectStructure}
            title="Estructura del Proyecto"
            aria-label="Estructura del Proyecto"
            aria-expanded={projectStructureOpen}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              border: projectStructureOpen ? '1px solid color-mix(in srgb, var(--glass-accent) 55%, transparent)' : '1px solid transparent',
              background: projectStructureOpen ? 'color-mix(in srgb, var(--glass-accent) 22%, transparent)' : 'transparent',
              color: projectStructureOpen ? 'var(--accent-primary)' : 'var(--text-secondary)',
              boxShadow: projectStructureOpen ? '0 0 12px color-mix(in srgb, var(--glass-accent) 40%, transparent)' : 'none'
            }}
          >
            <FolderTree size={18} />
          </button>
        )}

        {/* Equipo y Colaboradores */}
        <button
          onClick={() => onSelectTab && onSelectTab('team')}
          title="Equipo y Colaboración en Tiempo Real"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            border: activeTab === 'team' ? '1px solid color-mix(in srgb, var(--glass-accent) 55%, transparent)' : '1px solid transparent',
            background: activeTab === 'team' ? 'color-mix(in srgb, var(--glass-accent) 22%, transparent)' : 'transparent',
            color: activeTab === 'team' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: activeTab === 'team' ? '0 0 12px color-mix(in srgb, var(--glass-accent) 40%, transparent)' : 'none',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={e => {
            if (activeTab !== 'team') {
              e.currentTarget.style.color = '#38bdf8';
              e.currentTarget.style.background = 'rgba(47, 44, 121, 0.12)';
            }
          }}
          onMouseLeave={e => {
            if (activeTab !== 'team') {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <Users size={18} />
        </button>

        {onToggleAssistant && <button
          type="button"
          onClick={onToggleAssistant}
          title="Chat del equipo"
          aria-label={unreadChatCount && !assistantOpen ? `Chat del equipo, ${unreadChatCount} mensajes nuevos` : 'Chat del equipo'}
          aria-expanded={assistantOpen}
          style={{width:38,height:38,borderRadius:10,position:'relative',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all 0.2s ease',
            border:assistantOpen?'1px solid color-mix(in srgb, var(--glass-accent) 55%, transparent)':'1px solid transparent',
            background:assistantOpen?'color-mix(in srgb, var(--glass-accent) 22%, transparent)':'transparent',
            color:assistantOpen?'var(--accent-primary)':'var(--text-secondary)',
            boxShadow:assistantOpen?'0 0 12px color-mix(in srgb, var(--glass-accent) 40%, transparent)':'none'}}
        >
          <MessageSquare size={18} />
          {!assistantOpen && unreadChatCount > 0 && (
            <span className="studio-chat-unread" aria-hidden="true">{unreadChatCount > 99 ? '99+' : unreadChatCount}</span>
          )}
        </button>}
        {/* Configuración */}
        <button
          onClick={() => onSelectTab && onSelectTab('settings')}
          title="Configuración"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            border: activeTab === 'settings' ? '1px solid color-mix(in srgb, var(--glass-accent) 55%, transparent)' : '1px solid transparent',
            background: activeTab === 'settings' ? 'color-mix(in srgb, var(--glass-accent) 22%, transparent)' : 'transparent',
            color: activeTab === 'settings' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: activeTab === 'settings' ? '0 0 12px color-mix(in srgb, var(--glass-accent) 40%, transparent)' : 'none',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={e => {
            if (activeTab !== 'settings') {
              e.currentTarget.style.color = '#38bdf8';
              e.currentTarget.style.background = 'rgba(47, 44, 121, 0.12)';
            }
          }}
          onMouseLeave={e => {
            if (activeTab !== 'settings') {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Bottom User Avatar & Logout */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <div
          title={`${user.name} (${user.role})`}
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: user.avatarColor || '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '0.8rem',
            color: '#ffffff',
            boxShadow: `0 0 12px ${user.avatarColor || '#3b82f6'}`,
            cursor: 'pointer'
          }}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            title="Cerrar sesión"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              border: '1px solid rgba(244, 63, 94, 0.25)',
              background: 'rgba(244, 63, 94, 0.12)',
              color: '#fb7185',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <LogOut size={15} />
          </button>
        )}
      </div>
    </aside>
  );
};
