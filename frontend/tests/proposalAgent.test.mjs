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
const result = await agent.suggest('Sugiere clases',diagram,true,new AbortController().signal,undefined,'local');
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
const preferred = await agent.suggest('Consulta',diagram,false,new AbortController().signal,undefined,'local');
assert.equal(preferred.model,'qwen3.5:4b');
assert.equal(preferred.status,'clarification');
const selected = await agent.suggest('Consulta',diagram,false,new AbortController().signal,'qwen3.5:4b','local');
assert.equal(selected.model,'qwen3.5:4b');
await assert.rejects(agent.suggest('Consulta',diagram,false,new AbortController().signal,'modelo-ausente','local'),/modelo elegido no está disponible/);
globalThis.fetch = async () => {throw new TypeError('offline');};
await assert.rejects(agent.suggest('Consulta',diagram,false,new AbortController().signal,undefined,'local'),/No se pudo obtener una propuesta válida/);
const controller = new AbortController(); controller.abort();
await assert.rejects(agent.suggest('Consulta',diagram,true,controller.signal,undefined,'local'));
console.log('CU-15: prioridad local, contrato, cancelación, fallo local e inmutabilidad verificados.');
console.log('Modelo local: selección explícita, preferencia Qwen3.5 y think:false verificados.');
const engineCalls=[];
globalThis.fetch = async url => {engineCalls.push(url); throw new TypeError('offline');};
await assert.rejects(agent.suggest('Consulta',diagram,true,new AbortController().signal,'qwen3.5:4b','local'));
assert.deepEqual(engineCalls,['/api/ollama/api/tags'],'Local nunca recurre a nube');
engineCalls.length=0;
globalThis.fetch=async(url,options)=>{
  engineCalls.push(url);
  assert.deepEqual(JSON.parse(options.body),{provider:'claude'});
  assert.equal(options.headers['x-api-key'],undefined);
  return new Response(JSON.stringify({content:{clarification:'¿Qué clases necesitas?'},provider:'Claude',model:'claude-sonnet-5-5',durationMs:350,inputTokens:20,outputTokens:10}));
};
const request={roomId:'ROOM',requestId:'req-1',options:{provider:'claude'}};
const cloudResult=await agent.suggest('Consulta',diagram,true,new AbortController().signal,undefined,'cloud',request);
assert.equal(cloudResult.provider,'Claude');assert.equal(cloudResult.model,'claude-sonnet-5-5');assert.equal(cloudResult.durationMs,350);
assert.equal(engineCalls.length,1);assert.ok(engineCalls[0].endsWith('/colaboracion/salas/ROOM/inferencia/req-1'));
assert.equal(engineCalls.some(url=>url.includes('ollama') || url.includes('anthropic.com') || url.includes('googleapis.com')),false);
globalThis.fetch=async()=>new Response(JSON.stringify({mensaje:'Ambos proveedores no están disponibles.'}),{status:502});
await assert.rejects(agent.suggest('Consulta',diagram,true,new AbortController().signal,undefined,'cloud',request),/Ambos proveedores/);
await assert.rejects(agent.suggest('Consulta',diagram,true,new AbortController().signal,undefined,'cloud'),/sala no confirmó/);
console.log('Nube: gateway autenticado, proveedor real, metadatos y errores; sin claves ni llamadas directas a proveedores.');

// El esquema del gateway exige clarification aunque no se necesite: vacío no es una aclaración.
globalThis.fetch=async()=>new Response(JSON.stringify({content:{explanation:'Nueva clase Cita.',clarification:'',skip:false,classes:[{name:'Cita',attributes:[],methods:[]}],relations:[]},provider:'Claude',model:'claude-sonnet-5-5'}));
const structured=await agent.suggest('Propón Cita',diagram,true,new AbortController().signal,undefined,'cloud',request);
assert.equal(structured.status,'ready');assert.equal(structured.explanation,'Nueva clase Cita.');assert.equal(structured.diagram.classes[0].name,'Cita');
console.log('Una aclaración vacía no oculta una propuesta válida en el chat.');
