import { ModeloDiagrama, ClaseUml } from '../types/uml';

export interface VisualExportOptions {
  theme?: 'dark' | 'light' | 'transparent';
  scale?: number; // 1 = normal, 2 = HD Retina (default), 3 = Ultra HD / Impresión
  padding?: number;
  watermark?: boolean;
}

/**
 * Escapa caracteres especiales para XML/SVG.
 */
function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Calcula las dimensiones y la caja envolvente de una clase en el diagrama.
 */
interface ClassLayout {
  cls: ClaseUml;
  x: number;
  y: number;
  w: number;
  h: number;
  headerH: number;
  attrH: number;
  methodH: number;
}

function calculateClassLayouts(classes: ClaseUml[]): ClassLayout[] {
  const CARD_WIDTH = 320;
  const HEADER_BASE_H = 48;
  const ATTR_LINE_H = 22;
  const METHOD_LINE_H = 22;
  const SECTION_PAD = 12;

  return classes.map((cls, idx) => {
    const x = cls.position?.x ?? 80 + (idx % 3) * 360;
    const y = cls.position?.y ?? 60 + Math.floor(idx / 3) * 320;

    const hasStereo = Boolean(cls.stereotype);
    const headerH = HEADER_BASE_H + (hasStereo ? 14 : 0);

    const attrCount = cls.attributes?.length || 0;
    const attrH = attrCount > 0 ? SECTION_PAD + attrCount * ATTR_LINE_H : 0;

    const methodCount = cls.methods?.length || 0;
    const methodH = methodCount > 0 ? SECTION_PAD + methodCount * METHOD_LINE_H : 0;

    const h = headerH + attrH + methodH + (attrCount === 0 && methodCount === 0 ? 30 : 10);

    return {
      cls,
      x,
      y,
      w: CARD_WIDTH,
      h,
      headerH,
      attrH,
      methodH
    };
  });
}

/**
 * Genera el documento SVG vectorial autocontenido y listo para exportación o renderizado.
 */
