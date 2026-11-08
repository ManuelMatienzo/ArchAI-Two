import React from 'react';
import { Boxes, Loader2 } from 'lucide-react';

interface GlassLoadingScreenProps {
  message?: string;
  submessage?: string;
  fullScreen?: boolean;
}

export const GlassLoadingScreen: React.FC<GlassLoadingScreenProps> = ({
  message = 'Cargando módulo...',
  submessage = 'Preparando espacio de trabajo de ArchAI',
  fullScreen = true
}) => {
  return (
    <div
      style={{
        width: fullScreen ? '100vw' : '100%',
        height: fullScreen ? '100vh' : '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: fullScreen ? 'fixed' : 'relative',
        top: 0,
        left: 0,
        zIndex: 9999,
        background: 'radial-gradient(ellipse at 50% 30%, rgba(23, 26, 74, 0.85) 0%, rgba(0, 0, 32, 0.95) 75%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        color: '#f5e1ce',
        userSelect: 'none'
      }}
    >
      {/* Glow ambiental de fondo */}
      <div
        style={{
          position: 'absolute',
          width: '320px',
          height: '320px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232, 195, 158, 0.18) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none'
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
          padding: '32px 40px',
          borderRadius: '24px',
          background: 'rgba(23, 26, 74, 0.45)',
          border: '1px solid rgba(232, 195, 158, 0.22)',
          boxShadow: '0 20px 40px rgba(0, 0, 32, 0.6), 0 0 30px rgba(232, 195, 158, 0.1)'
        }}
      >
        {/* Brand Icon Pulsante */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, rgba(232, 195, 158, 0.25), rgba(47, 44, 121, 0.6))',
            border: '1px solid rgba(232, 195, 158, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            boxShadow: '0 8px 24px rgba(232, 195, 158, 0.25)',
            position: 'relative'
          }}
        >
          <Boxes size={32} color="#f5e1ce" />
          <Loader2
            size={76}
            color="#e8c39e"
            style={{
              position: 'absolute',
              animation: 'spin 1.8s linear infinite',
              opacity: 0.8
            }}
          />
        </div>

        <h3
          style={{
            fontSize: '1.05rem',
            fontWeight: 800,
            letterSpacing: '0.02em',
            margin: '0 0 6px 0',
            background: 'linear-gradient(135deg, #f5e1ce 0%, #e8c39e 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          {message}
        </h3>

        <p
          style={{
            fontSize: '0.8rem',
            color: 'rgba(245, 225, 206, 0.65)',
            margin: 0
          }}
        >
          {submessage}
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default GlassLoadingScreen;
