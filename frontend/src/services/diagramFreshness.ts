import { ModeloDiagrama } from '../types/uml';

const tiempo = (value: unknown): number => {
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const revision = (diagram: ModeloDiagrama | undefined | null): number =>
  Number((diagram as any)?._reviewRevision ?? 0);

/**
 * Decide si un diagrama recibido de la sala puede reemplazar al diagrama local.
 *
 * Al recargar, la sala puede conservar un layout anterior mientras el usuario ya
 * restauró posiciones más recientes desde la nube. En ese caso el diagrama remoto
 * no debe pisar el trabajo local. Si el remoto pertenece a otro diagrama (no comparte
 * clases) o el local está vacío, sí se adopta.
 */
export function diagramaRemotoReemplaza(
  remoto: ModeloDiagrama | undefined | null,
  local: ModeloDiagrama | undefined | null
): boolean {
  const clasesRemotas = Array.isArray(remoto?.classes) ? remoto!.classes : [];
  const clasesLocales = Array.isArray(local?.classes) ? local!.classes : [];
  if (clasesLocales.length && !clasesRemotas.length) return false;
  const idsLocales = new Set(clasesLocales.map((c) => c.id));
  const coinciden = clasesRemotas.filter((c) => idsLocales.has(c.id)).length;
  if (!coinciden) return true;
  const tRemoto = tiempo(remoto?.updatedAt);
  const tLocal = tiempo(local?.updatedAt);
  if (!tRemoto || !tLocal) return true;
  return tRemoto >= tLocal;
}

/** Una revisión oficial más alta siempre es autoridad, aunque su sello de tiempo sea anterior. */
export function revisionOficialAvanzada(
  revisionRemota: number | undefined,
  local: ModeloDiagrama | undefined | null
): boolean {
  return Number(revisionRemota ?? 0) > revision(local);
}