export function generateDiagramSvg(diagram: ModeloDiagrama, options: VisualExportOptions = {}): {
  svg: string;
  width: number;
  height: number;
} {
  const {
    theme = 'dark',
    padding = 60,
    watermark = true
  } = options;

  const isLight = theme === 'light';
  const isDark = theme === 'dark';

  // Paleta de colores según tema
  const colors = {
    bg: isLight ? '#ffffff' : (isDark ? '#08091e' : 'none'),
    cardBg: isLight ? '#fbfcfe' : '#131642',
    cardBorder: isLight ? '#cbd5e1' : 'rgba(232, 195, 158, 0.35)',
    headerBg: isLight ? '#f1f5f9' : '#1c2058',
    headerBorder: isLight ? '#e2e8f0' : 'rgba(232, 195, 158, 0.2)',
    title: isLight ? '#0f172a' : '#f5e1ce',
    stereotype: isLight ? '#4f46e5' : '#e8c39e',
    text: isLight ? '#334155' : '#e2e8f0',
    textMuted: isLight ? '#64748b' : '#8892b0',
    typeText: isLight ? '#2563eb' : '#38bdf8',
    pkBadge: isLight ? '#dc2626' : '#f87171',
    lineColor: isLight ? '#334155' : '#818cf8',
    gridColor: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)'
  };

  const layouts = calculateClassLayouts(diagram.classes);

  if (layouts.length === 0) {
    const emptyW = 600;
    const emptyH = 400;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${emptyW} ${emptyH}" width="${emptyW}" height="${emptyH}">
        <rect width="100%" height="100%" fill="${colors.bg}" />
        <text x="50%" y="50%" text-anchor="middle" fill="${colors.title}" font-family="Inter, system-ui, sans-serif" font-size="16">
          El diagrama no contiene clases para exportar
        </text>
      </svg>
    `.trim();
    return { svg, width: emptyW, height: emptyH };
  }

  // Calcular límites envolventes
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  layouts.forEach(l => {
    if (l.x < minX) minX = l.x;
    if (l.y < minY) minY = l.y;
    if (l.x + l.w > maxX) maxX = l.x + l.w;
    if (l.y + l.h > maxY) maxY = l.y + l.h;
  });

  const viewBoxX = minX - padding;
  const viewBoxY = minY - padding;
  const width = Math.max(200, maxX - minX + padding * 2);
  const height = Math.max(200, maxY - minY + padding * 2 + (watermark ? 30 : 0));

  const layoutMap = new Map<string, ClassLayout>();
  layouts.forEach(l => layoutMap.set(l.cls.id, l));

  // Generar marcadores SVG para relaciones UML
  const defs = `
    <defs>
      <!-- Herencia / Generalización: Triángulo hueco -->
      <marker id="marker-inheritance" markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto">
        <polygon points="1,1 13,7 1,13" fill="${isLight ? '#ffffff' : '#131642'}" stroke="${colors.lineColor}" stroke-width="1.8" />
      </marker>

      <!-- Realización: Triángulo hueco (para línea discontinua) -->
      <marker id="marker-realization" markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto">
        <polygon points="1,1 13,7 1,13" fill="${isLight ? '#ffffff' : '#131642'}" stroke="${colors.lineColor}" stroke-width="1.8" />
      </marker>

      <!-- Composición: Diamante relleno -->
      <marker id="marker-composition" markerWidth="16" markerHeight="12" refX="0" refY="6" orient="auto">
        <polygon points="0,6 8,1 16,6 8,11" fill="${colors.lineColor}" stroke="${colors.lineColor}" stroke-width="1.5" />
      </marker>

      <!-- Agregación: Diamante hueco -->
      <marker id="marker-aggregation" markerWidth="16" markerHeight="12" refX="0" refY="6" orient="auto">
        <polygon points="0,6 8,1 16,6 8,11" fill="${isLight ? '#ffffff' : '#131642'}" stroke="${colors.lineColor}" stroke-width="1.8" />
      </marker>

      <!-- Asociación dirigida / Navegabilidad -->
      <marker id="marker-navigable" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto">
        <polyline points="2,1 11,6 2,11" fill="none" stroke="${colors.lineColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </marker>

      <!-- Dependencia: Flecha abierta -->
      <marker id="marker-dependency" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto">
        <polyline points="2,2 11,6 2,10" fill="none" stroke="${colors.lineColor}" stroke-width="1.8" />
      </marker>

      <filter id="card-shadow" x="-8%" y="-8%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.5)'}" />
      </filter>
    </defs>
  `.trim();

  // Generar trazado de relaciones UML
  const relationsMarkup = (diagram.relations || []).map(rel => {
    const src = layoutMap.get(rel.sourceClassId);
    const tgt = layoutMap.get(rel.targetClassId);
    if (!src || !tgt) return '';

    const srcCx = src.x + src.w / 2;
    const srcCy = src.y + src.h / 2;
    const tgtCx = tgt.x + tgt.w / 2;
    const tgtCy = tgt.y + tgt.h / 2;

    const dx = tgtCx - srcCx;
    const dy = tgtCy - srcCy;

    let srcX = srcCx;
    let srcY = srcCy;
    let tgtX = tgtCx;
    let tgtY = tgtCy;

    // Calcular puntos de intersección con los bordes de las tarjetas
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        srcX = src.x + src.w;
        tgtX = tgt.x;
      } else {
        srcX = src.x;
        tgtX = tgt.x + tgt.w;
      }
    } else {
      if (dy > 0) {
        srcY = src.y + src.h;
        tgtY = tgt.y;
      } else {
        srcY = src.y;
        tgtY = tgt.y + tgt.h;
      }
    }

    let markerEnd = '';
    let markerStart = '';
    let isDashed = false;

    switch (rel.type) {
      case 'INHERITANCE':
        markerEnd = 'url(#marker-inheritance)';
        break;
      case 'REALIZATION':
        markerEnd = 'url(#marker-realization)';
        isDashed = true;
        break;
      case 'COMPOSITION':
        markerStart = 'url(#marker-composition)';
        break;
      case 'AGGREGATION':
        markerStart = 'url(#marker-aggregation)';
        break;
      case 'DEPENDENCY':
      case 'USAGE':
        markerEnd = 'url(#marker-dependency)';
        isDashed = true;
        break;
      case 'ASSOCIATION_1_N':
      case 'ASSOCIATION_N_M':
      case 'ASSOCIATION_1_1':
      case 'ASSOCIATION_BINARY':
      default:
        markerEnd = 'url(#marker-navigable)';
        break;
    }

    const midX = (srcX + tgtX) / 2;
    const midY = (srcY + tgtY) / 2;

    const labelMarkup = rel.label ? `
      <g transform="translate(${midX}, ${midY - 8})">
        <rect x="-40" y="-10" width="80" height="18" rx="4" fill="${colors.cardBg}" stroke="${colors.cardBorder}" stroke-width="0.8" opacity="0.9" />
        <text x="0" y="3" text-anchor="middle" fill="${colors.textMuted}" font-family="Inter, system-ui, sans-serif" font-size="9.5" font-weight="600">
          ${escapeXml(rel.label)}
        </text>
      </g>
    ` : '';

    const srcMultMarkup = rel.sourceMultiplicity ? `
      <text x="${srcX + (dx > 0 ? 12 : -12)}" y="${srcY + (dy > 0 ? 14 : -10)}" text-anchor="${dx > 0 ? 'start' : 'end'}" fill="${colors.textMuted}" font-family="monospace" font-size="9" font-weight="700">
        ${escapeXml(rel.sourceMultiplicity)}
      </text>
    ` : '';

    const tgtMultMarkup = rel.targetMultiplicity ? `
      <text x="${tgtX + (dx > 0 ? -12 : 12)}" y="${tgtY + (dy > 0 ? -10 : 14)}" text-anchor="${dx > 0 ? 'end' : 'start'}" fill="${colors.textMuted}" font-family="monospace" font-size="9" font-weight="700">
        ${escapeXml(rel.targetMultiplicity)}
      </text>
    ` : '';

    return `
      <g class="uml-relation" data-id="${rel.id}">
        <line
          x1="${srcX}"
          y1="${srcY}"
          x2="${tgtX}"
          y2="${tgtY}"
          stroke="${colors.lineColor}"
          stroke-width="1.8"
          ${isDashed ? 'stroke-dasharray="6,4"' : ''}
          ${markerStart ? `marker-start="${markerStart}"` : ''}
          ${markerEnd ? `marker-end="${markerEnd}"` : ''}
        />
        ${labelMarkup}
        ${srcMultMarkup}
        ${tgtMultMarkup}
      </g>
    `;
  }).join('\n');

  // Generar marcado de clases UML
  const classesMarkup = layouts.map(l => {
    const { cls, x, y, w, h, headerH } = l;

    const stereotypeMarkup = cls.stereotype ? `
      <text x="${w / 2}" y="18" text-anchor="middle" fill="${colors.stereotype}" font-family="Inter, system-ui, sans-serif" font-size="10.5" font-style="italic" font-weight="700" letter-spacing="0.04em">
        «${escapeXml(cls.stereotype)}»
      </text>
    ` : '';

    const titleY = cls.stereotype ? 35 : 28;

    let currentY = headerH;

    // Compartimento de Atributos
    let attrMarkup = '';
    if (cls.attributes && cls.attributes.length > 0) {
      currentY += 4;
      const attrLines = cls.attributes.map(attr => {
        const textY = currentY + 14;
        currentY += 22;
        const vis = attr.visibility || '+';
        const pk = attr.isPrimaryKey ? ' {PK}' : '';
        return `
          <text x="14" y="${textY}" fill="${colors.text}" font-family="Inter, system-ui, sans-serif" font-size="11">
            <tspan fill="${colors.textMuted}" font-family="monospace" font-weight="700">${vis} </tspan>
            <tspan font-weight="600">${escapeXml(attr.name)}: </tspan>
            <tspan fill="${colors.typeText}">${escapeXml(attr.type || 'String')}</tspan>
            ${pk ? `<tspan fill="${colors.pkBadge}" font-weight="800">${pk}</tspan>` : ''}
          </text>
        `;
      }).join('\n');

      attrMarkup = `
        <line x1="0" y1="${headerH}" x2="${w}" y2="${headerH}" stroke="${colors.headerBorder}" stroke-width="1.2" />
        <g class="uml-attributes">
          ${attrLines}
        </g>
      `;
    }

    // Compartimento de Métodos
    let methodMarkup = '';
    if (cls.methods && cls.methods.length > 0) {
      const methodDividerY = currentY + 6;
      currentY += 10;
      const methodLines = cls.methods.map(method => {
        const textY = currentY + 14;
        currentY += 22;
        const vis = method.visibility || '+';
        const params = method.parameters ? escapeXml(method.parameters) : '';
        return `
          <text x="14" y="${textY}" fill="${colors.text}" font-family="Inter, system-ui, sans-serif" font-size="11">
            <tspan fill="${colors.textMuted}" font-family="monospace" font-weight="700">${vis} </tspan>
            <tspan font-weight="500">${escapeXml(method.name)}(${params}): </tspan>
            <tspan fill="${colors.typeText}">${escapeXml(method.returnType || 'void')}</tspan>
          </text>
        `;
      }).join('\n');

      methodMarkup = `
        <line x1="0" y1="${methodDividerY}" x2="${w}" y2="${methodDividerY}" stroke="${colors.headerBorder}" stroke-width="1.2" />
        <g class="uml-methods">
          ${methodLines}
        </g>
      `;
    }

    return `
      <g class="uml-class-card" transform="translate(${x}, ${y})" filter="url(#card-shadow)">
        <!-- Fondo de Tarjeta -->
        <rect
          x="0"
          y="0"
          width="${w}"
          height="${h}"
          rx="12"
          fill="${colors.cardBg}"
          stroke="${colors.cardBorder}"
          stroke-width="1.5"
        />

        <!-- Encabezado -->
        <rect
          x="0"
          y="0"
          width="${w}"
          height="${headerH}"
          rx="12"
          fill="${colors.headerBg}"
        />
        <!-- Máscara plana inferior para unir cabecera con el cuerpo -->
        <rect
          x="0"
          y="${headerH - 6}"
          width="${w}"
          height="6"
          fill="${colors.headerBg}"
        />

        ${stereotypeMarkup}

        <text x="${w / 2}" y="${titleY}" text-anchor="middle" fill="${colors.title}" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="800">
          ${escapeXml(cls.name)}
        </text>

        ${attrMarkup}
        ${methodMarkup}
      </g>
    `;
  }).join('\n');

  // Marca de agua sutil de ArchAI
  const watermarkMarkup = watermark ? `
    <g transform="translate(${viewBoxX + width - padding}, ${viewBoxY + height - 16})">
      <text text-anchor="end" fill="${colors.textMuted}" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="600" opacity="0.6">
        ArchAI · Herramienta CASE UML 2.5
      </text>
    </g>
  ` : '';

  const svg = `
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="${viewBoxX} ${viewBoxY} ${width} ${height}"
  width="${width}"
  height="${height}"
  style="background-color: ${colors.bg};"
>
  ${defs}

  ${colors.bg !== 'none' ? `<rect x="${viewBoxX}" y="${viewBoxY}" width="${width}" height="${height}" fill="${colors.bg}" />` : ''}

  <!-- Capa de Relaciones UML -->
  <g id="layer-relations">
    ${relationsMarkup}
  </g>

  <!-- Capa de Clasificadores UML -->
  <g id="layer-classes">
    ${classesMarkup}
  </g>

  ${watermarkMarkup}
</svg>
  `.trim();

  return { svg, width, height };
}

/**
 * Descarga el diagrama actual como archivo SVG vectorial (.svg).
 */
export function exportDiagramAsSvg(diagram: ModeloDiagrama, options: VisualExportOptions = {}): void {
  const { svg } = generateDiagramSvg(diagram, options);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const fileName = `${(diagram.title || 'diagrama_uml').toLowerCase().replace(/\s+/g, '_')}.svg`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Renderiza el diagrama a alta resolución y lo descarga como imagen PNG (.png).
 */
export function exportDiagramAsPng(diagram: ModeloDiagrama, options: VisualExportOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const scale = options.scale ?? 2; // Por defecto 2x para resolución nítida Retina/Print
      const { svg, width, height } = generateDiagramSvg(diagram, options);

      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = width * scale;
          canvas.height = height * scale;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error('No se pudo obtener el contexto 2D del Canvas'));
            return;
          }

          // Renderizar con máxima calidad
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);

          canvas.toBlob(pngBlob => {
            URL.revokeObjectURL(url);
            if (!pngBlob) {
              reject(new Error('Error al generar el Blob PNG'));
              return;
            }

            const pngUrl = URL.createObjectURL(pngBlob);
            const fileName = `${(diagram.title || 'diagrama_uml').toLowerCase().replace(/\s+/g, '_')}.png`;

            const link = document.createElement('a');
            link.href = pngUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(pngUrl);
            resolve();
          }, 'image/png');
        } catch (canvasErr) {
          URL.revokeObjectURL(url);
          reject(canvasErr);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Error al cargar el SVG generado en el elemento de imagen'));
      };

      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}
