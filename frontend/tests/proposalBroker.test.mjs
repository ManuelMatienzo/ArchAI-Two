import assert from 'node:assert/strict';
const clients=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function client(room) {
  const ws=new WebSocket('ws://127.0.0.1:18015/ws-stomp'); clients.push(ws);
  const messages=[];
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Timeout STOMP')),5000);
    ws.onerror=reject;
    ws.onopen=()=>ws.send('CONNECT\naccept-version:1.2\nhost:archai\n\n\0');
    ws.onmessage=({data})=>{
      if(String(data).startsWith('CONNECTED')) {
        ws.send(`SUBSCRIBE\nid:s\ndestination:/topic/collab/${room}\n\n\0`);
        clearTimeout(timeout);resolve();
      } else if(String(data).startsWith('MESSAGE')) messages.push(JSON.parse(String(data).split('\n\n').slice(1).join('\n\n').replace(/\0.*$/s,'')));
    };
  }); return {ws,messages};
}
try {
  const a=await client('ARC-GRUPO04'),b=await client('ARC-GRUPO04'),other=await client('ARC-OTHER');
  await pause(300);
  const event={tipo:'ia_request',emisorId:'usr-admin-01#test',emisorNombre:'Host',payload:{id:'proposal-test',prompt:'Sugiere clases',automatic:false}};
  a.ws.send(`SEND\ndestination:/app/collab/ARC-GRUPO04\ncontent-type:application/json\n\n${JSON.stringify(event)}\0`);
  await pause(700);
  assert.equal(a.messages.length,1);assert.equal(b.messages.length,1);assert.equal(other.messages.length,0);
  assert.equal(b.messages[0].payload.id,'proposal-test');
  assert.equal(b.messages[0].salaId,'ARC-GRUPO04');
  console.log('CU-15: dos suscriptores reciben la solicitud una vez; otra sala queda aislada.');
} finally {clients.forEach(ws=>ws.close());}
