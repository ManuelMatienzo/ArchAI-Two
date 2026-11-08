import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { InformacionSesion } from './types/auth';
import { ModeloDiagrama } from './types/uml';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  const [session, setSession] = useState<InformacionSesion | null>(() => {
    const saved = localStorage.getItem('archai_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [selectedDiagramId, setSelectedDiagramId] = useState<string | undefined>(() => {
    return localStorage.getItem('archai_selected_diagram_id') || undefined;
  });

  const [selectedProjectTitle, setSelectedProjectTitle] = useState<string | undefined>(() => {
    return localStorage.getItem('archai_selected_project_title') || undefined;
  });

  const [selectedDiagram, setSelectedDiagram] = useState<ModeloDiagrama | undefined>(() => {
    const diagId = localStorage.getItem('archai_selected_diagram_id');
    if (diagId) {
      try {
        const porId = localStorage.getItem(`archai_diagram_${diagId}`);
        if (porId) return JSON.parse(porId);
      } catch {}
    }
    const saved = localStorage.getItem('archai_selected_diagram');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return undefined;
  });

  const handleLoginSuccess = (sesion: InformacionSesion, targetView?: 'proyectos' | 'estudio') => {
    setSession(sesion);
    try {
      localStorage.setItem('archai_current_view', targetView || 'proyectos');
    } catch {}
  };

  const handleLogout = () => {
    localStorage.removeItem('archai_session');
    localStorage.removeItem('archai_token');
    localStorage.removeItem('archai_current_view');
    localStorage.removeItem('archai_selected_diagram_id');
    localStorage.removeItem('archai_selected_project_title');
    localStorage.removeItem('archai_selected_diagram');
    setSession(null);
    setSelectedDiagram(undefined);
    setSelectedProjectTitle(undefined);
    setSelectedDiagramId(undefined);
  };

  const handleOpenStudio = (diagram?: ModeloDiagrama, projectTitle?: string, diagramId?: string) => {
    setSelectedDiagram(diagram);
    setSelectedProjectTitle(projectTitle);
    setSelectedDiagramId(diagramId);

    try {
      localStorage.setItem('archai_current_view', 'estudio');
      if (diagramId) localStorage.setItem('archai_selected_diagram_id', diagramId);
      else localStorage.removeItem('archai_selected_diagram_id');

      if (projectTitle) localStorage.setItem('archai_selected_project_title', projectTitle);
      else localStorage.removeItem('archai_selected_project_title');

      if (diagram) localStorage.setItem('archai_selected_diagram', JSON.stringify(diagram));
      else localStorage.removeItem('archai_selected_diagram');
    } catch (e) {
      console.warn('Error al guardar estado de navegación local', e);
    }
  };

  const handleBackToProjects = () => {
    try {
      localStorage.setItem('archai_current_view', 'proyectos');
    } catch {}
  };

  return (
    <BrowserRouter>
      <AppRoutes
        session={session}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
        onOpenStudio={handleOpenStudio}
        onBackToProjects={handleBackToProjects}
        selectedDiagram={selectedDiagram}
        selectedProjectTitle={selectedProjectTitle}
        selectedDiagramId={selectedDiagramId}
      />
    </BrowserRouter>
  );
}
