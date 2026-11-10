/**
 * Prueba del canal colaborativo STOMP del backend, sin navegador ni teléfono.
 *
 * Simula DOS clientes (como la Web y el móvil) contra /ws-stomp:
 *   · Cliente "web"   → publica nodo_mover y solicitar_diagrama
 *   · Cliente "movil" → escucha /topic/collab/{sala} y comprueba lo recibido
 *
 * Verifica el contrato exacto que consume CanvasViewerScreen:
 *   { salaId, tipo, emisorId, emisorNombre, payload, timestamp }
 *
 * Uso:
 *   node scripts/verify-stomp-realtime.js
 *   node scripts/verify-stomp-realtime.js ARC-920154 ws://192.168.0.144:8000/ws-stomp
 *
 * No modifica datos: solo emite `nodo_mover` (efímero) y `solicitar_diagrama` (lectura).
 */

const WS_URL = process.argv[3] || process.env.ARCHAI_WS_URL || 'ws://localhost:8000/ws-stomp';
const SALA = process.argv[2] || process.env.ARCHAI_SALA || 'ARC-GRUPO04';

let checks = 0;
let failures = 0;

function check(condition, message) {
  checks += 1;
  if (condition) {
    console.log(`  ✓ ${message}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${message}`);
  }
}

/** Cliente STOMP mínimo con frames de texto, igual que el cliente web. */
function crearCliente(nombre) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const mensajes = [];
    const esperadores = [];
    let conectado = false;

    const enviarFrame = (command, headers = {}, body = '') => {
      let frame = command + '\n';
      for (const [k, v] of Object.entries(headers)) frame += `${k}:${v}\n`;
      frame += '\n' + body + '\u0000';
      ws.send(frame);
    };

    const parsear = (texto) => {
      const fin = texto.indexOf('\u0000');
      const contenido = fin >= 0 ? texto.substring(0, fin) : texto;
      let sep = contenido.indexOf('\n\n');
      let len = 2;
      if (sep === -1) {
        sep = contenido.indexOf('\r\n\r\n');
        len = 4;
      }
      const cabeceras = sep >= 0 ? contenido.substring(0, sep) : contenido;
      const body = sep >= 0 ? contenido.substring(sep + len) : '';
      const lineas = cabeceras.split(/\r?\n/);
      const command = (lineas.shift() || '').trim();
      const headers = {};
      for (const linea of lineas) {
        const i = linea.indexOf(':');
        if (i > 0) headers[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
      }
      return { command, headers, body };
    };

    const notificar = (msg) => {
      mensajes.push(msg);
      for (let i = esperadores.length - 1; i >= 0; i--) {
        const esp = esperadores[i];
        if (esp.predicado(msg)) {
          esperadores.splice(i, 1);
          clearTimeout(esp.timer);
          esp.resolve(msg);
        }
      }
    };

    ws.onopen = () => {
      enviarFrame('CONNECT', { 'accept-version': '1.2', host: 'archai' });
    };

    ws.onmessage = (evento) => {
      const frame = parsear(String(evento.data));
      if (frame.command === 'CONNECTED') {
        conectado = true;
        resolve({
          nombre,
          enviarFrame,
          suscribir(destino, id) {
            enviarFrame('SUBSCRIBE', { id, destination: destino });
          },
          publicar(destino, payload) {
            enviarFrame(
              'SEND',
              { destination: destino, 'content-type': 'application/json' },
              JSON.stringify(payload)
            );
          },
          esperar(predicado, timeoutMs, etiqueta) {
            return new Promise((res, rej) => {
              const timer = setTimeout(
                () => rej(new Error(`Tiempo agotado esperando: ${etiqueta}`)),
                timeoutMs
              );
              esperadores.push({ predicado, resolve: res, timer });
            });
          },
          cerrar() {
            try { enviarFrame('DISCONNECT', {}); } catch {}
            try { ws.close(); } catch {}
          },
        });
        return;
      }
      if (frame.command === 'MESSAGE') {
        let payload;
        try { payload = JSON.parse(frame.body); } catch { payload = frame.body; }
        notificar({ destino: frame.headers.destination, payload });
      }
      if (frame.command === 'ERROR') {
        notificar({ error: frame.body });
      }
    };

    ws.onerror = () => reject(new Error(`No se pudo conectar a ${WS_URL}`));
    ws.onclose = () => {
      if (!conectado) reject(new Error(`WebSocket cerrado antes de CONNECTED (${WS_URL})`));
    };
  });
}

function mensaje(tipo, payload, emisorId, emisorNombre) {
  return {
    salaId: SALA,
    tipo,
    emisorId,
    emisorNombre,
    payload,
    timestamp: Date.now(),
  };
}

