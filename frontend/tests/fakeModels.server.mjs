// Local-only inference/push fixture. Never forwards requests to an external service.
import http from 'node:http';
const state = {
  gemini: 0,
  claude: 0,
  ollama: 0,
  push: 0,
  failGemini: 0,
  invalidGemini: false,
  delay: 0,
  contexts: [],
};
function content(prompt, system) {
  const answer = {
    explanation:
      'Respuesta de prueba del equipo. Se conserva la decisión de Ana de usar identificadores UUID.',
    clarification: '',
    skip: false,
    classes: [],
    relations: [],
    deletions: [],
  };
  let graph = { classes: [], relations: [] };
  try {
    graph = JSON.parse(system.split('Contexto canónico: ')[1]).diagram;
  } catch {}
  if (/elimin[ae]|borr[ae]/i.test(prompt)) {
    const target = graph.classes.find((c) => c.name === 'Receta') || graph.classes[0];
    if (target) {
      answer.explanation = `Se propone eliminar ${target.name} y revisar sus relaciones afectadas.`;
      answer.deletions = [{ kind: 'class', targetId: target.id, classId: '' }];
    }
  } else if (
    /prop[oó]n|modela|crea|agrega|receta/i.test(prompt) &&
    !/decid|acord|explica|qu[eé] /i.test(prompt)
  ) {
    answer.explanation =
      'Propongo Receta y Dosis para separar las indicaciones del paciente. El equipo debe aprobar los cambios.';
    answer.classes = [
      {
        name: 'Receta',
        attributes: [
          { name: 'id', type: 'Long', isPrimaryKey: true, visibility: '-' },
          { name: 'medicamento', type: 'String', visibility: '-' },
        ],
        methods: [],
      },
      { name: 'Dosis', attributes: [{ name: 'cantidad', type: 'Integer', visibility: '-' }], methods: [] },
    ];
    answer.relations = [
      {
        sourceName: 'Paciente',
        targetName: 'Receta',
        type: 'ASSOCIATION_1_N',
        sourceMultiplicity: '1',
        targetMultiplicity: '0..*',
      },
    ];
  }
  return answer;
}
const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  let body = {};
  try {
    body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
  } catch {}
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/control' && req.method === 'POST') {
    Object.assign(state, body);
    res.end('{}');
    return;
  }
  if (req.url === '/stats') {
    res.end(JSON.stringify(state));
    return;
  }
  if (req.url === '/api/tags') {
    res.end(JSON.stringify({ models: [{ name: 'qwen3.5:4b' }] }));
    return;
  }
  if (req.url === '/push') {
    state.push++;
    res.end(JSON.stringify({ data: { status: 'ok', id: crypto.randomUUID() } }));
    return;
  }
  const provider = req.url === '/gemini' ? 'gemini' : req.url === '/claude' ? 'claude' : 'ollama';
  state[provider]++;
  if (provider === 'gemini' && state.failGemini) {
    res.statusCode = state.failGemini;
    res.end('{}');
    return;
  }
  if (state.delay) await new Promise((r) => setTimeout(r, state.delay));
  const system =
    provider === 'gemini'
      ? body.systemInstruction?.parts?.[0]?.text
      : provider === 'claude'
        ? body.system
        : body.messages?.[0]?.content;
  const prompt =
    provider === 'gemini'
      ? body.contents?.[0]?.parts?.[0]?.text
      : provider === 'claude'
        ? body.messages?.[0]?.content
        : body.messages?.[1]?.content;
  state.contexts.push({ provider, prompt, system });
  if (state.contexts.length > 40) state.contexts.shift();
  const value =
    provider === 'gemini' && state.invalidGemini
      ? 'invalid JSON'
      : JSON.stringify(content(prompt || '', system || ''));
  res.end(
    JSON.stringify(
      provider === 'gemini'
        ? {
            candidates: [{ content: { parts: [{ text: value }] }, finishReason: 'STOP' }],
            usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 30 },
          }
        : provider === 'claude'
          ? {
              content: [{ type: 'text', text: value }],
              stop_reason: 'end_turn',
              usage: { input_tokens: 20, output_tokens: 30 },
            }
          : { message: { content: value }, prompt_eval_count: 20, eval_count: 30 }
    )
  );
});
server.listen(18029, '127.0.0.1', () => console.log('Fixtures locales de modelos y push en 18029.'));
