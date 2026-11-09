import { build } from 'esbuild';
import assert from 'node:assert/strict';

const {outputFiles} = await build({entryPoints:['src/services/proposalAgent.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env':'{}'}});
const agent = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const diagram = {title:'Ventas',classes:[],relations:[],updatedAt:''};
const original = JSON.stringify(diagram);
const calls = [];
globalThis.fetch = async (url,options) => {
  calls.push(url);
  if (url.endsWith('/tags')) return new Response(JSON.stringify({models:[{name:'qwen2.5:1.5b'}]}));
  assert.match(JSON.parse(options.body).messages[0].content,/Contexto actual/);
  return new Response(JSON.stringify({message:{content:JSON.stringify({explanation:'Separar responsabilidades.',classes:[{name:'Pedido',attributes:[],methods:[]}],relations:[]})}}));
};
const result = await agent.suggest('Sugiere clases',diagram,true,new AbortController().signal);
assert.equal(result.provider,'Ollama');
assert.equal(result.status,'ready');
assert.equal(JSON.stringify(diagram),original,'La propuesta no modifica el lienzo');
assert.deepEqual(calls,['/api/ollama/api/tags','/api/ollama/api/chat']);
const moved = structuredClone(result.diagram.classes[0]);
const a = {...diagram,classes:[moved]};
const b = structuredClone(a); b.classes[0].position = {x:999,y:999};
assert.equal(agent.semanticDiagram(a),agent.semanticDiagram(b),'Mover nodos no dispara revisión');
globalThis.fetch = async (url,options) => {
  if (url.endsWith('/tags')) return new Response(JSON.stringify({models:[{name:'qwen2.5-coder:1.5b-base'},{name:'qwen3.5:4b'}]}));
  const body = JSON.parse(options.body);
  assert.equal(body.model,'qwen3.5:4b');
  assert.equal(body.think,false);
  return new Response(JSON.stringify({message:{content:JSON.stringify({clarification:'¿Qué dominio deseas modelar?'})}}));
};
const preferred = await agent.suggest('Consulta',diagram,false,new AbortController().signal);
assert.equal(preferred.model,'qwen3.5:4b');
assert.equal(preferred.status,'clarification');
const selected = await agent.suggest('Consulta',diagram,false,new AbortController().signal,'qwen3.5:4b');
assert.equal(selected.model,'qwen3.5:4b');
await assert.rejects(agent.suggest('Consulta',diagram,false,new AbortController().signal,'modelo-ausente'),/modelo elegido no está disponible/);
globalThis.fetch = async () => {throw new TypeError('offline');};
await assert.rejects(agent.suggest('Consulta',diagram,false,new AbortController().signal),/modelo local/);
const controller = new AbortController(); controller.abort();
await assert.rejects(agent.suggest('Consulta',diagram,true,controller.signal));
console.log('CU-15: prioridad local, contrato, cancelación, fallo local e inmutabilidad verificados.');
console.log('Modelo local: selección explícita, preferencia Qwen3.5 y think:false verificados.');
const configured = await build({entryPoints:['src/services/proposalAgent.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env':JSON.stringify({VITE_GEMINI_API_KEY:'test-only-not-a-real-key',VITE_GEMINI_MODEL:'test-model'})}});
const configuredAgent = await import(`data:text/javascript;base64,${Buffer.from(configured.outputFiles[0].text).toString('base64')}`);
const engineCalls=[];
globalThis.fetch = async url => { engineCalls.push(url); throw new TypeError('offline'); };
await assert.rejects(configuredAgent.suggest('Consulta',diagram,true,new AbortController().signal,'qwen3.5:4b','local'));
assert.deepEqual(engineCalls,['/api/ollama/api/tags'],'Local nunca recurre a nube aunque exista una clave');
engineCalls.length=0;
globalThis.fetch = async url => {
  engineCalls.push(url);
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({clarification:'¿Qué clases necesitas?'})}]}}]}));
};
const cloudResult=await configuredAgent.suggest('Consulta',diagram,true,new AbortController().signal,'qwen3.5:4b','cloud');
assert.equal(cloudResult.provider,'Nube'); assert.equal(cloudResult.model,'test-model');
assert.equal(engineCalls.length,1); assert.match(engineCalls[0],/generativelanguage/);
assert.equal(engineCalls.some(url=>url.includes('ollama')),false,'Nube no consulta al modelo local');
console.log('Selector Local/Nube: rutas exclusivas comprobadas sin llamadas reales.');
for (const [status,message] of [[429,/cuota/],[403,/permisos/],[404,/modelo/],[400,/formato/],[503,/temporalmente/]]) {
  globalThis.fetch = async () => new Response('{}',{status});
  await assert.rejects(configuredAgent.suggest('Consulta',diagram,true,new AbortController().signal,undefined,'cloud'),message);
}
globalThis.fetch=async()=>{throw new TypeError('network');};
await assert.rejects(configuredAgent.suggest('Consulta',diagram,true,new AbortController().signal,undefined,'cloud'),/conexión/);
globalThis.fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[]}}]}));
await assert.rejects(configuredAgent.suggest('Consulta',diagram,true,new AbortController().signal,undefined,'cloud'),/sin texto/);
console.log('Gemini: errores de cuota, permisos, modelo, formato, disponibilidad, red y respuesta vacía verificados.');
