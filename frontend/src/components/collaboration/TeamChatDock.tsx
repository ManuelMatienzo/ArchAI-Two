import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  X,
  Users
} from 'lucide-react';

export interface TeamChatMessage {
  senderId?: string;
  id: string;
  sender: string;
  senderRole?: string;
  content: string;
  timestamp: string;
  fullDate?: string;
  roomId?: string;
  isAiResponse?: boolean;
  isSystemNotification?: boolean;
  status?: string;
}

interface TeamChatDockProps {
  isOpen: boolean;
  onClose: () => void;
  messages: TeamChatMessage[];
  onSendMessage: (text: string) => void;
  currentUser: {
    id: string;
    name: string;
    role?: string;
  };
  roomId: string;
}

export const TeamChatDock: React.FC<TeamChatDockProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  currentUser,
  roomId,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    onSendMessage(text);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getRoleBadge = (role?: string) => {
    const r = (role || '').toUpperCase();
    if (r.includes('ARQUITECT')) {
      return { label: 'Arquitecto', bg: 'rgba(232, 195, 158, 0.16)', color: '#e8c39e', border: 'rgba(232, 195, 158, 0.40)' };
    }
    if (r.includes('MOVIL') || r.includes('MÓVIL') || r.includes('ING')) {
      return { label: 'Ing. Móvil', bg: 'rgba(52, 211, 153, 0.16)', color: '#34d399', border: 'rgba(52, 211, 153, 0.40)' };
    }
    if (r.includes('REVISOR')) {
      return { label: 'Revisor', bg: 'rgba(56, 189, 248, 0.16)', color: '#38bdf8', border: 'rgba(56, 189, 248, 0.40)' };
    }
    if (r.includes('IA') || r.includes('ARCHAI')) {
      return { label: 'Co-Developer', bg: 'rgba(192, 132, 252, 0.16)', color: '#c084fc', border: 'rgba(192, 132, 252, 0.40)' };
    }
    return { label: role || 'Colaborador', bg: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)', border: 'rgba(255, 255, 255, 0.15)' };
  };

  return (
    <aside
      style={{
        width: '380px',
        maxWidth: '100vw',
        height: '100%',
        background: 'var(--glass-dock-bg)',
        backdropFilter: 'var(--glass-blur-lg)',
        WebkitBackdropFilter: 'var(--glass-blur-lg)',
        borderLeft: '1px solid var(--glass-dock-border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 85,
        flexShrink: 0,
        boxShadow: 'var(--glass-dock-shadow)',
        position: 'relative',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      {/* 1. Header del Chat */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: 'rgba(56, 189, 248, 0.14)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <MessageSquare size={15} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Chat Colaborativo
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
              Sala {roomId} · STOMP en vivo
            </div>
          </div>
        </div>

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
          title="Cerrar chat de equipo"
        >
          <X size={18} />
        </button>
      </div>

      {/* 2. Lista de Mensajes */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '30px' }}>
            <Users size={28} style={{ opacity: 0.4, marginBottom: '8px' }} />
            <div>No hay mensajes en esta sala aún.</div>
            <div style={{ fontSize: '0.70rem', marginTop: '4px' }}>Escribe un mensaje para sincronizar con la App Móvil.</div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = Boolean((msg.senderId && currentUser?.id && msg.senderId === currentUser.id) || (msg.sender && currentUser?.name && msg.sender.trim().toLowerCase() === currentUser.name.trim().toLowerCase()));
            const badge = getRoleBadge(msg.senderRole);

            if (msg.isSystemNotification) {
              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: 'center',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '0.70rem',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    margin: '4px 0'
                  }}
                >
                  {msg.content}
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px'
                }}
              >
                {/* Remitente e insignia de rol */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    justifyContent: isMe ? 'flex-end' : 'flex-start',
                    fontSize: '0.68rem'
                  }}
                >
                  <span style={{ fontWeight: 700, color: isMe ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                    {isMe ? 'Tú' : msg.sender}
                  </span>
                  <span
                    style={{
                      background: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                      padding: '1px 5px',
                      borderRadius: '4px',
                      fontSize: '0.60rem',
                      fontWeight: 800
                    }}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Burbuja del mensaje */}
                <div
                  style={{
                    background: isMe ? 'var(--btn-studio-share-bg)' : 'var(--glass-surface)',
                    border: isMe ? '1px solid var(--btn-studio-share-border)' : '1px solid var(--glass-border-color)',
                    padding: '8px 12px',
                    borderRadius: isMe ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.78rem',
                    lineHeight: '1.4',
                    wordBreak: 'break-word',
                    boxShadow: isMe ? '0 2px 8px rgba(47, 44, 121, 0.15)' : 'none'
                  }}
                >
                  {msg.content}
                </div>

                {/* Hora */}
                <div
                  style={{
                    fontSize: '0.62rem',
                    color: 'var(--text-muted)',
                    textAlign: isMe ? 'right' : 'left',
                    marginTop: '1px'
                  }}
                >
                  {msg.timestamp || 'Ahora'}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Input Inferior */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--glass-dock-border)',
          background: 'var(--glass-dock-header-bg)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mensaje para el equipo móvil..."
          style={{
            flex: 1,
            background: 'var(--input-bg)',
            border: '1px solid var(--input-border)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--text-primary)',
            fontSize: '0.78rem',
            outline: 'none'
          }}
        />
        <button
          onClick={handleSend}
          disabled={!inputText.trim()}
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            background: inputText.trim() ? '#2f2c79' : 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(232, 195, 158, 0.35)',
            color: inputText.trim() ? '#f5e1ce' : 'var(--text-muted)',
            cursor: inputText.trim() ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
          title="Enviar mensaje (Enter)"
        >
          <Send size={15} />
        </button>
      </div>
    </aside>
  );
};
