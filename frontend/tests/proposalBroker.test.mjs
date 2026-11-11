// Run after teamSession.integration.mjs; uses its disposable fixture and never calls AI.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const fixture = JSON.parse(await readFile('node_modules/.cache/team-session.json', 'utf8')),
  base = process.env.ARCHAI_TEST_URL || 'http://127.0.0.1:18026',
  clients = [];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function client(room, token) {
  const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws-stomp'),
    messages = [];
  clients.push(ws);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout STOMP')), 5000);
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error('STOMP rejected'));
    };
    ws.onopen = () =>
      ws.send(
        `CONNECT\naccept-version:1.2\nhost:archai\n${token ? `Authorization:Bearer ${token}\n` : ''}\n\0`
      );
    ws.onmessage = ({ data }) => {
      for (const frame of String(data).split('\0')) {
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
try {
  await assert.rejects(client(fixture.room), /STOMP/);
  const [a, b] = await Promise.all([
    client(fixture.room, fixture.owner.token),
    client(fixture.room, fixture.editor.token),
  ]);
  await pause(250);
  const id = crypto.randomUUID(),
    response = await fetch(
      `${base}/api/v1/colaboracion/salas/${fixture.room}/mensajes?diagramId=${fixture.diagramId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fixture.owner.token}` },
        body: JSON.stringify({ id, text: 'Confirmación del transporte compartido.' }),
      }
    );
  assert.equal(response.status, 200);
  await pause(500);
  for (const client of [a, b])
    assert.equal(client.messages.filter((m) => m.tipo === 'chat_message' && m.payload.id === id).length, 1);
  console.log('STOMP: autenticación obligatoria y una sola entrega a ambos participantes.');
} finally {
  clients.forEach((ws) => ws.close());
}
