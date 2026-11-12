import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Box,
  Key,
  Code2,
  Sliders,
  ChevronRight,
  Command,
  Sparkles,
  Plus,
  Image,
  FileOutput,
  FileJson,
  LayoutGrid,
  Sun,
  Users,
  X,
  History,
  Bot
} from 'lucide-react';
import { ModeloDiagrama } from '../../types/uml';

export type SearchItemKind = 'class' | 'attribute' | 'method' | 'command';

export interface SpotlightSearchItem {
  id: string;
  kind: SearchItemKind;
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  icon: React.ReactNode;
  classId?: string;
  action: () => void;
}

export interface QuickSearchSpotlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagram: ModeloDiagrama;
  onFocusClass: (classId: string) => void;
  // Comandos opcionales del sistema
  onNewClass?: () => void;
  onAutoOrganize?: () => void;
  onExportVisual?: () => void;
  onExportArchivo?: () => void;
  onExportEA?: () => void;
  onToggleTheme?: () => void;
  onFitToScreen?: () => void;
  onOpenShortcuts?: () => void;
  onToggleAiAssistant?: () => void;
  onToggleCodeDock?: () => void;
  onOpenTeamModal?: () => void;
  onOpenVersions?: () => void;
}

export const QuickSearchSpotlightModal: React.FC<QuickSearchSpotlightModalProps> = ({
  isOpen,
  onClose,
  diagram,
  onFocusClass,
  onNewClass,
  onAutoOrganize,
  onExportVisual,
  onExportArchivo,
  onExportEA,
  onToggleTheme,
  onFitToScreen,
  onOpenShortcuts,
  onToggleAiAssistant,
  onToggleCodeDock,
  onOpenTeamModal,
  onOpenVersions
}) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'class' | 'attribute' | 'method' | 'command'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-foco al abrir
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setActiveTab('all');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Construir catálogo de búsqueda
  const allItems = useMemo<SpotlightSearchItem[]>(() => {
    const items: SpotlightSearchItem[] = [];

    // 1. Clases UML
    diagram.classes.forEach(cls => {
      const stereo = cls.stereotype || (cls.isInterface ? 'Interface' : 'Class');
      const attrCount = cls.attributes?.length || 0;
      const methodCount = cls.methods?.length || 0;

      items.push({
        id: `class-${cls.id}`,
        kind: 'class',
        title: cls.name,
        subtitle: `Clase UML (${stereo}) · ${attrCount} atributos, ${methodCount} métodos`,
        badge: stereo,
        badgeColor: '#38bdf8',
        icon: <Box size={16} color="#38bdf8" />,
        classId: cls.id,
        action: () => {
          onFocusClass(cls.id);
          onClose();
        }
      });

      // 2. Atributos dentro de la clase
      cls.attributes?.forEach(attr => {
        const pkLabel = attr.isPrimaryKey ? ' [PK]' : '';
        items.push({
          id: `attr-${cls.id}-${attr.id}`,
          kind: 'attribute',
          title: `${attr.name}${pkLabel}`,
          subtitle: `Atributo en '${cls.name}': ${attr.visibility || '+'}${attr.name}: ${attr.type || 'String'}`,
          badge: attr.type || 'Tipo',
          badgeColor: attr.isPrimaryKey ? '#fbbf24' : '#e8c39e',
          icon: attr.isPrimaryKey ? <Key size={15} color="#fbbf24" /> : <Sliders size={15} color="#e8c39e" />,
          classId: cls.id,
          action: () => {
            onFocusClass(cls.id);
            onClose();
          }
        });
      });

      // 3. Métodos dentro de la clase
      cls.methods?.forEach(m => {
        items.push({
          id: `method-${cls.id}-${m.id}`,
          kind: 'method',
          title: `${m.name}(${m.parameters || ''})`,
          subtitle: `Método en '${cls.name}': ${m.visibility || '+'}${m.name}(...): ${m.returnType || 'void'}`,
          badge: m.returnType || 'void',
          badgeColor: '#a78bfa',
          icon: <Code2 size={15} color="#a78bfa" />,
          classId: cls.id,
          action: () => {
            onFocusClass(cls.id);
            onClose();
          }
        });
      });
    });

    // 4. Comandos Rápidos del Sistema
    if (onNewClass) {
      items.push({
        id: 'cmd-new-class',
        kind: 'command',
        title: 'Crear Nueva Clase / Tabla UML',
        subtitle: 'Abre el asistente de creación de clases y estereotipos',
        badge: 'Comando',
        badgeColor: '#34d399',
        icon: <Plus size={16} color="#34d399" />,
        action: () => {
          onClose();
          onNewClass();
        }
      });
    }

    if (onAutoOrganize) {
      items.push({
        id: 'cmd-auto-organize',
        kind: 'command',
        title: 'Auto-Organizar Diagrama (Layout Automático)',
        subtitle: 'Reorganiza automáticamente clases y conectores en cuadrícula inteligente',
        badge: 'Diseño',
        badgeColor: '#34d399',
        icon: <LayoutGrid size={16} color="#34d399" />,
        action: () => {
          onClose();
          onAutoOrganize();
        }
      });
    }

    if (onFitToScreen) {
      items.push({
        id: 'cmd-fit-screen',
        kind: 'command',
        title: 'Ajustar y Centrar Todo el Diagrama (Auto-Fit)',
        subtitle: 'Centra la vista en la pantalla calculando el bounding box óptimo',
        badge: 'Vista',
        badgeColor: '#38bdf8',
        icon: <Sparkles size={16} color="#38bdf8" />,
        action: () => {
          onClose();
          onFitToScreen();
        }
      });
    }

    if (onExportVisual) {
      items.push({
        id: 'cmd-export-visual',
        kind: 'command',
        title: 'Exportar Imagen (PNG / SVG en Alta Resolución)',
        subtitle: 'Genera imagen vectorial SVG o rasterizada PNG en escala 2x / 3x Retina',
        badge: 'Exportar',
        badgeColor: '#e8c39e',
        icon: <Image size={16} color="#e8c39e" />,
        action: () => {
          onClose();
          onExportVisual();
        }
      });
    }

    if (onExportArchivo) {
      items.push({
        id: 'cmd-export-file',
        kind: 'command',
        title: 'Exportar Proyecto Nativo (.archai.json)',
        subtitle: 'Descarga un archivo JSON portable con el modelo y sus relaciones completas',
        badge: 'Respaldo',
        badgeColor: '#38bdf8',
        icon: <FileJson size={16} color="#38bdf8" />,
        action: () => {
          onClose();
          onExportArchivo();
        }
      });
    }

    if (onExportEA) {
      items.push({
        id: 'cmd-export-ea',
        kind: 'command',
        title: 'Exportar para Enterprise Architect (XMI 1.1 Sparx)',
        subtitle: 'Exporta con diagrama, layout geométrico y conectores nativos de Sparx EA',
        badge: 'XMI EA',
        badgeColor: '#22d3ee',
        icon: <FileOutput size={16} color="#22d3ee" />,
        action: () => {
          onClose();
          onExportEA();
        }
      });
    }

    if (onToggleAiAssistant) {
      items.push({
        id: 'cmd-toggle-ai',
        kind: 'command',
        title: 'Abrir / Cerrar Asistente de IA (Ollama)',
        subtitle: 'Agente local para generar, modificar y auditar el diagrama por comandos de texto/voz',
        badge: 'IA Local',
        badgeColor: '#ec4899',
        icon: <Bot size={16} color="#ec4899" />,
        action: () => {
          onClose();
          onToggleAiAssistant();
        }
      });
    }

    if (onToggleCodeDock) {
      items.push({
        id: 'cmd-toggle-code',
        kind: 'command',
        title: 'Generador de Código (Spring Boot, SQL, Postman, IA)',
        subtitle: 'Abre el panel inferior para generar código fuente de backend y frontend',
        badge: 'Generador',
        badgeColor: '#f97316',
        icon: <Command size={16} color="#f97316" />,
        action: () => {
          onClose();
          onToggleCodeDock();
        }
      });
    }

    if (onOpenTeamModal) {
      items.push({
        id: 'cmd-open-team',
        kind: 'command',
        title: 'Gestión de Equipo y Permisos RBAC',
        subtitle: 'Administra colaboradores, roles y permisos de lectura/escritura',
        badge: 'Equipo',
        badgeColor: '#818cf8',
        icon: <Users size={16} color="#818cf8" />,
        action: () => {
          onClose();
          onOpenTeamModal();
        }
      });
    }

    if (onOpenVersions) {
      items.push({
        id: 'cmd-open-versions',
        kind: 'command',
        title: 'Historial de Versiones',
        subtitle: 'Ver snapshots guardados, comparar cambios y restaurar versiones anteriores',
        badge: 'Versiones',
        badgeColor: '#10b981',
        icon: <History size={16} color="#10b981" />,
        action: () => {
          onClose();
          onOpenVersions();
        }
      });
    }

    if (onToggleTheme) {
      items.push({
        id: 'cmd-toggle-theme',
        kind: 'command',
        title: 'Alternar Tema Claro / Oscuro',
        subtitle: 'Cambia entre la paleta Midnight Navy y la paleta Light HUD',
        badge: 'Tema',
        badgeColor: '#f59e0b',
        icon: <Sun size={16} color="#f59e0b" />,
        action: () => {
          onClose();
          onToggleTheme();
        }
      });
    }

    if (onOpenShortcuts) {
      items.push({
        id: 'cmd-open-shortcuts',
        kind: 'command',
        title: 'Guía de Atajos de Teclado (F1 / ?)',
        subtitle: 'Consulta todos los atajos de navegación, edición y zoom',
        badge: 'Atajos',
        badgeColor: '#a855f7',
        icon: <Command size={16} color="#a855f7" />,
        action: () => {
          onClose();
          onOpenShortcuts();
        }
      });
    }

    return items;
  }, [
    diagram,
    onFocusClass,
    onClose,
    onNewClass,
    onAutoOrganize,
    onExportVisual,
    onExportArchivo,
    onExportEA,
    onToggleAiAssistant,
    onToggleCodeDock,
    onOpenTeamModal,
    onOpenVersions,
    onToggleTheme,
    onFitToScreen,
    onOpenShortcuts
  ]);

  // Filtrado reactivo según búsqueda y pestaña activa
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allItems.filter(item => {
      // Filtro de pestaña
      if (activeTab !== 'all' && item.kind !== activeTab) return false;

      // Filtro de texto
      if (!q) return true;
      const titleMatch = item.title.toLowerCase().includes(q);
      const subtitleMatch = item.subtitle.toLowerCase().includes(q);
      const badgeMatch = item.badge?.toLowerCase().includes(q);
      return titleMatch || subtitleMatch || badgeMatch;
    });
  }, [allItems, query, activeTab]);

  // Asegurar que el elemento seleccionado esté visible al usar flechas
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeTab]);

  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector<HTMLElement>('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Manejo de teclado dentro del buscador
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        background: 'rgba(5, 7, 20, 0.75)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        animation: 'fadeIn 0.15s ease-out'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '92%',
          maxWidth: '640px',
          background: 'var(--popover-bg, #0b112c)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 25px rgba(56, 189, 248, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Cabecera / Barra de Entrada de Búsqueda */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 18px',
            borderBottom: '1px solid var(--glass-border-color, rgba(255, 255, 255, 0.1))',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <Search size={20} color="#38bdf8" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar clases, atributos, métodos o comandos... (ej. Controller, email, PNG)"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '0.98rem',
              color: 'var(--text-primary, #f8fafc)',
              fontWeight: 500
            }}
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary, #94a3b8)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Borrar texto"
            >
              <X size={16} />
            </button>
          ) : (
            <kbd
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '2px 7px',
                borderRadius: '5px',
                fontSize: '0.68rem',
                color: 'var(--text-secondary, #94a3b8)',
                fontFamily: 'var(--font-mono)'
              }}
            >
              Esc
            </kbd>
          )}
        </div>

        {/* Pestañas de Filtrado Rápido */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(0, 0, 0, 0.15)',
            overflowX: 'auto'
          }}
        >
          {[
            { id: 'all', label: 'Todo' },
            { id: 'class', label: 'Clases' },
            { id: 'attribute', label: 'Atributos' },
            { id: 'method', label: 'Métodos' },
            { id: 'command', label: 'Comandos' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: activeTab === tab.id ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                border: `1px solid ${activeTab === tab.id ? 'rgba(56, 189, 248, 0.4)' : 'transparent'}`,
                color: activeTab === tab.id ? '#38bdf8' : 'var(--text-secondary, #94a3b8)',
                padding: '3px 9px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--text-muted, #64748b)' }}>
            {filteredItems.length} resultado{filteredItems.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Lista de Resultados */}
        <div
          ref={listRef}
          style={{
            maxHeight: '360px',
            overflowY: 'auto',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          {filteredItems.length === 0 ? (
            <div
              style={{
                padding: '36px 16px',
                textAlign: 'center',
                color: 'var(--text-secondary, #94a3b8)',
                fontSize: '0.82rem'
              }}
            >
              No se encontraron coincidencias para &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-selected={isSelected}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isSelected
                      ? 'rgba(56, 189, 248, 0.14)'
                      : 'transparent',
                    border: isSelected
                      ? '1px solid rgba(56, 189, 248, 0.35)'
                      : '1px solid transparent',
                    transition: 'all 0.1s ease'
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {item.icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          color: isSelected ? '#f8fafc' : 'var(--text-primary, #e2e8f0)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {item.title}
                      </span>
                      {item.badge && (
                        <span
                          style={{
                            fontSize: '0.62rem',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: item.badgeColor ? `${item.badgeColor}22` : 'rgba(255, 255, 255, 0.1)',
                            color: item.badgeColor || '#94a3b8',
                            border: `1px solid ${item.badgeColor ? `${item.badgeColor}44` : 'rgba(255, 255, 255, 0.2)'}`,
                            fontWeight: 700
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-secondary, #94a3b8)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: '2px'
                      }}
                    >
                      {item.subtitle}
                    </div>
                  </div>

                  <ChevronRight
                    size={14}
                    color={isSelected ? '#38bdf8' : 'var(--text-muted, #64748b)'}
                    style={{
                      opacity: isSelected ? 1 : 0.4,
                      transform: isSelected ? 'translateX(2px)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Pie con Atajos de Teclado */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.2)',
            fontSize: '0.68rem',
            color: 'var(--text-secondary, #94a3b8)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span>
              <kbd style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '1px 5px', borderRadius: '3px' }}>↑</kbd>{' '}
              <kbd style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '1px 5px', borderRadius: '3px' }}>↓</kbd> Navegar
            </span>
            <span>
              <kbd style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '1px 5px', borderRadius: '3px' }}>↵</kbd> Seleccionar
            </span>
            <span>
              <kbd style={{ background: 'rgba(255, 255, 255, 0.08)', padding: '1px 5px', borderRadius: '3px' }}>Esc</kbd> Cerrar
            </span>
          </div>

          <span style={{ color: '#38bdf8', fontWeight: 600 }}>ArchAI Spotlight</span>
        </div>
      </div>
    </div>
  );
};
