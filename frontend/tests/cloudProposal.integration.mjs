// Explicit opt-in: consumes one request per real provider plus one Claude fallback.
// Requires the disposable fixture created by proposalReview.integration.mjs on local-test.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
if(!process.argv.includes('--live'))throw new Error('Usa --live para autorizar tres consultas reales con datos ficticios.');
const fixture=JSON.parse(await readFile('node_modules/.cache/review-session.json','utf8'));
const {owner,reader,room,diagramId}=fixture,base='http://127.0.0.1:8000';
async function api(path,options={},token=owner.token){const res=await fetch(base+path,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}});const text=await res.text();const body=text?JSON.parse(text):null;if(!res.ok)throw new Error(`HTTP ${res.status}: ${body?.mensaje || 'Error'}`);return body;}
const root=`/api/v1/colaboracion/salas/${room}`;
const state=await api(`${root}/propuestas?diagramId=${diagramId}`);
const config=await api(`${root}/inferencia?diagramId=${diagramId}`);
assert.equal(config.testControls,true,'Requiere local-test y controles activados');
const sockets=[];
async function connect(token,channel){
 const ws=new WebSocket('ws://127.0.0.1:8000/ws-stomp');sockets.push(ws);const messages=[];
 await new Promise((resolve,reject)=>{const tid=setTimeout(()=>reject(new Error('STOMP timeout')),5000);ws.onopen=()=>ws.send(`CONNECT\naccept-version:1.2\nhost:archai\nAuthorization:Bearer ${token}\n\n\0`);ws.onmessage=({data})=>{const frame=String(data);if(frame.startsWith('CONNECTED')){ws.send(`SUBSCRIBE\nid:test\ndestination:/topic/collab/${channel}\n\n\0`);clearTimeout(tid);resolve();}else if(frame.startsWith('MESSAGE'))messages.push(JSON.parse(frame.slice(frame.indexOf('\n\n')+2).replace(/\0.*$/s,'')));};ws.onerror=reject;});return {ws,messages};
}
const results=[];
try{
 const [sender,observer,other]=await Promise.all([connect(owner.token,room),connect(reader.token,room),connect(reader.token,'ARC-CLOUD-OTHER')]);
 const send=(payload,tipo)=>sender.ws.send(`SEND\ndestination:/app/collab/${room}\ncontent-type:application/json\n\n${JSON.stringify({tipo,emisorId:`${owner.user.id}#live`,emisorNombre:owner.user.name,salaId:room,payload})}\0`);
 for(const options of [{provider:'gemini'},{provider:'claude'},{provider:'auto',...(process.argv.includes('--natural')?{}:{simulateGeminiFailure:true})}].filter(o=>!process.argv.some(a=>a.startsWith('--mode=')) || process.argv.includes('--mode='+o.provider))){
  const id=crypto.randomUUID();const p={id,diagramId,baseDiagram:state.official,prompt:'Propón solo una clase nueva Cita con id: Long y fecha: LocalDateTime. Un Paciente existente tiene muchas citas. Usa ASSOCIATION_1_N desde Paciente a Cita. No repitas Paciente. Explicación breve en español.',author:'Equipo editor',automatic:false,requestedAt:Date.now()};
  send(p,'ia_request');const until=Date.now()+5000;while(!sender.messages.some(m=>m.tipo==='ia_request' && m.payload.id===id) && Date.now()<until)await new Promise(r=>setTimeout(r,50));
  assert.ok(sender.messages.some(m=>m.tipo==='ia_request' && m.payload.id===id),'La sala autoriza la solicitud');
  const started=Date.now();try{
   const result=await api(`${root}/inferencia/${id}`,{method:'POST',body:JSON.stringify(options)});
   assert.ok(result.content.classes.some(c=>c.name==='Cita'));assert.ok(result.content.relations.some(r=>r.sourceName==='Paciente'));
   const again=await api(`${root}/inferencia/${id}`,{method:'POST',body:JSON.stringify(options)});assert.deepEqual(result,again,'Idempotencia');
   send({...p,status:'ready',explanation:result.content.explanation,provider:result.provider,model:result.model},'ia_result');
   await new Promise(r=>setTimeout(r,120));assert.equal(observer.messages.filter(m=>m.tipo==='ia_result' && m.payload.id===id).length,1);assert.equal(other.messages.length,0);
   results.push({mode:options.provider,provider:result.provider,model:result.model,elapsedMs:Date.now()-started,inputTokens:result.inputTokens,outputTokens:result.outputTokens,success:true});
  }catch(ex){results.push({mode:options.provider,success:false,error:ex.message});}
 }
 assert.deepEqual((await api(`${root}/propuestas?diagramId=${diagramId}`)).official,state.official,'Las consultas no modifican el diagrama');
 console.log(JSON.stringify({results,diagramUnchanged:true,roomIsolation:true}));
 if(results.some(r=>!r.success))process.exitCode=1;
}finally{sockets.forEach(ws=>ws.close());}
