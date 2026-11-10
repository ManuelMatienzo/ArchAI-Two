/**
 * Verificación del flujo REAL de entrada a una sala desde el móvil.
 *
 * Reproduce, con el CÓDIGO REAL de `src/api/roomsApi.ts`, exactamente la misma
 * secuencia de llamadas que ejecuta `CanvasViewerScreen` al abrir una sala:
 *
 *   1. GET /colaboracion/salas                     → lista de PINs
 *   2. GET /colaboracion/salas/{pin}               → InfoSesionDto (participantes)
 *   3. GET /colaboracion/salas/{pin}/diagrama      → diagrama vivo en memoria
 *   4. GET /diagramas                              → respaldo persistido
 *   5. parseBackendDiagram + normalizeDiagramCoordinates + computeDiagramRelationships
 *
 * Uso:
 *   node scripts/verify-room-entry.js
 *   node scripts/verify-room-entry.js ARC-920154
 *
 * Exit code 0 = el flujo completo produce datos renderizables sin NaN.
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function loadTsModule(relPath, stubs = {}) {
  const filename = path.resolve(__dirname, '..', relPath);
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  });

  const module = { exports: {} };
  const localRequire = (spec) => {
    if (Object.prototype.hasOwnProperty.call(stubs, spec)) return stubs[spec];
    throw new Error(`Módulo no esperado en ${relPath}: ${spec}`);
  };

  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', outputText);
  fn(module.exports, localRequire, module, filename, path.dirname(filename));
  return module.exports;
}

const sanitizer = loadTsModule('src/utils/diagramSanitizer.ts');
const geometry = loadTsModule('src/utils/diagramGeometry.ts');
const rooms = loadTsModule('src/api/roomsApi.ts', {
  './client': { apiFetch: async () => { throw new Error('apiFetch no disponible'); } },
  '../types/uml': {},
});

const API = process.env.ARCHAI_API_URL || 'http://localhost:8000/api/v1';
let checks = 0;
let failures = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  ✗ ${message}`);
  }
}

const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n);

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

/** Misma lógica que roomsApi.getRoomDiagram, pero sin el cliente React Native. */
async function resolveRoomDiagram(pin, projectId) {
  const trace = [];

  if (projectId) {
    const diagrams = await getJson(`${API}/diagramas?proyectoId=${encodeURIComponent(projectId)}`);
    trace.push(`proyecto ${projectId}: ${Array.isArray(diagrams) ? diagrams.length : 0} diagramas`);
    const target = Array.isArray(diagrams)
      ? diagrams.find((d) => d.classes && d.classes.length > 0) || diagrams[0]
      : null;
    if (target && Array.isArray(target.classes) && target.classes.length > 0) {
      return { source: 'proyecto', dto: target, trace };
    }
  }

  const roomDiagram = await getJson(`${API}/colaboracion/salas/${encodeURIComponent(pin)}/diagrama`);
  trace.push(`sala/${pin}/diagrama: ${roomDiagram?.classes?.length ?? 0} clases`);
  if (roomDiagram && Array.isArray(roomDiagram.classes) && roomDiagram.classes.length > 0) {
    return { source: 'sala-en-memoria', dto: roomDiagram, trace };
  }

  const all = await getJson(`${API}/diagramas`);
  trace.push(`/diagramas (respaldo): ${Array.isArray(all) ? all.length : 0}`);
  const populated = Array.isArray(all)
    ? all.find((d) => d.classes && d.classes.length > 0) || all[0]
    : null;
  if (populated && Array.isArray(populated.classes) && populated.classes.length > 0) {
    return { source: 'respaldo-global', dto: populated, trace };
  }

  return { source: 'vacio', dto: null, trace };
}

