import { apiFetch } from './api';
import { roomPath, roomQuery } from './roomChat';

type ArtifactKind = 'backend_zip' | 'suite_zip' | 'flutter_zip' | 'xmi' | 'native' | 'code';

/** Reports a completed export, never its private contents. Download success is independent of notification delivery. */
export function reportArtifact(kind: ArtifactKind) {
  try {
    const session = JSON.parse(localStorage.getItem('archai_session') || 'null');
    const diagramId = localStorage.getItem('archai_selected_diagram_id');
    if (!session?.roomId || !diagramId) return;
    void apiFetch(`${roomPath(session.roomId, diagramId)}/actividad/generacion${roomQuery(diagramId)}`, {
      method: 'POST',
      body: JSON.stringify({ kind, operationId: crypto.randomUUID() }),
    }).catch(() => {});
  } catch {
    /* An unsaved or offline export remains available locally. */
  }
}
