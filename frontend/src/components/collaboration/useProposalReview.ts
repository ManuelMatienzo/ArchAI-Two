import { useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch, diagramaDesdeBackend } from '../../services/api';
import { Proposal } from '../../services/proposalAgent';
import { DraftDiagram } from '../../services/proposalDraft';
import { ModeloDiagrama } from '../../types/uml';

export interface ReviewedProposal extends Proposal {
  diagram: DraftDiagram;
  reviewRevision: number;
  moderationStatus: 'pending' | 'partial' | 'approved' | 'rejected' | 'superseded';
  conflict?: string;
  approvedClasses: string[];
  approvedRelations: string[];
  decidedBy?: string;
  decidedAt?: string;
  feedback?: string;
}
interface ReviewCommand {
  action: 'register' | 'preview' | 'edit' | 'rebase' | 'approve' | 'reject';
  proposalId: string;
  operationId?: string;
  expectedRevision?: number;
  proposal?: Proposal;
  baseDiagram?: ModeloDiagrama;
  diagram?: DraftDiagram;
  classIds?: string[];
  relationIds?: string[];
  deletionIds?: string[];
  feedback?: string;
}
interface ReviewSnapshot {
  sequence: number;
  diagramId: string;
  activeId: string;
  official: ModeloDiagrama;
  officialRevision: number;
  proposals: ReviewedProposal[];
  canModerate?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  undo?: ModeloDiagrama[];
  redo?: ModeloDiagrama[];
}
const friendly = (e: unknown) =>
  e instanceof ApiError && e.status === 0
    ? 'No se pudo conectar con el servidor. Tu borrador se conserva.'
    : e instanceof Error
      ? e.message
      : 'No se pudo completar la revisión.';
