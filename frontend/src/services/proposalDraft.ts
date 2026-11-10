import { AtributoUml, ClaseUml, MetodoUml, ModeloDiagrama, RelacionUml, TipoRelacion, Visibilidad } from '../types/uml';

export interface DraftClass extends ClaseUml { targetClassId?: string }
export interface DraftDiagram { classes: DraftClass[]; relations: RelacionUml[] }
const relationTypes: TipoRelacion[] = ['ASSOCIATION_1_1','ASSOCIATION_1_N','ASSOCIATION_N_M','ASSOCIATION_BINARY','NON_NAVIGABLE','COMPOSITION','AGGREGATION','INHERITANCE','REALIZATION','DEPENDENCY','USAGE','PACKAGE_IMPORT','ASSOCIATION_CLASS'];
const visibility = (s: unknown): Visibilidad => ['+','-','#','~'].includes(String(s)) ? s as Visibilidad : '+';
const id = () => `draft-${crypto.randomUUID()}`;

/** Separate from generation: an omitted official member is never interpreted as deletion. */
export function normalizeProposal(data: any, official: ModeloDiagrama): DraftDiagram {
  if (!Array.isArray(data.classes) || !Array.isArray(data.relations)) throw new Error('La propuesta no contiene listas válidas de clases y relaciones.');
  const classes: DraftClass[] = data.classes.map((raw: any) => {
    if (typeof raw.name !== 'string' || !raw.name.trim()) throw new Error('Una clase propuesta no tiene nombre.');
    const target = raw.targetClassId ? official.classes.find(c => c.id === raw.targetClassId) : undefined;
    if (raw.targetClassId && !target) throw new Error('La propuesta modifica una clase que ya no existe.');
    return {
      id:id(),name:raw.name.trim(),...(target ? {targetClassId:target.id} : {}),
      ...(raw.stereotype ? {stereotype:raw.stereotype} : {}),
      attributes: (raw.attributes || []).map((a: any): AtributoUml => {
        if (!a.name || !a.type) throw new Error('Falta el nombre o tipo de un atributo propuesto.');
        return {...a,...(target?.attributes.find(m=>m.name===a.name)?{targetMemberId:target.attributes.find(m=>m.name===a.name)!.id}:{}),id:id(),name:String(a.name).trim(),type:String(a.type).trim(),visibility:visibility(a.visibility),isPrimaryKey:a.isPrimaryKey ?? (a.name==='id')};
      }),
      methods:(raw.methods || []).map((m: any): MetodoUml => {
        if (!m.name) throw new Error('Falta el nombre de un método propuesto.');
        return {...m,...(target?.methods.find(x=>x.name===m.name)?{targetMemberId:target.methods.find(x=>x.name===m.name)!.id}:{}),id:id(),name:String(m.name).trim(),returnType:m.returnType || 'void',visibility:visibility(m.visibility),parameters:Array.isArray(m.parameters)?m.parameters.join(', '):m.parameters || ''};
      })
    };
  });
  const names = new Map<string,string>();
  official.classes.forEach(c => names.set(c.name.trim().toLowerCase(), c.id));
  classes.forEach(c => names.set(c.name.toLowerCase(), c.id));
  const resolve = (name: unknown, existingId: unknown) => {
    if (existingId && [...classes,...official.classes].some(c => c.id === existingId)) return String(existingId);
    const result = names.get(String(name || '').trim().toLowerCase());
    if (!result) throw new Error(`La relación menciona una clase desconocida: ${String(name || existingId || '')}.`);
    return result;
  };
  const relations: RelacionUml[] = data.relations.map((r: any) => {
    if (!relationTypes.includes(r.type)) throw new Error('La propuesta contiene un tipo de relación UML no válido.');
    return {...r,id:id(),sourceClassId:resolve(r.sourceName,r.sourceClassId),targetClassId:resolve(r.targetName,r.targetClassId),
      sourceMultiplicity:r.sourceMultiplicity || (r.type==='ASSOCIATION_N_M'?'0..*':'1'),
      targetMultiplicity:r.targetMultiplicity || (['ASSOCIATION_1_N','ASSOCIATION_N_M'].includes(r.type)?'0..*':'1'),
      ...(r.associationClassName?{associationClassId:resolve(r.associationClassName,r.associationClassId)}:{})};
  });
  if (!classes.length && !relations.length) throw new Error('La propuesta no contiene cambios para previsualizar.');
  return {classes,relations};
}
