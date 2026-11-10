import { ClaseUml, RelacionUml, AtributoUml, MetodoUml, TipoRelacion, ModeloDiagrama } from '../types/uml';
import { normalizeType, capitalize } from './aiVoiceParser';
import { inferirTablaIntermedia, inferirDireccionMaestroTransaccion, CATALOGO_DOMINIOS, sanitizarDiagramaUML25, esClaseAsociativaUniversal } from './semanticDomainEngine';
import { geminiDisponible, generarContenidoGemini, MODELO_GEMINI, ultimoProveedorIa } from './geminiService';

/**
 * ─────────────────────────────────────────────────────────────
 * AGENTE DE DIAGRAMAS UML (Fase 1 — JSON estructurado con Ollama)
 * ─────────────────────────────────────────────────────────────
 * Convierte a Ollama local en un "agente que dibuja":
 *  - generarDiagramaConAgente: crea un diagrama completo desde texto.
 *  - modificarDiagramaConAgente: lee el diagrama ACTUAL del lienzo
 *    y lo modifica/mejora según el pedido del usuario.
 *
 * Usa `format: 'json'` de Ollama para forzar salida JSON parseable
 * y un validador/normalizador con fallback para tolerar errores.
 */

export interface DiagramaGenerado {
  className?: string;
  classes: ClaseUml[];
  relations: RelacionUml[];
}

export interface ResultadoAgente {
  success: boolean;
  diagrama?: DiagramaGenerado;
  error?: string;
  fuente: 'gemini' | 'claude' | 'ollama' | 'error';
  model?: string;
}

interface RespuestaOllama {
  diagrama: DiagramaGenerado;
  model: string;
  provider?:string;
}

/** Tipos permitidos en la generación */
const TIPOS_JSON = 'Long, String, Integer, Double, Boolean, LocalDate, LocalDateTime, BigDecimal';
const TIPOS_RELACION = ['ASSOCIATION_1_1', 'ASSOCIATION_1_N', 'ASSOCIATION_N_M', 'ASSOCIATION_CLASS', 'COMPOSITION', 'AGGREGATION', 'INHERITANCE', 'REALIZATION', 'DEPENDENCY'];

/** Ejemplo que el modelo debe imitar (le da el formato exacto del esquema) */
const EJEMPLO_RESPUESTA = `{
  "className": "SistemaVentas",
  "classes": [
    {
      "name": "Vendedor",
      "stereotype": "Entity",
      "attributes": [
        { "name": "id", "type": "Long" },
        { "name": "nombre", "type": "String" }
      ],
      "methods": [
        { "name": "registrarVenta", "returnType": "void", "parameters": "" }
      ]
    },
    {
      "name": "Cliente",
      "stereotype": "Entity",
      "attributes": [
        { "name": "id", "type": "Long" },
        { "name": "nombre", "type": "String" },
        { "name": "email", "type": "String" }
      ],
      "methods": [
        { "name": "consultarCompras", "returnType": "void", "parameters": "" }
      ]
    },
    {
      "name": "Venta",
      "stereotype": "Entity",
      "attributes": [
        { "name": "id", "type": "Long" },
        { "name": "fecha", "type": "LocalDate" }
      ],
      "methods": [
        { "name": "calcularTotal", "returnType": "Double", "parameters": "" }
      ]
    },
    {
      "name": "Detalle",
      "stereotype": "AssociationClass",
      "attributes": [
        { "name": "cantidad", "type": "Integer" },
        { "name": "precioUni", "type": "Double" }
      ],
      "methods": []
    },
    {
      "name": "Producto",
      "stereotype": "Entity",
      "attributes": [
        { "name": "id", "type": "Long" },
        { "name": "nombre", "type": "String" },
        { "name": "precio", "type": "Double" },
        { "name": "stock", "type": "Integer" }
      ],
      "methods": [
        { "name": "actualizarStock", "returnType": "Boolean", "parameters": "Integer cantidad" }
      ]
    }
  ],
  "relations": [
    { "sourceName": "Vendedor", "targetName": "Venta", "type": "ASSOCIATION_1_N", "label": "realiza" },
    { "sourceName": "Cliente", "targetName": "Venta", "type": "ASSOCIATION_1_N", "label": "compra" },
    { "sourceName": "Venta", "targetName": "Producto", "type": "ASSOCIATION_N_M", "label": "incluye", "associationClassName": "Detalle" }
  ]
}`;

