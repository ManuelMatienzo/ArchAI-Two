package com.archai.modulo.colaboracion.servicio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Operaciones puras sobre borradores. Nunca modifica los argumentos. */
public final class MotorBorrador {
    private MotorBorrador() {}
    public static ResponseStatusException error(String mensaje) { return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, mensaje); }
    public static String texto(JsonNode n, String campo) { return n.path(campo).asText(""); }
    public static ObjectNode objeto(JsonNode n) {
        if (!(n instanceof ObjectNode)) throw error("La propuesta debe contener una estructura válida.");
        return (ObjectNode)n;
    }
    public static ArrayNode lista(JsonNode n, String campo) {
        if (!n.path(campo).isArray()) throw error("Falta la lista de " + campo + ".");
        return (ArrayNode)n.path(campo);
    }
    public static JsonNode buscar(JsonNode lista, String id) {
        for (JsonNode n : lista) if (id.equals(texto(n,"id"))) return n;
        return null;
    }
    public static String estructura(JsonNode n) {
        if (n == null) return "";
        ObjectNode copia = objeto(n).deepCopy();
        copia.remove(List.of("updatedAt","createdAt","_reviewRevision","reviewRevision","id","proyectoId","creadorId","description"));
        for (JsonNode c : copia.path("classes")) {
            ObjectNode cls=objeto(c);cls.remove("position");
            if(!cls.hasNonNull("stereotype"))cls.put("stereotype","Entity");
            for(JsonNode attribute:cls.path("attributes")) {
                ObjectNode a=objeto(attribute);
                if(!a.hasNonNull("visibility"))a.put("visibility","+");
                if(!a.hasNonNull("isPrimaryKey"))a.put("isPrimaryKey",false);
                if(!a.hasNonNull("isNullable"))a.put("isNullable",true);
            }
            for(JsonNode method:cls.path("methods")) {
                ObjectNode m=objeto(method);
                if(!m.hasNonNull("visibility"))m.put("visibility","+");
                if(!m.hasNonNull("returnType"))m.put("returnType","void");
                if(!m.hasNonNull("parameters"))m.put("parameters","");
            }
            for(JsonNode method:c.path("methods")) if(method.path("parameters").isArray()) {
                List<String> params=new ArrayList<>();method.path("parameters").forEach(v->params.add(v.asText()));
                objeto(method).put("parameters",String.join(", ",params));
            }
        }
        return ordenar(copia).toString();
    }
    private static JsonNode ordenar(JsonNode n) {
        if (n.isObject()) {
            ObjectNode result=JsonNodeFactory.instance.objectNode();
            List<String> keys=new ArrayList<>(); n.fieldNames().forEachRemaining(keys::add); Collections.sort(keys);
            keys.forEach(k->result.set(k,ordenar(n.get(k)))); return result;
        }
        if (n.isArray()) {
            List<JsonNode> values=new ArrayList<>(); n.forEach(x->values.add(ordenar(x)));
            values.sort(Comparator.comparing(JsonNode::toString));
            ArrayNode result=JsonNodeFactory.instance.arrayNode(); values.forEach(result::add); return result;
        }
        return n;
    }
    public static void validar(ObjectNode draft, ObjectNode official) {
        Set<String> ids=new HashSet<>(), names=new HashSet<>();
        for(JsonNode c:lista(draft,"classes")) {
            String id=texto(c,"id"), name=texto(c,"name").trim();
            if(id.isBlank() || name.isBlank() || !ids.add(id) || !names.add(name.toLowerCase(Locale.ROOT))) throw error("Hay clases sin nombre o duplicadas en la propuesta.");
            String target=texto(c,"targetClassId");
            JsonNode existing=buscar(official.path("classes"),target);
            if(!target.isBlank() && existing==null) throw error("La clase que se quiere modificar ya no existe.");
            for(JsonNode other:official.path("classes")) if(texto(other,"name").equalsIgnoreCase(name) && !texto(other,"id").equals(target)) throw error("Ya existe la clase '"+name+"'. Indica una actualización o cambia su nombre.");
            for(String kind:List.of("attributes","methods")) {
                Set<String> members=new HashSet<>();
                for(JsonNode a:lista(c,kind)) {
                    if(texto(a,"id").isBlank() || texto(a,"name").isBlank() || !members.add(texto(a,"name"))) throw error("Hay miembros vacíos o repetidos en "+name+".");
                    if(!Set.of("+","-","#","~").contains(texto(a,"visibility"))) throw error("Visibilidad UML inválida en "+name+".");
                    if(texto(a,kind.equals("attributes")?"type":"returnType").isBlank()) throw error("Falta el tipo de un miembro en "+name+".");
                }
            }
            if(c.has("position") && (!c.path("position").path("x").isNumber() || !c.path("position").path("y").isNumber()
                    || !Double.isFinite(c.path("position").path("x").asDouble()) || !Double.isFinite(c.path("position").path("y").asDouble()))) throw error("Posición de borrador inválida.");
        }
        official.path("classes").forEach(c->ids.add(texto(c,"id")));
        Set<String> relations=new HashSet<>();
        for(JsonNode r:lista(draft,"relations")) {
            if(texto(r,"id").isBlank() || !relations.add(texto(r,"id"))) throw error("Relación repetida o sin identificador.");
            if(!ids.contains(texto(r,"sourceClassId")) || !ids.contains(texto(r,"targetClassId"))) throw error("Una relación apunta a una clase inexistente.");
            if(!Set.of("ASSOCIATION_1_1","ASSOCIATION_1_N","ASSOCIATION_N_M","ASSOCIATION_BINARY","NON_NAVIGABLE","COMPOSITION","AGGREGATION","INHERITANCE","REALIZATION","DEPENDENCY","USAGE","PACKAGE_IMPORT","ASSOCIATION_CLASS").contains(texto(r,"type"))) throw error("Tipo de relación UML inválido.");
            for(String end:List.of("sourceMultiplicity","targetMultiplicity")) if(!texto(r,end).matches("(\\*|[0-9]+|[0-9]+\\.\\.([0-9]+|\\*))")) throw error("Multiplicidad UML inválida. Usa 1, *, 0..1 o 0..*.");
            if(!texto(r,"associationClassId").isBlank() && !ids.contains(texto(r,"associationClassId"))) throw error("Falta la clase asociativa.");
        }
    }
    public static void ubicar(ObjectNode draft, ObjectNode official) {
        List<double[]> boxes=new ArrayList<>(); official.path("classes").forEach(c->boxes.add(caja(c)));
        for(JsonNode n:draft.path("classes")) {
            ObjectNode c=objeto(n); double[] box=caja(c); int i=0;
            do { box[0]=80+(i%4)*400; box[1]=100+(i/4)*120; i++; }
            while(colision(box,boxes));
            c.set("position",JsonNodeFactory.instance.objectNode().put("x",box[0]).put("y",box[1])); boxes.add(box);
        }
    }
    private static double[] caja(JsonNode c) { return new double[]{c.path("position").path("x").asDouble(100),c.path("position").path("y").asDouble(100),330,180+38*(c.path("attributes").size()+c.path("methods").size())}; }
    private static boolean colision(double[] a,List<double[]> boxes) { return boxes.stream().anyMatch(b->a[0]<b[0]+b[2]+50 && a[0]+a[2]+50>b[0] && a[1]<b[1]+b[3]+50 && a[1]+a[3]+50>b[1]); }

    public record Fusion(ObjectNode official, ObjectNode pending, Map<String,String> ids) {}
    public static Fusion fusionar(ObjectNode official, ObjectNode draft, Set<String> selectedClasses, Set<String> selectedRelations, Map<String,String> previousIds) {
        validar(draft,official);
        if(selectedClasses.isEmpty() && selectedRelations.isEmpty()) throw error("Selecciona al menos un elemento.");
        for(String id:selectedClasses) if(buscar(draft.path("classes"),id)==null) throw error("La selección contiene una clase que ya no está pendiente.");
        for(String id:selectedRelations) if(buscar(draft.path("relations"),id)==null) throw error("La selección contiene una relación que ya no está pendiente.");
        ObjectNode next=official.deepCopy(), remaining=draft.deepCopy(); Map<String,String> ids=new HashMap<>(previousIds);
        ArrayNode classes=lista(next,"classes"), pendingClasses=JsonNodeFactory.instance.arrayNode();
        for(JsonNode item:draft.path("classes")) {
            if(!selectedClasses.contains(texto(item,"id"))) {pendingClasses.add(item.deepCopy()); continue;}
            ObjectNode c=objeto(item).deepCopy(); String temp=texto(c,"id"), target=texto(c,"targetClassId");
            JsonNode existing=buscar(classes,target);
            if(existing!=null) {
                ObjectNode merged=objeto(existing).deepCopy();
                c.fields().forEachRemaining(e->{if(!Set.of("id","targetClassId","position","attributes","methods").contains(e.getKey())) merged.set(e.getKey(),e.getValue());});
                for(String kind:List.of("attributes","methods")) {
                    ArrayNode members=lista(merged,kind);
                    for(JsonNode proposed:c.path(kind)) {
                        JsonNode prior=buscar(members,texto(proposed,"targetMemberId"));
                        if(!texto(proposed,"targetMemberId").isBlank() && prior==null) throw error("El miembro que se quiere modificar ya no existe.");
                        if(prior==null) for(JsonNode m:members) if(texto(m,"name").equals(texto(proposed,"name"))) {prior=m;break;}
                        ObjectNode member=prior==null?JsonNodeFactory.instance.objectNode():objeto(prior).deepCopy();
                        proposed.fields().forEachRemaining(e->{if(!Set.of("id","targetMemberId").contains(e.getKey())) member.set(e.getKey(),e.getValue());});
                        member.put("id",prior==null?UUID.randomUUID().toString():texto(prior,"id"));
                        if(prior!=null) for(int i=0;i<members.size();i++) if(members.get(i)==prior) {members.set(i,member);break;}
                        if(prior==null) members.add(member);
                    }
                }
                for(int i=0;i<classes.size();i++) if(classes.get(i)==existing) classes.set(i,merged);
                ids.put(temp,target);
            } else {
                c.remove("targetClassId"); c.put("id",UUID.randomUUID().toString()); ids.put(temp,texto(c,"id"));
                for(String kind:List.of("attributes","methods")) for(JsonNode m:c.path(kind)) objeto(m).put("id",UUID.randomUUID().toString());
                classes.add(c);
            }
        }
        remaining.set("classes",pendingClasses); ArrayNode pendingRelations=JsonNodeFactory.instance.arrayNode();
        for(JsonNode item:draft.path("relations")) {
            ObjectNode r=objeto(item).deepCopy();
            for(String end:List.of("sourceClassId","targetClassId","associationClassId")) if(r.has(end)) r.put(end,ids.getOrDefault(texto(r,end),texto(r,end)));
            if(!selectedRelations.contains(texto(r,"id"))) {pendingRelations.add(r);continue;}
            for(String end:List.of("sourceClassId","targetClassId")) if(buscar(classes,texto(r,end))==null) throw error("Incluye las clases necesarias para la relación seleccionada.");
            if(!texto(r,"associationClassId").isBlank() && buscar(classes,texto(r,"associationClassId"))==null) throw error("Incluye la clase asociativa necesaria.");
            JsonNode existing=null; for(JsonNode old:next.path("relations")) if(texto(old,"sourceClassId").equals(texto(r,"sourceClassId")) && texto(old,"targetClassId").equals(texto(r,"targetClassId")) && texto(old,"type").equals(texto(r,"type"))) {existing=old;break;}
            r.put("id",existing==null?UUID.randomUUID().toString():texto(existing,"id"));
            if(existing==null) lista(next,"relations").add(r);
            else for(int i=0;i<next.path("relations").size();i++) if(next.path("relations").get(i)==existing) lista(next,"relations").set(i,r);
        }
        remaining.set("relations",pendingRelations); return new Fusion(next,remaining,ids);
    }
}
