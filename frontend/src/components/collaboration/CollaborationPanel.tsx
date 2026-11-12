import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  Check,
  Activity,
  Crown,
  Bot,
  RefreshCw,
  Link,
  X,
  Zap,
  Pencil
} from 'lucide-react';
import { InformacionSesion } from '../../types/auth';
import { ClienteStomp } from '../../services/stompClient';

interface CollaborationPanelProps {
  session: InformacionSesion;
  onAddSimulatedParticipant?: () => void;
}

type ActivityType = 'join' | 'leave' | 'diagrama' | 'chat' | 'ia' | 'sistema' | 'reconnect';

interface ActivityEvent {
  id: string;
  type: ActivityType;
  user: string;
  userColor: string;
  text: string;
  time: string;
  icon: React.ReactNode;
  accent: string;
}

const TYPE_CONFIG: Record<ActivityType, { label: string; icon: React.ReactNode; accent: string }> = {
  join: { label: 'Se unió a la sala', icon: <Users size={12} color="#38bdf8" />, accent: '#38bdf8' },
  leave: { label: 'Abandonó la sala', icon: <X size={12} color="#f43f5e" />, accent: '#f43f5e' },
  diagrama: { label: 'Actualizó el diagrama', icon: <Pencil size={12} color="#e8c39e" />, accent: '#e8c39e' },
  chat: { label: 'Mensaje', icon: <Activity size={12} color="#a78bfa" />, accent: '#a78bfa' },
  ia: { label: 'Propuesta de IA', icon: <Bot size={12} color="#4ade80" />, accent: '#4ade80' },
  sistema: { label: 'Sistema', icon: <Activity size={12} color="#94a3b8" />, accent: '#94a3b8' },
  reconnect: { label: 'Reconectado', icon: <RefreshCw size={12} color="#38bdf8" />, accent: '#38bdf8' }
};

