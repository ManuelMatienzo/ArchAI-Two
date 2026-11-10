/** Identifiers only. Model credentials are never part of browser context. */
export function activeRoomContext(): { roomId?: string; diagramId?: string } {
  try {
    const session = JSON.parse(localStorage.getItem('archai_session') || 'null');
    const diagramId = localStorage.getItem('archai_selected_diagram_id');
    return { ...(session?.roomId ? { roomId: session.roomId } : {}), ...(diagramId ? { diagramId } : {}) };
  } catch {
    return {};
  }
}
