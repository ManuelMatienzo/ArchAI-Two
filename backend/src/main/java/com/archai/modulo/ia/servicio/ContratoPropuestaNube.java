package com.archai.modulo.ia.servicio;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;
import static com.archai.modulo.colaboracion.servicio.MotorBorrador.*;

/** Contrato de proveedor independiente del formato visual del borrador. */
public final class ContratoPropuestaNube {
    private ContratoPropuestaNube() {}
    public static final List<String> TYPES=List.of("ASSOCIATION_1_1","ASSOCIATION_1_N","ASSOCIATION_N_M","ASSOCIATION_BINARY","NON_NAVIGABLE","COMPOSITION","AGGREGATION","INHERITANCE","REALIZATION","DEPENDENCY","USAGE","PACKAGE_IMPORT","ASSOCIATION_CLASS");
    private static ObjectNode string() {return JsonNodeFactory.instance.objectNode().put("type","string");}
    private static ObjectNode object(Map<String,JsonNode> fields,String... required) {
        ObjectNode n=JsonNodeFactory.instance.objectNode().put("type","object").put("additionalProperties",false);
        ObjectNode props=n.putObject("properties");fields.forEach(props::set);
        ArrayNode req=n.putArray("required");for(String r:required)req.add(r);return n;
    }
    private static ObjectNode array(JsonNode items) {ObjectNode n=JsonNodeFactory.instance.objectNode().put("type","array");n.set("items",items);return n;}
    public static ObjectNode schema() {
        ObjectNode visibility=string();visibility.putArray("enum").add("+").add("-").add("#").add("~");
        ObjectNode attr=object(Map.of("name",string(),"type",string(),"visibility",visibility,"targetMemberId",string(),"isPrimaryKey",JsonNodeFactory.instance.objectNode().put("type","boolean")),"name","type");
        ObjectNode method=object(Map.of("name",string(),"returnType",string(),"parameters",string(),"visibility",visibility,"targetMemberId",string()),"name");
        ObjectNode cls=object(Map.of("name",string(),"targetClassId",string(),"stereotype",string(),"attributes",array(attr),"methods",array(method)),"name","attributes","methods");
        ObjectNode type=string();ArrayNode enums=type.putArray("enum");TYPES.forEach(enums::add);
        ObjectNode rel=object(Map.of("sourceName",string(),"targetName",string(),"type",type,"sourceMultiplicity",string(),"targetMultiplicity",string(),"associationClassName",string()),"sourceName","targetName","type");
        return object(Map.of("explanation",string(),"clarification",string(),"skip",JsonNodeFactory.instance.objectNode().put("type","boolean"),"classes",array(cls),"relations",array(rel)),"explanation","clarification","skip","classes","relations");
    }
    public static void validarRespuesta(ObjectNode data,ObjectNode official,boolean automatic) {
        if(data.path("skip").asBoolean(false)) {if(!automatic)throw error("La consulta explícita no puede omitirse.");return;}
        if(!texto(data,"clarification").isBlank())return;
        if(texto(data,"explanation").isBlank())throw error("Falta la explicación de la propuesta.");
        ObjectNode draft=JsonNodeFactory.instance.objectNode();ArrayNode classes=draft.putArray("classes"),rels=draft.putArray("relations");
        Map<String,String> names=new HashMap<>();official.path("classes").forEach(c->names.put(texto(c,"name").toLowerCase(Locale.ROOT),texto(c,"id")));
        for(JsonNode raw:lista(data,"classes")) {
            ObjectNode c=objeto(raw).deepCopy();c.put("id",UUID.randomUUID().toString());
            JsonNode target=buscar(official.path("classes"),texto(c,"targetClassId"));
            for(String kind:List.of("attributes","methods"))for(JsonNode member:lista(c,kind)) {
                ObjectNode m=objeto(member);m.put("id",UUID.randomUUID().toString());
                if(kind.equals("methods") && !m.hasNonNull("returnType"))m.put("returnType","void");
                if(!m.has("visibility"))m.put("visibility","+");
                if(kind.equals("attributes") && texto(m,"type").isBlank())throw error("Falta el tipo de atributo.");
                if(target!=null && !m.hasNonNull("targetMemberId"))for(JsonNode old:target.path(kind))if(texto(old,"name").equals(texto(m,"name")))m.put("targetMemberId",texto(old,"id"));
            }
            names.put(texto(c,"name").toLowerCase(Locale.ROOT),texto(c,"id"));classes.add(c);
        }
        for(JsonNode raw:lista(data,"relations")) {
            ObjectNode r=objeto(raw).deepCopy();if(!TYPES.contains(texto(r,"type")))throw error("Tipo UML no válido.");
            r.put("id",UUID.randomUUID().toString());
            for(String side:List.of("source","target")) {
                String id=names.get(texto(r,side+"Name").toLowerCase(Locale.ROOT));
                if(id==null)throw error("La relación menciona una clase desconocida.");r.put(side+"ClassId",id);
            }
            if(r.hasNonNull("associationClassName")) {
                String id=names.get(texto(r,"associationClassName").toLowerCase(Locale.ROOT));
                if(id==null)throw error("Clase asociativa desconocida.");r.put("associationClassId",id);
            }
            if(!r.has("sourceMultiplicity"))r.put("sourceMultiplicity",texto(r,"type").equals("ASSOCIATION_N_M")?"0..*":"1");
            if(!r.has("targetMultiplicity"))r.put("targetMultiplicity",Set.of("ASSOCIATION_1_N","ASSOCIATION_N_M").contains(texto(r,"type"))?"0..*":"1");
            rels.add(r);
        }
        if(classes.isEmpty() && rels.isEmpty())throw error("La propuesta no contiene cambios.");
        validar(draft,official);
    }
}
