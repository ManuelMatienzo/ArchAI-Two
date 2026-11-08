import React, { useState } from 'react';
import { 
  Boxes, 
  Mail, 
  Lock, 
  User, 
  ArrowRight,
  Briefcase
} from 'lucide-react';
import { InformacionSesion, RolUsuario } from '../../types/auth';
import { GlassTextField } from '../glass/GlassTextField';
import { GlassDropdown, DropdownOption } from '../glass/GlassDropdown';
import { LoginBackground } from './LoginBackground';
import {
  iniciarSesion,
  registrarUsuario
} from '../../services/api';

interface LoginModalProps {
  onLoginSuccess: (session: InformacionSesion, targetView?: 'proyectos' | 'estudio') => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

const ROLE_OPTIONS: DropdownOption<RolUsuario>[] = [
  { value: 'Arquitecto de Software', label: 'Arquitecto de Software', icon: <Briefcase size={14} color="var(--text-secondary)" /> },
  { value: 'Ingeniero de Datos', label: 'Ingeniero de Datos', icon: <Briefcase size={14} color="var(--text-secondary)" /> },
  { value: 'Desarrollador Backend', label: 'Desarrollador Backend', icon: <Briefcase size={14} color="var(--text-secondary)" /> },
  { value: 'Ingeniero Frontend', label: 'Ingeniero Frontend', icon: <Briefcase size={14} color="var(--text-secondary)" /> },
  { value: 'Líder Técnico', label: 'Líder Técnico', icon: <Briefcase size={14} color="var(--text-secondary)" /> }
];

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess, theme }) => {
  const isDark = (theme || (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'dark') === 'dark';
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState('carlos.criado@archai.io');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('Ing. Carlos Criado');
  const [role, setRole] = useState<RolUsuario>('Arquitecto de Software');
  const [loading, setLoading] = useState(false);
  const [errorLocal, setErrorLocal] = useState('');

  const handleQuickProfile = (pName: string, pEmail: string, pRole: RolUsuario) => {
    setName(pName);
    setEmail(pEmail);
    setRole(pRole);
    setPassword('password123');
    setErrorLocal('');
  };

  /** Flujo de Autenticación contra el Servidor */
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!email.trim()) {
      setErrorLocal('Por favor ingresa tu correo electrónico.');
      return;
    }
    if (!password.trim()) {
      setErrorLocal('Por favor ingresa tu contraseña.');
      return;
    }
    if (modo === 'registro' && !name.trim()) {
      setErrorLocal('Por favor ingresa tu nombre completo.');
      return;
    }

    setErrorLocal('');
    setLoading(true);

    try {
      if (modo === 'registro') {
        await registrarUsuario({
          nombre: name.trim(),
          nombreUsuario: name.trim().toLowerCase().replace(/\s+/g, '_'),
          correo: email.trim(),
          contrasena: password.trim(),
          rol: role as string
        });
      }

      // Autenticación contra el backend Spring Boot (POST /api/v1/auth/login)
      const data = await iniciarSesion(email.trim(), password.trim());
      
      if (!data || !data.token || !data.session) {
        throw new Error('El servidor no devolvió una sesión o token válido.');
      }

      // Persistir token JWT real y sesión de base de datos
      localStorage.setItem('archai_token', data.token);
      localStorage.setItem('archai_session', JSON.stringify(data.session));
      localStorage.setItem('archai_ultima_sala', data.session.roomId || 'ARC-GRUPO04');

      // Acceso directo al Hub de Proyectos
      onLoginSuccess(data.session, 'proyectos');
    } catch (err: any) {
      setErrorLocal(err?.message || 'No se pudo iniciar sesión. Por favor verifica tus credenciales o el estado de la red.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      zIndex: 9999
    }}>
      <LoginBackground />

      {/* Modal Card con alto contraste y lucidez adaptativa (Tema Claro y Oscuro) */}
      <div className="glass-login-modal" style={{
        maxWidth: '410px',
        width: '100%',
        padding: '26px 24px',
        position: 'relative',
        zIndex: 10,
        borderRadius: '18px'
      }}>
        {/* Cabecera / Marca con Lucidez de Contraste */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #171a4a, #2f2c79)',
            border: '1.5px solid #e8c39e',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#e8c39e',
            marginBottom: '8px',
            boxShadow: '0 4px 14px rgba(232, 195, 158, 0.35)'
          }}>
            <Boxes size={22} color="#e8c39e" />
          </div>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.45rem',
            fontWeight: 900,
            letterSpacing: '0.02em',
            margin: 0,
            color: isDark ? '#ffffff' : '#000020',
            textTransform: 'uppercase'
          }}>
            {modo === 'registro' ? 'Crear Cuenta' : 'Acceder'}
          </h2>
          <p style={{
            fontSize: '0.80rem',
            color: isDark ? '#cbd5e1' : '#131247',
            fontWeight: 600,
            margin: '5px 0 0',
            lineHeight: 1.35
          }}>
            {modo === 'registro'
              ? 'Regístrate para colaborar en diagramas UML con IA'
              : 'Ingresa tus credenciales para acceder al estudio'}
          </p>
        </div>

        {/* Notificación de Error */}
        {errorLocal && (
          <div style={{
            background: isDark ? 'rgba(244, 63, 94, 0.20)' : 'rgba(244, 63, 94, 0.14)',
            border: `1.5px solid ${isDark ? 'rgba(244, 63, 94, 0.50)' : '#e11d48'}`,
            color: isDark ? '#fda4af' : '#b91c1c',
            borderRadius: '9px',
            padding: '9px 12px',
            fontSize: '0.76rem',
            fontWeight: 800,
            marginBottom: '14px',
            textAlign: 'center'
          }}>
            {errorLocal}
          </div>
        )}

        {/* Acceso Rápido */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{
            fontSize: '0.68rem',
            color: isDark ? '#e8c39e' : '#171a4a',
            fontWeight: 900,
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            textAlign: 'center'
          }}>
            Acceso Rápido:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
            <button
              type="button"
              onClick={() => handleQuickProfile('Ing. Carlos Criado', 'carlos.criado@archai.io', 'Arquitecto de Software')}
              style={{
                padding: '7px 4px',
                fontSize: '0.74rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                borderRadius: '8px',
                cursor: 'pointer',
                border: email === 'carlos.criado@archai.io'
                  ? (isDark ? '2px solid #e8c39e' : '2px solid #171a4a')
                  : (isDark ? '1.5px solid rgba(232, 195, 158, 0.35)' : '1.5px solid rgba(23, 26, 74, 0.25)'),
                background: email === 'carlos.criado@archai.io'
                  ? (isDark ? 'rgba(232, 195, 158, 0.28)' : 'rgba(232, 195, 158, 0.40)')
                  : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(23, 26, 74, 0.04)'),
                color: isDark ? '#ffffff' : '#000020',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#e8c39e',
                flexShrink: 0,
                border: isDark ? '1px solid #f5e1ce' : '1px solid #171a4a'
              }} />
              <span>Carlos (Arq.)</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickProfile('Dra. Elena Ramos', 'elena.ramos@archai.io', 'Ingeniero de Datos')}
              style={{
                padding: '7px 4px',
                fontSize: '0.74rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                borderRadius: '8px',
                cursor: 'pointer',
                border: email === 'elena.ramos@archai.io'
                  ? (isDark ? '2px solid #38bdf8' : '2px solid #0369a1')
                  : (isDark ? '1.5px solid rgba(232, 195, 158, 0.35)' : '1.5px solid rgba(23, 26, 74, 0.25)'),
                background: email === 'elena.ramos@archai.io'
                  ? (isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(186, 230, 253, 0.60)')
                  : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(23, 26, 74, 0.04)'),
                color: isDark ? '#ffffff' : '#000020',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#38bdf8',
                flexShrink: 0,
                border: isDark ? '1px solid #7dd3fc' : '1px solid #0369a1'
              }} />
              <span>Elena (Datos)</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickProfile('Ing. Lucas Vaca', 'lucas.vaca@archai.io', 'Desarrollador Backend')}
              style={{
                padding: '7px 4px',
                fontSize: '0.74rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                borderRadius: '8px',
                cursor: 'pointer',
                border: email === 'lucas.vaca@archai.io'
                  ? (isDark ? '2px solid #a78bfa' : '2px solid #5b21b6')
                  : (isDark ? '1.5px solid rgba(232, 195, 158, 0.35)' : '1.5px solid rgba(23, 26, 74, 0.25)'),
                background: email === 'lucas.vaca@archai.io'
                  ? (isDark ? 'rgba(167, 139, 250, 0.22)' : 'rgba(233, 213, 255, 0.60)')
                  : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(23, 26, 74, 0.04)'),
                color: isDark ? '#ffffff' : '#000020',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#a78bfa',
                flexShrink: 0,
                border: isDark ? '1px solid #c4b5fd' : '1px solid #5b21b6'
              }} />
              <span>Lucas (Dev)</span>
            </button>
          </div>
        </div>

        {/* Formulario Directo de 1 Solo Paso */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {modo === 'registro' && (
            <GlassTextField
              label="Nombre Completo"
              required
              labelStyle={{ color: isDark ? '#f5e1ce' : '#000020', fontWeight: 800 }}
              leadingIcon={<User size={15} color={isDark ? '#e8c39e' : '#171a4a'} />}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej. Ing. Carlos Criado"
            />
          )}

          <GlassTextField
            label="Correo Electrónico"
            required
            type="email"
            labelStyle={{ color: isDark ? '#f5e1ce' : '#000020', fontWeight: 800 }}
            leadingIcon={<Mail size={15} color={isDark ? '#e8c39e' : '#171a4a'} />}
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="usuario@archai.io"
          />

          <GlassTextField
            label="Contraseña de Acceso"
            required
            type="password"
            labelStyle={{ color: isDark ? '#f5e1ce' : '#000020', fontWeight: 800 }}
            leadingIcon={<Lock size={15} color={isDark ? '#e8c39e' : '#171a4a'} />}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          {modo === 'registro' && (
            <GlassDropdown
              label="Rol en el Proyecto"
              options={ROLE_OPTIONS}
              value={role}
              onChange={val => setRole(val)}
            />
          )}

          {/* Botón Principal Prominente (Lucidez Total: Texto Oscuro sobre Fondo Arena) */}
          <button
            type="submit"
            disabled={loading}
            style={{
              background: '#e8c39e',
              color: '#000020',
              border: 'none',
              borderRadius: '9px',
              padding: '12px',
              fontSize: '0.88rem',
              fontFamily: 'var(--font-heading)',
              fontWeight: 900,
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 16px rgba(232, 195, 158, 0.40)',
              marginTop: '4px',
              letterSpacing: '0.02em',
              transition: 'all 0.15s ease'
            }}
          >
            <span>{loading ? 'Accediendo...' : (modo === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta y Entrar')}</span>
            <ArrowRight size={16} color="#000020" />
          </button>
        </form>

        {/* Alternar Registro / Login con Contraste Nitido */}
        <div style={{ textAlign: 'center', marginTop: '14px' }}>
          <button
            type="button"
            onClick={() => {
              setModo(modo === 'login' ? 'registro' : 'login');
              setErrorLocal('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: isDark ? '#e8c39e' : '#171a4a',
              fontSize: '0.80rem',
              fontWeight: 800,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {modo === 'login'
              ? '¿No tienes una cuenta aún? Regístrate aquí'
              : '¿Ya tienes una cuenta? Inicia sesión aquí'}
          </button>
        </div>
      </div>
    </div>
  );
};
