import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { InformacionSesion } from '../../types/auth';
import { LoginModal as ModalInicioSesion } from '../../components/auth/LoginModal';

export interface LoginPageProps {
  onLoginSuccess?: (sesion: InformacionSesion, targetView?: 'proyectos' | 'estudio') => void;
  alIniciarSesion?: (sesion: InformacionSesion, targetView?: 'proyectos' | 'estudio') => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, alIniciarSesion }) => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('archai_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('archai_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    // Si ya existe sesión guardada, redirigir automáticamente al panel de proyectos
    const existing = localStorage.getItem('archai_session');
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (parsed?.currentUser) {
          navigate('/projects', { replace: true });
        }
      } catch {}
    }
  }, [navigate]);

  const handleSuccess = (sesion: InformacionSesion, targetView?: 'proyectos' | 'estudio') => {
    if (onLoginSuccess) {
      onLoginSuccess(sesion, targetView);
    } else if (alIniciarSesion) {
      alIniciarSesion(sesion, targetView);
    }

    if (targetView === 'estudio') {
      navigate('/studio');
    } else {
      navigate('/projects');
    }
  };

  return (
    <main className="pagina-autenticacion" style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Selector Flotante de Modo Claro / Modo Oscuro */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '24px',
        zIndex: 10001
      }}>
        <button
          type="button"
          onClick={toggleTheme}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '24px',
            background: theme === 'dark' ? 'rgba(23, 26, 74, 0.85)' : 'rgba(255, 255, 255, 0.95)',
            border: theme === 'dark' ? '1.5px solid rgba(232, 195, 158, 0.40)' : '1.5px solid rgba(23, 26, 74, 0.22)',
            color: theme === 'dark' ? '#f5e1ce' : '#000020',
            cursor: 'pointer',
            fontSize: '0.78rem',
            fontWeight: 800,
            boxShadow: theme === 'dark' ? '0 6px 20px rgba(0, 0, 32, 0.55)' : '0 6px 18px rgba(23, 26, 74, 0.12)',
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)'
          }}
          title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
        >
          {theme === 'dark' ? <Sun size={15} color="#e8c39e" /> : <Moon size={15} color="#171a4a" />}
          <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
        </button>
      </div>

      <ModalInicioSesion onLoginSuccess={handleSuccess} theme={theme} onToggleTheme={toggleTheme} />
    </main>
  );
};

// Alias de retrocompatibilidad
export const PaginaInicioSesion = LoginPage;
export default LoginPage;
