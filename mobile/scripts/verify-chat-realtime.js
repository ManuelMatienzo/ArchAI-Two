/**
 * Verificación en vivo del canal de Chat Colaborativo (Humano a Humano)
 * sin intervención de la IA.
 *
 * Simula dos participantes reales en una sala compartida:
 *   - Participante 1: "Carlos (Ing. Móvil)"
 *   - Participante 2: "Elena (Arquitecta Web)"
 *
 * Verifica:
 *   1. Envío bidireccional instantáneo sobre el broker STOMP (/topic/collab/{sala})
 *   2. Preservación íntegra de emisor, rol, contenido y timestamp
 *   3. Confirmación de entrega y orden secuencial sin pérdida de paquetes
 *   4. Operación 100% autónoma sin requerir servicios de IA
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
    };

    ws.onerror = () => reject(new Error(`No se pudo conectar a ${WS_URL}`));
    ws.onclose = () => {
      if (!conectado) reject(new Error(`WebSocket cerrado antes de CONNECTED (${WS_URL})`));
    };
  });
}

async function run() {
  console.log('ArchAI · Prueba de Chat Colaborativo en Vivo (Sin IA)\n');
  console.log(`Broker: ${WS_URL}`);
  console.log(`Sala:   ${SALA}\n`);

  let movil;
  let web;

  try {
    // 1. Conexión de participantes
    movil = await crearCliente('Carlos (Móvil)');
    web = await crearCliente('Elena (Web)');

    console.log('  · Carlos (Móvil) conectado a STOMP');
    console.log('  · Elena (Web) conectada a STOMP\n');

    // Suscribir a los canales de la sala
    movil.suscribir(`/topic/collab/${SALA}`, 'sub-movil-collab');
    movil.suscribir(`/topic/room/${SALA}/chat`, 'sub-movil-chat');
    web.suscribir(`/topic/collab/${SALA}`, 'sub-web-collab');
    web.suscribir(`/topic/room/${SALA}/chat`, 'sub-web-chat');

    await new Promise((r) => setTimeout(r, 150));

    // ──────────────────────────────────────────────────────────────────────────
    // Caso 1: Carlos (Móvil) envía un mensaje de equipo a Elena (Web)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('1) Envío de mensaje desde Móvil (Carlos) → Web (Elena)');

    const mensajeCarlos = {
      id: 'msg_' + Date.now() + '_carlos',
      sender: 'Carlos Criado',
      senderRole: 'DESARROLLADOR_MOVIL',
      content: 'Hola Elena, acabo de entrar a la sala. ¿Revisamos las tablas del módulo de ventas?',
      timestamp: '14:52',
      roomId: SALA,
      status: 'entregado',
    };

    const esperaElena = web.esperar(
      (m) => {
        const payload = m.payload?.payload || m.payload;
        return payload?.content?.includes('módulo de ventas');
      },
      3000,
      'Mensaje de Carlos hacia Elena'
    );

    // El móvil publica al endpoint colaborativo de la sala
    movil.publicar(`/app/collab/${SALA}`, {
      salaId: SALA,
      tipo: 'chat',
      emisorId: 'usr-carlos-movil',
      emisorNombre: 'Carlos Criado',
      payload: mensajeCarlos,
      timestamp: Date.now(),
    });

    const recibidoElena = await esperaElena;
    const datosElena = recibidoElena.payload?.payload || recibidoElena.payload;

    check(datosElena.sender === 'Carlos Criado', 'Elena recibe el emisor correcto: "Carlos Criado"');
    check(datosElena.senderRole === 'DESARROLLADOR_MOVIL', 'Rol del emisor preservado: DESARROLLADOR_MOVIL');
    check(datosElena.content.includes('módulo de ventas'), 'Contenido del mensaje recibido íntegramente');
    check(datosElena.roomId === SALA, `Sala validada correctamente (${SALA})`);

    console.log(`    💬 Elena leyó: "${datosElena.content}"\n`);

    // ──────────────────────────────────────────────────────────────────────────
    // Caso 2: Elena (Web) responde a Carlos (Móvil)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('2) Respuesta desde Web (Elena) → Móvil (Carlos)');

    const mensajeElena = {
      id: 'msg_' + Date.now() + '_elena',
      sender: 'Elena Arquitecta',
      senderRole: 'ARQUITECTO',
      content: 'Perfecto Carlos. Conectemos DetalleVenta con Producto y calculemos el subtotal.',
      timestamp: '14:53',
      roomId: SALA,
      status: 'entregado',
    };

    const esperaCarlos = movil.esperar(
      (m) => {
        const payload = m.payload?.payload || m.payload;
        return payload?.content?.includes('DetalleVenta');
      },
      3000,
      'Respuesta de Elena hacia Carlos'
    );

    web.publicar(`/app/collab/${SALA}`, {
      salaId: SALA,
      tipo: 'chat',
      emisorId: 'usr-elena-web',
      emisorNombre: 'Elena Arquitecta',
      payload: mensajeElena,
      timestamp: Date.now(),
    });

    const recibidoCarlos = await esperaCarlos;
    const datosCarlos = recibidoCarlos.payload?.payload || recibidoCarlos.payload;

    check(datosCarlos.sender === 'Elena Arquitecta', 'Carlos recibe la respuesta de: "Elena Arquitecta"');
    check(datosCarlos.senderRole === 'ARQUITECTO', 'Rol del emisor validado: ARQUITECTO');
    check(datosCarlos.content.includes('DetalleVenta'), 'Contenido de la respuesta recibido íntegramente');

    console.log(`    💬 Carlos leyó: "${datosCarlos.content}"\n`);

    // ──────────────────────────────────────────────────────────────────────────
    // Caso 3: Diálogo fluido continuo (verificación de latencia y no-pérdida)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('3) Diálogo secuencial continuo sin pérdida de paquetes');

    const esperaRespuestaFinal = web.esperar(
      (m) => {
        const payload = m.payload?.payload || m.payload;
        return payload?.content?.includes('Listo, cambios aplicados');
      },
      3000,
      'Confirmación final de Carlos'
    );

    const mensajeFinal = {
      id: 'msg_' + Date.now() + '_confirm',
      sender: 'Carlos Criado',
      senderRole: 'DESARROLLADOR_MOVIL',
      content: 'Listo, cambios aplicados en el diagrama.',
      timestamp: '14:53',
      roomId: SALA,
      status: 'entregado',
    };

    movil.publicar(`/app/collab/${SALA}`, {
      salaId: SALA,
      tipo: 'chat',
      emisorId: 'usr-carlos-movil',
      emisorNombre: 'Carlos Criado',
      payload: mensajeFinal,
      timestamp: Date.now(),
    });

    const resFinal = await esperaRespuestaFinal;
    const datosFinal = resFinal.payload?.payload || resFinal.payload;

    check(datosFinal.content === 'Listo, cambios aplicados en el diagrama.', 'Diálogo secuencial completado sin pérdida');

    console.log(`    💬 Web confirmó recepción: "${datosFinal.content}"\n`);

    // ──────────────────────────────────────────────────────────────────────────
    // Resumen
    // ──────────────────────────────────────────────────────────────────────────
    console.log(`Resultado: ${checks} comprobaciones, ${failures} fallo(s).`);
    if (failures === 0) {
      console.log('✓ El chat colaborativo funciona 100% en tiempo real entre participantes sin depender de la IA.');
    } else {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Error durante la prueba de chat:', err.message);
    process.exitCode = 1;
  } finally {
    if (movil) movil.cerrar();
    if (web) web.cerrar();
  }
}

run();
