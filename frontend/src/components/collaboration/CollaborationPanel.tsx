import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Share2, 
  Check, 
  Activity, 
  Crown
} from 'lucide-react';
import { InformacionSesion } from '../../types/auth';
import { ClienteStomp } from '../../services/stompClient';

interface CollaborationPanelProps {
  session: InformacionSesion;
  onAddSimulatedParticipant?: () => void;
}

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  session
}) => {
  const [copied, setCopied] = useState(false);
  const [estadoConexion, setEstadoConexion] = useState<'conectando' | 'conectado' | 'simulado'>('conectando');
  const [events,setEvents]=useState<string[]>([]);
  const stompRef = useRef<ClienteStomp | null>(null);

  const copyShareLink = () => {
    navigator.clipboard.writeText(session.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const agregarEvento = (texto: string) => {
    setEvents(prev => [texto, ...prev.slice(0, 4)]);
  };

  // CU-03 · Conexión STOMP real al broker del backend (/ws-stomp + canal /topic/collab/{salaId})
  useEffect(() => {
    let activo = true;
    const cliente = new ClienteStomp(
      session.roomId,
      session.currentUser.id,
      session.currentUser.name,
      (payload: any) => {
        if (!activo) return;
        const tipo = payload?.tipo || 'mensaje';
        const emisor = payload?.emisorNombre || 'participante';
        const dato = payload?.payload;
        if (tipo === 'join') {
          agregarEvento(`${emisor} se unió a la sala colaborativa (STOMP).`);
          return;
        }
        if (tipo === 'diagrama') {
          agregarEvento(`${emisor} actualizó el diagrama en vivo.`);
          return;
        }
        const texto = typeof dato === 'string' ? dato : (dato?.texto || dato?.mensaje || tipo);
        agregarEvento(`${emisor}: ${texto}`);
      },
      (estado) => {
        if (activo) console.log('[STOMP]', estado);
      }
    );
    stompRef.current = cliente;

    cliente.connect(7000)
      .then(() => {
        if (!activo) return;
        setEstadoConexion('conectado');
        cliente.publicar('join', { texto: 'unirse a la sala' });
        agregarEvento(`Conectado vía STOMP al canal /topic/collab/${session.roomId}.`);
      })
      .catch(() => {
        if (!activo) return;
        setEstadoConexion('simulado');
        agregarEvento('No se pudo conectar con la sala. Intenta reconectar.');
      });

    return () => {
      activo = false;
      stompRef.current?.disconnect();
      stompRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.roomId, session.currentUser.id, session.currentUser.name]);

  return (
    <div className="glass-card" style={{
      padding: '24px 30px',
      marginBottom: '26px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'linear-gradient(135deg, var(--glass-accent), var(--glass-accent-secondary))',
              padding: '8px',
              borderRadius: '10px',
              boxShadow: 'var(--glow-accent)',
              color: '#FFFFFF'
            }}>
              <Users size={18} />
            </div>
            <h4 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.08rem',
              fontWeight: 800,
              letterSpacing: '-0.01em',
              color: 'var(--text-primary)'
            }}>
              Colaboración en Vivo ({session.participants.length} ingenieros conectados)
            </h4>
          </div>
          <span
            style={{
              marginLeft: '36px',
              fontSize: '0.66rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              alignSelf: 'flex-start',
              background: estadoConexion === 'conectado'
                ? 'rgba(16, 185, 129, 0.12)'
                : estadoConexion === 'conectando'
                  ? 'rgba(245, 158, 11, 0.12)'
                  : 'rgba(125, 125, 125, 0.10)',
              border: `1px solid ${
                estadoConexion === 'conectado'
                  ? 'rgba(16, 185, 129, 0.35)'
                  : estadoConexion === 'conectando'
                    ? 'rgba(245, 158, 11, 0.35)'
                    : 'var(--glass-border-color)'
              }`,
              color: estadoConexion === 'conectado'
                ? 'var(--glass-success)'
                : estadoConexion === 'conectando'
                  ? '#F59E0B'
                  : 'var(--text-muted)'
            }}
            title="Estado del canal STOMP /topic/collab/{salaId}"
          >
            <Activity size={10} />
            {estadoConexion === 'conectado'
              ? 'STOMP en vivo'
              : estadoConexion === 'conectando'
                ? 'Conectando al broker...'
                : 'Sin conexión'}
          </span>
        </div>
        <button
          onClick={copyShareLink}
          className="glass-button-secondary"
          style={{
            padding: '6px 14px',
            fontSize: '0.78rem'
          }}
        >
          {copied ? <Check size={13} color="var(--glass-success)" /> : <Share2 size={13} />}
          {copied ? '¡PIN Copiado!' : 'Compartir Sala'}
        </button>
      </div>

      {/* Participants List */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        {session.participants.map(user => (
          <div
            key={user.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'var(--glass-surface)',
              backdropFilter: 'var(--glass-blur-sm)',
              border: `1px solid ${user.avatarColor}60`,
              boxShadow: `0 4px 15px ${user.avatarColor}15`,
              borderRadius: 'var(--radius-full)',
              padding: '6px 14px 6px 8px',
              transition: 'all 0.25s ease'
            }}
          >
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: user.avatarColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 800,
              color: '#ffffff',
              boxShadow: `0 0 10px ${user.avatarColor}`
            }}>
              {user.name.charAt(0)}
            </div>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>{user.name}</span>
            {user.isHost && (
              <span title="Anfitrión de la sesión">
                <Crown size={13} color="var(--glass-warning)" />
              </span>
            )}
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({user.role})</span>
          </div>
        ))}
      </div>

      {/* Live Activity Ticker */}
      <div style={{
        background: 'var(--glass-surface)',
        backdropFilter: 'var(--glass-blur-sm)',
        border: '1px solid var(--glass-border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 16px',
        fontSize: '0.8rem',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        color: 'var(--text-secondary)'
      }}>
        <Activity size={15} color="var(--glass-success)" className="animate-pulse" />
        <span>Última actividad: <strong style={{ color: 'var(--text-primary)' }}>{events[0]}</strong></span>
      </div>
    </div>
  );
};