/** ── Prompt de GENERACIÓN (lienzo vacío o nuevo dominio) ── */
function construirSystemPrompt(contextoUml: string): string {
  return `Eres un ARQUITECTO DE SOFTWARE EXPERTO en UML y diseño de bases de datos relacionales (3FN). Tu tarea es transformar la descripción de negocio del usuario en un diagrama de clases UML 2.5 riguroso, normalizado y coherente.

REGLAS OBLIGATORIAS:
1. Responde ÚNICAMENTE con un JSON válido. NADA de explicaciones, texto suelto o bloques markdown. Solo el JSON.
2. Esquema exacto del JSON:
{
  "className": "NombreDelSistema",
  "classes": [
    {
      "name": "NombreClase",
      "stereotype": "Entity",
      "attributes": [{ "name": "atributo", "type": "Tipo" }],
      "methods": [{ "name": "metodo", "returnType": "Tipo", "parameters": "String x" }]
    }
  ],
  "relations": [
    { "sourceName": "ClaseOrigen", "targetName": "ClaseDestino", "type": "TIPO_RELACION", "label": "verbo" }
  ]
}
3. Tipos de atributo permitidos: ${TIPOS_JSON}.
4. Tipos de relación permitidos: ${TIPOS_RELACION.join(', ')}.
5. Define entre 3 y 8 clases relevantes al dominio del usuario. Analiza sujetos, verbos y objetos del texto.
6. Estereotipo: usa "Entity" por defecto, "AssociationClass" para tablas/clases intermedias, o "Controller"/"Service"/"Repository" solo si el texto lo requiere.
7. Cada clase debe empezar por el atributo "id" de tipo Long (clave primaria), EXCEPTO las clases con stereotype "AssociationClass" (como Detalle) que representan clases asociativas cuya identidad proviene de la relación N:M y llevan únicamente sus atributos propios (ej. cantidad, precioUni), SIN ningún campo "id".
8. Methods puede quedar vacío si el dominio es muy simple, pero intenta poner al menos 1 método de negocio por clase.
9. Relations deben referenciar las clases por su nombre EXACTO (mismo nombre en classes).
10. REGLA OBLIGATORIA DE MUCHOS A MUCHOS (N:M) CON CLASE ASOCIATIVA (UML 2.5):
    - En diseño de software relacional y UML 2.5, una relación de muchos a muchos con atributos propios de la transacción (ej. Venta y Producto con cantidad y precioUni; Estudiante y Curso con notaFinal y semestre; Medico y Paciente con fechaHora y diagnostico; etc.) se modela rigurosamente con una CLASE ASOCIATIVA (Association Class).
    - Para representarla:
      a) Modela la relación directa entre las dos entidades maestras con type: "ASSOCIATION_N_M" (cardinalidades "*" y "1..*") e incluye el campo "associationClassName": "Detalle".
      b) Define la clase intermedia con stereotype: "AssociationClass" (ej. "Detalle") con sus atributos de negocio específicos (ej. cantidad, precioUni) SIN atributo "id". El lienzo de ArchAI renderizará automáticamente la línea sólida de asociación y la línea discontinua perpendicular reglamentaria que desciende hacia la Clase Asociativa.
      c) PROHIBIDO GENERAR RELACIONES DIRECTAS entre las entidades maestras y la clase asociativa (por ejemplo, NUNCA agregues Venta -> Detalle ni Producto -> Detalle). La única conexión permitida es la relación N:M entre las dos entidades maestras vinculada por associationClassName.
11. REGLA DE DIRECCIÓN Y CARDINALIDAD (1 a N):
    - La entidad catálogo/maestro/padre (ej. Cliente, Medico, Estudiante, Producto, Usuario) SIEMPRE es el origen (sourceName) con cardinalidad 1.
    - La entidad dependiente, evento o transacción (ej. Venta, Cita, Inscripcion, Detalle) SIEMPRE es el destino (targetName) con cardinalidad * (0..* o 1..*).
    - NUNCA inviertas la dirección: un Cliente tiene muchas Ventas, NO una Venta tiene muchos Clientes.
12. REGLA DE HERENCIA Y GENERALIZACIÓN («abstract»):
    - Si el dominio involucra tipos especializados (ej. Persona base de Cliente y Empleado; Cuenta base de Ahorro y Corriente), crea la superclase con "stereotype": "Abstract" y atributos comunes, y conecta las subclases con type: "INHERITANCE" (la subclase es sourceName y la superclase es targetName con label: "extiende").
13. REGLA DE INTERFACES Y CONTRATOS («interface»):
    - Si se especifican contratos de servicio o repositorios, usa "stereotype": "Interface" con métodos abstractos, y conéctala a la clase implementadora con type: "REALIZATION" (la clase concreta es sourceName y la interfaz es targetName con label: "implementa").
14. REGLA DE RELACIONES RECURSIVAS / JERARQUÍAS:
    - Si una entidad tiene jerarquía consigo misma (ej. Empleado jefe de Empleado, Categoria padre de Categoria), usa una relación 1 a N auto-referencial (sourceName y targetName son la MISMA clase) con label: "reporta a" o "subcategoria".

${contextoUml ? `Contexto del modelo UML actual en el lienzo: ${contextoUml}` : ''}
Ejemplo del formato exacto que debes devolver:
${EJEMPLO_RESPUESTA}`;
}

