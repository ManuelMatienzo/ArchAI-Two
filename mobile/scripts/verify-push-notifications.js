#!/usr/bin/env node
/**
 * CU-23 — Verificación de Alertas Push (móvil + backend).
 *
 * 1. Comprueba el cableado real del cliente móvil y del backend.
 * 2. Si el backend está levantado, ejecuta un round-trip de registro → alerta → baja.
 *
 * Uso:
 *   npm run verify:push
 *   ARCHAI_BACKEND_URL=http://192.168.0.144:8000/api/v1 npm run verify:push
 */

const fs = require('fs');
const path = require('path');

const RAIZ_MOVIL = path.resolve(__dirname, '..');
const RAIZ_APP = path.resolve(RAIZ_MOVIL, '..');
const BACKEND = process.env.ARCHAI_BACKEND_URL || 'http://localhost:8000/api/v1';

let aprobadas = 0;
let fallidas = 0;
const fallos = [];

function comprobar(nombre, condicion, detalle = '') {
  if (condicion) {
    aprobadas++;
    console.log(`  [OK]   ${nombre}`);
  } else {
    fallidas++;
    fallos.push(`${nombre}${detalle ? ` — ${detalle}` : ''}`);
    console.log(`  [FALLA] ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  }
}

function leer(relativa) {
  const absoluta = path.isAbsolute(relativa) ? relativa : path.join(RAIZ_MOVIL, relativa);
  return fs.existsSync(absoluta) ? fs.readFileSync(absoluta, 'utf8') : '';
}

function existe(relativa) {
  const absoluta = path.isAbsolute(relativa) ? relativa : path.join(RAIZ_MOVIL, relativa);
  return fs.existsSync(absoluta);
}

function seccion(titulo) {
  console.log(`\n${titulo}`);
}

function verificarFuentes() {
  seccion('1. Cliente móvil');

  const servicio = leer('src/services/pushNotificationsService.ts');
  comprobar('Existe pushNotificationsService.ts', servicio.length > 0);
  comprobar('Exporta activarNotificacionesPush', servicio.includes('export async function activarNotificacionesPush'));
  comprobar('Exporta desactivarNotificacionesPush', servicio.includes('export async function desactivarNotificacionesPush'));
  comprobar('Exporta sincronizarTokenPush', servicio.includes('export async function sincronizarTokenPush'));
  comprobar('Exporta vincularSalaPush', servicio.includes('export async function vincularSalaPush'));
  comprobar('Exporta suscribirNotificaciones', servicio.includes('export function suscribirNotificaciones'));
  comprobar('Exporta procesarNotificacionInicial', servicio.includes('export async function procesarNotificacionInicial'));
  comprobar('Canal Android archai-critical', servicio.includes("PUSH_CHANNEL_ID = 'archai-critical'"));
  comprobar('Usa getDevicePushTokenAsync (FCM)', servicio.includes('getDevicePushTokenAsync'));
  comprobar('Soporta Expo Push opcional', servicio.includes('getExpoPushTokenAsync'));
  comprobar('Punto de integración Firebase documentado', servicio.includes('google-services.json'));

  const cliente = leer('src/api/client.ts');
  comprobar('Cliente llama POST /push/register', cliente.includes("'/push/register'"));
  comprobar('Cliente llama POST /push/unregister', cliente.includes("'/push/unregister'"));
  comprobar('Cliente envía plataforma al backend', cliente.includes('plataforma:'));

  const app = leer('App.tsx');
  comprobar('App registra NavigationContainer ref', app.includes('createNavigationContainerRef'));
  comprobar('App escucha taps de notificación', app.includes('suscribirNotificaciones'));
  comprobar('App procesa notificación inicial', app.includes('procesarNotificacionInicial'));
  comprobar(
    'App abre CanvasViewer desde la alerta',
    app.includes("name: 'CanvasViewer'") || app.includes("navigate('CanvasViewer'")
  );
  comprobar('App no abre el lienzo sin sesión', app.includes("getItem('archai_session')"));

  const settings = leer('src/screens/SettingsScreen.tsx');
  comprobar('Ajustes activa notificaciones reales', settings.includes('activarNotificacionesPush'));
  comprobar('Ajustes desactiva notificaciones reales', settings.includes('desactivarNotificacionesPush'));
  comprobar('Ajustes no muestra diagnósticos', !settings.includes('token') || !settings.includes('archai_push_token'));

  const rooms = leer('src/screens/RoomsScreen.tsx');
  comprobar('Hub sincroniza token con el usuario', rooms.includes('sincronizarTokenPush'));
  comprobar('Hub vincula proyecto/sala', rooms.includes('vincularSalaPush'));
  comprobar('Logout desregistra el token', rooms.includes('desactivarNotificacionesPush'));

  const canvas = leer('src/screens/CanvasViewerScreen.tsx');
  comprobar('Visor vincula la sala abierta', canvas.includes('vincularSalaPush'));

  const appJson = JSON.parse(leer('app.json') || '{}');
  const plugin = (appJson.expo?.plugins || []).find((p) => Array.isArray(p) && p[0] === 'expo-notifications');
  comprobar('app.json declara expo-notifications', Boolean(plugin));
  comprobar('app.json usa canal archai-critical', Boolean(plugin && plugin[1]?.defaultChannel === 'archai-critical'));
  comprobar('Android declara POST_NOTIFICATIONS', (appJson.expo?.android?.permissions || []).includes('POST_NOTIFICATIONS'));

  seccion('2. Backend Spring Boot');
  const backendJava = path.join(RAIZ_APP, 'backend', 'src', 'main', 'java', 'com', 'archai', 'modulo', 'push');
  comprobar('Existe módulo push', existe(backendJava));
  comprobar('ControladorPush existe', existe(path.join(backendJava, 'controlador', 'ControladorPush.java')));
  comprobar('ServicioNotificacionesPush existe', existe(path.join(backendJava, 'servicio', 'ServicioNotificacionesPush.java')));
  comprobar('DespachadorFcmHttpV1 existe', existe(path.join(backendJava, 'servicio', 'DespachadorFcmHttpV1.java')));
  comprobar('Entidad SuscripcionPush existe', existe(path.join(backendJava, 'entidad', 'SuscripcionPush.java')));

  const controlador = existe(path.join(backendJava, 'controlador', 'ControladorPush.java'))
    ? fs.readFileSync(path.join(backendJava, 'controlador', 'ControladorPush.java'), 'utf8')
    : '';
  comprobar('Endpoint /register', controlador.includes('"/register"'));
  comprobar('Endpoint /unregister', controlador.includes('"/unregister"'));
  comprobar('Endpoint /alertas', controlador.includes('"/alertas"'));

  const fcm = existe(path.join(backendJava, 'servicio', 'DespachadorFcmHttpV1.java'))
    ? fs.readFileSync(path.join(backendJava, 'servicio', 'DespachadorFcmHttpV1.java'), 'utf8')
    : '';
  comprobar('FCM HTTP v1 configurado', fcm.includes('messages:send'));
  comprobar('FCM firma OAuth2 RS256', fcm.includes('SHA256withRSA'));
  comprobar('FCM lee credenciales de Firebase', fcm.includes('ARCHAI_PUSH_FCM_CREDENCIALES'));

  const migracion = path.join(RAIZ_APP, 'backend', 'src', 'main', 'resources', 'db', 'migration', 'V3__CU23_suscripciones_push.sql');
  comprobar('Migración V3 de suscripciones push', existe(migracion));

  const properties = path.join(RAIZ_APP, 'backend', 'src', 'main', 'resources', 'application.properties');
  const props = existe(properties) ? fs.readFileSync(properties, 'utf8') : '';
  comprobar('application.properties declara FCM', props.includes('archai.push.fcm.credenciales'));
  comprobar('application.properties declara Expo', props.includes('archai.push.expo.url'));
}

async function peticion(metodo, ruta, cuerpo) {
  const respuesta = await fetch(`${BACKEND}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await respuesta.text();
  let json = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = null;
  }
  return { status: respuesta.status, json, texto };
}

async function verificarBackendEnVivo() {
  seccion(`3. Backend en vivo (${BACKEND})`);

  const token = `verify-fcm-${Date.now()}`;
  const usuarioId = `verify-user-${Date.now()}`;

  let disponible = false;
  try {
    const estadoInicial = await peticion('GET', '/push/estado');
    disponible = estadoInicial.status === 200 && Boolean(estadoInicial.json);
  } catch {
    disponible = false;
  }

  if (!disponible) {
    console.log('  [INFO] Backend no disponible o sin CU-23; se omiten las pruebas en vivo.');
    console.log('         Arranca el backend con `mvn spring-boot:run` y vuelve a ejecutar.');
    return;
  }

  const registro = await peticion('POST', '/push/register', {
    token,
    usuarioId,
    salaId: 'ARC-VERIFY',
    proyectoId: 'PRJ-VERIFY',
    plataforma: 'mobile-react-native',
    dispositivo: 'verify-push-script',
  });
  comprobar('POST /push/register responde 200', registro.status === 200, `status=${registro.status}`);
  comprobar('Registro confirma ok=true', registro.json?.ok === true);

  const estado = await peticion('GET', `/push/estado?usuarioId=${encodeURIComponent(usuarioId)}`);
  comprobar('GET /push/estado cuenta la suscripción', (estado.json?.activas || 0) >= 1, `activas=${estado.json?.activas}`);

  const alerta = await peticion('POST', '/push/alertas', {
    titulo: 'Verificación CU-23',
    cuerpo: 'Prueba automatizada del flujo de alertas push.',
    tipo: 'CAMBIO_CRITICO',
    usuarioIds: [usuarioId],
  });
  comprobar('POST /push/alertas responde 200', alerta.status === 200, `status=${alerta.status}`);
  comprobar('La alerta encuentra al dispositivo', (alerta.json?.total || 0) >= 1, `total=${alerta.json?.total}`);
  const procesados = (alerta.json?.enviados || 0) + (alerta.json?.fallidos || 0) + (alerta.json?.omitidos || 0);
  comprobar('La alerta se procesa por completo', procesados === (alerta.json?.total || 0), `procesados=${procesados}`);
  comprobar('El canal FCM reporta su estado', typeof alerta.json?.fcmConfigurado === 'boolean');

  const baja = await peticion('POST', '/push/unregister', { token });
  comprobar('POST /push/unregister responde 200', baja.status === 200, `status=${baja.status}`);

  const estadoFinal = await peticion('GET', `/push/estado?usuarioId=${encodeURIComponent(usuarioId)}`);
  comprobar('La baja deja 0 suscripciones activas', (estadoFinal.json?.activas || 0) === 0, `activas=${estadoFinal.json?.activas}`);
}

(async () => {
  console.log('CU-23 — Verificación de Alertas Push (móvil)\n');
  verificarFuentes();
  await verificarBackendEnVivo();

  console.log(`\nResultado: ${aprobadas} aprobadas, ${fallidas} fallidas.`);
  if (fallos.length > 0) {
    console.log('\nFallos:');
    fallos.forEach((fallo) => console.log(`  - ${fallo}`));
    process.exit(1);
  }
})().catch((error) => {
  console.error('\nError inesperado en la verificación:', error);
  process.exit(1);
});
