import { ModeloDiagrama } from '../types/uml';
import { diagramaDesdeBackend } from './api';

export interface DiagramaResumen {
  id:string; proyectoId:string; titulo:string; totalClases:number;
  totalRelaciones:number; actualizadoEn:string; data?:ModeloDiagrama;
}

/** El Hub abre IDs reales; conserva aparte los borradores locales con contenido. */
export function mergeProjectDiagrams(projectId:string, remote:any[], local:DiagramaResumen[]=[]):DiagramaResumen[] {
  const saved=remote.map(dto=>({
    id:dto.id,proyectoId:projectId,titulo:dto.title || 'Diagrama sin título',
    totalClases:dto.classes?.length || 0,totalRelaciones:dto.relations?.length || 0,
    actualizadoEn:dto.updatedAt || 'Reciente',data:diagramaDesdeBackend(dto)
  }));
  const ids=new Set(saved.map(d=>d.id));
  return [...saved,...local.filter(d=>d.data && !ids.has(d.id))];
}