/** ── Serializa el diagrama actual del lienzo a texto compacto (para que el agente lo lea) ── */
export function serializarModeloUML(diagrama: ModeloDiagrama | undefined | null): string {
  if (!diagrama) return '(lienzo vacío)';

  const bloquesClases = (diagrama.classes || []).map(c => {
    const attrs = (c.attributes || [])
      .map(a => `${a.name}:${a.type}${a.isPrimaryKey ? '(PK)' : ''}${a.isNullable === false ? '' : ''}`)
      .join(', ') || '—';
    const mets = (c.methods || [])
      .map(m => `${m.name}(${m.parameters || ''}):${m.returnType}${m.isAbstract ? ' {abstract}' : ''}`)
      .join(', ') || '—';
    return `CLASE "${c.name}" [${c.stereotype || 'Entity'}] -> atributos: ${attrs} | métodos: ${mets}`;
  });

  const rels = (diagrama.relations || []).map(r => {
    const src = diagrama.classes.find(c => c.id === r.sourceClassId)?.name || r.sourceClassId;
    const tgt = diagrama.classes.find(c => c.id === r.targetClassId)?.name || r.targetClassId;
    const assoc = r.associationClassId ? diagrama.classes.find(c => c.id === r.associationClassId)?.name : undefined;
    const assocStr = assoc ? ` [Clase Asociativa en T: "${assoc}"]` : '';
    return `RELACIÓN "${src}" -> "${tgt}" (${r.type}) ${r.label ? `etiqueta: "${r.label}"` : ''}${assocStr}`;
  });

  return [
    `TÍTULO DEL DIAGRAMA: "${diagrama.title || 'Sin título'}"`,
    ...bloquesClases,
    ...(rels.length ? rels : ['(sin relaciones)'])
  ].join('\n');
}

/** ── Prompt de MODIFICACIÓN (el agente lee el diagrama actual y lo cambia) ── */
function construirSystemPromptModificar(serializado: string): string {
  return `Eres un ARQUITECTO DE SOFTWARE EXPERTO en UML que trabaja sobre un diagrama de clases EXISTENTE dibujado por el usuario.

El diagrama ACTUAL que está en el lienzo es este:

${serializado}

El usuario te va a pedir MODIFICAR, MEJORAR o CORREGIR ese diagrama (agregar clases, atributos, métodos o relaciones; cambiar tipos; renombrar; eliminar algo, etc.). Debes analizar su pedido y devolver el diagrama COMPLETO RESULTANTE.

REGLAS OBLIGATORIAS:
1. Responde ÚNICAMENTE con un JSON válido, sin markdown ni texto extra.
2. Esquema del JSON de salida:
{
  "classes": [
    { "name": "NombreClase", "stereotype": "Entity", "attributes": [{ "name": "a", "type": "Tipo" }], "methods": [{ "name": "m", "returnType": "Tipo", "parameters": "" }] }
  ],
  "relations": [
    { "sourceName": "A", "targetName": "B", "type": "TIPO_RELACION", "label": "verbo" }
  ]
}
3. CONSERVA en la salida TODAS las clases del diagrama actual que NO cambian, con su MISMO nombre exacto. Solo omite una clase si el usuario pide eliminarla explícitamente.
4. Aplica el cambio pedido: nuevas clases/atributos si se solicitan, y ajusta las relaciones afectadas.
5. REGLA OBLIGATORIA DE MUCHOS A MUCHOS (N:M) CON CLASE ASOCIATIVA (UML 2.5):
   Si existe o se pide una relación de muchos a muchos con atributos (ej. Venta-Producto -> Detalle con cantidad y precio; Estudiante-Curso -> Inscripcion con notaFinal y semestre; Huesped-Habitacion -> Reserva, etc.):
   a) Modela la relación maestra N:M con "type": "ASSOCIATION_N_M" e incluye "associationClassName": "<NombreClaseAsociativa>".
   b) Define la clase intermedia con "stereotype": "AssociationClass" con sus atributos específicos y SIN atributo "id".
   c) PROHIBIDO crear relaciones binarias directas entre las entidades maestras y la clase asociativa. La clase asociativa se conecta ÚNICAMENTE mediante el trazo punteado perpendicular en T.
6. REGLA DE CARDINALIDAD: La entidad maestra/padre es sourceName (1), y la transaccional/hija es targetName (*).
7. REGLA DE HERENCIA Y GENERALIZACIÓN: Superclases usan "stereotype": "Abstract" y las subclases se conectan con type: "INHERITANCE" apuntando de subclase (origen) a superclase (destino).
8. REGLA DE INTERFACES: Contratos usan "stereotype": "Interface" y se implementan con type: "REALIZATION".
9. REGLA DE RELACIONES RECURSIVAS: Entidades jerárquicas usan una relación 1 a N donde sourceName y targetName son la misma clase.
10. Tipos de atributo permitidos: ${TIPOS_JSON}.
11. Tipos de relación permitidos: ${TIPOS_RELACION.join(', ')}.
12. Cada clase estándar conserva su atributo "id" de tipo Long (PK), EXCEPTO las clases con stereotype "AssociationClass", las cuales NO llevan atributo "id".
13. Normaliza 3FN y usa nombres en el idioma del usuario (español).`;
}

/** Extrae/limpia el JSON de la respuesta del modelo (tolerante a fences y texto suelto). */
export function extraerJSON(texto: string): string | null {
  if (!texto) return null;
  const t = texto.trim();

  // 1. Si ya es JSON directo
  try {
    JSON.parse(t);
    return t;
  } catch {
    /* continuar */
  }

  // 2. Quitar llaves de bloques markdown ```json ... ```
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    const inner = fenced[1].trim();
    try {
      JSON.parse(inner);
      return inner;
    } catch {
      /* continuar */
    }
  }

  // 3. Extraer el primer '{' hasta el último '}'
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last > first) {
    const candidate = t.slice(first, last + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      return null;
    }
  }

  return null;
}

