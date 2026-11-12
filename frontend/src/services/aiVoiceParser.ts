import { ClaseUml, AtributoUml, RelacionUml } from '../types/uml';
import { inferirDireccionMaestroTransaccion, inferirTablaIntermedia } from './semanticDomainEngine';

export interface ParseResult {
  success: boolean;
  action: 'CREATE_CLASS' 
    | 'ADD_ATTRIBUTE' 
    | 'CREATE_RELATION' 
    | 'VALIDATE_MODEL' 
    | 'SUMMARY_MODEL' 
    | 'GENERATE_DIAGRAM' 
    | 'OPEN_WHITEBOARD' 
    | 'OPEN_CODE_DOCK'
    | 'GENERATE_DOMAIN'
    | 'AUTO_FIX_MODEL'
    | 'GREETING'
    | 'HELP'
    | 'GRATITUDE'
    | 'UNKNOWN';
  reasoning: string;
  createdClass?: ClaseUml;
  createdClasses?: ClaseUml[];
  targetClassName?: string;
  newAttribute?: AtributoUml;
  newRelation?: RelacionUml;
  rawPrompt?: string;
  domainId?: string;
  message: string;
}

// Normalizador de tipos Java / UML en español e inglés
export function normalizeType(rawType: string): AtributoUml['type'] {
  const t = rawType.toLowerCase().trim();
  if (t.includes('long') || t.includes('id') || t.includes('identificador') || t.includes('bigint')) return 'Long';
  if (t.includes('string') || t.includes('texto') || t.includes('cadena') || t.includes('nombre') || t.includes('descripcion') || t.includes('correo') || t.includes('email') || t.includes('telefono') || t.includes('direccion') || t.includes('ciudad') || t.includes('pais') || t.includes('titulo') || t.includes('codigo') || t.includes('placa') || t.includes('sku')) return 'String';
  if (t.includes('int') || t.includes('integer') || t.includes('entero') || t.includes('edad') || t.includes('numero') || t.includes('cantidad') || t.includes('stock') || t.includes('contador') || t.includes('anio') || t.includes('año') || t.includes('mes') || t.includes('dia')) return 'Integer';
  if (t.includes('double') || t.includes('float') || t.includes('decimal') || t.includes('monto') || t.includes('precio') || t.includes('total') || t.includes('saldo') || t.includes('costo') || t.includes('tarifa') || t.includes('sueldo') || t.includes('iva') || t.includes('subtotal')) return 'Double';
  if (t.includes('bool') || t.includes('boolean') || t.includes('booleano') || t.includes('activo') || t.includes('estado') || t.includes('habilitado') || t.includes('pagado') || t.includes('disponible')) return 'Boolean';
  if (t.includes('datetime') || t.includes('timestamp') || t.includes('hora') || t.includes('tiempo')) return 'LocalDateTime';
  if (t.includes('date') || t.includes('fecha') || t.includes('nacimiento') || t.includes('emision') || t.includes('creacion')) return 'LocalDate';
  return 'String';
}

export function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Genera atributos por defecto inteligentes para una entidad según su nombre si no se especificaron.
 */
