import { ModeloDiagrama, ClaseUml, RelacionUml } from '../types/uml';

export interface ArchAiProjectFile {
  format: 'archai-model';
  version: '2.5.0';
  exportedAt: string;
  project: {
    title: string;
    description?: string;
  };
  diagram: ModeloDiagrama;
  metadata?: {
    totalClasses: number;
    totalRelations: number;
    author?: string;
  };
}

/**
 * Normaliza y valida una estructura JSON para asegurar que cumple con el estándar ModeloDiagrama.
 */
export function normalizeImportedDiagram(parsed: any, fallbackTitle = 'Diagrama Importado'): ModeloDiagrama {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('El archivo no contiene un objeto JSON válido.');
  }

  // 1. Extraer el objeto diagrama si viene en formato completo ArchAiProjectFile
  let rawDiagram: any = parsed;
  if (parsed.format === 'archai-model' && parsed.diagram) {
    rawDiagram = parsed.diagram;
  } else if (parsed.diagram && typeof parsed.diagram === 'object') {
    rawDiagram = parsed.diagram;
  }

  // 2. Extraer título
  const title = (rawDiagram.title || parsed.project?.title || parsed.nombre || fallbackTitle).trim();

  // 3. Normalizar clases
  const rawClasses = Array.isArray(rawDiagram.classes)
    ? rawDiagram.classes
    : (Array.isArray(rawDiagram.clases) ? rawDiagram.clases : []);

  const normalizedClasses: ClaseUml[] = rawClasses.map((cls: any, idx: number) => {
    const id = cls.id ? String(cls.id) : `cls-${idx + 1}-${Date.now().toString(36)}`;
    const name = (cls.name || cls.nombre || `Clase${idx + 1}`).trim();
    const stereotype = cls.stereotype || cls.estereotipo || 'Class';

    const rawPos = cls.position || cls.posicion;
    const posX = typeof rawPos?.x === 'number' ? rawPos.x : 80 + (idx % 3) * 360;
    const posY = typeof rawPos?.y === 'number' ? rawPos.y : 60 + Math.floor(idx / 3) * 320;

    const rawAttrs = Array.isArray(cls.attributes)
      ? cls.attributes
      : (Array.isArray(cls.atributos) ? cls.atributos : []);

    const attributes = rawAttrs.map((a: any, aIdx: number) => ({
      id: a.id ? String(a.id) : `attr-${id}-${aIdx}`,
      name: (a.name || a.nombre || `attr${aIdx + 1}`).trim(),
      type: (a.type || a.tipo || 'String').trim(),
      visibility: (a.visibility || a.visibilidad || '+') as any,
      isPrimaryKey: Boolean(a.isPrimaryKey || a.clavePrimaria || a.is_primary_key),
      isStatic: Boolean(a.isStatic),
      isDerived: Boolean(a.isDerived),
      isReadOnly: Boolean(a.isReadOnly),
      multiplicity: a.multiplicity ? String(a.multiplicity) : undefined
    }));

    const rawMethods = Array.isArray(cls.methods)
      ? cls.methods
      : (Array.isArray(cls.metodos) ? cls.metodos : []);

    const methods = rawMethods.map((m: any, mIdx: number) => ({
      id: m.id ? String(m.id) : `m-${id}-${mIdx}`,
      name: (m.name || m.nombre || `operacion${mIdx + 1}`).trim(),
      returnType: (m.returnType || m.tipoRetorno || m.return_type || 'void').trim(),
      visibility: (m.visibility || m.visibilidad || '+') as any,
      parameters: m.parameters ? String(m.parameters) : '',
      isAbstract: Boolean(m.isAbstract),
      isStatic: Boolean(m.isStatic)
    }));

    return {
      id,
      name,
      stereotype,
      isAbstract: Boolean(cls.isAbstract),
      isInterface: Boolean(cls.isInterface || stereotype === 'Interface'),
      isInstance: Boolean(cls.isInstance || stereotype === 'Instance'),
      noteText: cls.noteText,
      position: { x: posX, y: posY },
      attributes,
      methods
    };
  });

  // 4. Normalizar relaciones
  const rawRelations = Array.isArray(rawDiagram.relations)
    ? rawDiagram.relations
    : (Array.isArray(rawDiagram.relaciones) ? rawDiagram.relaciones : []);

  const normalizedRelations: RelacionUml[] = rawRelations.map((r: any, idx: number) => {
    const id = r.id ? String(r.id) : `rel-${idx + 1}-${Date.now().toString(36)}`;
    const sourceClassId = String(r.sourceClassId || r.claseOrigenId || r.source_class_id || '');
    const targetClassId = String(r.targetClassId || r.claseDestinoId || r.target_class_id || '');

    return {
      id,
      sourceClassId,
      targetClassId,
      type: (r.type || r.tipo || 'ASSOCIATION_1_N') as any,
      sourceMultiplicity: r.sourceMultiplicity || r.multiplicidadOrigen || '1',
      targetMultiplicity: r.targetMultiplicity || r.multiplicidadDestino || '0..*',
      label: r.label || r.etiqueta,
      sourceRole: r.sourceRole,
      targetRole: r.targetRole,
      associationClassId: r.associationClassId
    };
  });

  return {
    title,
    classes: normalizedClasses,
    relations: normalizedRelations,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Exporta el diagrama completo como archivo portable `.archai.json` descargable.
 */
export function exportProjectAsArchAi(
  diagram: ModeloDiagrama,
  projectTitle?: string,
  authorName?: string
): void {
  const title = (projectTitle || diagram.title || 'Proyecto_ArchAI').trim();
  const projectFile: ArchAiProjectFile = {
    format: 'archai-model',
    version: '2.5.0',
    exportedAt: new Date().toISOString(),
    project: {
      title,
      description: 'Modelo de arquitectura UML 2.5 generado con ArchAI'
    },
    diagram,
    metadata: {
      totalClasses: diagram.classes?.length || 0,
      totalRelations: diagram.relations?.length || 0,
      author: authorName || 'Arquitecto ArchAI'
    }
  };

  const jsonContent = JSON.stringify(projectFile, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const fileName = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.archai.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Lee un archivo File desde el navegador y retorna el ModeloDiagrama normalizado.
 */
export async function readAndImportProjectFile(file: File): Promise<ModeloDiagrama> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          throw new Error('El archivo seleccionado está vacío.');
        }
        const parsed = JSON.parse(text);
        const diagram = normalizeImportedDiagram(parsed, file.name.replace(/\.[^/.]+$/, ''));
        resolve(diagram);
      } catch (err: any) {
        reject(new Error(`Error al procesar el archivo '${file.name}': ${err.message || 'JSON inválido'}`));
      }
    };
    reader.onerror = () => {
      reject(new Error(`No se pudo leer el archivo '${file.name}'.`));
    };
    reader.readAsText(file);
  });
}

/**
 * Abre el selector nativo de archivos del sistema para importar `.archai.json` o `.json`.
 */
export function openProjectFileDialog(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.archai,.archai.json';

    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0] || null;
      resolve(file);
    };

    input.oncancel = () => {
      resolve(null);
    };

    input.click();
  });
}