/** Normaliza un nombre de clase para que sea un identificador válido. */
function sanitizarNombre(raw: string): string {
  return capitalize(raw.replace(/[^a-zA-Z0-9ÁÉÍÓÚáéíóúÑñ_]/g, '')).slice(0, 40);
}

function detectarTipoRelacion(raw: string): TipoRelacion {
  if (!raw) return 'ASSOCIATION_1_N';
  const cleanUpper = raw.trim().toUpperCase();
  if (TIPOS_RELACION.includes(cleanUpper)) {
    return cleanUpper as TipoRelacion;
  }
  const r = (raw || '').toLowerCase().replace(/[\s_-]+/g, ' ');
  if (r.includes('composicion') || r.includes('composition') || r.includes('compone') || r.includes('parte de')) return 'COMPOSITION';
  if (r.includes('agregacion') || r.includes('aggregation') || r.includes('agrega') || r.includes('tiene')) return 'AGGREGATION';
  if (r.includes('herencia') || r.includes('inheritance') || r.includes('extiende') || r.includes('extends') || r.includes('subclase') || r.includes('generalizacion') || r.includes('generalization')) return 'INHERITANCE';
  if (r.includes('realizacion') || r.includes('realization') || r.includes('implementa') || r.includes('interfaz') || r.includes('interface')) return 'REALIZATION';
  if (r.includes('dependencia') || r.includes('dependency') || r.includes('usa') || r.includes('utiliza')) return 'DEPENDENCY';
  if (r.includes('1 a 1') || r.includes('1:1') || r.includes('1 1') || r.includes('uno a uno') || r.includes('one to one') || r.includes('one-to-one')) return 'ASSOCIATION_1_1';
  if (r.includes('n a m') || r.includes('n:m') || r.includes('n m') || r.includes('m n') || r.includes('muchos a muchos') || r.includes('many to many') || r.includes('n a n') || r.includes('n n')) return 'ASSOCIATION_N_M';
  return 'ASSOCIATION_1_N';
}

export function multiplicidadesPara(tipo: TipoRelacion): { source: string; target: string } {
  switch (tipo) {
    case 'ASSOCIATION_1_1': return { source: '1', target: '1' };
    case 'ASSOCIATION_N_M': return { source: '0..*', target: '0..*' };
    case 'COMPOSITION': return { source: '1', target: '1..*' };
    case 'INHERITANCE':
    case 'REALIZATION':
    case 'DEPENDENCY': return { source: '1', target: '1' };
    case 'AGGREGATION':
    default: return { source: '1', target: '0..*' };
  }
}

