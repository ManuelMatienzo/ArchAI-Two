// Isolated backend + fakeModels.server.mjs only. Does not spend provider credits.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const base = process.env.ARCHAI_TEST_URL || 'http://127.0.0.1:18026',
  fixture = 'http://127.0.0.1:18029',
  clients = [];
const pause = (ms) => new Promise((r) => setTimeout(r, ms)),
  seed = Date.now().toString(36);
async function api(path, body, token, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Non-JSON HTTP ${response.status}`);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${data?.mensaje || data?.message}`);
  return data;
}
async function user(name) {
  const username = `team-${seed}-${name}`,
    password = 'ArchAI-Fixture-2026!';
  await api('/api/v1/auth/registro', {
    nombre: name,
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
  const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws-stomp');
  clients.push(ws);
  const messages = [];
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('STOMP timeout')), 7000);
    ws.onopen = () =>
      ws.send(`CONNECT\naccept-version:1.2\nhost:archai\nAuthorization:Bearer ${token}\n\n\0`);
    ws.onerror = () => reject(new Error('STOMP failed'));
    ws.onmessage = ({ data }) => {
      for (const raw of String(data).split('\0')) {
        const frame = raw.trimStart();
        if (frame.startsWith('CONNECTED')) {
          ws.send(`SUBSCRIBE\nid:s\ndestination:/topic/collab/${room}\n\n\0`);
          clearTimeout(timer);
          resolve();
        } else if (frame.startsWith('MESSAGE'))
          messages.push(JSON.parse(frame.slice(frame.indexOf('\n\n') + 2)));
        else if (frame.startsWith('ERROR')) {
          clearTimeout(timer);
          reject(new Error('STOMP rejected'));
        }
      }
    };
  });
  return { ws, messages };
}
const path = (room, id, suffix) => `/api/v1/colaboracion/salas/${room}${suffix}?diagramId=${id}`;
const stats = () => fetch(fixture + '/stats').then((r) => r.json());
const control = (body) =>
  fetch(fixture + '/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
async function until(fn, label, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await fn();
    if (value) return value;
    await pause(150);
  }
  throw new Error('Timeout: ' + label);
}
async function reply(room, id, token, request) {
  return until(async () => {
    const messages = await api(path(room, id, '/mensajes'), null, token);
    return messages.find(
      (m) => m.replyTo === request && ['sent', 'failed', 'cancelled', 'interrupted'].includes(m.status)
    );
  }, 'AI reply');
}
try {
  if (process.argv.includes('--presence')) {
    const saved = JSON.parse(await readFile('node_modules/.cache/team-session.json', 'utf8')),
      before = await stats();
    const current = () => api(path(saved.room, saved.diagramId, '/sesion'), null, saved.owner.token);
    await until(async () => !(await current()).settings.observing, 'inactive observation off');
    const first = await client(saved.room, saved.owner.token),
      second = await client(saved.room, saved.owner.token);
    await until(
      async () => (await current()).participants.filter((p) => p.id === saved.owner.user.id).length === 1,
      'same user presence'
    );
    first.ws.close();
    await pause(600);
    assert.equal(
      (await current()).participants.filter((p) => p.id === saved.owner.user.id).length,
      1,
      'Otra pestaña sigue conectada'
    );
    await api(
      path(saved.room, saved.diagramId, '/configuracion'),
      { mode: 'cloud', observing: true },
      saved.owner.token,
      'PUT'
    );
    second.ws.close();
    await until(async () => {
      const state = await current();
      return !state.settings.observing && state.participants.length === 0;
    }, 'last disconnect pauses observation');
    const after = await stats();
    assert.equal(after.gemini, before.gemini);
    assert.equal(after.claude, before.claude);
    console.log(
      'PASS presencia: dos pestañas, identidad única, cierre parcial y pausa de observación al salir el último participante, sin consultas adicionales.'
    );
  } else if (process.argv.includes('--prepare-restart')) {
    const saved = JSON.parse(await readFile('node_modules/.cache/team-session.json', 'utf8'));
    await control({ delay: 60000, failGemini: 0 });
    const request = { id: crypto.randomUUID(), text: '@ArchAI explica cómo continuar esta sesión mañana' };
    await api(path(saved.room, saved.diagramId, '/mensajes'), request, saved.editor.token);
    await until(async () => {
      const list = await api(path(saved.room, saved.diagramId, '/mensajes'), null, saved.owner.token);
      return list.some((m) => m.replyTo === request.id && m.status === 'thinking');
    }, 'pending request');
    await until(
      async () => {
        const s = await api(path(saved.room, saved.diagramId, '/sesion'), null, saved.owner.token);
        return s.persistence.connected && s.persistence.pending === 0;
      },
      'durable pending request',
      15000
    );
    saved.interruptedReply = 'ai-' + request.id;
    await writeFile('node_modules/.cache/team-session.json', JSON.stringify(saved));
    console.log('Pending inference persisted; ready to stop isolated backend.');
  } else if (process.argv.includes('--resume')) {
    const saved = JSON.parse(await readFile('node_modules/.cache/team-session.json', 'utf8'));
    const before = await stats(),
      session = await api(path(saved.room, saved.diagramId, '/sesion'), null, saved.owner.token);
    assert.equal(session.settings.observing, false);
    assert.ok(session.messages.some((m) => m.text.includes('identificadores UUID')));
    assert.equal(session.review.official.classes.length, 2);
    assert.equal(session.review.proposals.find((p) => p.id === saved.proposalId).moderationStatus, 'partial');
    assert.ok(session.review.activeId);
    assert.equal(session.messages.find((m) => m.id === saved.interruptedReply).status, 'interrupted');
    await pause(600);
    const after = await stats();
    assert.equal(after.gemini, before.gemini);
    assert.equal(after.claude, before.claude);
    assert.ok((await api(`/api/v1/colaboracion/salas/${saved.room}`, null, saved.owner.token)).diagramId);
    console.log(
      'PASS resume: MongoDB recupera chat, contexto, propuesta parcial, PIN e historial; no reejecuta consultas pagadas y observación queda apagada.'
    );
  } else {
    await control({ delay: 0, failGemini: 0, invalidGemini: false });
    const owner = await user('Ana'),
      editor = await user('Luis'),
      reader = await user('Carla'),
      stranger = await user('Dario');
    const project = await api(
      '/api/v1/proyectos',
      { nombre: 'Clínica de integración', propietarioId: stranger.user.id },
      owner.token
    );
    assert.equal(project.propietarioId, owner.user.id, 'El servidor asigna identidad real');
    for (const [u, role] of [
      [editor, 'EDITOR'],
      [reader, 'LECTOR'],
    ])
      await api(
        `/api/v1/proyectos/${project.id}/miembros`,
        { correoOUsuario: u.username, rolProyecto: role },
        owner.token
      );
    const model = {
      title: 'Clínica compartida',
      classes: [
        {
          id: 'paciente',
          name: 'Paciente',
          position: { x: 100, y: 100 },
          attributes: [{ id: 'id', name: 'id', type: 'Long', visibility: '-', isPrimaryKey: true }],
          methods: [],
        },
      ],
      relations: [],
      proyectoId: project.id,
      creadorId: owner.user.id,
    };
    const diagram = await api('/api/v1/diagramas', model, owner.token),
      diagramId = diagram.id;
    const session = await api('/api/v1/colaboracion/salas/abrir', { diagramId }, owner.token),
      room = session.roomId;
    assert.equal((await api('/api/v1/colaboracion/salas/abrir', { diagramId }, editor.token)).roomId, room);
    const otherProject = await api('/api/v1/proyectos', { nombre: 'Proyecto aislado' }, stranger.token),
      otherDiagram = await api(
        '/api/v1/diagramas',
        { ...model, proyectoId: otherProject.id },
        stranger.token
      ),
      otherRoom = (
        await api('/api/v1/colaboracion/salas/abrir', { diagramId: otherDiagram.id }, stranger.token)
      ).roomId;
    const [a, b, other] = await Promise.all([
      client(room, owner.token),
      client(room, editor.token),
      client(otherRoom, stranger.token),
    ]);
    await pause(250);
    let response = await fetch(base + path(room, diagramId, '/sesion'), {
      headers: { Authorization: `Bearer ${stranger.token}` },
    });
    assert.equal(response.status, 403);
    response = await fetch(base + `/api/v1/diagramas/${diagramId}`, {
      headers: { Authorization: `Bearer ${stranger.token}` },
    });
    assert.equal(response.status, 403);
    response = await fetch(base + '/api/v1/diagramas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${reader.token}` },
      body: JSON.stringify({ ...model, id: diagramId }),
    });
    assert.equal(response.status, 403);
    const initialCalls = await stats(),
      human = {
        id: crypto.randomUUID(),
        text: 'Acordamos usar identificadores UUID y mantener Receta separada de Paciente.',
        authorId: stranger.user.id,
      };
    const acknowledged = await api(path(room, diagramId, '/mensajes'), human, owner.token);
    await api(path(room, diagramId, '/mensajes'), human, owner.token);
    assert.equal(acknowledged.authorId, owner.user.id);
    assert.equal((await stats()).gemini, initialCalls.gemini);
    await pause(250);
    assert.equal(a.messages.filter((m) => m.tipo === 'chat_message' && m.payload.id === human.id).length, 1);
    assert.equal(b.messages.filter((m) => m.tipo === 'chat_message' && m.payload.id === human.id).length, 1);
    assert.equal(other.messages.filter((m) => m.salaId === room).length, 0);
    const question = { id: crypto.randomUUID(), text: '@ArchAI ¿Qué decidimos sobre los identificadores?' };
    await api(path(room, diagramId, '/mensajes'), question, reader.token);
    await api(path(room, diagramId, '/mensajes'), question, reader.token);
    assert.equal((await reply(room, diagramId, owner.token, question.id)).provider, 'Gemini');
    const context = (await stats()).contexts.at(-1).system;
    assert.ok(context.includes('identificadores UUID'));
    assert.ok(context.includes('Ana'));
    assert.ok(context.includes('Paciente'));
    const request = { id: crypto.randomUUID(), text: '@ArchAI propón Receta y Dosis' };
    await api(path(room, diagramId, '/mensajes'), request, editor.token);
    const proposalReply = await reply(room, diagramId, owner.token, request.id);
    assert.ok(proposalReply.proposalId);
    assert.equal((await stats()).gemini, initialCalls.gemini + 2);
    let state = await api(path(room, diagramId, '/propuestas'), null, owner.token);
    assert.equal(state.official.classes.length, 1);
    let proposal = state.proposals.find((p) => p.id === proposalReply.proposalId);
    const command = (action, extra = {}) =>
      api(
        path(room, diagramId, '/propuestas'),
        {
          action,
          proposalId: proposal.id,
          operationId: crypto.randomUUID(),
          expectedRevision: proposal.reviewRevision,
          ...extra,
        },
        owner.token
      );
    state = await command('preview');
    proposal = state.proposals.find((p) => p.id === proposal.id);
    response = await fetch(base + path(room, diagramId, '/propuestas'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${reader.token}` },
      body: JSON.stringify({
        action: 'approve',
        proposalId: proposal.id,
        operationId: crypto.randomUUID(),
        expectedRevision: proposal.reviewRevision,
      }),
    });
    assert.equal(response.status, 403);
    const receta = proposal.diagram.classes.find((c) => c.name === 'Receta');
    state = await command('approve', {
      classIds: [receta.id],
      relationIds: proposal.diagram.relations.map((r) => r.id),
    });
    proposal = state.proposals.find((p) => p.id === proposal.id);
    assert.equal(state.official.classes.length, 2);
    assert.equal(proposal.moderationStatus, 'partial');
    assert.equal(proposal.diagram.classes[0].name, 'Dosis');
    const device = await api(
      '/api/v1/notificaciones/dispositivos',
      { token: 'ExpoPushToken[fixture_android_device_2026]' },
      owner.token,
      'PUT'
    );
    response = await fetch(base + `/api/v1/notificaciones/dispositivos/${device.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${reader.token}` },
    });
    assert.equal(response.status, 403);
    await api(
      path(room, diagramId, '/actividad/generacion'),
      { kind: 'backend_zip', operationId: crypto.randomUUID() },
      owner.token
    );
    await until(
      async () =>
        (await api('/api/v1/notificaciones', null, owner.token)).some((n) => n.type === 'artifact_generated'),
      'artifact activity'
    );
    await api(path(room, diagramId, '/sesion/guardar'), {}, owner.token);
    const changes = structuredClone(state.official);
    changes.classes.push({
      id: 'auditoria',
      name: 'Auditoria',
      attributes: [],
      methods: [],
      position: { x: 800, y: 50 },
    });
    await api(
      path(room, diagramId, '/configuracion'),
      { mode: 'cloud', observing: true },
      owner.token,
      'PUT'
    );
    await control({ failGemini: 503 });
    const beforeAuto = await stats();
    await api(`/api/v1/colaboracion/salas/${room}/diagrama`, changes, owner.token, 'PUT');
    await until(
      async () => {
        const all = await api(path(room, diagramId, '/mensajes'), null, owner.token);
        return all.find((m) => m.automatic && m.status === 'failed');
      },
      'automatic observation',
      24000
    );
    const afterAuto = await stats();
    assert.equal(afterAuto.claude, beforeAuto.claude, 'Observación no usa Claude');
    assert.equal(afterAuto.gemini, beforeAuto.gemini + 1);
    await api(path(room, diagramId, '/configuracion'), { observing: false }, owner.token, 'PUT');
    await control({ failGemini: 0 });
    state = await api(path(room, diagramId, '/propuestas'), null, owner.token);
    state = await api(
      path(room, diagramId, '/sesion/restaurar'),
      { action: 'undo', expectedRevision: state.officialRevision, operationId: crypto.randomUUID() },
      owner.token
    );
    assert.equal(state.official.classes.length, 2);
    await api(
      path(room, diagramId, '/configuracion'),
      { mode: 'local', observing: false },
      owner.token,
      'PUT'
    );
    let calls = await stats();
    const localRequest = { id: crypto.randomUUID(), text: '@ArchAI explica nuestro modelo' };
    await api(path(room, diagramId, '/mensajes'), localRequest, editor.token);
    assert.equal((await reply(room, diagramId, owner.token, localRequest.id)).provider, 'Ollama');
    assert.equal((await stats()).gemini, calls.gemini);
    assert.equal((await stats()).claude, calls.claude);
    await api(
      path(room, diagramId, '/configuracion'),
      { mode: 'cloud', observing: false },
      owner.token,
      'PUT'
    );
    await control({ failGemini: 503 });
    const fallbackRequest = { id: crypto.randomUUID(), text: '@ArchAI explica la decisión del equipo' };
    await api(path(room, diagramId, '/mensajes'), fallbackRequest, owner.token);
    assert.equal((await reply(room, diagramId, owner.token, fallbackRequest.id)).provider, 'Claude');
    await control({ failGemini: 0 });
    await until(async () => {
      const notes = await api('/api/v1/notificaciones', null, owner.token);
      return notes.find((n) => n.type === 'session_restored');
    }, 'activity notification');
    await until(async () => (await stats()).push > 0, 'native push dispatch');
    assert.equal(
      (await api(path(room, diagramId, '/configuracion'), null, reader.token)).canConfigure,
      false
    );
    assert.ok(
      a.messages.filter((m) => m.tipo === 'chat_settings').every((m) => m.payload.canConfigure === undefined),
      'No distribuye permisos del anfitrión a lectores'
    );
    await control({ delay: 500 });
    const detached = {
      id: crypto.randomUUID(),
      text: '@ArchAI explica nuestra decisión aunque cierre mi pestaña',
    };
    await api(path(room, diagramId, '/mensajes'), detached, editor.token);
    b.ws.close();
    assert.equal(
      (await reply(room, diagramId, owner.token, detached.id)).status,
      'sent',
      'La inferencia continúa sin la pestaña solicitante'
    );
    await api(
      path(room, diagramId, '/configuracion'),
      { mode: 'cloud', observing: true },
      owner.token,
      'PUT'
    );
    await control({ delay: 20000 });
    const interruptedRequest = { id: crypto.randomUUID(), text: '@ArchAI explica cómo continuar mañana' };
    await api(path(room, diagramId, '/mensajes'), interruptedRequest, editor.token);
    await until(async () => {
      const all = await api(path(room, diagramId, '/mensajes'), null, owner.token);
      return all.find((m) => m.replyTo === interruptedRequest.id && m.status === 'thinking');
    }, 'inference started');
    await until(
      async () => {
        const s = await api(path(room, diagramId, '/sesion'), null, owner.token);
        return s.persistence.connected && s.persistence.pending === 0;
      },
      'MongoDB durable sync',
      15000
    );
    const finalState = await api(path(room, diagramId, '/propuestas'), null, owner.token);
    assert.equal(finalState.official.classes.length, 2);
    assert.equal(other.messages.filter((m) => m.salaId === room).length, 0);
    await mkdir('node_modules/.cache', { recursive: true });
    await writeFile(
      'node_modules/.cache/team-session.json',
      JSON.stringify({
        owner,
        editor,
        reader,
        stranger,
        room,
        diagramId,
        projectId: project.id,
        proposalId: proposal.id,
        interruptedReply: 'ai-' + interruptedRequest.id,
        session,
        url: `http://localhost:5174/studio/${diagramId}?diagramId=${diagramId}`,
      })
    );
    console.log(
      'PASS integration: identidad, permisos REST/STOMP, chat compartido sin duplicados, contexto, propuesta parcial, undo, local/nube, respaldo Claude, observación sin Claude, actividad, push simulado y sincronización MongoDB real.'
    );
    console.log(
      JSON.stringify({
        room,
        diagramId,
        uiUser: owner.username,
        fixture: 'node_modules/.cache/team-session.json',
      })
    );
  }
} finally {
  clients.forEach((c) => c.close());
}