const formatTime = (): string => {
  const now = new Date();
  return now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

const userColors = ['#38bdf8', '#e8c39e', '#4ade80', '#a78bfa', '#f472b6', '#fb923c', '#22d3ee', '#84cc16'];

const getUserColor = (userName: string): string => {
  let hash = 0;
  for (let i = 0; i < userName.length; i++) {
    hash = userName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return userColors[Math.abs(hash) % userColors.length];
};

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  session
}) => {
  const [copied, setCopied] = useState(false);
  const [estadoConexion, setEstadoConexion] = useState<'conectando' | 'conectado' | 'simulado' | 'desconectado'>('conectando');
  const [actividadActual, setActividadActual] = useState<{ user: string; text: string; time: number } | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const stompRef = useRef<ClienteStomp | null>(null);
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyShareLink = useCallback(() => {
    navigator.clipboard.writeText(session.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [session.roomId]);

  const agregarEvento = useCallback((tipo: ActivityType, user: string, text: string) => {
    const now = Date.now();
    const event: ActivityEvent = {
      id: `${tipo}-${now}-${Math.random().toString(36).slice(2, 6)}`,
      type: tipo,
      user,
      userColor: getUserColor(user),
      text,
      time: formatTime(),
      ...TYPE_CONFIG[tipo]
    };
    setEvents(prev => [event, ...prev].slice(0, 30));
    // Actualizar actividad actual (la más reciente se muestra como "en vivo")
    setActividadActual({ user, text, time: now });
    if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
    activityTimeoutRef.current = setTimeout(() => {
      setActividadActual(null);
    }, 6000);
  }, []);

  // CU-03 · Conexión STOMP real al broker del backend (/ws-stomp + canal /topic/collab/{salaId})
  useEffect(() => {
    let activo = true;
    const cliente = new ClienteStomp(
      session.roomId,
      session.currentUser.id,
      session.currentUser.name,
      (payload: any) => {
        if (!activo) return;
        const tipoRaw = payload?.tipo || 'mensaje';
        const emisor = payload?.emisorNombre || 'participante';
        const dato = payload?.payload;

        const tipo = (['join', 'leave', 'diagrama', 'chat', 'ia', 'sistema', 'reconnect'] as ActivityType[]).includes(tipoRaw as ActivityType)
          ? (tipoRaw as ActivityType)
          : 'chat';

        let texto: string = tipo;
        if (tipo === 'join') {
          texto = 'Se unió a la sala colaborativa.';
        } else if (tipo === 'leave') {
          texto = 'Abandonó la sala.';
        } else if (tipo === 'diagrama') {
          texto = 'Actualizó el diagrama en vivo.';
        } else if (tipo === 'ia') {
          texto = 'Generó una propuesta de diseño.';
        } else if (dato) {
          texto = typeof dato === 'string' ? dato : (dato?.texto || dato?.mensaje || 'Envió un mensaje.');
        }

        agregarEvento(tipo, emisor, texto);
      },
      (estado) => {
        if (!activo) return;
        if (estado.includes('Conectado')) {
          setEstadoConexion('conectado');
          agregarEvento('sistema', 'Sistema', 'Conectado al canal de colaboración en vivo.');
        } else if (estado.includes('Error') || estado.includes('Desconectado')) {
          setEstadoConexion('desconectado');
          agregarEvento('sistema', 'Sistema', 'Se interrumpió la conexión. Reintentando…');
        }
      }
    );
    stompRef.current = cliente;

    cliente.connect(8000)
      .then(() => {
        if (!activo) return;
        setEstadoConexion('conectado');
        cliente.publicar('join', { texto: 'unirse a la sala' });
        agregarEvento('join', session.currentUser.name, 'Se unió a la sala colaborativa.');
      })
      .catch(() => {
        if (!activo) return;
        setEstadoConexion('simulado');
        agregarEvento('sistema', 'Sistema', 'Modo sin conexión: los cambios se conservan localmente.');
      });

    return () => {
      activo = false;
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
      stompRef.current?.disconnect();
      stompRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.roomId, session.currentUser.id, session.currentUser.name, agregarEvento]);

  const reconnect = useCallback(() => {
    setEstadoConexion('conectando');
    agregarEvento('reconnect', session.currentUser.name, 'Intentando reconectar a la sala…');
    // Forzar re-montaje del efecto cambiando una clave interna
    window.dispatchEvent(new CustomEvent('archai-reconnect-stomp', { detail: { roomId: session.roomId } }));
  }, [session.roomId, session.currentUser.name, agregarEvento]);

  const isHost = session.currentUser.isHost;
  const participantCount = session.participants.length;

  return (
    <div className="glass-card" style={{
      padding: '20px 24px',
      marginBottom: '24px',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--glass-border-color)',
      background: 'var(--glass-surface)',
      backdropFilter: 'var(--glass-blur-lg)',
      boxShadow: 'var(--glass-shadow)'
    }}>
      {/* ==================== HEADER DE SALA ==================== */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--glass-accent), var(--glass-accent-secondary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--glow-accent)',
              flexShrink: 0
            }}>
              <Users size={16} color="#ffffff" />
            </div>
            <h4 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.05rem',
              fontWeight: 800,
              letterSpacing: '-0.01em',
              color: 'var(--text-primary)',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              Sala de Colaboración
            </h4>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              background: 'rgba(255,255,255,0.06)',
              padding: '2px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.10)',
              display: 'inline-block'
            }}>
              {session.roomId}
            </span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '6px'
          }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: estadoConexion === 'conectado'
                  ? 'var(--glass-success)'
                  : estadoConexion === 'conectando'
                    ? '#F59E0B'
                    : estadoConexion === 'desconectado'
                      ? '#f43f5e'
                      : '#94a3b8',
                boxShadow: estadoConexion === 'conectado' ? '0 0 10px var(--glass-success)' : 'none',
                flexShrink: 0
              }}
            />
            <span style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              color: estadoConexion === 'conectado' ? 'var(--glass-success)' : estadoConexion === 'conectando' ? '#F59E0B' : 'var(--text-muted)',
              fontFamily: 'var(--font-heading)'
            }}>
              {estadoConexion === 'conectado' ? 'En vivo' : estadoConexion === 'conectando' ? 'Conectando…' : estadoConexion === 'desconectado' ? 'Desconectado' : 'Sin conexión'}
            </span>
            {estadoConexion !== 'conectado' && (
              <button
                onClick={reconnect}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '0.70rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease'
                }}
              >
                <RefreshCw size={11} />
                Reconectar
              </button>
            )}
          </div>
        </div>
        <button
          onClick={copyShareLink}
          style={{
            background: copied ? 'var(--glass-success)' : 'rgba(255,255,255,0.08)',
            border: copied ? '1px solid var(--glass-success)' : '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px',
            color: copied ? '#ffffff' : 'var(--text-primary)',
            fontSize: '0.74rem',
            fontWeight: 800,
            padding: '8px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
        >
          {copied ? <Check size={13} /> : <Link size={13} />}
          <span>{copied ? '¡PIN copiado!' : 'Compartir Sala'}</span>
        </button>
      </div>

      {/* ==================== PARTICIPANTES EN VIVO ==================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Users size={13} color="var(--glass-node-stereo-color)" />
          <span style={{
            fontSize: '0.78rem',
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Equipo en Sala ({participantCount})
          </span>
          {isHost && (
            <span style={{
              fontSize: '0.70rem',
              fontWeight: 800,
              color: '#f43f5e',
              background: 'rgba(244, 63, 94, 0.10)',
              padding: '1px 6px',
              borderRadius: '4px',
              border: '1px solid rgba(244, 63, 94, 0.20)'
            }}>
              Anfitrión
            </span>
          )}
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          {session.participants.map((user) => (
            <div
              key={user.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'var(--glass-blur-sm)',
                border: `1px solid ${user.avatarColor || '#64748b'}30`,
                borderRadius: 'var(--radius-full)',
                padding: '5px 12px',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: user.avatarColor || '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                fontWeight: 800,
                color: '#ffffff',
                boxShadow: `0 0 8px ${user.avatarColor || '#64748b'}`
              }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span style={{
                fontSize: '0.80rem',
                fontWeight: 700,
                fontFamily: 'var(--font-heading)',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '120px'
              }}>
                {user.name}
              </span>
              {user.isHost && (
                <Crown size={11} color="#f43f5e" style={{ flexShrink: 0 }} />
              )}
              <span style={{
                fontSize: '0.66rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                flexShrink: 0,
                whiteSpace: 'nowrap'
              }}>
                ({user.role})
              </span>
            </div>
          ))}
          {participantCount === 0 && (
            <span style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              fontStyle: 'italic'
            }}>
              Solo en esta sala
            </span>
          )}
        </div>
      </div>

      {/* ==================== ACTIVIDAD EN TIEMPO REAL ==================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Activity size={13} color="var(--glass-node-stereo-color)" />
          <span style={{
            fontSize: '0.78rem',
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Actividad Reciente
          </span>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 'var(--radius-lg)',
          padding: '0',
          maxHeight: '220px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column-reverse'
        }}>
          {events.length === 0 ? (
            <div style={{
              padding: '24px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '8px',
              color: 'var(--text-muted)'
            }}>
              <Activity size={20} color="var(--text-muted)" style={{ opacity: 0.5 }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Sin actividad reciente</span>
              <span style={{ fontSize: '0.70rem', opacity: 0.6 }}>Las acciones del equipo aparecerán aquí.</span>
            </div>
          ) : (
            events.map((evt) => (
              <div
                key={evt.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '8px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: evt.type === 'diagrama' ? 'rgba(232, 195, 158, 0.05)' : 'transparent',
                  transition: 'background 0.15s ease',
                  animation: 'fadeIn 0.3s ease-out'
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: `${evt.accent}15`,
                    border: `1px solid ${evt.accent}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: evt.accent,
                    flexShrink: 0
                  }}
                >
                  {evt.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '6px',
                    marginBottom: '2px'
                  }}>
                    <span style={{
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      color: evt.userColor,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '130px'
                    }}>
                      {evt.user}
                    </span>
                    <span style={{
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {evt.time}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.4',
                    whiteSpace: 'pre-wrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {evt.text}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ==================== ACTIVIDAD EN VIVO (ENCURSO) ==================== */}
      {actividadActual && (
        <div
          style={{
            marginTop: '14px',
            padding: '10px 14px',
            background: 'rgba(56, 189, 248, 0.10)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <Zap size={13} color="#38bdf8" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              fontSize: '0.74rem',
              fontWeight: 800,
              color: '#38bdf8',
              fontFamily: 'var(--font-heading)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'block',
              marginBottom: '2px'
            }}>
              En vivo ahora
            </span>
            <span style={{
              fontSize: '0.80rem',
              color: 'var(--text-primary)',
              fontWeight: 600,
              whiteSpace: 'pre-wrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {actividadActual.user} {actividadActual.text}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