/** Valida y normaliza el JSON del modelo al esquema interno ClaseUml/RelacionUml. */
export function normalizarDiagrama(
  json: any,
  clasesExistentes: ClaseUml[]
): DiagramaGenerado | null {
  if (!json || typeof json !== 'object') return null;
  const rawClasses: any[] = Array.isArray(json.classes) ? json.classes : [];
  const rawRelations: any[] = Array.isArray(json.relations) ? json.relations : [];
  if (rawClasses.length === 0) return null;

  const timestamp = Date.now();
  const mapId = new Map<string, string>();
  const classes: ClaseUml[] = [];

  const cols = 3;
  const baseOffset = (clasesExistentes?.length || 0);

  rawClasses.forEach((rc, idx) => {
    const name = sanitizarNombre(String(rc?.name || 'Entidad' + idx));
    if (!name) return;

    const id = `cls-ai-${timestamp}-${idx}`;
    mapId.set(name.toLowerCase(), id);

    const rawStereo = String(rc?.stereotype || '').toLowerCase();
    const isAssociationClass = esClaseAsociativaUniversal({ id, name, stereotype: rc?.stereotype as any, attributes: [], methods: [] }, rawRelations)
      || rawStereo.includes('association')
      || rawStereo.includes('asociativa');

    // Atributos
    const attributes: AtributoUml[] = [];
    const rawAttrs: any[] = Array.isArray(rc?.attributes) ? rc.attributes : [];
    rawAttrs.forEach((ra, ai) => {
      const rawAttrName = String(ra?.name || '').trim().replace(/[^a-zA-Z0-9_]/g, '_');
      if (!rawAttrName) return;

      // Si es clase asociativa, omitir cualquier 'id' artificial
      if (isAssociationClass && rawAttrName.toLowerCase() === 'id') {
        return;
      }

      const type = normalizeType(String(ra?.type || 'String'));
      const isPk = isAssociationClass ? false : (Boolean(ra?.isPrimaryKey) || rawAttrName.toLowerCase() === 'id');
      attributes.push({
        id: `attr-ai-${timestamp}-${idx}-${ai}`,
        name: rawAttrName,
        type,
        visibility: ra?.visibility || '-',
        isPrimaryKey: isPk,
        isNullable: !isPk
      });
    });

    if (!isAssociationClass && !attributes.some(a => a.isPrimaryKey)) {
      attributes.unshift({
        id: `attr-ai-${timestamp}-${idx}-pk`,
        name: 'id',
        type: 'Long',
        visibility: '-',
        isPrimaryKey: true,
        isNullable: false
      });
    }

    // Métodos
    const methods: MetodoUml[] = [];
    const rawMethods: any[] = Array.isArray(rc?.methods) ? rc.methods : [];
    rawMethods.forEach((rm, mi) => {
      const mn = sanitizarNombre(String(rm?.name || ''));
      if (!mn) return;
      methods.push({
        id: `m-ai-${timestamp}-${idx}-${mi}`,
        name: mn,
        returnType: String(rm?.returnType || 'void'),
        visibility: '+',
        parameters: String(rm?.parameters || '')
      });
    });

    const posX = rc?.position ? Number(rc.position.x) : (120 + (idx % cols) * 340);
    const posY = rc?.position ? Number(rc.position.y) : (140 + Math.floor((baseOffset + idx) / cols) * 280);

    classes.push({
      id,
      name,
      stereotype: (isAssociationClass ? 'AssociationClass' : (String(rc?.stereotype || 'Entity') || 'Entity')) as ClaseUml['stereotype'],
      attributes,
      methods,
      position: { x: posX, y: posY }
    });
  });

  // Relaciones
  const relations: RelacionUml[] = [];
  const clavesVistas = new Set<string>();
  const assocConnections = new Map<string, Set<string>>(); // assocClassId -> Set<entityId>

  rawRelations.forEach((rr, ri) => {
    let srcName = String(rr?.sourceName || '').toLowerCase().trim();
    let tgtName = String(rr?.targetName || '').toLowerCase().trim();
    let srcId = mapId.get(srcName);
    let tgtId = mapId.get(tgtName);
    if (!srcId || !tgtId) return;

    // Jerarquía autorreferencial (ej. Empleado -> jefe, Categoria -> padre)
    if (srcId === tgtId) {
      const selfKey = `${srcId}|${tgtId}|SELF`;
      if (clavesVistas.has(selfKey)) return;
      clavesVistas.add(selfKey);
      relations.push({
        id: `rel-ai-self-${timestamp}-${ri}`,
        sourceClassId: srcId,
        targetClassId: tgtId,
        type: 'ASSOCIATION_1_N',
        sourceMultiplicity: '0..1',
        targetMultiplicity: '0..*',
        label: String(rr?.label || 'reporta a / jerarquía').slice(0, 30)
      });
      return;
    }

    const srcCls = classes.find(c => c.id === srcId);
    const tgtCls = classes.find(c => c.id === tgtId);

    // UML 2.5: Si uno de los extremos es una clase asociativa, NO crear relación binaria directa.
    // En su lugar, registrar las entidades conectadas para asegurar la relación principal en T (asociación N:M).
    const isSrcAssoc = srcCls?.stereotype === 'AssociationClass';
    const isTgtAssoc = tgtCls?.stereotype === 'AssociationClass';
    if (isSrcAssoc || isTgtAssoc) {
      const assocId = isSrcAssoc ? srcId : tgtId;
      const otherId = isSrcAssoc ? tgtId : srcId;
      if (!assocConnections.has(assocId)) assocConnections.set(assocId, new Set());
      assocConnections.get(assocId)!.add(otherId);
      return;
    }

    let tipo = detectarTipoRelacion(String(rr?.type || ''));
    const mult = multiplicidadesPara(tipo);
    const validTypes: TipoRelacion[] = TIPOS_RELACION as TipoRelacion[];
    let finalTipo: TipoRelacion = validTypes.includes(tipo) ? tipo : 'ASSOCIATION_1_N';

    // 1. REGLA OBLIGATORIA N:M (UML 2.5 / 3FN): Modelado con Clase Asociativa
    // Se activa si es explícitamente N:M, o multiplicidades *..*, o si las entidades coinciden con cualquier par N:M del catálogo de dominios
    const esParOntologicoNM = srcCls && tgtCls && finalTipo !== 'INHERITANCE' && finalTipo !== 'REALIZATION' &&
      CATALOGO_DOMINIOS.some(d => d.coincide(srcCls.name, tgtCls.name));

    if (finalTipo === 'ASSOCIATION_N_M' || (mult.source.includes('*') && mult.target.includes('*')) || esParOntologicoNM) {
      if (srcCls && tgtCls) {
        const specifiedAssocName = String((rr as any)?.associationClassName || '').toLowerCase().trim();
        const domMatch = CATALOGO_DOMINIOS.find(d => d.coincide(srcCls.name, tgtCls.name));
        const nomEsperado = domMatch ? domMatch.generarNombreIntermedia(srcCls.name, tgtCls.name).toLowerCase() : '';

        // Si la clase intermedia ya existe en el modelo (por nombre especificado, ontología o estereotipo), reutilizarla
        let intermediateCls = specifiedAssocName
          ? classes.find(c => c.name.toLowerCase() === specifiedAssocName)
          : undefined;

        if (!intermediateCls && nomEsperado) {
          intermediateCls = classes.find(c => c.name.toLowerCase() === nomEsperado || c.name.toLowerCase().includes(nomEsperado));
        }

        if (!intermediateCls) {
          intermediateCls = classes.find(c => c.stereotype === 'AssociationClass' && c.id !== srcId && c.id !== tgtId);
        }

        let intermediateId = intermediateCls ? intermediateCls.id : undefined;

        const sPos = srcCls.position || { x: 100, y: 100 };
        const tPos = tgtCls.position || { x: 500, y: 100 };
        const optimalAssocPos = {
          x: Math.round((sPos.x + tPos.x) / 2),
          y: Math.max(sPos.y, tPos.y) + 240
        };

        if (!intermediateCls) {
          const suggestion = inferirTablaIntermedia(srcCls, tgtCls, classes);
          const intermediateName = suggestion.nombreClase;
          intermediateId = `cls-ai-inter-${timestamp}-${ri}`;
          mapId.set(intermediateName.toLowerCase(), intermediateId);

          intermediateCls = {
            id: intermediateId,
            name: intermediateName,
            stereotype: 'AssociationClass',
            attributes: suggestion.atributos,
            methods: suggestion.metodos,
            position: optimalAssocPos
          };
          classes.push(intermediateCls);
        } else {
          intermediateCls.stereotype = 'AssociationClass';
          if (!intermediateCls.position || Math.abs(intermediateCls.position.y - sPos.y) < 120) {
            intermediateCls.position = optimalAssocPos;
          }
        }

        // En UML 2.5: La relación N:M conecta las dos entidades maestras con multiplicidades * y 1..*,
        // y vincula la Clase Asociativa mediante associationClassId para el trazo punteado perpendicular.
        const nmKey = `${srcId}|${tgtId}|ASSOCIATION_N_M`;
        const nmKeyRev = `${tgtId}|${srcId}|ASSOCIATION_N_M`;
        if (!clavesVistas.has(nmKey) && !clavesVistas.has(nmKeyRev)) {
          clavesVistas.add(nmKey);
          relations.push({
            id: `rel-ai-nm-${timestamp}-${ri}`,
            sourceClassId: srcId,
            targetClassId: tgtId,
            type: 'ASSOCIATION_N_M',
            sourceMultiplicity: mult.source.includes('*') ? mult.source : '*',
            targetMultiplicity: mult.target.includes('*') ? mult.target : '1..*',
            label: String(rr?.label || intermediateCls?.name || '').slice(0, 30),
            associationClassId: intermediateId!
          });
        }
        return;
      }
    }

    // 2. REGLA DE HERENCIA (UML 2.5): Subclase (origen) ──▷ Superclase (destino)
    if (finalTipo === 'INHERITANCE' && srcCls && tgtCls) {
      const esPadre = srcCls.stereotype === 'Abstract' || srcCls.isAbstract || /(persona|usuario|vehiculo|cuenta|base|entidad)/i.test(srcCls.name);
      const esHijo = /(cliente|empleado|vendedor|auto|camion|ahorro|corriente|alumno|estudiante|profesor|medico|paciente)/i.test(tgtCls.name);
      if (esPadre && esHijo) {
        const tempId = srcId;
        srcId = tgtId;
        tgtId = tempId;
      }
    }

    // 3. REGLA DE CARDINALIDAD 1:N: El Maestro/Padre es Origen (1) y la Transacción/Hija es Destino (*)
    if (finalTipo === 'ASSOCIATION_1_N') {
      const sCls = classes.find(c => c.id === srcId);
      const tCls = classes.find(c => c.id === tgtId);
      if (sCls && tCls) {
        const dir = inferirDireccionMaestroTransaccion(sCls.name, tCls.name);
        if (!dir.origenEsMaestro) {
          const tempId = srcId;
          srcId = tgtId;
          tgtId = tempId;
        }
      }
    }

    const clave = `${srcId}|${tgtId}|${finalTipo}`;
    if (clavesVistas.has(clave)) return;
    clavesVistas.add(clave);

    relations.push({
      id: `rel-ai-${timestamp}-${ri}`,
      sourceClassId: srcId,
      targetClassId: tgtId,
      type: finalTipo,
      sourceMultiplicity: mult.source,
      targetMultiplicity: mult.target,
      label: String(rr?.label || (finalTipo === 'COMPOSITION' ? 'compone' : 'se relaciona con')).slice(0, 30)
    });
  });

  // UML 2.5: Si una clase asociativa recibió conexiones de 2 entidades maestras (ej. Venta y Producto):
  // Garantizar que la relación principal N:M entre ellas exista y tenga su associationClassId vinculado
  assocConnections.forEach((connectedEntities, assocId) => {
    if (connectedEntities.size >= 2) {
      const entityArr = Array.from(connectedEntities);
      const e1 = entityArr[0];
      const e2 = entityArr[1];
      const assocCls = classes.find(c => c.id === assocId);

      const existingRel = relations.find(r =>
        (r.sourceClassId === e1 && r.targetClassId === e2) ||
        (r.sourceClassId === e2 && r.targetClassId === e1)
      );

      if (existingRel) {
        existingRel.type = 'ASSOCIATION_N_M';
        existingRel.associationClassId = assocId;
      } else {
        relations.push({
          id: `rel-ai-nm-synth-${timestamp}-${assocId}`,
          sourceClassId: e1,
          targetClassId: e2,
          type: 'ASSOCIATION_N_M',
          sourceMultiplicity: '*',
          targetMultiplicity: '1..*',
          label: assocCls?.name || '',
          associationClassId: assocId
        });
      }
    }
  });

  // 4. VERIFICACIÓN POST-PROCESO PREDETERMINADA: Garantizar que cualquier par de clases del catálogo N:M tenga su clase asociativa vinculada
  CATALOGO_DOMINIOS.forEach(dom => {
    classes.forEach(c1 => {
      classes.forEach(c2 => {
        if (c1.id !== c2.id && dom.coincide(c1.name, c2.name)) {
          const nombreEsperado = dom.generarNombreIntermedia(c1.name, c2.name).toLowerCase();
          let interCls = classes.find(c =>
            c.name.toLowerCase() === nombreEsperado ||
            c.name.toLowerCase().includes(nombreEsperado) ||
            c.stereotype === 'AssociationClass'
          );

          const sPos = c1.position || { x: 100, y: 100 };
          const tPos = c2.position || { x: 500, y: 100 };
          const optimalAssocPos = {
            x: Math.round((sPos.x + tPos.x) / 2),
            y: Math.max(sPos.y, tPos.y) + 240
          };

          if (!interCls) {
            const suggestion = inferirTablaIntermedia(c1, c2, classes);
            const interId = `cls-ai-auto-${timestamp}-${c1.name}-${c2.name}`;
            interCls = {
              id: interId,
              name: suggestion.nombreClase,
              stereotype: 'AssociationClass',
              attributes: suggestion.atributos,
              methods: suggestion.metodos,
              position: optimalAssocPos
            };
            classes.push(interCls);
          } else {
            interCls.stereotype = 'AssociationClass';
          }

          // Garantizar relación principal N:M vinculada con la clase asociativa
          const relExistente = relations.find(r =>
            (r.sourceClassId === c1.id && r.targetClassId === c2.id) ||
            (r.sourceClassId === c2.id && r.targetClassId === c1.id)
          );

          if (relExistente) {
            relExistente.type = 'ASSOCIATION_N_M';
            if (!relExistente.sourceMultiplicity?.includes('*')) relExistente.sourceMultiplicity = '*';
            if (!relExistente.targetMultiplicity?.includes('*')) relExistente.targetMultiplicity = '1..*';
            relExistente.associationClassId = interCls.id;
          } else {
            relations.push({
              id: `rel-ai-nm-auto-${timestamp}-${c1.name}-${c2.name}`,
              sourceClassId: c1.id,
              targetClassId: c2.id,
              type: 'ASSOCIATION_N_M',
              sourceMultiplicity: '*',
              targetMultiplicity: '1..*',
              label: interCls.name,
              associationClassId: interCls.id
            });
          }
        }
      });
    });
  });

  // 5. PURGA UNIVERSAL DE ARISTAS BINARIAS HACIA CLASES ASOCIATIVAS (UML 2.5):
  const sanitized = sanitizarDiagramaUML25({
    title: String(json.className || `Diagrama-${timestamp}`).slice(0, 60),
    classes,
    relations,
    updatedAt: new Date().toISOString()
  });

  return {
    className: String(json.className || `Diagrama-${timestamp}`).slice(0, 60),
    classes: sanitized.classes,
    relations: sanitized.relations
  };
}