export function useProposalReview(
  room: string,
  diagramId: string | undefined,
  connected: boolean,
  official: ModeloDiagrama,
  apply: (d: ModeloDiagrama, previous?: ModeloDiagrama) => void
) {
  const [snapshot, setSnapshot] = useState<ReviewSnapshot | null>(null);
  const [canModerate, setCanModerate] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [inspected, setInspected] = useState<string | null>(null);
  const current = useRef({ room, diagramId, official, apply, connected });
  current.current = { room, diagramId, official, apply, connected };
  const last = useRef<ReviewSnapshot | null>(null);
  const lock = useRef(false);
  const pendingOperation = useRef<{ id: string; body: ReviewCommand } | null>(null);
  const path = () =>
    `/api/v1/colaboracion/salas/${encodeURIComponent(current.current.room)}/propuestas?diagramId=${encodeURIComponent(current.current.diagramId || '')}`;
  const receive = (next: ReviewSnapshot) => {
    if (
      next.diagramId !== current.current.diagramId ||
      (last.current && next.sequence < last.current.sequence)
    )
      return;
    const previous = last.current;
    last.current = next;
    setSnapshot(next);
    if (typeof next.canModerate === 'boolean') setCanModerate(next.canModerate);
    if (next.official && (!previous || next.officialRevision > previous.officialRevision))
      current.current.apply(diagramaDesdeBackend(next.official));
  };
  const refresh = async () => {
    if (current.current.diagramId) receive(await apiFetch<ReviewSnapshot>(path()));
  };
  const receiveRevision = (
    meta: Pick<ReviewSnapshot, 'diagramId' | 'sequence' | 'officialRevision' | 'canUndo' | 'canRedo'>
  ) => {
    if (
      meta.diagramId !== current.current.diagramId ||
      !last.current ||
      meta.sequence < last.current.sequence
    )
      return;
    const next = { ...last.current, ...meta };
    last.current = next;
    setSnapshot(next);
  };
  useEffect(() => {
    last.current = null;
    setSnapshot(null);
    setSelected([]);
    setError('');
    setCanModerate(false);
    pendingOperation.current = null;
  }, [room, diagramId]);
  useEffect(() => {
    if (connected && diagramId) {
      last.current = null;
      void refresh().catch((e: Error) => setError(friendly(e)));
    }
  }, [room, diagramId, connected]);
  const command = async (body: ReviewCommand) => {
    if (lock.current) throw new Error('Espera a que termine la operación actual.');
    if (!current.current.diagramId)
      throw new Error('Abre un diagrama guardado del proyecto para revisar propuestas.');
    if (!current.current.connected)
      throw new Error('Se interrumpió la conexión con la sala. Vuelve a conectar antes de continuar.');
    lock.current = true;
    setBusy(true);
    setError('');
    const before = body.action === 'approve' ? structuredClone(current.current.official) : undefined;
    const operationId = crypto.randomUUID();
    pendingOperation.current = { id: operationId, body };
    try {
      const next = await apiFetch<ReviewSnapshot>(path(), {
        method: 'POST',
        body: JSON.stringify({ ...body, operationId }),
      });
      receive(next);
      if (before) current.current.apply(diagramaDesdeBackend(next.official), before);
      pendingOperation.current = null;
      return next;
    } catch (e) {
      if (e instanceof ApiError && e.status > 0 && e.status < 500) pendingOperation.current = null;
      setError(friendly(e));
      await refresh().catch(() => {});
      throw e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const safe = async (body: ReviewCommand) => {
    try {
      return await command(body);
    } catch {
      return undefined;
    }
  };
  const preview = async (p: Proposal) => {
    try {
      let next = last.current;
      let record = next?.proposals.find((x) => x.id === p.id);
      if (!record) {
        next = await command({
          action: 'register',
          proposalId: p.id,
          proposal: p,
          baseDiagram: p.baseDiagram || current.current.official,
        });
        record = next.proposals.find((x) => x.id === p.id);
      }
      if (record) {
        await command({ action: 'preview', proposalId: p.id, expectedRevision: record.reviewRevision });
        setHidden(false);
        setInspected(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo mostrar la propuesta.');
    }
  };
  const active = snapshot?.proposals.find((p) => p.id === snapshot.activeId);
  useEffect(() => {
    setSelected(
      active
        ? [
            ...active.diagram.classes.map((c) => c.id),
            ...active.diagram.relations.map((r) => r.id),
            ...(active.diagram.deletions || []).map((d) => d.id),
          ]
        : []
    );
    setConfirmingDelete(false);
  }, [active?.id, active?.reviewRevision]);
  const mutate = (action: ReviewCommand['action'], extra: Partial<ReviewCommand> = {}) =>
    active
      ? safe({ action, proposalId: active.id, expectedRevision: active.reviewRevision, ...extra })
      : Promise.resolve(undefined);
  const confirmApprove = () => {
    setConfirmingDelete(false);
    return active
      ? mutate('approve', {
          classIds: active.diagram.classes.filter((c) => selected.includes(c.id)).map((c) => c.id),
          relationIds: active.diagram.relations.filter((r) => selected.includes(r.id)).map((r) => r.id),
          deletionIds: (active.diagram.deletions || [])
            .filter((d) => selected.includes(d.id))
            .map((d) => d.id),
        })
      : Promise.resolve(undefined);
  };
  const approve = () => {
    if (active?.diagram.deletions?.some((d) => selected.includes(d.id))) {
      setConfirmingDelete(true);
      return Promise.resolve(undefined);
    }
    return confirmApprove();
  };
  const retry = async () => {
    const pending = pendingOperation.current;
    if (!pending || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      receive(
        await apiFetch<ReviewSnapshot>(path(), {
          method: 'POST',
          body: JSON.stringify({ ...pending.body, operationId: pending.id }),
        })
      );
      pendingOperation.current = null;
    } catch (e) {
      setError(friendly(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return {
    snapshot,
    active,
    canModerate,
    editorOpen,
    setEditorOpen,
    hidden,
    setHidden,
    busy,
    error,
    setError,
    selected,
    setSelected,
    inspected,
    setInspected,
    receive,
    receiveRevision,
    preview,
    mutate,
    approve,
    retry,
    confirmingDelete,
    setConfirmingDelete,
    confirmApprove,
    hasPendingOperation: !!pendingOperation.current,
    edit: (diagram: DraftDiagram) => mutate('edit', { diagram }),
    reject: (feedback = '') => mutate('reject', { feedback }),
    move: (id: string, position: { x: number; y: number }) =>
      active
        ? mutate('edit', {
            diagram: {
              ...active.diagram,
              classes: active.diagram.classes.map((c) => (c.id === id ? { ...c, position } : c)),
            },
          })
        : Promise.resolve(undefined),
  };
}
export type ProposalReview = ReturnType<typeof useProposalReview>;
