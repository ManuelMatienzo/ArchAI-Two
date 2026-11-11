// Explicit opt-in. Isolated local-test backend only; three real provider calls at most.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
if (!process.argv.includes('--live'))
  throw new Error('Usa --live para autorizar las consultas reales de verificación.');
const base = process.env.ARCHAI_TEST_URL || 'http://127.0.0.1:18027',
  sockets = [],
  seed = Date.now().toString(36);
if (!/^http:\/\/(127\.0\.0\.1|localhost):18027$/.test(base))
  throw new Error('Este recorrido requiere el backend aislado del puerto 18027.');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function api(path, body, token, method = body ? 'POST' : 'GET') {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text(),
    data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${data?.mensaje || data?.message || 'Error'}`);
  return data;
}
async function user(name) {
  const username = `cloud-${seed}-${name}`,
    password = 'ArchAI-Live-Fixture-2026!';
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
  const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws-stomp'),
    messages = [];
  sockets.push(ws);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('STOMP timeout')), 7000);
    ws.onerror = () => reject(new Error('STOMP failed'));
    ws.onopen = () =>
      ws.send(`CONNECT\naccept-version:1.2\nhost:archai\nAuthorization:Bearer ${token}\n\n\0`);
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
async function until(fn, label, timeout = 75000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await fn();
    if (value) return value;
    await pause(250);
  }
  throw new Error('Timeout: ' + label);
}
const results = [];
try {
  const owner = await user('Ana'),
    reader = await user('Luis');
  const project = await api(
    '/api/v1/proyectos',
    { nombre: 'Verificación de motores del equipo' },
    owner.token
  );
  await api(
    `/api/v1/proyectos/${project.id}/miembros`,
    { correoOUsuario: reader.username, rolProyecto: 'LECTOR' },
    owner.token
  );
  const diagram = await api(
      '/api/v1/diagramas',
      {
        title: 'Clínica de prueba',
        proyectoId: project.id,
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
      },
      owner.token
    ),
    diagramId = diagram.id;
  const session = await api('/api/v1/colaboracion/salas/abrir', { diagramId }, owner.token),
    room = session.roomId,
    path = (suffix) => `/api/v1/colaboracion/salas/${room}${suffix}?diagramId=${diagramId}`;
  const [sender, observer] = await Promise.all([client(room, owner.token), client(room, reader.token)]);
  await pause(250);
  const config = await api(path('/configuracion'), null, owner.token);
  assert.equal(config.cloud.testControls, true, 'Controles de prueba en local-test');
  await api(
    path('/mensajes'),
    {
      id: crypto.randomUUID(),
      text: 'Acordamos usar UUID para identificar pacientes. Toda propuesta necesita revisión del equipo.',
    },
    owner.token
  );
  const cases = [
    {
      provider: 'gemini',
      text: '@ArchAI propón solo una clase Cita con id Long como PK y fecha LocalDateTime. Relaciona el Paciente existente con muchas citas (ASSOCIATION_1_N). No repitas Paciente. Explicación breve.',
    },
    {
      provider: 'claude',
      text: '@ArchAI ¿Qué decidió Ana sobre la identificación de los pacientes y la revisión? Responde en dos oraciones, sin cambios UML.',
    },
    {
      provider: 'auto',
      text: '@ArchAI propón solo una clase Cita con id Long y fecha LocalDateTime. Relaciona el Paciente existente con muchas citas (ASSOCIATION_1_N). No repitas Paciente. Explicación breve.',
      simulateGeminiFailure: true,
    },
  ];
  if (process.argv.includes('--local'))
    cases.push({
      provider: 'local',
      text: '@ArchAI explica en una oración qué es una clase UML. No propongas cambios al diagrama.',
    });
  for (const entry of cases.filter(
    (c) => !process.argv.some((a) => a.startsWith('--mode=')) || process.argv.includes('--mode=' + c.provider)
  )) {
    try {
      if (entry.provider === 'local') {
        const available = await api(path('/modelos-locales'), null, owner.token);
        assert.ok(available.includes('qwen3.5:4b'), 'qwen3.5:4b disponible');
        await api(
          path('/configuracion'),
          { mode: 'local', model: 'qwen3.5:4b', observing: false },
          owner.token,
          'PUT'
        );
      } else await api(path('/configuracion'), { mode: 'cloud', observing: false }, owner.token, 'PUT');
      const request = {
          id: crypto.randomUUID(),
          text: entry.text,
          ...(entry.provider !== 'local'
            ? {
                options: {
                  provider: entry.provider,
                  ...(entry.simulateGeminiFailure && !process.argv.includes('--natural')
                    ? { simulateGeminiFailure: true }
                    : {}),
                },
              }
            : {}),
        },
        started = Date.now();
      await api(path('/mensajes'), request, owner.token);
      await api(path('/mensajes'), request, owner.token);
      const response = await until(
        async () => {
          const list = await api(path('/mensajes'), null, owner.token);
          return list.find((m) => m.replyTo === request.id && ['sent', 'failed'].includes(m.status));
        },
        'provider response',
        entry.provider === 'local' ? 110000 : 75000
      );
      assert.equal(response.status, 'sent', response.text);
      assert.ok(response.text.length > 5);
      if (entry.provider === 'auto' && process.argv.includes('--natural'))
        assert.ok(['Gemini', 'Claude'].includes(response.provider));
      else
        assert.equal(
          response.provider,
          entry.provider === 'gemini' ? 'Gemini' : entry.provider === 'local' ? 'Ollama' : 'Claude'
        );
      if (entry.provider === 'gemini' || entry.provider === 'auto') {
        assert.ok(response.proposalId);
        assert.ok(response.proposal.diagram.classes.some((c) => c.name === 'Cita'));
        assert.ok(response.proposal.diagram.relations.some((r) => r.sourceClassId === 'paciente'));
      }
      await until(
        () =>
          observer.messages.find(
            (e) => e.tipo === 'chat_message' && e.payload.id === response.id && e.payload.status === 'sent'
          ),
        'shared reply',
        5000
      );
      assert.equal(
        observer.messages.filter(
          (e) => e.tipo === 'chat_message' && e.payload.id === response.id && e.payload.status === 'sent'
        ).length,
        1
      );
      results.push({
        mode: entry.provider,
        provider: response.provider,
        model: response.model,
        elapsedMs: Date.now() - started,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        success: true,
      });
    } catch (error) {
      results.push({ mode: entry.provider, success: false, error: error.message });
    }
  }
  await api(path('/configuracion'), { mode: 'cloud', observing: false }, owner.token, 'PUT');
  const state = await api(path('/sesion'), null, owner.token);
  assert.equal(state.review.official.classes.length, 1, 'El lienzo no cambia sin aprobación');
  await until(
    async () => {
      const state = await api(path('/sesion'), null, owner.token);
      return state.persistence.connected && state.persistence.pending === 0;
    },
    'NoSQL synchronization',
    20000
  );
  await mkdir('node_modules/.cache', { recursive: true });
  await writeFile(
    'node_modules/.cache/cloud-session.json',
    JSON.stringify({
      owner,
      reader,
      room,
      diagramId,
      projectId: project.id,
      results,
      url: `http://127.0.0.1:5175/studio/${diagramId}?diagramId=${diagramId}`,
    })
  );
  console.log(
    JSON.stringify({
      results,
      diagramUnchanged: true,
      noDuplicateReplies: true,
      realNoSqlSynchronized: true,
      room,
      diagramId,
    })
  );
  if (results.some((r) => !r.success)) process.exitCode = 1;
} finally {
  sockets.forEach((ws) => ws.close());
}