async function pedirDiagramaGemini(
  prompt: string,
  systemPrompt: string,
  timeoutMs: number
): Promise<RespuestaOllama | null> {
  if (!geminiDisponible()) return null;

  const content = await generarContenidoGemini(
    prompt,
    systemPrompt,
    { temperature: 0.2, maxOutputTokens: 1500, responseMimeType: 'application/json' },
    timeoutMs
  );
  if (!content) return null;

  const jsonStr = extraerJSON(content);
  if (!jsonStr) return null;

  try {
    const parsed = JSON.parse(jsonStr);
    const normalizado = normalizarDiagrama(parsed, []);
    if (normalizado) return { diagrama: normalizado, model: MODELO_GEMINI,provider:ultimoProveedorIa() };
  } catch {
    /* JSON inválido → devolver null para seguir con Ollama */
  }
  return null;
}

export async function pedirDiagramaOllama(prompt:string,systemPrompt:string,_modeloSugerido?:string,timeoutMs=120000):Promise<RespuestaOllama|null>{return pedirDiagramaGemini(prompt,systemPrompt,timeoutMs);}

/**
 * Orquestador de GENERACIÓN: crea un diagrama nuevo desde un prompt libre.
 */
export async function generarDiagramaConAgente(
  prompt: string,
  clasesExistentes: ClaseUml[],
  modeloOllama?: string
): Promise<ResultadoAgente> {
  const contextoUml = clasesExistentes.length > 0
    ? `Clases actuales en el lienzo: ${clasesExistentes.map(c => c.name).join(', ')}.`
    : 'El lienzo está vacío.';

  const resp = await pedirDiagramaOllama(prompt, construirSystemPrompt(contextoUml), modeloOllama);

  if (resp) {
    return { success: true, diagrama: resp.diagrama, fuente: resp.provider==='Ollama'?'ollama':resp.provider==='Claude'?'claude':'gemini', model: resp.model };
  }

  return {
    success: false,
    error: 'El modelo no devolvió un diagrama JSON válido.',
    fuente: 'error'
  };
}

