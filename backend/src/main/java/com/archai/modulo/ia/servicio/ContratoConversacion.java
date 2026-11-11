package com.archai.modulo.ia.servicio;

import static com.archai.modulo.colaboracion.servicio.MotorBorrador.*;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;

/** The same contract serves conversation, clarification and optional UML changes. */
public final class ContratoConversacion {

    private ContratoConversacion() {}

    public static ObjectNode schema() {
        ObjectNode n = ContratoPropuestaNube.schema();
        ObjectNode deletion = JsonNodeFactory.instance
            .objectNode()
            .put("type", "object")
            .put("additionalProperties", false);
        ObjectNode fields = deletion.putObject("properties");
        fields
            .putObject("kind")
            .put("type", "string")
            .putArray("enum")
            .add("class")
            .add("attribute")
            .add("method")
            .add("relation");
        fields.putObject("targetId").put("type", "string");
        fields.putObject("classId").put("type", "string");
        deletion.putArray("required").add("kind").add("targetId").add("classId");
        ObjectNode arr = JsonNodeFactory.instance.objectNode().put("type", "array");
        arr.set("items", deletion);
        ((ObjectNode) n.path("properties")).set("deletions", arr);
        ((ArrayNode) n.path("required")).add("deletions");
        return n;
    }

    public static boolean cambios(JsonNode n) {
        return n.path("classes").size() > 0 || n.path("relations").size() > 0 || n.path("deletions").size() > 0;
    }

    public static void validar(ObjectNode n, ObjectNode official, boolean automatic) {
        if (n.path("skip").asBoolean()) {
            if (!automatic) throw error("La consulta explícita no puede omitirse.");
            return;
        }
        if (!texto(n, "clarification").isBlank()) return;
        if (texto(n, "explanation").isBlank()) throw error("La respuesta está vacía.");
        lista(n, "classes");
        lista(n, "relations");
        if (cambios(n)) normalizar(n, official);
    }

    public static ObjectNode normalizar(ObjectNode data, ObjectNode official) {
        ObjectNode draft = JsonNodeFactory.instance.objectNode();
        ArrayNode classes = draft.putArray("classes"),
            relations = draft.putArray("relations"),
            deletions = draft.putArray("deletions");
        Map<String, String> names = new HashMap<>();
        official
            .path("classes")
            .forEach(c -> names.put(texto(c, "name").strip().toLowerCase(Locale.ROOT), texto(c, "id")));
        for (JsonNode item : lista(data, "classes")) {
            ObjectNode c = objeto(item).deepCopy();
            String name = texto(c, "name").strip();
            String target = texto(c, "targetClassId");
            if (target.isBlank()) target = names.getOrDefault(name.toLowerCase(Locale.ROOT), "");
            JsonNode original = buscar(official.path("classes"), target);
            c.put("id", UUID.randomUUID().toString()).put("name", name);
            if (!target.isBlank()) c.put("targetClassId", target);
            else c.remove("targetClassId");
            if (!c.hasNonNull("stereotype")) c.put(
                "stereotype",
                original == null ? "Entity" : texto(original, "stereotype")
            );
            for (String kind : List.of("attributes", "methods"))
                for (JsonNode raw : lista(c, kind)) {
                    ObjectNode m = objeto(raw);
                    m.put("id", UUID.randomUUID().toString());
                    if (!m.hasNonNull("visibility")) m.put("visibility", "+");
                    if (kind.equals("methods") && !m.hasNonNull("returnType")) m.put("returnType", "void");
                    if (kind.equals("attributes") && !m.has("isPrimaryKey")) m.put(
                        "isPrimaryKey",
                        texto(m, "name").equals("id")
                    );
                    if (original != null) for (JsonNode old : original.path(kind))
                        if (texto(old, "name").equals(texto(m, "name")) && !m.hasNonNull("targetMemberId")) m.put(
                            "targetMemberId",
                            texto(old, "id")
                        );
                }
            names.put(name.toLowerCase(Locale.ROOT), texto(c, "id"));
            classes.add(c);
        }
        for (JsonNode raw : lista(data, "relations")) {
            ObjectNode r = objeto(raw).deepCopy();
            r.put("id", UUID.randomUUID().toString());
            for (String side : List.of("source", "target")) {
                String id = names.get(
                    texto(r, side + "Name")
                        .strip()
                        .toLowerCase(Locale.ROOT)
                );
                if (id == null) throw error("La relación menciona una clase desconocida.");
                r.put(side + "ClassId", id);
            }
            if (!texto(r, "associationClassName").isBlank()) {
                String id = names.get(texto(r, "associationClassName").toLowerCase(Locale.ROOT));
                if (id == null) throw error("La clase asociativa no existe.");
                r.put("associationClassId", id);
            }
            if (texto(r, "sourceMultiplicity").isBlank()) r.put(
                "sourceMultiplicity",
                texto(r, "type").equals("ASSOCIATION_N_M") ? "0..*" : "1"
            );
            if (texto(r, "targetMultiplicity").isBlank()) r.put(
                "targetMultiplicity",
                Set.of("ASSOCIATION_1_N", "ASSOCIATION_N_M").contains(texto(r, "type")) ? "0..*" : "1"
            );
            relations.add(r);
        }
        for (JsonNode raw : data.path("deletions")) {
            ObjectNode d = objeto(raw).deepCopy();
            d.put("id", UUID.randomUUID().toString());
            String kind = texto(d, "kind"),
                id = texto(d, "targetId");
            JsonNode target = kind.equals("class")
                ? buscar(official.path("classes"), id)
                : kind.equals("relation")
                  ? buscar(official.path("relations"), id)
                  : null;
            if (kind.equals("attribute") || kind.equals("method")) {
                JsonNode parent = buscar(official.path("classes"), texto(d, "classId"));
                if (parent != null) target = buscar(
                    parent.path(kind.equals("attribute") ? "attributes" : "methods"),
                    id
                );
            }
            if (target == null) throw error("El elemento que se quiere eliminar no existe.");
            d.put("label", kind.equals("relation") ? "Relación UML" : texto(target, "name"));
            ArrayNode affected = d.putArray("affectedRelationIds");
            if (kind.equals("class")) for (JsonNode r : official.path("relations"))
                if (
                    List.of(
                        texto(r, "sourceClassId"),
                        texto(r, "targetClassId"),
                        texto(r, "associationClassId")
                    ).contains(id)
                ) affected.add(texto(r, "id"));
            deletions.add(d);
        }
        com.archai.modulo.colaboracion.servicio.MotorBorrador.validar(draft, official);
        return draft;
    }
}
