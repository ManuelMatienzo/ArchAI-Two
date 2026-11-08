import { useNavigate } from 'react-router-dom';
import { ROUTES } from './paths';

export interface NavigateToStudioOptions {
  title?: string;
  tab?: 'canvas' | 'team' | 'settings';
  dock?: 'code' | 'ai';
  state?: any;
}

/**
 * Hook para navegación tipada dentro de la aplicación ArchAI,
 * facilitando el movimiento entre páginas y alias sin hardcodear strings.
 */
export function useAppNavigation() {
  const navigate = useNavigate();

  const toLogin = (replace = false) => {
    navigate(ROUTES.LOGIN.PATH, { replace });
  };

  const toProjects = (replace = false) => {
    navigate(ROUTES.PROJECTS.PATH, { replace });
  };

  const toStudio = (diagramId?: string, options?: NavigateToStudioOptions) => {
    const basePath = diagramId ? `/studio/${diagramId}` : ROUTES.STUDIO.PATH;
    const searchParams = new URLSearchParams();

    if (options?.title) searchParams.set('title', options.title);
    if (options?.tab) searchParams.set('tab', options.tab);
    if (options?.dock) searchParams.set('dock', options.dock);

    const query = searchParams.toString();
    navigate(
      {
        pathname: basePath,
        search: query ? `?${query}` : ''
      },
      { state: options?.state }
    );
  };

  const toLienzo = (diagramId?: string, options?: NavigateToStudioOptions) => {
    const basePath = diagramId ? `/lienzo/${diagramId}` : '/lienzo';
    const searchParams = new URLSearchParams();
    if (options?.title) searchParams.set('title', options.title);
    if (options?.tab) searchParams.set('tab', options.tab);
    if (options?.dock) searchParams.set('dock', options.dock);
    const query = searchParams.toString();
    navigate(
      {
        pathname: basePath,
        search: query ? `?${query}` : ''
      },
      { state: options?.state }
    );
  };

  const toRoom = (roomId: string) => {
    navigate(`/room/${encodeURIComponent(roomId)}`);
  };

  const toTeam = () => {
    navigate(ROUTES.TEAM.PATH);
  };

  const toSettings = () => {
    navigate(ROUTES.SETTINGS.PATH);
  };

  const toGenerator = () => {
    navigate(ROUTES.GENERATOR.PATH);
  };

  return {
    navigate,
    toLogin,
    toProjects,
    toStudio,
    toLienzo,
    toRoom,
    toTeam,
    toSettings,
    toGenerator
  };
}

export default useAppNavigation;