/**
 * Orquestador de MODIFICACIÓN: lee el diagrama actual del lienzo y pide
 * a Ollama devolver la versión completa actualizada según el pedido del usuario.
 */
export async function modificarDiagramaConAgente(
  prompt: string,
  diagramaActual: ModeloDiagrama,
  modeloOllama?: string
): Promise<ResultadoAgente> {
  const serializado = serializarModeloUML(diagramaActual);
  const systemPrompt = construirSystemPromptModificar(serializado);
  const resp = await pedirDiagramaOllama(prompt, systemPrompt, modeloOllama);

  if (resp) {
    return { success: true, diagrama: resp.diagrama, fuente: resp.provider==='Ollama'?'ollama':resp.provider==='Claude'?'claude':'gemini', model: resp.model };
  }

  return {
    success: false,
    error: 'El modelo no devolvió un diagrama válido para modificar.',
    fuente: 'error'
  };
}

/**
 * Fusiona el diagrama que devolvió el agente con el diagrama actual del lienzo:
 * - Las clases existentes con el MISMO nombre conservan su id y posición originales.
 * - Las clases nuevas se agregan en cuadrícula.
 * - Las clases actuales que el agente NO mencionó se conservan (no se pierde trabajo).
 * - Las relaciones se reconstruyen y se evitan duplicados.
 */
