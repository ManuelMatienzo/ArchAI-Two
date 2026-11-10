/**
 * Prueba E2E del escenario real: "proyecto = su propia sala".
 *
 * Simula la Web (anfitrión, en /studio?roomId={codigoAcceso}) y el móvil
 * (que abre el mismo proyecto) sobre el canal /topic/collab/{codigoAcceso}:
 *
 *   1. La web se suscribe y publica el diagrama activo (como hace StudioPage).
 *   2. El móvil se suscribe, envía `join` y `solicitar_diagrama`.
 *   3. La web recibe el join y responde con `diagrama` → el móvil lo recibe.
 *   4. La web mueve una tabla (`nodo_mover`) → el móvil lo recibe al instante.
 *
 * Uso:
 *   node scripts/verify-project-room.js
 *   node scripts/verify-project-room.js BANCO1-6439 ws://192.168.0.144:8000/ws-stomp
 */

const WS_URL = process.argv[3] || process.env.ARCHAI_WS_URL || 'ws://localhost:8000/ws-stomp';
const SALA = process.argv[2] || process.env.ARCHAI_SALA || 'BANCO1-6439';

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

function crearCliente(nombre) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
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
      for (let i = esperadores.length - 1; i >= 0; i--) {
        const esp = esperadores[i];
        if (esp.predicado(msg)) {
          esperadores.splice(i, 1);
          clearTimeout(esp.timer);
          esp.resolve(msg);
        }
      }
    };

    ws.onopen = () => enviarFrame('CONNECT', { 'accept-version': '1.2', host: 'archai' });

    ws.onmessage = (evento) => {
      const frame = parsear(String(evento.data));
      if (frame.command === 'CONNECTED') {
        conectado = true;
        resolve({
          nombre,
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
      if (frame.command === 'ERROR') notificar({ error: frame.body });
    };

    ws.onerror = () => reject(new Error(`No se pudo conectar a ${WS_URL}`));
    ws.onclose = () => {
      if (!conectado) reject(new Error(`WebSocket cerrado antes de CONNECTED (${WS_URL})`));
    };
  });
}

function mensaje(tipo, payload, emisorId, emisorNombre) {
  return { salaId: SALA, tipo, emisorId, emisorNombre, payload, timestamp: Date.now() };
}

const DIAGRAMA = {
  title: 'Proyecto en vivo',
  classes: [
    {
      id: 'cls-cuenta',
      name: 'Cuenta',
      stereotype: 'Entity',
      position: { x: 240, y: 180 },
      attributes: [
        { id: 'a1', name: 'id', type: 'Long', visibility: '-', isPrimaryKey: true, isNullable: false },
      ],
      methods: [],
    },
    {
      id: 'cls-cliente',
      name: 'Cliente',
      stereotype: 'Entity',
      position: { x: 620, y: 420 },
      attributes: [],
      methods: [],
    },
  ],
  relations: [
    { id: 'rel-1', sourceClassId: 'cls-cuenta', targetClassId: 'cls-cliente', type: 'ASSOCIATION' },
  ],
};

async function run() {
  console.log('ArchAI · Proyecto = su propia sala (Web anfitrión + Móvil)\n');
  console.log(`Broker: ${WS_URL}`);
  console.log(`Sala:   ${SALA} (código de acceso del proyecto)\n`);

  let web;
  let movil;
  try {
    web = await crearCliente('web');
    web.suscribir(`/topic/collab/${SALA}`, 'sub-web');
    console.log('  · web conectada y suscrita a la sala del proyecto');

    movil = await crearCliente('movil');
    movil.suscribir(`/topic/collab/${SALA}`, 'sub-movil');
    console.log('  · móvil conectado y suscrito a la misma sala\n');
  } catch (err) {
    console.error(`\n✗ No se pudo conectar al broker: ${err.message}`);
    console.error('  Verifica que el backend esté corriendo (mvn spring-boot:run).');
    process.exit(1);
  }

  try {
    // 1) La web (anfitrión) publica el diagrama activo del proyecto
    web.publicar(`/app/collab/${SALA}`, mensaje('diagrama', DIAGRAMA, 'usr-web-host', 'Web Studio'));

    const esperaDiagramaInicial = movil.esperar(
      (m) => m.payload && m.payload.tipo === 'diagrama',
      6000,
      'diagrama inicial'
    );
    const inicial = await esperaDiagramaInicial;
    console.log('1) La web publica el diagrama del proyecto');
    check(inicial.payload.payload?.classes?.length === 2, 'el móvil recibe las 2 clases del proyecto');
    check(
      inicial.payload.payload?.relations?.[0]?.sourceClassId === 'cls-cuenta',
      'el móvil recibe las relaciones'
    );

    // 2) El móvil entra: join + solicitar_diagrama, y la web responde con el diagrama
    const esperaJoinEnWeb = web.esperar(
      (m) => m.payload && m.payload.tipo === 'join',
      6000,
      'join del móvil'
    );

    movil.publicar(
      `/app/collab/${SALA}`,
      mensaje(
        'join',
        { usuario: { id: 'usr-admin-01', name: 'Ing. Carlos Criado' } },
        'usr-admin-01',
        'Ing. Carlos Criado'
      )
    );

    const joinRecibido = await esperaJoinEnWeb;
    console.log('\n2) El móvil entra al proyecto');
    check(joinRecibido.payload.payload?.usuario?.id === 'usr-admin-01', 'la web recibe el join con el usuario real');

    const esperaDiagramaBienvenida = movil.esperar(
      (m) => m.payload && m.payload.tipo === 'diagrama',
      6000,
      'diagrama de bienvenida'
    );
    web.publicar(
      `/app/collab/${SALA}`,
      mensaje('diagrama', DIAGRAMA, 'usr-web-host', 'Web Studio')
    );
    const bienvenida = await esperaDiagramaBienvenida;
    check(
      bienvenida.payload.payload?.classes?.length === 2,
      'el móvil recibe el diagrama de bienvenida tras el join'
    );

    // 3) La web mueve una tabla → el móvil debe verla moverse en vivo
    const esperaMovimiento = movil.esperar(
      (m) => m.payload && m.payload.tipo === 'nodo_mover',
      6000,
      'nodo_mover'
    );
    web.publicar(
      `/app/collab/${SALA}`,
      mensaje(
        'nodo_mover',
        { classId: 'cls-cuenta', x: 512, y: 333, color: '#e8c39e' },
        'usr-web-host',
        'Web Studio'
      )
    );

    const movimiento = await esperaMovimiento;
    console.log('\n3) La web mueve una tabla en el proyecto');
    check(movimiento.payload.payload?.classId === 'cls-cuenta', 'el móvil identifica la tabla movida');
    check(
      movimiento.payload.payload?.x === 512 && movimiento.payload.payload?.y === 333,
      'el móvil recibe las coordenadas exactas (512, 333)'
    );
    check(movimiento.payload.emisorNombre === 'Web Studio', 'el móvil sabe quién la movió');

    console.log(`\nResultado: ${checks} comprobaciones, ${failures} fallo(s).`);
    if (failures > 0) {
      console.error('✗ El proyecto no está sincronizando el diagrama en tiempo real.');
      process.exitCode = 1;
    } else {
      console.log('✓ Web y móvil comparten la sala del proyecto y se ven los cambios en vivo.');
    }
  } catch (err) {
    console.error(`\n✗ ${err.message}`);
    process.exitCode = 1;
  } finally {
    web.cerrar();
    movil.cerrar();
    setTimeout(() => process.exit(process.exitCode || 0), 300);
  }
}

run();
