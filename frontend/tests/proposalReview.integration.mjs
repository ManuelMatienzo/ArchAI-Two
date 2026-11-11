// Run only against the isolated local-test backend. Creates disposable accounts/projects in H2.
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
const base = process.env.ARCHAI_TEST_URL || 'http://127.0.0.1:18026',
  clients = [];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const seed = Date.now().toString(36);
async function api(path, body, token, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${data.mensaje || data.message}`);
  return data;
}
async function user(suffix) {
  const username = `review-${seed}-${suffix}`,
    password = 'ArchAI-Test-2026!';
  await api('/api/v1/auth/registro', {
    nombre: `Equipo ${suffix}`,
    nombreUsuario: username,
    correo: `${username}@test.invalid`,
    contrasena: password,
    rol: 'Arquitecto de Software',
  });
  return {
    ...(await api('/api/v1/auth/login', { usuario: username, contrasena: password })),
    username,
    password,
  };
}
async function client(room, token) {
  const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws-stomp'),
    messages = [],
    presence = [];
  clients.push(ws);
  await new Promise((resolve, reject) => {
    const tid = setTimeout(() => reject(new Error('STOMP timeout')), 8000);
    ws.onopen = () =>
      ws.send(`CONNECT\naccept-version:1.2\nhost:archai\nAuthorization:Bearer ${token}\n\n\0`);
    ws.onerror = () => reject(new Error('WebSocket error'));
    ws.onmessage = ({ data }) => {
      const frame = String(data);
      if (frame.startsWith('CONNECTED')) {
        ws.send(`SUBSCRIBE\nid:s\ndestination:/topic/collab/${room}\n\n\0`);
        ws.send(`SUBSCRIBE\nid:p\ndestination:/topic/room/${room}/presence\n\n\0`);
        clearTimeout(tid);
        resolve();
      } else if (frame.startsWith('MESSAGE')) {
        const target = frame.split('\n\n')[0].includes('/presence') ? presence : messages;
        target.push(JSON.parse(frame.slice(frame.indexOf('\n\n') + 2).replace(/\0.*$/s, '')));
      } else if (frame.startsWith('ERROR')) reject(new Error('STOMP rejected'));
    };
  });
  return { ws, messages, presence };
}
try {
  const owner = await user('editor'),
    reader = await user('lector'),
    colleague = await user('colaborador');
  const project = await api(
    '/api/v1/proyectos',
    { nombre: 'Clínica colaborativa', propietarioId: owner.user.id },
    owner.token
  );
  await api(
    `/api/v1/proyectos/${project.id}/miembros`,
    { correoOUsuario: reader.username, rolProyecto: 'LECTOR' },
    owner.token
  );
  const room = `ARC-REVIEW-${seed}`.toUpperCase();
  const session = await api(
    '/api/v1/colaboracion/salas',
    { nombreSala: 'Equipo de diseño', anfitrion: owner.user, pin: room },
    owner.token
  );
  const official = {
    title: 'Clínica colaborativa',
    classes: [
      {
        id: 'paciente',
        name: 'Paciente',
        stereotype: 'Entity',
        attributes: [{ id: 'nombre', name: 'nombre', type: 'String', visibility: '+' }],
        methods: [],
        position: { x: 140, y: 150 },
      },
    ],
    relations: [],
    proyectoId: project.id,
    creadorId: owner.user.id,
  };
  const saved = await api('/api/v1/diagramas', official, owner.token),
    diagramId = saved.id;
  await api('/api/v1/colaboracion/salas/abrir', { diagramId, roomId: room }, owner.token);
  await api(`/api/v1/colaboracion/salas/${room}/diagrama`, official, owner.token, 'PUT');
  const path = `/api/v1/colaboracion/salas/${room}/propuestas?diagramId=${diagramId}`;
  await api(
    '/api/v1/colaboracion/salas',
    { nombreSala: 'Sala aislada', anfitrion: reader.user, pin: `ARC-OTHER-${seed}` },
    reader.token
  );
  const [a, b, other] = await Promise.all([
    client(room, owner.token),
    client(room, reader.token),
    client(`ARC-OTHER-${seed}`, reader.token),
  ]);
  await pause(200);
  // Merge regression: joining projects/rooms from main must coexist with dev's proposal permissions and broadcasts.
  const joined = await api(
    '/api/v1/proyectos/unirse',
    { codigoAcceso: project.codigoAcceso.toLowerCase(), usuarioId: colleague.user.id },
    colleague.token
  );
  assert.equal(joined.id, project.id);
  const ownProjects = await api(`/api/v1/proyectos?usuarioId=${colleague.user.id}`, null, colleague.token);
  assert.deepEqual(
    ownProjects.map((p) => p.id),
    [project.id]
  );
  const realDiagrams = await api(`/api/v1/diagramas?proyectoId=${project.id}`, null, colleague.token);
  assert.equal(realDiagrams[0].id, diagramId);
  assert.equal(realDiagrams[0].classes[0].name, 'Paciente');
  await api('/api/v1/colaboracion/salas/unirse', { pin: room, usuario: colleague.user }, colleague.token);
  await pause(300);
  assert.ok(a.presence.at(-1).some((p) => p.id === colleague.user.id));
  assert.ok(b.messages.some((m) => m.tipo === 'join' && m.emisorId === colleague.user.id));
  assert.ok(other.presence.every((list) => !list.some((p) => p.id === colleague.user.id)));
  const visibleRooms = await api(
    `/api/v1/colaboracion/salas?usuarioId=${colleague.user.id}`,
    null,
    colleague.token
  );
  assert.deepEqual(visibleRooms, [room]);
  const requestedId = `request-${seed}`;
  a.ws.send(
    `SEND\ndestination:/app/collab/${room}\ncontent-type:application/json\n\n${JSON.stringify({ tipo: 'ia_request', emisorId: owner.user.id, emisorNombre: owner.user.name, payload: { id: requestedId, prompt: 'Sugiere recetas', inferenceMode: 'local', diagramId } })}\0`
  );
  await pause(300);
  assert.equal(a.messages.filter((m) => m.tipo === 'ia_request' && m.payload.id === requestedId).length, 1);
  assert.equal(b.messages.filter((m) => m.tipo === 'ia_request' && m.payload.id === requestedId).length, 1);
  assert.equal(other.messages.filter((m) => m.salaId === room).length, 0);
  const initial = await api(path, null, owner.token);
  const draft = {
    classes: [
      {
        id: 'draft-receta',
        name: 'Receta',
        stereotype: 'Entity',
        attributes: [{ id: 'med', name: 'medicamento', type: 'String', visibility: '+' }],
        methods: [],
      },
      {
        id: 'draft-dosis',
        name: 'Dosis',
        stereotype: 'Entity',
        attributes: [{ id: 'cant', name: 'cantidad', type: 'Integer', visibility: '+' }],
        methods: [],
      },
    ],
    relations: [
      {
        id: 'draft-rel',
        sourceClassId: 'paciente',
        targetClassId: 'draft-receta',
        type: 'ASSOCIATION_1_N',
        sourceMultiplicity: '1',
        targetMultiplicity: '0..*',
      },
    ],
  };
  const proposal = {
    id: `proposal-${seed}`,
    status: 'ready',
    prompt: 'Sugiere recetas y dosis',
    author: 'Equipo editor',
    automatic: false,
    requestedAt: Date.now(),
    explanation:
      'Separar recetas y dosis permite registrar indicaciones sin recargar la responsabilidad de Paciente.',
    provider: 'Ollama',
    model: 'fixture-sintética',
    diagram: draft,
  };
  const command = (action, expectedRevision = 0, extra = {}) =>
    api(
      path,
      { action, expectedRevision, proposalId: proposal.id, operationId: crypto.randomUUID(), ...extra },
      owner.token
    );
  await command('register', 0, { proposal, baseDiagram: initial.official });
  let state = await command('preview');
  await pause(350);
  assert.equal(a.messages.filter((m) => m.tipo === 'ia_draft_state').length, 2);
  assert.equal(b.messages.filter((m) => m.tipo === 'ia_draft_state').length, 2);
  assert.equal(other.messages.filter((m) => m.salaId === room).length, 0);
  assert.equal(state.official.classes.length, 1);
  assert.equal((await api(path, null, reader.token)).canModerate, false);
  const denied = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${reader.token}` },
    body: JSON.stringify({
      action: 'reject',
      expectedRevision: 1,
      proposalId: proposal.id,
      operationId: crypto.randomUUID(),
    }),
  });
  assert.equal(denied.status, 403);
  state = await command('approve', 1, { classIds: ['draft-receta'], relationIds: ['draft-rel'] });
  assert.equal(state.official.classes.length, 2);
  assert.equal(state.proposals[0].moderationStatus, 'partial');
  assert.equal(state.proposals[0].diagram.classes[0].name, 'Dosis');
  assert.equal((await api(`/api/v1/diagramas/${diagramId}/versiones`, null, owner.token)).length, 1);
  const accepted = a.messages.filter((m) => m.tipo === 'diagrama');
  await pause(250);
  assert.ok(b.messages.some((m) => m.tipo === 'diagrama'));
  assert.equal(other.messages.filter((m) => m.salaId === room).length, 0);
  // The combined REST controller must preserve presence updates and the official-diagram permission fence.
  const deniedWrite = await fetch(`${base}/api/v1/colaboracion/salas/${room}/diagrama`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${reader.token}` },
    body: JSON.stringify(state.official),
  });
  assert.equal(deniedWrite.status, 403);
  await api(`/api/v1/colaboracion/salas/${room}/salir`, { usuarioId: colleague.user.id }, colleague.token);
  await pause(300);
  assert.ok(!a.presence.at(-1).some((p) => p.id === colleague.user.id));
  assert.ok(b.messages.some((m) => m.tipo === 'leave' && m.emisorId === colleague.user.id));
  assert.ok(other.presence.every((list) => !list.some((p) => p.id === colleague.user.id)));
  // Leave a fresh pending proposal so browser/manual review can inspect a complete example.
  const followup = {
    ...proposal,
    id: `visual-${seed}`,
    diagram: { classes: [draft.classes[1]], relations: [] },
  };
  await api(
    path,
    {
      action: 'register',
      operationId: crypto.randomUUID(),
      proposalId: followup.id,
      proposal: followup,
      baseDiagram: state.official,
    },
    owner.token
  );
  await api(
    path,
    { action: 'preview', operationId: crypto.randomUUID(), proposalId: followup.id, expectedRevision: 0 },
    owner.token
  );
  await mkdir('node_modules/.cache', { recursive: true });
  await writeFile(
    'node_modules/.cache/review-session.json',
    JSON.stringify({
      owner,
      reader,
      session,
      room,
      diagramId,
      projectId: project.id,
      url: `http://localhost:5173/studio/${diagramId}?diagramId=${diagramId}&roomId=${room}&title=Clínica+colaborativa`,
    })
  );
  console.log(
    JSON.stringify({
      success: true,
      checks: [
        'ingreso por código y proyectos de la cuenta',
        'diagramas reales del proyecto',
        'presencia al entrar/salir',
        'solicitud compartida una vez y aislamiento',
        'lector 403 en propuestas y diagrama',
        'modelo intacto antes de aprobar',
        'aprobación parcial con pendientes',
        'versión persistida',
        'notificación del diagrama',
      ],
      room,
      diagramId,
      uiUsername: owner.username,
      officialEvents: accepted.length,
    })
  );
} finally {
  clients.forEach((c) => c.close());
}