export function fusionarDiagramas(nuevo: DiagramaGenerado, anterior: ModeloDiagrama): ModeloDiagrama {
  const ts = Date.now();
  const anteriores = anterior.classes || [];
  const mapIdAnterior = new Map<string, string>();
  anteriores.forEach(c => mapIdAnterior.set(c.name.toLowerCase(), c.id));

  const clasesFinales: ClaseUml[] = [];
  const idsUsados = new Set<string>();

  // 1) Clases que devolvió el agente (reusar id/posición de las que ya existían)
  nuevo.classes.forEach((nc, i) => {
    const key = nc.name.toLowerCase();
    const prevId = mapIdAnterior.get(key);
    const previa = prevId ? anteriores.find(c => c.id === prevId) : undefined;

    const id = previa ? previa.id : nc.id;
    const position = previa ? previa.position : nc.position;
    if (previa) idsUsados.add(previa.id);

    // Atributos: ids frescos para no colisionar
    const attributes: AtributoUml[] = (nc.attributes || []).map((a, ai) => ({
      ...a,
      id: `attr-ai-${ts}-${i}-${ai}`
    }));

    clasesFinales.push({
      ...nc,
      id,
      position,
      attributes,
      methods: (nc.methods || []).map((m, mi) => ({ ...m, id: `m-ai-${ts}-${i}-${mi}` }))
    });
  });

  // 2) Clases anteriores que el agente NO devolvió → se conservan
  anteriores.forEach(c => {
    if (!idsUsados.has(c.id)) clasesFinales.push(c);
  });

  // 3) Relaciones: mapa nombre->id de las clases finales
  const idPorNombre = new Map<string, string>();
  clasesFinales.forEach(c => idPorNombre.set(c.name.toLowerCase(), c.id));

  const relacionesFinales: RelacionUml[] = [];
  const clavesVistas = new Set<string>();

  nuevo.relations.forEach((r, ri) => {
    const nSrcCls = nuevo.classes.find(c => c.id === r.sourceClassId || c.name.toLowerCase() === String(r.sourceClassId).toLowerCase());
    const nTgtCls = nuevo.classes.find(c => c.id === r.targetClassId || c.name.toLowerCase() === String(r.targetClassId).toLowerCase());

    const sName = nSrcCls ? nSrcCls.name.toLowerCase() : String(r.sourceClassId).toLowerCase();
    const tName = nTgtCls ? nTgtCls.name.toLowerCase() : String(r.targetClassId).toLowerCase();

    const src = idPorNombre.get(sName) || clasesFinales.find(c => c.id === r.sourceClassId)?.id;
    const tgt = idPorNombre.get(tName) || clasesFinales.find(c => c.id === r.targetClassId)?.id;
    if (!src || !tgt || src === tgt) return;
    const clave = `${src}|${tgt}|${r.type}`;
    if (clavesVistas.has(clave)) return;
    clavesVistas.add(clave);
    let assocId = r.associationClassId;
    if (assocId) {
      const nAssocCls = nuevo.classes.find(c => c.id === assocId) || anterior.classes?.find(c => c.id === assocId);
      if (nAssocCls) {
        assocId = idPorNombre.get(nAssocCls.name.toLowerCase()) || assocId;
      }
    }

    relacionesFinales.push({
      ...r,
      id: `rel-ai-${ts}-${ri}`,
      sourceClassId: src,
      targetClassId: tgt,
      associationClassId: assocId
    });
  });

  // 4) Relaciones anteriores que sigan teniendo sentido y no estén duplicadas
  (anterior.relations || []).forEach(r => {
    const clave = `${r.sourceClassId}|${r.targetClassId}|${r.type}`;
    if (clavesVistas.has(clave)) return;
    clavesVistas.add(clave);
    relacionesFinales.push(r);
  });

  // 5) Purga universal UML 2.5: Ninguna clase asociativa debe tener relaciones binarias directas
  return sanitizarDiagramaUML25({
    ...anterior,
    title: anterior.title || nuevo.className || 'Diagrama modificado por IA',
    classes: clasesFinales,
    relations: relacionesFinales,
    updatedAt: new Date().toISOString()
  });
}