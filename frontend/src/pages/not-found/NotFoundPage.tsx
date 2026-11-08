import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft, LayoutGrid } from 'lucide-react';
import { GlassCard } from '../../components/glass/GlassCard';
import { GlassButton } from '../../components/glass/GlassButton';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 20%, #171a4a 0%, #000020 70%)',
        padding: '20px'
      }}
    >
      {/* Glow ambiental de fondo */}
      <div
        style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232, 195, 158, 0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none'
        }}
      />

      <GlassCard
        className="not-found-card"
        style={{
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
          padding: '44px 32px',
          position: 'relative',
          zIndex: 1,
          border: '1px solid rgba(232, 195, 158, 0.22)',
          boxShadow: '0 20px 50px rgba(0, 0, 32, 0.6), 0 0 30px rgba(232, 195, 158, 0.12)'
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(232, 195, 158, 0.2), rgba(47, 44, 121, 0.4))',
            border: '1px solid rgba(232, 195, 158, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px auto',
            color: '#e8c39e',
            boxShadow: '0 8px 24px rgba(232, 195, 158, 0.2)'
          }}
        >
          <Compass size={38} />
        </div>

        <div
          style={{
            fontSize: '3.5rem',
            fontWeight: 900,
            letterSpacing: '0.05em',
            background: 'linear-gradient(135deg, #f5e1ce 0%, #e8c39e 50%, #b8977e 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
            marginBottom: '12px'
          }}
        >
          404
        </div>

        <h1
          style={{
            fontSize: '1.35rem',
            fontWeight: 700,
            color: '#f5e1ce',
            marginBottom: '12px'
          }}
        >
          Página no encontrada
        </h1>

        <p
          style={{
            fontSize: '0.9rem',
            color: 'rgba(245, 225, 206, 0.72)',
            lineHeight: 1.6,
            marginBottom: '32px'
          }}
        >
          La ruta que intentas acceder no existe o fue movida en la arquitectura de ArchAI.
          Puedes regresar al gestor de proyectos o al estudio de diagramas.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}
        >
          <GlassButton
            onClick={() => navigate(-1)}
            variant="secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '12px',
              fontSize: '0.85rem'
            }}
          >
            <ArrowLeft size={16} />
            Volver atrás
          </GlassButton>

          <GlassButton
            onClick={() => navigate('/projects')}
            variant="primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              borderRadius: '12px',
              fontSize: '0.85rem',
              fontWeight: 700
            }}
          >
            <LayoutGrid size={16} />
            Gestor de Proyectos
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
};

export default NotFoundPage;
