import { useEffect, useState } from 'react';
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

  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(() => {
    return localStorage.getItem('archai_selected_room_id') || undefined;
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

  useEffect(() => {
    const expired = () => {
      setSession(null);
      setSelectedDiagram(undefined);
      setSelectedProjectTitle(undefined);
      setSelectedDiagramId(undefined);
    setSelectedRoomId(undefined);
    localStorage.removeItem('archai_selected_room_id');
    };
    window.addEventListener('archai-session-expired', expired);
    return () => window.removeEventListener('archai-session-expired', expired);
  }, []);

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

  const handleOpenStudio = (diagram?: ModeloDiagrama, projectTitle?: string, diagramId?: string, roomId?: string) => {
    setSelectedDiagram(diagram);
    setSelectedProjectTitle(projectTitle);
    setSelectedDiagramId(diagramId);
    setSelectedRoomId(roomId);

    try {
      localStorage.setItem('archai_current_view', 'estudio');
      if (diagramId) localStorage.setItem('archai_selected_diagram_id', diagramId);
      else localStorage.removeItem('archai_selected_diagram_id');

      if (projectTitle) localStorage.setItem('archai_selected_project_title', projectTitle);
      else localStorage.removeItem('archai_selected_project_title');

      if (roomId) localStorage.setItem('archai_selected_room_id', roomId);
      else localStorage.removeItem('archai_selected_room_id');

      if (roomId) localStorage.setItem('archai_selected_room_id', roomId);
      else localStorage.removeItem('archai_selected_room_id');

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
        selectedRoomId={selectedRoomId}
      />
    </BrowserRouter>
  );
}