async function run() {
  console.log('ArchAI · Prueba del canal colaborativo STOMP en vivo\n');
  console.log(`Broker: ${WS_URL}`);
  console.log(`Sala:   ${SALA}\n`);

  let movil;
  let web;
  try {
    movil = await crearCliente('movil');
    console.log('  · cliente móvil conectado');
    movil.suscribir(`/topic/collab/${SALA}`, 'sub-movil');

    web = await crearCliente('web');
    console.log('  · cliente web conectado');
    web.suscribir(`/topic/collab/${SALA}`, 'sub-web');
  } catch (err) {
    console.error(`\n✗ No se pudo conectar al broker: ${err.message}`);
    console.error('  Verifica que el backend esté corriendo (mvn spring-boot:run).');
    process.exit(1);
  }

  try {
    // 1) Movimiento de nodo en vivo (lo que hace la Web al arrastrar una tabla)
    const esperaNodo = movil.esperar(
      (m) => m.payload && m.payload.tipo === 'nodo_mover',
      6000,
      'nodo_mover'
    );
    // El emisor también debe recibir el broadcast (necesario para 2 pestañas del mismo usuario)
    const esperaEco = web.esperar(
      (m) => m.payload && m.payload.tipo === 'nodo_mover' && m.payload.payload?.classId === 'cls-realtime-test',
      6000,
      'eco nodo_mover'
    );

    web.publicar(
      `/app/collab/${SALA}`,
      mensaje('nodo_mover', { classId: 'cls-realtime-test', x: 321, y: 654, color: '#38bdf8' }, 'usr-web-test', 'Web Studio')
    );

    const recibido = await esperaNodo;
    console.log('\n1) Movimiento de nodo en vivo');
    check(recibido.payload.tipo === 'nodo_mover', 'llega el tipo nodo_mover');
    check(recibido.payload.payload?.classId === 'cls-realtime-test', 'llega el classId');
    check(recibido.payload.payload?.x === 321 && recibido.payload.payload?.y === 654, 'llegan las coordenadas x=321 y=654');
    check(recibido.payload.emisorNombre === 'Web Studio', 'llega el nombre del emisor');
    check(typeof recibido.payload.timestamp === 'number', 'llega el timestamp');

    // 2) Petición del diagrama activo (lo que hace el móvil al entrar a la sala).
    //    Primero la web publica su diagrama para que el backend lo guarde en memoria;
    //    así la prueba no depende de que la sala ya tuviera contenido antes.
    const DIAGRAMA_PRUEBA = {
      title: 'Diagrama de prueba',
      classes: [
        {
          id: 'cls-realtime-test',
          name: 'Prueba',
          stereotype: 'Entity',
          position: { x: 200, y: 160 },
          attributes: [],
          methods: [],
        },
        {
          id: 'cls-realtime-test-2',
          name: 'PruebaDos',
          stereotype: 'Entity',
          position: { x: 480, y: 320 },
          attributes: [],
          methods: [],
        },
      ],
      relations: [
        { id: 'rel-test', sourceClassId: 'cls-realtime-test', targetClassId: 'cls-realtime-test-2', type: 'ASSOCIATION' },
      ],
    };

    const esperaDiagrama = movil.esperar(
      (m) => m.payload && m.payload.tipo === 'diagrama' && m.payload.emisorId === 'sistema-backend',
      6000,
      'diagrama'
    );

    web.publicar(`/app/collab/${SALA}`, mensaje('diagrama', DIAGRAMA_PRUEBA, 'usr-web-test', 'Web Studio'));
    await new Promise((r) => setTimeout(r, 250));
    movil.publicar(`/app/collab/${SALA}`, mensaje('solicitar_diagrama', {}, 'usr-movil-test', 'Móvil'));
    const diagrama = await esperaDiagrama;

    console.log('\n2) Diagrama activo bajo demanda');
    const payload = diagrama.payload.payload;
    const clases = Array.isArray(payload?.classes) ? payload.classes : [];
    const relaciones = Array.isArray(payload?.relations) ? payload.relations : [];
    check(clases.length > 0, `el backend devuelve clases (${clases.length})`);
    check(Array.isArray(payload?.classes), 'classes es un array');
    check(relaciones.every((r) => r && (r.sourceClassId || r.sourceId)), 'las relaciones tienen origen');

    // 3) El emisor también recibe el broadcast (dos pestañas del mismo usuario)
    check(!!(await esperaEco), 'el emisor también recibe el broadcast (necesario para 2 pestañas)');

    // 4) Entrada de un colaborador: el backend lo registra y difunde la presencia
    movil.suscribir(`/topic/room/${SALA}/presence`, 'sub-presence');
    const esperaPresencia = movil.esperar(
      (m) => m.destino === `/topic/room/${SALA}/presence` && Array.isArray(m.payload),
      6000,
      'presencia tras join'
    );
    movil.publicar(
      `/app/collab/${SALA}`,
      mensaje('join', { usuario: { id: 'usr-presencia-test', name: 'Prueba Presencia' } }, 'usr-presencia-test', 'Prueba Presencia')
    );
    const presencia = await esperaPresencia;

    console.log('\n3) Presencia en la sala');
    check(
      presencia.payload.some((p) => p && p.id === 'usr-presencia-test'),
      'el backend registra al colaborador que entra con join'
    );

    console.log(`\nResultado: ${checks} comprobaciones, ${failures} fallo(s).`);
    if (failures > 0) {
      console.error('✗ El canal colaborativo no está entregando los eventos esperados.');
      process.exitCode = 1;
    } else {
      console.log('✓ El canal STOMP entrega movimiento y diagrama en tiempo real.');
    }
  } catch (err) {
    console.error(`\n✗ ${err.message}`);
    process.exitCode = 1;
  } finally {
    movil.cerrar();
    web.cerrar();
    setTimeout(() => process.exit(process.exitCode || 0), 300);
  }
}

run();
