import { ClaseUml, AtributoUml, MetodoUml, RelacionUml, ModeloDiagrama } from '../types/uml';

/**
 * Motor de Ontología Semántica Universal para UML 2.5 y Normalización 3FN.
 * Deduce dinámicamente nombres de entidades asociativas, atributos de negocio específicos,
 * métodos y direcciones Maestro (1) ➔ Transacción (*) para CUALQUIER dominio de software.
 */

export interface DominioOntologia {
  id: string;
  nombre: string;
  coincide: (a: string, b: string) => boolean;
  generarNombreIntermedia: (a: string, b: string) => string;
  atributosIntermedia: (srcClass: ClaseUml, tgtClass: ClaseUml) => AtributoUml[];
  metodosIntermedia?: (srcClass: ClaseUml, tgtClass: ClaseUml) => MetodoUml[];
}

/**
 * Catálogo de ontologías industriales estándar.
 */
export const CATALOGO_DOMINIOS: DominioOntologia[] = [
  // 1. Comercio / Ventas / Facturación
  {
    id: 'comercio',
    nombre: 'Comercio y Ventas',
    coincide: (a, b) => {
      const s = `${a} ${b}`.toLowerCase();
      const hasOrder = /(venta|pedido|factura|orden|compra|ticket|proforma|cotizacion|carrito)/.test(s);
      const hasProduct = /(producto|articulo|item|mercancia|repuesto|insumo|servicio)/.test(s);
      return hasOrder && hasProduct;
    },
    generarNombreIntermedia: () => 'Detalle',
    atributosIntermedia: (_src, _tgt) => {
      const ts = Date.now();
      return [
        { id: `attr-${ts}-cant`, name: 'cantidad', type: 'Integer', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-pu`, name: 'precioUni', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-sub`, name: 'subtotal', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-desc`, name: 'descuento', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: true }
      ];
    },
    metodosIntermedia: () => [
      { id: `m-${Date.now()}-1`, name: 'calcularSubtotal', returnType: 'Double', visibility: '+', parameters: '' }
    ]
  },

  // 2. Educación / Académico
  {
    id: 'educacion',
    nombre: 'Educación y Universidad',
    coincide: (a, b) => {
      const s = `${a} ${b}`.toLowerCase();
      const hasStudent = /(estudiante|alumno|postulante|aprendiz|matriculado)/.test(s);
      const hasCourse = /(curso|materia|asignatura|modulo|clase|taller|diplomado)/.test(s);
      return hasStudent && hasCourse;
    },
    generarNombreIntermedia: () => 'Inscripcion',
    atributosIntermedia: () => {
      const ts = Date.now();
      return [
        { id: `attr-${ts}-sem`, name: 'semestre', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-fin`, name: 'fechaInscripcion', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-not`, name: 'notaFinal', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: true },
        { id: `attr-${ts}-asis`, name: 'asistenciaPorc', type: 'Integer', visibility: '-', isPrimaryKey: false, isNullable: true },
        { id: `attr-${ts}-est`, name: 'estado', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false }
      ];
    },
    metodosIntermedia: () => [
      { id: `m-${Date.now()}-1`, name: 'esAprobado', returnType: 'Boolean', visibility: '+', parameters: '' }
    ]
  },

  // 3. Salud / Hospitalario
  {
    id: 'salud',
    nombre: 'Salud y Clínica',
    coincide: (a, b) => {
      const s = `${a} ${b}`.toLowerCase();
      const hasMedic = /(medico|doctor|especialista|enfermero|terapeuta|cirujano)/.test(s);
      const hasPatient = /(paciente|afiliado|asegurado|consultante)/.test(s);
      return hasMedic && hasPatient;
    },
    generarNombreIntermedia: () => 'CitaMedica',
    atributosIntermedia: () => {
      const ts = Date.now();
      return [
        { id: `attr-${ts}-fh`, name: 'fechaHora', type: 'LocalDateTime', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-mot`, name: 'motivo', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-diag`, name: 'diagnostico', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: true },
        { id: `attr-${ts}-cost`, name: 'costoConsulta', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-est`, name: 'estado', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false }
      ];
    },
    metodosIntermedia: () => [
      { id: `m-${Date.now()}-1`, name: 'completarConsulta', returnType: 'void', visibility: '+', parameters: 'String diagnostico' }
    ]
  },

  // 4. Recursos Humanos / Gestión de Proyectos
  {
    id: 'rrhh',
    nombre: 'Recursos Humanos y Proyectos',
    coincide: (a, b) => {
      const s = `${a} ${b}`.toLowerCase();
      const hasEmployee = /(empleado|colaborador|trabajador|miembro|desarrollador)/.test(s);
      const hasProject = /(proyecto|iniciativa|sprint|tarea|actividad|fase)/.test(s);
      return hasEmployee && hasProject;
    },
    generarNombreIntermedia: () => 'AsignacionProyecto',
    atributosIntermedia: () => {
      const ts = Date.now();
      return [
        { id: `attr-${ts}-rol`, name: 'rolEnProyecto', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-hrs`, name: 'horasAsignadas', type: 'Integer', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-fi`, name: 'fechaInicio', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-ff`, name: 'fechaFin', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: true },
        { id: `attr-${ts}-act`, name: 'activo', type: 'Boolean', visibility: '-', isPrimaryKey: false, isNullable: false }
      ];
    }
  },

  // 5. Transporte / Aerolíneas / Pasajes
  {
    id: 'transporte',
    nombre: 'Transporte y Boletos',
    coincide: (a, b) => {
      const s = `${a} ${b}`.toLowerCase();
      const hasPassenger = /(pasajero|viajero|usuario|cliente)/.test(s);
      const hasTransport = /(vuelo|viaje|ruta|itinerario|tren|bus|embarcacion)/.test(s);
      return hasPassenger && hasTransport;
    },
    generarNombreIntermedia: () => 'BoletoReserva',
    atributosIntermedia: () => {
      const ts = Date.now();
      return [
        { id: `attr-${ts}-asi`, name: 'numeroAsiento', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-cla`, name: 'clase', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-pre`, name: 'precioPagado', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-cod`, name: 'codigoReserva', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false }
      ];
    }
  },

  // 6. Seguridad y Permisos (RBAC)
  {
    id: 'seguridad',
    nombre: 'Seguridad y Control de Acceso',
    coincide: (a, b) => {
      const s = `${a} ${b}`.toLowerCase();
      const hasUser = /(usuario|user|cuenta|account)/.test(s);
      const hasRole = /(rol|role|permiso|permission|privilegio|perfil)/.test(s);
      return hasUser && hasRole;
    },
    generarNombreIntermedia: () => 'UsuarioRol',
    atributosIntermedia: () => {
      const ts = Date.now();
      return [
        { id: `attr-${ts}-fa`, name: 'fechaAsignacion', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-act`, name: 'activo', type: 'Boolean', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-exp`, name: 'fechaExpiracion', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: true }
      ];
    }
  },

  // 7. Logística / Cadena de Suministro
  {
    id: 'logistica',
    nombre: 'Logística y Abastecimiento',
    coincide: (a, b) => {
      const s = `${a} ${b}`.toLowerCase();
      const hasSupplier = /(proveedor|fabricante|distribuidor)/.test(s);
      const hasMaterial = /(producto|material|pieza|insumo|repuesto|materia)/.test(s);
      return hasSupplier && hasMaterial;
    },
    generarNombreIntermedia: () => 'Suministro',
    atributosIntermedia: () => {
      const ts = Date.now();
      return [
        { id: `attr-${ts}-cant`, name: 'cantidad', type: 'Integer', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-cost`, name: 'costoUnitario', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-dias`, name: 'plazoEntregaDias', type: 'Integer', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-fult`, name: 'fechaUltimaEntrega', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: true }
      ];
    }
  },

  // 8. Hotelería / Hospedaje
  {
    id: 'hoteleria',
    nombre: 'Hotelería y Reservas',
    coincide: (a, b) => {
      const s = `${a} ${b}`.toLowerCase();
      const hasGuest = /(huesped|cliente|turista|viajero)/.test(s);
      const hasRoom = /(habitacion|cuarto|suite|cabaña|alojamiento)/.test(s);
      return hasGuest && hasRoom;
    },
    generarNombreIntermedia: () => 'ReservaHabitacion',
    atributosIntermedia: () => {
      const ts = Date.now();
      return [
        { id: `attr-${ts}-in`, name: 'fechaCheckIn', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-out`, name: 'fechaCheckOut', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-noc`, name: 'cantidadNoches', type: 'Integer', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-tar`, name: 'tarifaTotal', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: false }
      ];
    }
  },

  // 9. Inmobiliaria / Bienes Raíces
  {
    id: 'inmobiliaria',
    nombre: 'Inmobiliaria y Arriendos',
    coincide: (a, b) => {
      const s = `${a} ${b}`.toLowerCase();
      const hasTenant = /(inquilino|arrendatario|comprador)/.test(s);
      const hasProperty = /(propiedad|inmueble|departamento|casa|oficina|local)/.test(s);
      return hasTenant && hasProperty;
    },
    generarNombreIntermedia: () => 'ContratoArrendamiento',
    atributosIntermedia: () => {
      const ts = Date.now();
      return [
        { id: `attr-${ts}-canon`, name: 'montoMensual', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-dep`, name: 'depositoGarantia', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-ini`, name: 'fechaInicio', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-fin`, name: 'fechaTermino', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: false }
      ];
    }
  },

  // 10. Biblioteca / Préstamos
  {
    id: 'biblioteca',
    nombre: 'Biblioteca y Préstamos',
    coincide: (a, b) => {
      const s = `${a} ${b}`.toLowerCase();
      const hasBook = /(libro|ejemplar|obra|texto|publicacion|volumen)/.test(s);
      const hasReader = /(lector|usuario|socio|estudiante|afiliado)/.test(s);
      return hasBook && hasReader;
    },
    generarNombreIntermedia: () => 'PrestamoLibro',
    atributosIntermedia: () => {
      const ts = Date.now();
      return [
        { id: `attr-${ts}-fpres`, name: 'fechaPrestamo', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-fesp`, name: 'fechaDevolucionEsperada', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-freal`, name: 'fechaDevolucionReal', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: true },
        { id: `attr-${ts}-multa`, name: 'multaPendiente', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: true },
        { id: `attr-${ts}-est`, name: 'estado', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false }
      ];
    },
    metodosIntermedia: () => [
      { id: `m-${Date.now()}-1`, name: 'calcularDiasAtraso', returnType: 'Integer', visibility: '+', parameters: '' },
      { id: `m-${Date.now()}-2`, name: 'registrarDevolucion', returnType: 'void', visibility: '+', parameters: '' }
    ]
  },

  // 11. Gimnasio / Fitness / Membresías
  {
    id: 'gimnasio',
    nombre: 'Gimnasio y Fitness',
    coincide: (a, b) => {
      const s = `${a} ${b}`.toLowerCase();
      const hasMember = /(socio|cliente|miembro|atleta|deportista)/.test(s);
      const hasPlan = /(plan|membresia|disciplina|entrenador|clase|rutina)/.test(s);
      return hasMember && hasPlan;
    },
    generarNombreIntermedia: () => 'InscripcionMembresia',
    atributosIntermedia: () => {
      const ts = Date.now();
      return [
        { id: `attr-${ts}-fini`, name: 'fechaInicio', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-fvenc`, name: 'fechaVencimiento', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-monto`, name: 'montoPagado', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-est`, name: 'estado', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false }
      ];
    },
    metodosIntermedia: () => [
      { id: `m-${Date.now()}-1`, name: 'estaVigente', returnType: 'Boolean', visibility: '+', parameters: '' }
    ]
  },

  // 12. Veterinaria / Mascotas
  {
    id: 'veterinaria',
    nombre: 'Veterinaria y Atención Animal',
    coincide: (a, b) => {
      const s = `${a} ${b}`.toLowerCase();
      const hasVet = /(veterinario|doctor|especialista)/.test(s);
      const hasPet = /(mascota|animal|perro|gato|paciente)/.test(s);
      return hasVet && hasPet;
    },
    generarNombreIntermedia: () => 'ConsultaVeterinaria',
    atributosIntermedia: () => {
      const ts = Date.now();
      return [
        { id: `attr-${ts}-fh`, name: 'fechaHora', type: 'LocalDateTime', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-peso`, name: 'pesoKg', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-diag`, name: 'diagnostico', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: true },
        { id: `attr-${ts}-trat`, name: 'tratamiento', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: true }
      ];
    }
  },

  // 13. Cine / Espectáculos / Eventos
  {
    id: 'eventos',
    nombre: 'Cine, Eventos y Espectáculos',
    coincide: (a, b) => {
      const s = `${a} ${b}`.toLowerCase();
      const hasCustomer = /(cliente|espectador|asistente|usuario)/.test(s);
      const hasEvent = /(funcion|pelicula|evento|obra|concierto|sala)/.test(s);
      return hasCustomer && hasEvent;
    },
    generarNombreIntermedia: () => 'EntradaBoleto',
    atributosIntermedia: () => {
      const ts = Date.now();
      return [
        { id: `attr-${ts}-num`, name: 'numeroBoleto', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-asiento`, name: 'asiento', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-precio`, name: 'precio', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-fcomp`, name: 'fechaCompra', type: 'LocalDateTime', visibility: '-', isPrimaryKey: false, isNullable: false }
      ];
    }
  },

  // 14. Aerolíneas / Vuelos
  {
    id: 'aerolineas',
    nombre: 'Aerolíneas y Transporte Aéreo',
    coincide: (a, b) => {
      const s = `${a} ${b}`.toLowerCase();
      const hasPassenger = /(pasajero|viajero|cliente)/.test(s);
      const hasFlight = /(vuelo|ruta|itinerario|avion)/.test(s);
      return hasPassenger && hasFlight;
    },
    generarNombreIntermedia: () => 'ReservaVuelo',
    atributosIntermedia: () => {
      const ts = Date.now();
      return [
        { id: `attr-${ts}-cod`, name: 'codigoReserva', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-asiento`, name: 'numeroAsiento', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: true },
        { id: `attr-${ts}-clase`, name: 'claseCabina', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-tarifa`, name: 'precioPasaje', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-checkin`, name: 'checkInRealizado', type: 'Boolean', visibility: '-', isPrimaryKey: false, isNullable: false }
      ];
    }
  },

  // 15. Banca / Finanzas
  {
    id: 'banca',
    nombre: 'Banca y Productos Financieros',
    coincide: (a, b) => {
      const s = `${a} ${b}`.toLowerCase();
      const hasClient = /(cliente|titular|socio)/.test(s);
      const hasAccount = /(cuenta|tarjeta|prestamo|credito|deposito)/.test(s);
      return hasClient && hasAccount;
    },
    generarNombreIntermedia: () => 'TitularidadCuenta',
    atributosIntermedia: () => {
      const ts = Date.now();
      return [
        { id: `attr-${ts}-porc`, name: 'porcentajeParticipacion', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-tipo`, name: 'tipoFirma', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-falta`, name: 'fechaAlta', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-act`, name: 'activo', type: 'Boolean', visibility: '-', isPrimaryKey: false, isNullable: false }
      ];
    }
  },

  // 16. Editorial / Publicaciones (Autor - Libro)
  {
    id: 'editorial',
    nombre: 'Editorial y Publicaciones',
    coincide: (a, b) => {
      const s = `${a} ${b}`.toLowerCase();
      const hasAuthor = /(autor|escritor|creador|novelista|poeta)/.test(s);
      const hasBook = /(libro|obra|publicacion|texto|manuscrito|articulo)/.test(s);
      return hasAuthor && hasBook;
    },
    generarNombreIntermedia: () => 'AutoriaObra',
    atributosIntermedia: () => {
      const ts = Date.now();
      return [
        { id: `attr-${ts}-rol`, name: 'rolAutoria', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
        { id: `attr-${ts}-porc`, name: 'porcentajeRegalias', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: true },
        { id: `attr-${ts}-ord`, name: 'ordenAparicion', type: 'Integer', visibility: '-', isPrimaryKey: false, isNullable: false }
      ];
    }
  }
];

export interface SugerenciaTablaIntermedia {
  id: string;
  nombreClase: string;
  dominioDetectado: string;
  dominio: string;
  atributos: AtributoUml[];
  metodos: MetodoUml[];
  posicion: { x: number; y: number };
  relacion1: {
    id: string;
    sourceClassId: string;
    targetClassId: string;
    label: string;
    sourceMultiplicity: string;
    targetMultiplicity: string;
    sourceRole?: string;
    targetRole?: string;
  };
  relacion2: {
    id: string;
    sourceClassId: string;
    targetClassId: string;
    label: string;
    sourceMultiplicity: string;
    targetMultiplicity: string;
    sourceRole?: string;
    targetRole?: string;
  };
}

/**
 * Deduce la estructura completa de una clase intermedia para CUALQUIER par de entidades.
 */
export function inferirTablaIntermedia(
  srcClass: ClaseUml,
  tgtClass: ClaseUml,
  existingClasses: ClaseUml[] = []
): SugerenciaTablaIntermedia {
  const cleanA = srcClass.name.trim().replace(/[^a-zA-Z0-9_]/g, '') || 'Origen';
  const cleanB = tgtClass.name.trim().replace(/[^a-zA-Z0-9_]/g, '') || 'Destino';
  const ts = Date.now();

  // 1. Buscar coincidencia en ontologías conocidas
  const match = CATALOGO_DOMINIOS.find(d => d.coincide(cleanA, cleanB));

  let nombreSugerido = '';
  let dominioLabel = 'Genérico (Normalización 3FN)';
  let atributosEspecificos: AtributoUml[] = [];
  let metodosEspecificos: MetodoUml[] = [];

  if (match) {
    nombreSugerido = match.generarNombreIntermedia(cleanA, cleanB);
    dominioLabel = match.nombre;
    atributosEspecificos = match.atributosIntermedia(srcClass, tgtClass);
    metodosEspecificos = match.metodosIntermedia ? match.metodosIntermedia(srcClass, tgtClass) : [];
  } else {
    // 2. Fallback heurístico universal: Si no coincide con ninguna ontología conocida
    nombreSugerido = `${cleanA}${cleanB}`;
    atributosEspecificos = [
      { id: `attr-${ts}-freg`, name: 'fechaRegistro', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: false },
      { id: `attr-${ts}-est`, name: 'estado', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: true },
      { id: `attr-${ts}-obs`, name: 'observaciones', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: true },
      { id: `attr-${ts}-act`, name: 'activo', type: 'Boolean', visibility: '-', isPrimaryKey: false, isNullable: false }
    ];
  }

  // Evitar colisión de nombres con clases existentes en el diagrama
  let nombreFinal = nombreSugerido;
  let counter = 1;
  const clasesExistentesLower = new Set(existingClasses.map(c => c.name.toLowerCase()));
  while (clasesExistentesLower.has(nombreFinal.toLowerCase())) {
    nombreFinal = `${nombreSugerido}${counter > 1 ? counter : 'Item'}`;
    counter++;
  }

  // Atributos de negocio específicos de la clase asociativa (en UML 2.5 no llevan ID artificial)
  const atributosCompletos: AtributoUml[] = [...atributosEspecificos];

  // Posición central entre las dos entidades
  const sPos = srcClass.position || { x: 150, y: 150 };
  const tPos = tgtClass.position || { x: 550, y: 150 };
  let midX = Math.round((sPos.x + tPos.x) / 2);
  let midY = Math.round((sPos.y + tPos.y) / 2);

  // Si están muy cerca o superpuestas verticalmente, desplazar verticalmente
  if (Math.abs(sPos.x - tPos.x) < 160 && Math.abs(sPos.y - tPos.y) < 160) {
    midY += 160;
  }

  const newClassId = `cls-${ts}-${Math.random().toString(36).substring(2, 6)}`;
  return {
    id: newClassId,
    nombreClase: nombreFinal,
    dominioDetectado: dominioLabel,
    dominio: dominioLabel,
    atributos: atributosCompletos,
    metodos: metodosEspecificos,
    posicion: { x: midX, y: midY },
    relacion1: {
      id: `rel-${ts}-1`,
      sourceClassId: srcClass.id,
      targetClassId: newClassId,
      label: 'tiene',
      sourceMultiplicity: '1',
      targetMultiplicity: '0..*',
      sourceRole: `+${cleanA.toLowerCase()}`,
      targetRole: `+${nombreFinal.toLowerCase()}s`
    },
    relacion2: {
      id: `rel-${ts}-2`,
      sourceClassId: tgtClass.id,
      targetClassId: newClassId,
      label: 'incluye',
      sourceMultiplicity: '1',
      targetMultiplicity: '0..*',
      sourceRole: `+${cleanB.toLowerCase()}`,
      targetRole: `+${nombreFinal.toLowerCase()}s`
    }
  };
}

/**
 * Heurística Ontológica Universal para Dirección Maestro ➔ Transacción (1 ➔ *).
 * Retorna true si 'claseA' es la entidad maestra (1) y 'claseB' es la transacción (*).
 * Retorna false si 'claseA' es transacción y 'claseB' es maestro (requiere inversión).
 */
export function inferirDireccionMaestroTransaccion(claseA: string, claseB: string): { origenEsMaestro: boolean; razon: string } {
  const a = claseA.toLowerCase().trim();
  const b = claseB.toLowerCase().trim();

  // Sufijos y términos transaccionales / dependientes (*)
  const esTransaccion = (nombre: string): boolean => {
    return (
      /(cion|sión|miento|ing|log|historial|registro|evento|detalle|linea|item|orden|ticket|transaccion|factura|pedido|venta|compra|pago|cita|reserva|inscripcion|movimiento|auditoria|notificacion|sesion|bitacora|presupuesto|copia|ejemplar|instancia|subscripcion|suscripcion)$/i.test(nombre) ||
      /(detalle|item|transaccion|linea|history|audit|log|copia|ejemplar|instancia)/i.test(nombre)
    );
  };

  // Términos y sufijos típicamente de catálogo / maestro / sujeto (1)
  const esMaestro = (nombre: string): boolean => {
    return (
      /(cliente|usuario|persona|empleado|vendedor|medico|doctor|paciente|estudiante|alumno|profesor|docente|proveedor|autor|administrador|conductor|pasajero|huesped|inquilino|cuenta|producto|articulo|curso|materia|asignatura|vehiculo|auto|hotel|habitacion|inmueble|propiedad|almacen|categoria|sucursal|departamento|empresa|institucion|pais|ciudad|rol|perfil|libro|revista|obra|catalogo)$/i.test(nombre)
    );
  };

  const aIsTrans = esTransaccion(a);
  const bIsTrans = esTransaccion(b);
  const aIsMaster = esMaestro(a);
  const bIsMaster = esMaestro(b);

  if (aIsTrans && bIsMaster) {
    return { origenEsMaestro: false, razon: `'${claseB}' es catálogo/maestro y '${claseA}' es evento/transacción dependiente.` };
  }

  if (aIsMaster && bIsTrans) {
    return { origenEsMaestro: true, razon: `'${claseA}' es catálogo/maestro y '${claseB}' es evento/transacción dependiente.` };
  }

  // Fallback por defecto: mantener orden
  return { origenEsMaestro: true, razon: 'No se detectó inversión evidente; se mantiene el origen seleccionado.' };
}

export interface AtributoCompartido {
  name: string;
  type: string;
  presentInAll: boolean;
  count: number;
}

/**
 * Detecta atributos compartidos entre dos o más clases para la extracción de una Superclase (Generalización).
 */
export function detectarAtributosCompartidos(clases: ClaseUml[]): AtributoCompartido[] {
  if (!clases || clases.length < 2) return [];

  const contador = new Map<string, { type: string; count: number }>();

  clases.forEach(c => {
    (c.attributes || []).forEach(a => {
      // Ignorar PK 'id' específica de cada tabla relacional
      if (a.isPrimaryKey || a.name.toLowerCase() === 'id') return;

      const key = a.name.toLowerCase().trim();
      const existing = contador.get(key);
      if (existing) {
        existing.count++;
      } else {
        contador.set(key, { type: a.type || 'String', count: 1 });
      }
    });
  });

  const resultados: AtributoCompartido[] = [];
  contador.forEach((info, name) => {
    if (info.count >= 2) {
      resultados.push({
        name,
        type: info.type,
        presentInAll: info.count === clases.length,
        count: info.count
      });
    }
  });

  // Ordenar por presencia (los que están en todas primero)
  return resultados.sort((x, y) => y.count - x.count);
}

/**
 * Identifica si una clase actúa como Clase Asociativa / Intermedia según la semántica UML 2.5 / 3FN:
 * 1. Stereotype 'AssociationClass'
 * 2. Referenciada como 'associationClassId' en alguna relación
 * 3. Patrones de nombre: 'detalle', 'linea', 'item', 'asociat', 'intermedia', o nombres del catálogo de dominios
 */
export function esClaseAsociativaUniversal(c: ClaseUml, allRelations: RelacionUml[] = []): boolean {
  if (c.stereotype === 'AssociationClass') return true;
  if (allRelations.some(r => r.associationClassId === c.id)) return true;
  const nLow = (c.name || '').toLowerCase().trim();
  if (
    nLow.includes('detalle') ||
    nLow.includes('linea') ||
    nLow.includes('item_') ||
    nLow.includes('asociat') ||
    nLow.includes('intermedia')
  ) {
    return true;
  }
  return CATALOGO_DOMINIOS.some(d => {
    const interName = d.generarNombreIntermedia('', '').toLowerCase();
    // A short domain name (Cita, Reserva, Cuenta...) is not evidence of an association class.
    // Keep existing catalog matches, but never classify a class just because a longer catalog name contains it.
    return nLow === interName || nLow.includes(interName);
  });
}

/**
 * Sanitiza universalmente cualquier diagrama UML 2.5:
 * 1. Identifica todas las clases asociativas.
 * 2. Les asigna stereotype = 'AssociationClass' y remueve cualquier 'id' artificial PK.
 * 3. Garantiza que las 2 entidades maestras estén conectadas mediante una sola relación N:M
 *    (ASSOCIATION_N_M) que tenga 'associationClassId' apuntando a la clase asociativa.
 * 4. ELIMINA DE RAÍZ cualquier relación binaria directa donde la clase asociativa sea source o target
 *    (por ejemplo, Venta -> DetalleVenta o Producto -> DetalleVenta).
 */
export function sanitizarDiagramaUML25(diagram: ModeloDiagrama): ModeloDiagrama {
  if (!diagram || !diagram.classes) return diagram;

  const rawClasses = diagram.classes;
  const rawRelations = diagram.relations || [];

  // 1. Identificar clases asociativas
  const assocClassIds = new Set<string>();
  rawClasses.forEach(c => {
    if (esClaseAsociativaUniversal(c, rawRelations)) {
      assocClassIds.add(c.id);
    }
  });

  // Si no hay clases asociativas, retornar sin cambios
  if (assocClassIds.size === 0) {
    return diagram;
  }

  // 2. Normalizar clases: asegurar stereotype 'AssociationClass' y sin PK 'id'
  const classesNormalizadas: ClaseUml[] = rawClasses.map(c => {
    if (!assocClassIds.has(c.id)) return c;

    const attributesSinId = (c.attributes || []).filter(a => a.name.toLowerCase() !== 'id');
    return {
      ...c,
      stereotype: 'AssociationClass',
      attributes: attributesSinId.map(a => ({ ...a, isPrimaryKey: false, isNullable: true }))
    };
  });

  // 3. Identificar conexiones de cada clase asociativa hacia entidades maestras
  const assocConnections = new Map<string, Set<string>>(); // assocId -> Set<masterClassId>
  rawRelations.forEach(r => {
    const isSrcAssoc = assocClassIds.has(r.sourceClassId);
    const isTgtAssoc = assocClassIds.has(r.targetClassId);
    if (isSrcAssoc && !isTgtAssoc) {
      if (!assocConnections.has(r.sourceClassId)) assocConnections.set(r.sourceClassId, new Set());
      assocConnections.get(r.sourceClassId)!.add(r.targetClassId);
    } else if (isTgtAssoc && !isSrcAssoc) {
      if (!assocConnections.has(r.targetClassId)) assocConnections.set(r.targetClassId, new Set());
      assocConnections.get(r.targetClassId)!.add(r.sourceClassId);
    }
  });

  // 4. Copiar relaciones excluyendo aristas binarias directas hacia clases asociativas
  const cleanedRelations: RelacionUml[] = [];
  const relPairs = new Set<string>();

  rawRelations.forEach(r => {
    // Si la arista apunta o nace de una clase asociativa, omitirla (se reemplaza por la conexión en T)
    if (assocClassIds.has(r.sourceClassId) || assocClassIds.has(r.targetClassId)) {
      return;
    }
    const pairKey = [r.sourceClassId, r.targetClassId].sort().join('|');
    relPairs.add(pairKey);
    cleanedRelations.push(r);
  });

  // 5. Garantizar relación principal N:M para cada clase asociativa
  assocClassIds.forEach(acId => {
    const assocCls = classesNormalizadas.find(c => c.id === acId);
    if (!assocCls) return;

    let partners = Array.from(assocConnections.get(acId) || []);

    // Si solo tiene 1 conexión (ej. solo Producto), buscar una entidad compañera en el diagrama según el catálogo
    if (partners.length === 1) {
      const p1 = classesNormalizadas.find(c => c.id === partners[0]);
      if (p1) {
        const dom = CATALOGO_DOMINIOS.find(d => classesNormalizadas.some(c2 => c2.id !== p1.id && !assocClassIds.has(c2.id) && d.coincide(p1.name, c2.name)));
        if (dom) {
          const comp = classesNormalizadas.find(c2 => c2.id !== p1.id && !assocClassIds.has(c2.id) && dom.coincide(p1.name, c2.name));
          if (comp) partners.push(comp.id);
        }
      }
    }

    // Si no tiene conexiones directas, buscar par de entidades maestras que coincidan en el catálogo
    if (partners.length < 2) {
      const dom = CATALOGO_DOMINIOS.find(d => {
        const iname = d.generarNombreIntermedia('', '').toLowerCase();
        return assocCls.name.toLowerCase().includes(iname);
      });
      if (dom) {
        for (const c1 of classesNormalizadas) {
          if (assocClassIds.has(c1.id)) continue;
          for (const c2 of classesNormalizadas) {
            if (c1.id !== c2.id && !assocClassIds.has(c2.id) && dom.coincide(c1.name, c2.name)) {
              partners = [c1.id, c2.id];
              break;
            }
          }
          if (partners.length >= 2) break;
        }
      }
    }

    if (partners.length >= 2) {
      const [srcId, tgtId] = partners;
      const pairKey = [srcId, tgtId].sort().join('|');

      // Buscar si ya existe una relación entre estas dos entidades maestras
      const existingRel = cleanedRelations.find(r =>
        (r.sourceClassId === srcId && r.targetClassId === tgtId) ||
        (r.sourceClassId === tgtId && r.targetClassId === srcId)
      );

      if (existingRel) {
        existingRel.type = 'ASSOCIATION_N_M';
        existingRel.associationClassId = acId;
        if (!existingRel.sourceMultiplicity?.includes('*')) existingRel.sourceMultiplicity = '*';
        if (!existingRel.targetMultiplicity?.includes('*')) existingRel.targetMultiplicity = '1..*';
      } else {
        relPairs.add(pairKey);
        cleanedRelations.push({
          id: `rel-synth-nm-${Date.now()}-${acId}`,
          sourceClassId: srcId,
          targetClassId: tgtId,
          type: 'ASSOCIATION_N_M',
          sourceMultiplicity: '*',
          targetMultiplicity: '1..*',
          label: assocCls.name,
          associationClassId: acId
        });
      }
    }
  });

  return {
    ...diagram,
    classes: classesNormalizadas,
    relations: cleanedRelations,
    updatedAt: new Date().toISOString()
  };
}