function validateRenderable(label, dto) {
  if (!dto) {
    console.log(`   · ${label} → sin diagrama (se muestra estado vacío)`);
    return;
  }

  let parsed;
  try {
    parsed = rooms.parseBackendDiagram(dto);
  } catch (err) {
    check(false, `${label}: parseBackendDiagram lanzó ${err.message}`);
    return;
  }

  check(Array.isArray(parsed.classes), `${label}: classes no es array`);
  check(Array.isArray(parsed.relationships), `${label}: relationships no es array`);

  for (const c of parsed.classes) {
    check(
      isFiniteNum(c.x) && isFiniteNum(c.y) && isFiniteNum(c.width) && isFiniteNum(c.height),
      `${label}: clase ${c.id} con coordenadas no finitas`
    );
    check(
      Array.isArray(c.attributes) && Array.isArray(c.methods),
      `${label}: clase ${c.id} sin arrays attributes/methods`
    );
  }

  const { classes, offsetX, offsetY } = sanitizer.normalizeDiagramCoordinates(parsed.classes);
  check(isFiniteNum(offsetX) && isFiniteNum(offsetY), `${label}: offset no finito`);

  let paths = [];
  try {
    paths = geometry.computeDiagramRelationships(classes, parsed.relationships);
  } catch (err) {
    check(false, `${label}: computeDiagramRelationships lanzó ${err.message}`);
    return;
  }

  for (const p of paths) {
    check(
      typeof p.pathD === 'string' && !p.pathD.includes('NaN') && !p.pathD.includes('Infinity'),
      `${label}: pathD inválido`
    );
  }

  // Geometría del auto-fit: debe ser finita para no romper el transform animado.
  if (classes.length > 0) {
    const maxX = Math.max(...classes.map((c) => c.x + (c.width || 195)));
    const maxY = Math.max(...classes.map((c) => c.y + geometry.getEstimatedClassHeight(c)));
    check(isFiniteNum(maxX) && isFiniteNum(maxY), `${label}: caja envolvente no finita`);
  }

  console.log(
    `   · ${label} → ${parsed.classes.length} clases, ${parsed.relationships.length} relaciones, ${paths.length} curvas`
  );
}

async function run() {
  console.log('ArchAI · Verificación del flujo de entrada a sala\n');
  console.log(`Backend: ${API}\n`);

  let pins = [];
  const argPin = process.argv[2];
  try {
    const listed = await getJson(`${API}/colaboracion/salas`);
    check(Array.isArray(listed), 'GET /colaboracion/salas no devolvió un array');
    pins = Array.isArray(listed) ? listed : [];
    console.log(`1) Salas activas: ${pins.length}${pins.length ? ` → ${pins.join(', ')}` : ''}`);
  } catch (err) {
    console.error(`   ✗ No se pudo listar salas: ${err.message}`);
    failures += 1;
  }

  if (argPin) pins = [argPin];
  if (pins.length === 0) {
    console.log('   (no hay salas; pasa un PIN como argumento para probar una concreta)');
  }

  for (const pin of pins) {
    console.log(`\n2) Sala ${pin}`);

    // Detalle de sesión: aquí se rompía el render si participants no era array.
    try {
      const info = await getJson(`${API}/colaboracion/salas/${encodeURIComponent(pin)}`);
      check(!!info && typeof info === 'object', `${pin}: InfoSesionDto inválido`);
      check(
        info.participants === undefined || Array.isArray(info.participants),
        `${pin}: participants no es array`
      );
      check(typeof info.roomName === 'string', `${pin}: roomName no es string`);
      console.log(
        `   · detalle → roomName="${info.roomName}", participantes=${Array.isArray(info.participants) ? info.participants.length : 'n/d'}`
      );
    } catch (err) {
      check(false, `${pin}: GET detalle falló (${err.message})`);
    }

    try {
      const { source, dto, trace } = await resolveRoomDiagram(pin);
      trace.forEach((t) => console.log(`   · ${t}`));
      console.log(`   · origen del diagrama: ${source}`);
      validateRenderable(pin, dto);
    } catch (err) {
      check(false, `${pin}: resolución del diagrama falló (${err.message})`);
    }
  }

  // Proyectos del usuario (pestaña "Mis Proyectos" del hub móvil)
  console.log('\n3) Proyectos del usuario usr-admin-01');
  try {
    const projects = await getJson(`${API}/proyectos?usuarioId=usr-admin-01`);
    check(Array.isArray(projects), 'GET /proyectos no devolvió un array');
    console.log(`   · ${Array.isArray(projects) ? projects.length : 0} proyecto(s)`);
    for (const p of Array.isArray(projects) ? projects : []) {
      check(typeof p.id === 'string' && p.id.length > 0, `proyecto sin id (${p.nombre})`);
      check(Array.isArray(p.miembros ?? []), `proyecto ${p.nombre}: miembros no es array`);
    }
  } catch (err) {
    check(false, `GET /proyectos falló (${err.message})`);
  }

  console.log(`\nResultado: ${checks} comprobaciones, ${failures} fallo(s).`);
  if (failures > 0) {
    console.error('✗ El flujo de entrada a sala puede romper el lienzo.');
    process.exit(1);
  }
  console.log('✓ El flujo de entrada a sala produce datos renderizables.');
}

run().catch((err) => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
