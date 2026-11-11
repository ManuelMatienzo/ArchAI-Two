import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { InformacionSesion } from '../types/auth';
import { ROUTES } from './paths';
import { GlassLoadingScreen } from '../components/glass/GlassLoadingScreen';

// Carga perezosa (Code Splitting con React.lazy) para separar bundles por página
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const ProjectsPage = lazy(() => import('../pages/projects/ProjectsPage'));
const StudioPage = lazy(() => import('../pages/studio/StudioPage'));
const NotFoundPage = lazy(() => import('../pages/not-found/NotFoundPage'));

interface AppRoutesProps {
  session: InformacionSesion | null;
  onLoginSuccess: (sesion: InformacionSesion, targetView?: 'proyectos' | 'estudio') => void;
  onLogout: () => void;
  onOpenStudio?: (diagram?: any, projectTitle?: string, diagramId?: string, roomId?: string) => void;
  onBackToProjects?: () => void;
  selectedDiagram?: any;
  selectedProjectTitle?: string;
  selectedDiagramId?: string;
  selectedRoomId?: string;
}

/**
 * Componente que protege rutas que requieren autenticación.
 */
export const ProtectedRoute: React.FC<{
  session: InformacionSesion | null;
  children: React.ReactElement;
}> = ({ session, children }) => {
  const location = useLocation();

  // Comprobar tanto el estado de React como localStorage para evitar parpadeos tras recargar
  const tieneSesion = Boolean(session || localStorage.getItem('archai_session'));

  if (!tieneSesion) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

/**
 * Componente para rutas públicas (ej. /login).
 * Si ya hay sesión activa, redirige automáticamente al hub de proyectos.
 */
export const PublicOnlyRoute: React.FC<{
  session: InformacionSesion | null;
  children: React.ReactElement;
}> = ({ session, children }) => {
  const tieneSesion = Boolean(session || localStorage.getItem('archai_session'));

  if (tieneSesion) {
    return <Navigate to="/projects" replace />;
  }

  return children;
};

export const AppRoutes: React.FC<AppRoutesProps> = ({
  session,
  onLoginSuccess,
  onLogout,
  onOpenStudio,
  onBackToProjects,
  selectedDiagram,
  selectedProjectTitle,
  selectedDiagramId,
  selectedRoomId
}) => {
  // Elemento reutilizable de Login con carga perezosa
  const loginElement = (
    <PublicOnlyRoute session={session}>
      <Suspense fallback={<GlassLoadingScreen message="Iniciando acceso..." submessage="Cargando portal de autenticación" />}>
        <LoginPage onLoginSuccess={onLoginSuccess} />
      </Suspense>
    </PublicOnlyRoute>
  );

  // Elemento reutilizable de Projects con carga perezosa
  const projectsElement = (
    <ProtectedRoute session={session}>
      <Suspense fallback={<GlassLoadingScreen message="Cargando proyectos..." submessage="Recuperando espacio de trabajo" />}>
        <ProjectsPage
          session={session || undefined}
          onLogout={onLogout}
          onOpenStudio={onOpenStudio}
        />
      </Suspense>
    </ProtectedRoute>
  );

  // Fábrica para el Estudio y sus sub-vistas con carga perezosa
  const createStudioElement = (initialTab?: 'canvas' | 'team' | 'settings', initialDock?: 'code' | 'ai') => (
    <ProtectedRoute session={session}>
      <Suspense fallback={<GlassLoadingScreen message="Iniciando Estudio UML..." submessage="Cargando lienzo interactivo y herramientas CASE" />}>
        <StudioPage
          session={session || undefined}
          onLogout={onLogout}
          initialDiagram={selectedDiagram}
          projectTitle={selectedProjectTitle}
          diagramId={selectedDiagramId}
          roomId={selectedRoomId}
          onOpenProjects={onBackToProjects}
          initialTab={initialTab}
          initialDock={initialDock}
        />
      </Suspense>
    </ProtectedRoute>
  );

  const studioElement = createStudioElement();
  const teamElement = createStudioElement('team');
  const settingsElement = createStudioElement('settings');
  const generatorElement = createStudioElement(undefined, 'code');

  return (
    <Routes>
      {/* 1. Redirección de Raíz */}
      <Route
        path="/"
        element={
          session || localStorage.getItem('archai_session') ? (
            <Navigate to={ROUTES.PROJECTS.PATH} replace />
          ) : (
            <Navigate to={ROUTES.LOGIN.PATH} replace />
          )
        }
      />

      {/* 2. Autenticación / Login (Canónico y Alias) */}
      <Route path={ROUTES.LOGIN.PATH} element={loginElement} />
      {ROUTES.LOGIN.ALIASES.map(alias => (
        <Route key={alias} path={alias} element={loginElement} />
      ))}

      {/* 3. Gestión de Proyectos (Canónico y Alias) */}
      <Route path={ROUTES.PROJECTS.PATH} element={projectsElement} />
      {ROUTES.PROJECTS.ALIASES.map(alias => (
        <Route key={alias} path={alias} element={projectsElement} />
      ))}

      {/* 4. Lienzo / Estudio UML (Canónico y Alias sin ID) */}
      <Route path={ROUTES.STUDIO.PATH} element={studioElement} />
      {ROUTES.STUDIO.ALIASES.map(alias => (
        <Route key={alias} path={alias} element={studioElement} />
      ))}

      {/* 5. Lienzo / Estudio UML con Diagram ID (Deep-linking) */}
      <Route path={ROUTES.STUDIO.WITH_ID} element={studioElement} />
      {ROUTES.STUDIO.ALIASES_WITH_ID.map(alias => (
        <Route key={alias} path={alias} element={studioElement} />
      ))}

      {/* 6. Salas de Colaboración en Tiempo Real CU-03 (Canónico y Alias) */}
      <Route path={ROUTES.ROOM.PATH} element={studioElement} />
      {ROUTES.ROOM.ALIASES.map(alias => (
        <Route key={alias} path={alias} element={studioElement} />
      ))}

      {/* 7. Sub-módulos y Vistas Directas del Estudio */}
      {/* Equipo / Colaboradores */}
      <Route path={ROUTES.TEAM.PATH} element={teamElement} />
      {ROUTES.TEAM.ALIASES.map(alias => (
        <Route key={alias} path={alias} element={teamElement} />
      ))}

      {/* Configuración / Ajustes */}
      <Route path={ROUTES.SETTINGS.PATH} element={settingsElement} />
      {ROUTES.SETTINGS.ALIASES.map(alias => (
        <Route key={alias} path={alias} element={settingsElement} />
      ))}

      {/* Generador de Código */}
      <Route path={ROUTES.GENERATOR.PATH} element={generatorElement} />
      {ROUTES.GENERATOR.ALIASES.map(alias => (
        <Route key={alias} path={alias} element={generatorElement} />
      ))}

      {/* 8. Ruta 404 No Encontrada */}
      <Route
        path="*"
        element={
          <Suspense fallback={<GlassLoadingScreen message="Cargando..." />}>
            <NotFoundPage />
          </Suspense>
        }
      />
    </Routes>
  );
};

export default AppRoutes;