function generarAtributosPorDefecto(className: string): AtributoUml[] {
  const lower = className.toLowerCase();
  const idAttr: AtributoUml = {
    id: `attr-${Date.now()}-id`,
    name: 'id',
    type: 'Long',
    visibility: '-',
    isPrimaryKey: true,
    isNullable: false
  };

  if (lower.includes('detalle') || lower.includes('linea') || lower.includes('item_orden') || lower.includes('asociativ') || lower.includes('inscrip') || lower.includes('reserva')) {
    return [
      { id: `attr-${Date.now()}-1`, name: 'cantidad', type: 'Integer', visibility: '-', isPrimaryKey: false, isNullable: false },
      { id: `attr-${Date.now()}-2`, name: 'precioUni', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: false }
    ];
  }

  if (lower.includes('vendedor')) {
    return [
      idAttr,
      { id: `attr-${Date.now()}-1`, name: 'nombre', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
      { id: `attr-${Date.now()}-2`, name: 'email', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
      { id: `attr-${Date.now()}-3`, name: 'codigo', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false }
    ];
  }

  if (lower.includes('factura') || lower.includes('pedido') || lower.includes('venta') || lower.includes('orden')) {
    return [
      idAttr,
      { id: `attr-${Date.now()}-1`, name: 'numero', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
      { id: `attr-${Date.now()}-2`, name: 'fecha', type: 'LocalDate', visibility: '-', isPrimaryKey: false, isNullable: false },
      { id: `attr-${Date.now()}-3`, name: 'total', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: false },
      { id: `attr-${Date.now()}-4`, name: 'estado', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false }
    ];
  }

  if (lower.includes('cliente') || lower.includes('usuario') || lower.includes('persona') || lower.includes('empleado') || lower.includes('paciente') || lower.includes('alumno') || lower.includes('estudiante')) {
    return [
      idAttr,
      { id: `attr-${Date.now()}-1`, name: 'nombre', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
      { id: `attr-${Date.now()}-2`, name: 'correo', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
      { id: `attr-${Date.now()}-3`, name: 'telefono', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
      { id: `attr-${Date.now()}-4`, name: 'activo', type: 'Boolean', visibility: '-', isPrimaryKey: false, isNullable: false }
    ];
  }

  if (lower.includes('producto') || lower.includes('articulo') || lower.includes('item') || lower.includes('repuesto')) {
    return [
      idAttr,
      { id: `attr-${Date.now()}-1`, name: 'codigo', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
      { id: `attr-${Date.now()}-2`, name: 'nombre', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
      { id: `attr-${Date.now()}-3`, name: 'precio', type: 'Double', visibility: '-', isPrimaryKey: false, isNullable: false },
      { id: `attr-${Date.now()}-4`, name: 'stock', type: 'Integer', visibility: '-', isPrimaryKey: false, isNullable: false }
    ];
  }

  return [
    idAttr,
    { id: `attr-${Date.now()}-1`, name: 'nombre', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
    { id: `attr-${Date.now()}-2`, name: 'descripcion', type: 'String', visibility: '-', isPrimaryKey: false, isNullable: false },
    { id: `attr-${Date.now()}-3`, name: 'activo', type: 'Boolean', visibility: '-', isPrimaryKey: false, isNullable: false }
  ];
}

/**
 * Genera métodos de negocio recomendados para una clase recién creada.
 */
function generarMetodosPorDefecto(className: string): ClaseUml['methods'] {
  const lower = className.toLowerCase();
  const idBase = `m-${Date.now()}`;

  if (lower.includes('detalle') || lower.includes('linea')) {
    return [
      { id: `${idBase}-1`, name: 'calcularSubtotal', returnType: 'Double', visibility: '+', parameters: '' }
    ];
  }

  if (lower.includes('factura') || lower.includes('pedido') || lower.includes('venta')) {
    return [
      { id: `${idBase}-1`, name: 'calcularTotal', returnType: 'Double', visibility: '+', parameters: '' },
      { id: `${idBase}-2`, name: 'confirmar', returnType: 'Boolean', visibility: '+', parameters: '' }
    ];
  }

  if (lower.includes('producto') || lower.includes('articulo')) {
    return [
      { id: `${idBase}-1`, name: 'actualizarStock', returnType: 'Boolean', visibility: '+', parameters: 'Integer cantidad' },
      { id: `${idBase}-2`, name: 'esDisponible', returnType: 'Boolean', visibility: '+', parameters: '' }
    ];
  }

  return [
    { id: `${idBase}-1`, name: `validar${className}`, returnType: 'Boolean', visibility: '+', parameters: '' },
    { id: `${idBase}-2`, name: `obtener${className}Info`, returnType: 'String', visibility: '+', parameters: '' }
  ];
}

/**
 * Analizador léxico y semántico de comandos de voz y texto en lenguaje natural para UML.
 * Funciona de forma 100% offline en el navegador sin dependencias externas y detecta
 * automáticamente intenciones de auditoría, corrección, generación de dominios,
 * clases, atributos y relaciones.
 */
export function parseNaturalLanguageCommand(text: string, existingClasses: ClaseUml[]): ParseResult {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 0. Saludos y conversación amigable
  if (
    /^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches|que tal|saludos|hey|hello|hi|oiga|asistente)(\s+.*)?$/i.test(lower) ||
    lower === 'hola' || lower === 'hola ia' || lower === 'hola asistente'
  ) {
    return {
      success: true,
      action: 'GREETING',
      reasoning: 'Saludo del usuario detectado.',
      message: '¡Hola! Soy tu copiloto IA de ArchAI. ¿Qué deseas diseñar hoy? Puedes pedirme auditar, crear clases o generar dominios.'
    };
  }

  // 0.1 Ayuda y capacidades
  if (
    lower.includes('ayuda') || lower.includes('que puedes hacer') || lower.includes('qué puedes hacer') ||
    lower.includes('comandos') || lower.includes('instrucciones') || lower.includes('como funciona') || lower.includes('cómo funciona')
  ) {
    return {
      success: true,
      action: 'HELP',
      reasoning: 'Solicitud de ayuda y guía de comandos.',
      message: 'Puedes pedirme: "Auditar modelo", "Sistema de ventas", "Crear clase Factura con total Double", "Relacionar Cliente con Pedido" o "Auto-corregir".'
    };
  }

  // 0.2 Cortesía y agradecimiento
  if (
    lower.includes('gracias') || lower.includes('muchas gracias') || lower.includes('excelente') ||
    lower.includes('genial') || lower.includes('perfecto') || lower.includes('adios') || lower.includes('adiós') || lower.includes('chao')
  ) {
    return {
      success: true,
      action: 'GRATITUDE',
      reasoning: 'Mensaje de cortesía o agradecimiento detectado.',
      message: '¡Con gusto! Estoy aquí para cuando lo necesites.'
    };
  }

  // 0.3 Auto-reparación / Corrección inteligente
  if (
    lower.includes('corregir') || 
    lower.includes('arreglar') || 
    lower.includes('reparar') || 
    lower.includes('solucionar') || 
    lower.includes('autocorregir') || 
    lower.includes('auto reparar') ||
    lower.includes('auto-reparar') ||
    lower.includes('completar pk') ||
    lower.includes('agregar pk') ||
    lower.includes('asignar pk')
  ) {
    return {
      success: true,
      action: 'AUTO_FIX_MODEL',
      reasoning: 'Comando de auto-reparación arquitectónica detectado.',
      message: 'Iniciando corrección automática con IA (PKs y métodos de dominio)...'
    };
  }

  // 1. Auditoría arquitectónica / Madurez / 3FN
  if (
    lower.includes('validar') || 
    lower.includes('auditar') || 
    lower.includes('auditoria') || 
    lower.includes('auditoría') || 
    lower.includes('normalizar') || 
    lower.includes('3fn') || 
    lower.includes('revisar modelo') || 
    lower.includes('salud') || 
    lower.includes('madurez') || 
    lower.includes('cerebro') || 
    lower.includes('diagnostico') || 
    lower.includes('diagnóstico') || 
    lower.includes('analizar')
  ) {
    return {
      success: true,
      action: 'VALIDATE_MODEL',
      reasoning: 'Comando de auditoría del modelo UML y cerebro de código detectado.',
      message: 'Ejecutando auditoría arquitectónica del proyecto...'
    };
  }

  // 2. Resumen conceptual
  if (lower.includes('resumen') || lower.includes('explicar modelo') || lower.includes('describir diagrama') || lower.includes('que hace el modelo')) {
    return {
      success: true,
      action: 'SUMMARY_MODEL',
      reasoning: 'Comando de resumen conceptual del modelo detectado.',
      message: 'Generando diagnóstico y resumen con el agente contextual...'
    };
  }

  // 3. UI Actions (Pizarra y Código)
  if (lower.includes('escanear pizarra') || lower.includes('abrir pizarra') || lower.includes('foto pizarra') || lower.includes('camara pizarra') || lower.includes('pizarra')) {
    return {
      success: true,
      action: 'OPEN_WHITEBOARD',
      reasoning: 'Comando para escaneo de pizarra física OCR detectado.',
      message: 'Abriendo escáner de pizarra física...'
    };
  }

  if (lower.includes('generar codigo') || lower.includes('ver codigo') || lower.includes('spring boot') || lower.includes('descargar zip') || lower.includes('codigo fuente')) {
    return {
      success: true,
      action: 'OPEN_CODE_DOCK',
      reasoning: 'Comando para panel de generación de código Spring Boot detectado.',
      message: 'Desplegando dock de generación de código y empaquetado ZIP...'
    };
  }

  // 4. Instanciación explícita de Plantillas Rápidas (solo si el usuario pide "plantilla" o "ejemplo de")
  const pidePlantillaExplicita = lower.includes('plantilla') || lower.includes('ejemplo de') || lower.startsWith('plantilla ') || lower.startsWith('template ');

  if (pidePlantillaExplicita) {
    if (lower.includes('ecom') || lower.includes('venta') || lower.includes('tienda') || lower.includes('facturacion') || lower.includes('facturación') || lower.includes('carrito') || lower.includes('comercio')) {
      return {
        success: true,
        action: 'GENERATE_DOMAIN',
        domainId: 'ecommerce',
        reasoning: 'Dominio de E-Commerce y Facturación identificado.',
        message: 'Generando arquitectura completa de E-Commerce (Cliente, Pedido, Detalle, Producto, Factura, Pago)...'
      };
    }
    if (lower.includes('hosp') || lower.includes('clinic') || lower.includes('médic') || lower.includes('medic') || lower.includes('paciente') || lower.includes('doctor')) {
      return {
        success: true,
        action: 'GENERATE_DOMAIN',
        domainId: 'hospital',
        reasoning: 'Dominio de Hospital y Clínica Médica identificado.',
        message: 'Generando arquitectura médica (Paciente, Médico, CitaMédica, Historial, Receta)...'
      };
    }
    if (lower.includes('univ') || lower.includes('matric') || lower.includes('matríc') || lower.includes('facultad') || lower.includes('colegio') || lower.includes('estudiant')) {
      return {
        success: true,
        action: 'GENERATE_DOMAIN',
        domainId: 'universidad',
        reasoning: 'Dominio de Universidad y Matrícula identificado.',
        message: 'Generando arquitectura universitaria (Estudiante, Carrera, Curso, Matrícula, Profesor)...'
      };
    }
    if (lower.includes('inven') || lower.includes('almacen') || lower.includes('almacén') || lower.includes('bodega') || lower.includes('stock')) {
      return {
        success: true,
        action: 'GENERATE_DOMAIN',
        domainId: 'inventario',
        reasoning: 'Dominio de Inventario y Almacén identificado.',
        message: 'Generando arquitectura logística (Almacén, Producto, MovimientoInventario, Proveedor)...'
      };
    }
    if (lower.includes('biblio') || lower.includes('libro') || lower.includes('prestamo') || lower.includes('préstamo')) {
      return {
        success: true,
        action: 'GENERATE_DOMAIN',
        domainId: 'biblioteca',
        reasoning: 'Dominio de Biblioteca y Préstamos identificado.',
        message: 'Generando arquitectura de Biblioteca (Libro, Autor, Socio, Préstamo)...'
      };
    }
    if (lower.includes('hotel') || lower.includes('huesped') || lower.includes('huésped') || lower.includes('habitacion') || lower.includes('habitación') || lower.includes('estadia')) {
      return {
        success: true,
        action: 'GENERATE_DOMAIN',
        domainId: 'hotel',
        reasoning: 'Dominio de Hotel y Reservaciones identificado.',
        message: 'Generando arquitectura hotelera (Habitación, Huésped, Reserva, Pago)...'
      };
    }
    if (lower.includes('rbac') || lower.includes('rol') || lower.includes('permiso') || lower.includes('seguridad') || lower.includes('autentica') || lower.includes('acceso')) {
      return {
        success: true,
        action: 'GENERATE_DOMAIN',
        domainId: 'rbac',
        reasoning: 'Dominio de Seguridad y Control de Acceso (RBAC) identificado.',
        message: 'Generando arquitectura de Seguridad (Usuario, Rol, Permiso, Sesión)...'
      };
    }
  }

  // Intención explícita de relación o conexión entre tablas/clases
  const tieneIntencionRelacion = /(conectar|conecta|conecte|conéctame|conexi[oó]n|relacionar|relaciona|relacione|relaci[oó]n|vincular|vincula|v[ií]nculo|asociar|asocia|asociaci[oó]n|unir|une|enlazar|enlaza|heredar|hereda|herencia|componer|compone|composici[oó]n|ley\s+asociativa)/i.test(lower);

  // 5. Generación de diagramas descriptivos libres con IA (para CUALQUIER dominio)
  const esPedidoGeneracionDiagrama = !tieneIntencionRelacion && (
    lower.startsWith('generar') || lower.startsWith('crear') || lower.startsWith('crea') ||
    lower.startsWith('diseña') || lower.startsWith('diseñar') || lower.startsWith('hazme') ||
    lower.startsWith('haz un') || lower.startsWith('quiero un') || lower.startsWith('necesito un') ||
    lower.startsWith('diagrama') || lower.startsWith('sistema') || lower.includes('sistema de') ||
    lower.includes('diagrama de') || lower.includes('modelo de') || lower.includes('arquitectura de')
  ) && clean.split(/\s+/).length >= 2;

  if (esPedidoGeneracionDiagrama) {
    return {
      success: true,
      action: 'GENERATE_DIAGRAM',
      rawPrompt: clean,
      reasoning: 'Prompt descriptivo para sintetizar un diagrama completo por IA detectado.',
      message: `Generando arquitectura completa desde el prompt: "${clean}"...`
    };
  }

  // 6. Crear clase o entidad (flexible: "crear clase Factura", "nueva entidad Cliente", "Vehiculo", "clase Pedido con total Double")
  const palabrasCreacion = [
    'crear clase', 'crea la clase', 'crea una clase', 'crea clase', 'agrega clase', 'agregar clase',
    'nueva clase', 'nueva entidad', 'crear entidad', 'crea entidad', 'crear tabla', 'crea tabla',
    'nueva tabla', 'quiero una clase', 'hazme una clase', 'genera clase', 'entidad ', 'clase '
  ];

  const esCreacionClase = !tieneIntencionRelacion && (palabrasCreacion.some(p => lower.includes(p)) || (clean.split(/\s+/).length === 1 && /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ0-9_]+$/.test(clean)));

  if (esCreacionClase) {
    let className = '';
    const classMatch = lower.match(/(?:clase|entidad|tabla)\s+(?:de\s+|del\s+|la\s+|el\s+)?([a-záéíóúñ0-9_]+)/i);
    if (classMatch && classMatch[1]) {
      className = capitalize(classMatch[1]);
    } else if (clean.split(/\s+/).length === 1) {
      className = capitalize(clean);
    } else {
      // Tomar la primera palabra relevante
      const tokens = clean.replace(/^(crear|crea|nueva|nuevo|agrega|agregar|quiero|hazme|una|un|la|el)\s+/i, '').split(/\s+/);
      className = tokens[0] ? capitalize(tokens[0]) : 'Entidad' + Math.floor(Math.random() * 100);
    }

    // Identificar estereotipo
    let stereotype: ClaseUml['stereotype'] = 'Entity';
    if (lower.includes('asociativ') || lower.includes('association') || lower.includes('intermedia') || lower.includes('detalle') || lower.includes('linea') || lower.includes('item_')) stereotype = 'AssociationClass';
    else if (lower.includes('controller') || lower.includes('controlador')) stereotype = 'Controller';
    else if (lower.includes('service') || lower.includes('servicio')) stereotype = 'Service';
    else if (lower.includes('repository') || lower.includes('repositorio')) stereotype = 'Repository';
    else if (lower.includes('enum')) stereotype = 'Enum';

    const esAsociativa = stereotype === 'AssociationClass' || lower.includes('detalle') || lower.includes('asociativ');
    let attributes: AtributoUml[] = esAsociativa ? [] : [
      {
        id: 'attr-' + Date.now() + '-id',
        name: 'id',
        type: 'Long',
        visibility: '-',
        isPrimaryKey: true,
        isNullable: false
      }
    ];

    // Extraer atributos si se especificaron
    const withIndex = lower.indexOf('con');
    if (withIndex !== -1) {
      const attributesChunk = clean.slice(withIndex + 3);
      const rawTokens = attributesChunk
        .replace(/[,;]/g, ' ')
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length > 0);

      const stopWords = new Set(['atributo', 'atributos', 'campo', 'campos', 'columna', 'columnas', 'tipo', 'de', 'el', 'la', 'un', 'una', 'y', 'e', 'con']);
      const knownTypeTokens = new Set(['string', 'int', 'integer', 'long', 'double', 'float', 'boolean', 'bool', 'date', 'localdate', 'localdatetime', 'datetime', 'texto', 'numero', 'entero', 'decimal', 'fecha', 'hora']);

      const filteredTokens = rawTokens.filter(t => !stopWords.has(t.toLowerCase()));

      let i = 0;
      let attrCount = 0;
      while (i < filteredTokens.length) {
        const token = filteredTokens[i];
        const tokenLower = token.toLowerCase();

        if (tokenLower === 'id' || tokenLower === 'identificador') {
          i++;
          continue;
        }

        let attrName = tokenLower;
        let attrType: AtributoUml['type'] = 'String';

        if (i + 1 < filteredTokens.length && knownTypeTokens.has(filteredTokens[i + 1].toLowerCase())) {
          attrType = normalizeType(filteredTokens[i + 1]);
          i += 2;
        } else {
          attrType = normalizeType(tokenLower);
          i += 1;
        }

        if (!attributes.some(a => a.name.toLowerCase() === attrName)) {
          attributes.push({
            id: `attr-${Date.now()}-${attrCount++}`,
            name: attrName,
            type: attrType,
            visibility: '-',
            isPrimaryKey: false,
            isNullable: false
          });
        }
      }
    } else {
      // Si no especificó atributos, generar atributos iniciales de dominio
      attributes = generarAtributosPorDefecto(className);
    }

    // Calcular posición óptima sin solapar
    const cols = 3;
    const baseOffset = existingClasses.length;
    const posX = 120 + (baseOffset % cols) * 340;
    const posY = 140 + Math.floor(baseOffset / cols) * 280;

    const newClass: ClaseUml = {
      id: 'class-' + Date.now(),
      name: className,
      stereotype,
      attributes,
      methods: generarMetodosPorDefecto(className),
      position: { x: posX, y: posY }
    };

    return {
      success: true,
      action: 'CREATE_CLASS',
      reasoning: `Se analizó el comando. Se identificó la entidad '${className}' con estereotipo <<${stereotype}>> y ${attributes.length} atributos.`,
      createdClass: newClass,
      message: `Clase UML '${className}' generada con éxito.`
    };
  }

  // 7. Agregar atributo a clase existente
  if (
    lower.includes('agrega atributo') || lower.includes('agregar atributo') || lower.includes('añade atributo') ||
    lower.includes('añadir atributo') || lower.includes('nuevo atributo') || lower.includes('agrega campo') ||
    lower.includes('agregar campo') || lower.includes('poner atributo') || lower.includes('poner campo') ||
    lower.includes('añade campo') || lower.includes('añadir campo')
  ) {
    const attrMatch = lower.match(/(?:atributo|campo|columna)\s+([a-záéíóúñ0-9_]+)/i);
    const classMatch = lower.match(/(?:a|en|para)\s+(?:la\s+clase\s+|la\s+entidad\s+)?([a-záéíóúñ0-9_]+)/i);

    if (attrMatch) {
      const attrName = attrMatch[1].toLowerCase();
      let targetName = classMatch ? capitalize(classMatch[1]) : (existingClasses[0]?.name || 'Clase');
      const attrType = normalizeType(lower);

      const newAttr: AtributoUml = {
        id: 'attr-' + Date.now(),
        name: attrName,
        type: attrType,
        visibility: '-',
        isPrimaryKey: false,
        isNullable: false
      };

      return {
        success: true,
        action: 'ADD_ATTRIBUTE',
        reasoning: `Se detectó la inserción del atributo '${attrName}: ${attrType}' para la clase '${targetName}'.`,
        targetClassName: targetName,
        newAttribute: newAttr,
        message: `Atributo '${attrName} (${attrType})' añadido a la clase '${targetName}'.`
      };
    }
  }

  // 8. Relacionar clases y aplicar Ley Asociativa UML 2.5
  if (tieneIntencionRelacion) {
    const stopWordsNombres = new Set([
      'muchos', 'mucho', 'uno', 'una', 'tabla', 'tablas', 'clase', 'clases', 'modelo', 'modelos',
      'entidad', 'entidades', 'con', 'y', 'a', 'de', 'del', 'la', 'el', 'las', 'los', 'un', 'una',
      'ley', 'asociativa', 'intermedia', 'detalle', 'relacion', 'relación', 'relacionar', 'conectar',
      'vincular', 'asociar', 'unir', 'esta', 'este', 'tal', 'estas', 'estos', 'tales', 'hacia', 'e'
    ]);

    // 8.1 Extraer si el usuario especificó explícitamente un nombre para la clase asociativa / tabla intermedia
    let explicitAssocName = '';
    const assocMatch = lower.match(/(?:con|usando|mediante|aplicando|tener)?\s*(?:la\s+)?(?:clase\s+asociativa|tabla\s+asociativa|entidad\s+asociativa|clase\s+intermedia|tabla\s+intermedia|intermedia|detalle\s+asociativo|detalle)\s+(?:de\s+|llamada\s+|llamado\s+)?([a-zA-ZáéíóúñÁÉÍÓÚÑ0-9_]+)/i);
    if (assocMatch && assocMatch[1] && !stopWordsNombres.has(assocMatch[1].toLowerCase())) {
      explicitAssocName = capitalize(assocMatch[1]);
    }

    // 8.2 Tipo de relación / Cardinalidad
    const esNM = /(muchos\s+a\s+muchos|n\s*:\s*m|n\s+a\s+m|n\s+a\s+n|m\s+a\s+n|varios\s+a\s+varios|ley\s+asociativa|clase\s+asociativa|tabla\s+asociativa|tabla\s+intermedia|clase\s+intermedia)/i.test(lower) || !!explicitAssocName;
    const es1a1 = /(uno\s+a\s+uno|1\s*:\s*1|1\s+a\s+1|una\s+a\s+una)/i.test(lower);
    const esHerencia = /(hereda|herencia|subclase|extiende|generalizaci[oó]n)/i.test(lower);
    const esComposicion = /(compone|composici[oó]n|agregaci[oó]n)/i.test(lower);

    // 8.3 Identificar entidades maestras participantes
    // a) Búsqueda en clases ya presentes en el lienzo (excluyendo la clase asociativa si se especificó)
    let matchedMasters = existingClasses.filter(c =>
      (!explicitAssocName || c.name.toLowerCase() !== explicitAssocName.toLowerCase()) &&
      lower.includes(c.name.toLowerCase())
    );

    // b) Extracción por patrones léxicos verbales
    let candA = '';
    let candB = '';
    const regexPats = [
      /(?:conectar|relacionar|vincular|asociar|unir|enlazar)\s+(?:la\s+tabla\s+|la\s+clase\s+|el\s+modelo\s+|la\s+entidad\s+)?([a-zA-ZáéíóúñÁÉÍÓÚÑ0-9_]+)\s+(?:con|y|a|hacia|e)\s+(?:la\s+tabla\s+|la\s+clase\s+|el\s+modelo\s+|la\s+entidad\s+)?([a-zA-ZáéíóúñÁÉÍÓÚÑ0-9_]+)/i,
      /(?:entre|de)\s+(?:la\s+tabla\s+|la\s+clase\s+|el\s+modelo\s+|la\s+entidad\s+)?([a-zA-ZáéíóúñÁÉÍÓÚÑ0-9_]+)\s+(?:y|con|e)\s+(?:la\s+tabla\s+|la\s+clase\s+|el\s+modelo\s+|la\s+entidad\s+)?([a-zA-ZáéíóúñÁÉÍÓÚÑ0-9_]+)/i,
      /(?:conectar|relacionar|vincular|asociar|unir)\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ0-9_]+)\s+(?:y|con|a)\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ0-9_]+)/i
    ];

    for (const pat of regexPats) {
      const m = lower.match(pat);
      if (m && m[1] && m[2]) {
        const p1 = m[1].toLowerCase();
        const p2 = m[2].toLowerCase();
        if (!stopWordsNombres.has(p1) && !stopWordsNombres.has(p2)) {
          candA = capitalize(m[1]);
          candB = capitalize(m[2]);
          break;
        }
      }
    }

    // c) Referencias deícticas o contextuales ('conectar tal tabla con esta', 'conectar estas tablas', 'conectar de muchos a muchos')
    if (matchedMasters.length < 2 && !candA && !candB && existingClasses.length >= 2) {
      matchedMasters = [
        existingClasses[existingClasses.length - 2],
        existingClasses[existingClasses.length - 1]
      ];
    }

    // d) Consolidar entidades maestras (sintetizar si no existen aún)
    const nuevasClasesSintetizadas: ClaseUml[] = [];
    let master1: ClaseUml | null = matchedMasters[0] || null;
    let master2: ClaseUml | null = matchedMasters[1] || null;

    if (!master1 && candA) {
      master1 = existingClasses.find(c => c.name.toLowerCase() === candA.toLowerCase()) || null;
      if (!master1) {
        master1 = {
          id: 'class-' + Date.now() + '-1',
          name: candA,
          stereotype: 'Entity',
          attributes: generarAtributosPorDefecto(candA),
          methods: generarMetodosPorDefecto(candA),
          position: { x: 120, y: 150 }
        };
        nuevasClasesSintetizadas.push(master1);
      }
    }

    if (!master2 && candB) {
      master2 = existingClasses.find(c => c.name.toLowerCase() === candB.toLowerCase()) || null;
      if (!master2) {
        master2 = {
          id: 'class-' + Date.now() + '-2',
          name: candB,
          stereotype: 'Entity',
          attributes: generarAtributosPorDefecto(candB),
          methods: generarMetodosPorDefecto(candB),
          position: { x: 520, y: 150 }
        };
        nuevasClasesSintetizadas.push(master2);
      }
    }

    // Si solo hay 1 master identificado y en el lienzo hay al menos otra clase, usarla como destino
    if (master1 && !master2 && existingClasses.length > 0) {
      const m1Id = master1.id;
      master2 = existingClasses.find(c => c.id !== m1Id) || null;
    } else if (master2 && !master1 && existingClasses.length > 0) {
      const m2Id = master2.id;
      master1 = existingClasses.find(c => c.id !== m2Id) || null;
    }

    if (master1 && master2 && master1.id !== master2.id) {
      const m1 = master1;
      const m2 = master2;
      // 8.4 LEY ASOCIATIVA UML 2.5: Muchos a Muchos (N:M)
      if (esNM) {
        let assocClass: ClaseUml | null = null;
        let esNuevaAssoc = false;

        if (explicitAssocName) {
          const yaExiste = existingClasses.find(c => c.name.toLowerCase() === explicitAssocName.toLowerCase());
          if (yaExiste) {
            assocClass = {
              ...yaExiste,
              stereotype: 'AssociationClass',
              attributes: (yaExiste.attributes || []).filter(a => a.name.toLowerCase() !== 'id').map(a => ({ ...a, isPrimaryKey: false }))
            };
          } else {
            const suggestion = inferirTablaIntermedia(master1, master2, existingClasses);
            const sPos = master1.position || { x: 150, y: 150 };
            const tPos = master2.position || { x: 550, y: 150 };
            const midX = Math.round((sPos.x + tPos.x) / 2);
            const midY = Math.max(sPos.y, tPos.y) + 180;

            assocClass = {
              id: 'cls-assoc-' + Date.now(),
              name: explicitAssocName,
              stereotype: 'AssociationClass',
              attributes: suggestion.atributos.filter(a => a.name.toLowerCase() !== 'id').map(a => ({ ...a, isPrimaryKey: false })),
              methods: suggestion.metodos || [],
              position: { x: midX, y: midY }
            };
            esNuevaAssoc = true;
          }
        } else {
          // Búsqueda de clase asociativa ya existente para estas entidades
          const yaExisteAssoc = existingClasses.find(c =>
            c.id !== m1.id && c.id !== m2.id &&
            (c.stereotype === 'AssociationClass' || c.name.toLowerCase().includes('detalle') || c.name.toLowerCase().includes('asociat') ||
             c.name.toLowerCase() === (m1.name.toLowerCase() + m2.name.toLowerCase()) ||
             c.name.toLowerCase() === (m2.name.toLowerCase() + m1.name.toLowerCase()))
          );

          if (yaExisteAssoc) {
            assocClass = {
              ...yaExisteAssoc,
              stereotype: 'AssociationClass',
              attributes: (yaExisteAssoc.attributes || []).filter(a => a.name.toLowerCase() !== 'id').map(a => ({ ...a, isPrimaryKey: false }))
            };
          } else {
            const suggestion = inferirTablaIntermedia(master1, master2, existingClasses);
            assocClass = {
              id: 'cls-assoc-' + Date.now(),
              name: suggestion.nombreClase,
              stereotype: 'AssociationClass',
              attributes: suggestion.atributos.filter(a => a.name.toLowerCase() !== 'id').map(a => ({ ...a, isPrimaryKey: false })),
              methods: suggestion.metodos || [],
              position: suggestion.posicion
            };
            esNuevaAssoc = true;
          }
        }

        // Relación principal N:M entre las 2 entidades maestras con conector T hacia la clase asociativa
        const relNM: RelacionUml = {
          id: 'rel-' + Date.now() + '-nm',
          sourceClassId: master1.id,
          targetClassId: master2.id,
          type: 'ASSOCIATION_N_M',
          sourceMultiplicity: '*',
          targetMultiplicity: '1..*',
          label: assocClass.name,
          associationClassId: assocClass.id
        };

        return {
          success: true,
          action: 'CREATE_RELATION',
          reasoning: "En cumplimiento estricto de la Ley Asociativa UML 2.5, la relación N:M entre '" + master1.name + "' y '" + master2.name + "' se conecta a la clase asociativa '" + assocClass.name + "' mediante conector punteado perpendicular en T (sin aristas binarias directas redundantes).",
          newRelation: relNM,
          createdClass: esNuevaAssoc ? assocClass : undefined,
          createdClasses: nuevasClasesSintetizadas.length > 0 ? nuevasClasesSintetizadas : undefined,
          message: "Ley asociativa UML 2.5 aplicada: '" + master1.name + "' y '" + master2.name + "' vinculadas en N:M con la clase asociativa '" + assocClass.name + "'."
        };
      }

      // 8.5 Otras relaciones (1:N, 1:1, Herencia, Composición)
      let relType: RelacionUml['type'] = 'ASSOCIATION_1_N';
      let srcMult = '1';
      let tgtMult = '0..*';
      let relLabel = 'gestiona';

      if (es1a1) {
        relType = 'ASSOCIATION_1_1';
        srcMult = '1';
        tgtMult = '1';
        relLabel = 'contiene';
      } else if (esHerencia) {
        relType = 'INHERITANCE';
        srcMult = '1';
        tgtMult = '1';
        relLabel = 'extiende';
      } else if (esComposicion) {
        relType = 'COMPOSITION';
        srcMult = '1';
        tgtMult = '0..*';
        relLabel = 'compone';
      }

      let srcClassObj = master1;
      let tgtClassObj = master2;

      // Si es 1:N, garantizar dirección Maestro (1) -> Transacción (*)
      if (relType === 'ASSOCIATION_1_N') {
        const dir = inferirDireccionMaestroTransaccion(srcClassObj.name, tgtClassObj.name);
        if (!dir.origenEsMaestro) {
          srcClassObj = master2;
          tgtClassObj = master1;
        }
      }

      // Si es Herencia, la subclase (hija) apunta a la superclase (padre) en UML (──▷)
      if (relType === 'INHERITANCE') {
        if (lower.includes('hereda de') || lower.includes('extiende de') || lower.includes('subclase de')) {
          const pos0 = lower.indexOf(master1.name.toLowerCase());
          const pos1 = lower.indexOf(master2.name.toLowerCase());
          if (pos1 !== -1 && pos0 !== -1 && pos1 < pos0) {
            srcClassObj = master2;
            tgtClassObj = master1;
          }
        }
      }

      const rel: RelacionUml = {
        id: 'rel-' + Date.now(),
        sourceClassId: srcClassObj.id,
        targetClassId: tgtClassObj.id,
        type: relType,
        sourceMultiplicity: srcMult,
        targetMultiplicity: tgtMult,
        label: relLabel
      };

      return {
        success: true,
        action: 'CREATE_RELATION',
        reasoning: "Se generó la relación " + relType + " entre '" + srcClassObj.name + "' y '" + tgtClassObj.name + "'.",
        newRelation: rel,
        createdClasses: nuevasClasesSintetizadas.length > 0 ? nuevasClasesSintetizadas : undefined,
        message: "Relación creada entre " + srcClassObj.name + " (" + srcMult + ") y " + tgtClassObj.name + " (" + tgtMult + ")."
      };
    }
  }

  // 9. Fallback inteligente: si el texto parece ser el nombre de una entidad no detectada previamente
  const words = clean.split(/\s+/);
  const stopWordsConversacion = new Set([
    'hola', 'buenas', 'que', 'tal', 'ayuda', 'si', 'no', 'ok', 'bien', 'gracias', 'adios', 'chao',
    'hey', 'hello', 'hi', 'error', 'prueba', 'test', 'nada', 'cancelar', 'porfa', 'favor'
  ]);
  if (words.length <= 3 && !words.some(w => stopWordsConversacion.has(w.toLowerCase()))) {
    const candidateName = capitalize(words[words.length - 1].replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9]/g, ''));
    if (candidateName.length >= 3 && !stopWordsConversacion.has(candidateName.toLowerCase())) {
      const baseOffset = existingClasses.length;
      const posX = 120 + (baseOffset % 3) * 340;
      const posY = 140 + Math.floor(baseOffset / 3) * 280;

      const fallbackClass: ClaseUml = {
        id: 'class-' + Date.now(),
        name: candidateName,
        stereotype: 'Entity',
        attributes: generarAtributosPorDefecto(candidateName),
        methods: generarMetodosPorDefecto(candidateName),
        position: { x: posX, y: posY }
      };

      return {
        success: true,
        action: 'CREATE_CLASS',
        reasoning: `Interpretado automáticamente como solicitud para crear la entidad '${candidateName}'.`,
        createdClass: fallbackClass,
        message: `Clase UML '${candidateName}' generada automáticamente.`
      };
    }
  }

  return {
    success: false,
    action: 'UNKNOWN',
    reasoning: 'No se pudo mapear el comando a una operación UML conocida.',
    message: 'Prueba: "auditar proyecto", "crear clase Factura", "sistema de ventas", "relaciona Cliente con Pedido".'
  };
}
