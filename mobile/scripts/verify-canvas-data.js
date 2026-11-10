/**
 * Verificación del pipeline de datos del lienzo móvil.
 *
 * Ejecuta el CÓDIGO REAL de:
 *   - src/api/roomsApi.ts        → parseBackendDiagram
 *   - src/utils/diagramSanitizer.ts → normalizeDiagramCoordinates / normalizeGhostDraft
 *   - src/utils/diagramGeometry.ts  → computeDiagramRelationships
 *
 * No necesita emulador ni React Native: transpila los módulos TypeScript y los
 * ejecuta en Node con un stub del cliente HTTP.
 *
 * Uso:
 *   node scripts/verify-canvas-data.js
 *
 * Salida: exit code 0 si todo es seguro; 1 si encuentra NaN, arrays nulos o excepciones.
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
  './client': {
    apiFetch: async () => {
      throw new Error('apiFetch no disponible en la prueba pura');
    },
  },
  '../types/uml': {},
});

const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n);
let failures = 0;
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  ✗ ${message}`);
  }
}

function assertDiagramSafe(label, parsed) {
  const { classes, relationships } = parsed;
  check(Array.isArray(classes), `${label}: classes no es array`);
  check(Array.isArray(relationships), `${label}: relationships no es array`);

  for (const c of classes) {
    check(
      isFiniteNum(c.x) && isFiniteNum(c.y) && isFiniteNum(c.width) && isFiniteNum(c.height),
      `${label}: clase ${c.id} con coordenadas no finitas (${c.x}, ${c.y}, ${c.width}, ${c.height})`
    );
    check(
      Array.isArray(c.attributes) && Array.isArray(c.methods),
      `${label}: clase ${c.id} sin arrays de attributes/methods`
    );
  }

  const { classes: norm, offsetX, offsetY } = sanitizer.normalizeDiagramCoordinates(classes);
  check(isFiniteNum(offsetX) && isFiniteNum(offsetY), `${label}: offset no finito`);

  for (const c of norm) {
    check(isFiniteNum(c.x) && isFiniteNum(c.y), `${label}: clase normalizada ${c.id} no finita`);
  }

  let paths = [];
  try {
    paths = geometry.computeDiagramRelationships(norm, relationships);
  } catch (err) {
    check(false, `${label}: computeDiagramRelationships lanzó ${err.message}`);
    return 0;
  }

  for (const p of paths) {
    check(
      typeof p.pathD === 'string' && !p.pathD.includes('NaN') && !p.pathD.includes('Infinity'),
      `${label}: pathD inválido (${p.pathD})`
    );
    for (const key of ['startX', 'startY', 'endX', 'endY', 'c1X', 'c1Y', 'c2X', 'c2Y', 'midX', 'midY', 'angle']) {
      check(isFiniteNum(p[key]), `${label}: ${p.id}.${key} no finito`);
    }
  }

  return paths.length;
}

function parseSafely(label, dto) {
  try {
    return rooms.parseBackendDiagram(dto);
  } catch (err) {
    check(false, `${label}: parseBackendDiagram lanzó ${err.message}`);
    return { classes: [], relationships: [] };
  }
}

async function fetchJson(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  console.log('ArchAI · Verificación de datos del lienzo móvil\n');

  // 1) Payloads reales del backend
  const backendUrl = process.env.ARCHAI_API_URL || 'http://localhost:8000/api/v1';
  console.log(`1) Backend real: ${backendUrl}`);
  let liveDiagrams = [];
  try {
    liveDiagrams = await fetchJson(`${backendUrl}/diagramas`);
    check(Array.isArray(liveDiagrams), 'la respuesta de /diagramas no es un array');
    console.log(`   Diagramas recibidos: ${liveDiagrams.length}`);
  } catch (err) {
    console.log(`   ⚠ Backend no disponible (${err.message}). Se omiten los payloads reales.`);
  }

  for (const dto of liveDiagrams) {
    const parsed = parseSafely(`live:${dto.id}`, dto);
    const pathCount = assertDiagramSafe(`live:${dto.id}`, parsed);
    console.log(`   · ${dto.id} → ${parsed.classes.length} clases, ${parsed.relationships.length} relaciones, ${pathCount} curvas`);
  }

  // 2) Payloads corruptos / incompletos (los que antes podían romper SVG)
  console.log('\n2) Payloads corruptos');
  const malformed = [
    ['nulo', null],
    ['vacío', {}],
    ['clases null', { classes: null, relations: null }],
    ['clase null', { classes: [null], relations: [] }],
    ['coordenadas string/null', { classes: [{ id: 'a', name: 'A', position: { x: 'oops', y: null } }], relations: [] }],
    ['coordenadas NaN/Infinity', { classes: [{ id: 'a', name: 'A', x: NaN, y: Infinity, width: Infinity, height: -Infinity }], relations: [] }],
    ['attributes no-array', { classes: [{ id: 'a', name: 'A', x: 10, y: 10, attributes: 'nope', methods: null }], relations: [] }],
    [
      'relación huérfana y sin target',
      {
        classes: [{ id: 'a', name: 'A', x: 10, y: 10 }],
        relations: [
          { id: 'r1', sourceClassId: 'a', targetClassId: 'fantasma' },
          { id: 'r2', sourceClassId: 'a' },
          { id: 'r3', sourceClassId: 'a', targetClassId: 'a' },
        ],
      },
    ],
  ];

  for (const [label, dto] of malformed) {
    const parsed = parseSafely(label, dto);
    const pathCount = assertDiagramSafe(label, parsed);
    console.log(`   · ${label} → ${parsed.classes.length} clases, ${parsed.relationships.length} relaciones, ${pathCount} curvas`);
  }

  // 3) Propuestas Ghost Draft sin arrays
  console.log('\n3) Ghost Draft');
  const ghostCases = [
    ['null', null],
    ['sin classes', { title: 'x' }],
    ['classes undefined', { classes: undefined, relationships: undefined }],
    ['clase con NaN', { classes: [{ id: 'g', name: 'G', x: NaN, y: 'x' }], relationships: [] }],
  ];
  for (const [label, proposal] of ghostCases) {
    let result;
    try {
      result = sanitizer.normalizeGhostDraft(proposal);
    } catch (err) {
      check(false, `ghost ${label}: lanzó ${err.message}`);
      continue;
    }
    if (result !== null) {
      check(Array.isArray(result.classes), `ghost ${label}: classes no es array`);
      check(Array.isArray(result.relationships), `ghost ${label}: relationships no es array`);
      for (const c of result.classes) {
        check(isFiniteNum(c.x) && isFiniteNum(c.y), `ghost ${label}: clase ${c.id} no finita`);
      }
    }
    console.log(`   · ${label} → ${result === null ? 'null (no se renderiza)' : `${result.classes.length} clases`}`);
  }

  // 4) Coordenadas negativas → normalización a espacio positivo
  console.log('\n4) Normalización de cuadrantes negativos');
  const negative = sanitizer.normalizeDiagramCoordinates([
    { id: 'n1', name: 'N1', x: -500, y: -300, width: 190, height: 175, attributes: [], methods: [] },
  ]);
  check(negative.offsetX === 560, `offsetX esperado 560, recibido ${negative.offsetX}`);
  check(negative.offsetY === 380, `offsetY esperado 380, recibido ${negative.offsetY}`);
  check(negative.classes[0].x === 60 && negative.classes[0].y === 80, 'la clase no quedó en (60, 80)');
  console.log(`   · offset=(${negative.offsetX}, ${negative.offsetY}) → (${negative.classes[0].x}, ${negative.classes[0].y})`);

  // Resumen
  console.log(`\nResultado: ${checks} comprobaciones, ${failures} fallo(s).`);
  if (failures > 0) {
    console.error('✗ Se encontraron datos que podrían romper el lienzo.');
    process.exit(1);
  }
  console.log('✓ Todos los payloads son seguros para el lienzo (sin NaN ni arrays nulos).');
}

run().catch((err) => {
  console.error('Error inesperado en la verificación:', err);
  process.exit(1);
});
