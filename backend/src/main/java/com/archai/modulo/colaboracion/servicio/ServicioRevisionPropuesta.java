package com.archai.modulo.colaboracion.servicio;

import static com.archai.modulo.colaboracion.servicio.MotorBorrador.*;

import com.archai.comun.seguridad.ServicioJwt;
import com.archai.modulo.colaboracion.dto.MensajeColaboracionDto;
import com.archai.modulo.diagrama.repositorio.DiagramaRepository;
import com.archai.modulo.proyecto.repositorio.MiembroProyectoRepository;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Autoridad de moderación para la instancia activa. Persistencia durable de borradores: CU-21. */
@Service
@RequiredArgsConstructor
public class ServicioRevisionPropuesta {

    private final ServicioJwt jwt;
    private final DiagramaRepository diagramas;
    private final MiembroProyectoRepository miembros;
    private final ServicioSalaColaborativa salas;
    private final PersistenciaPropuesta persistencia;
    private final SimpMessagingTemplate broker;
    private final ObjectMapper mapper;
    private final com.archai.modulo.persistencia.servicio.AlmacenDocumental documentos;
    private final org.springframework.context.ApplicationEventPublisher eventos;
    private final Map<String, Estado> estados = new HashMap<>();

    private static class Estado {

        String diagramId,
            active = "",
            persistedStructure = "";
        long revision = 0,
            sequence = 0;
        ObjectNode official;
        boolean dirty, checkpointDirty;
        long changedAt,
            lastCheckpoint = System.currentTimeMillis();
        final Deque<ObjectNode> undo = new ArrayDeque<>(),
            redo = new ArrayDeque<>();
        final Map<String, ObjectNode> proposals = new LinkedHashMap<>();
        final Map<String, ObjectNode> results = new LinkedHashMap<>();
    }

    private record Acceso(String id, boolean edit) {}

    public String usuario(String auth) {
        String token = auth != null && auth.startsWith("Bearer ") ? auth.substring(7) : "";
        return String.valueOf(
            jwt
                .validarToken(token)
                .orElseThrow(() ->
                    new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Inicia sesión para continuar.")
                )
                .get("sub")
        );
    }

    public synchronized String autorizarLectura(String room, String id, String auth) {
        String user = usuario(auth);
        autorizarLecturaUsuario(room, id, user);
        return user;
    }

    public synchronized void autorizarLecturaUsuario(String room, String id, String user) {
        permisos(id, user);
        sala(room, id);
    }

    public synchronized boolean puedeEditar(String id, String user) {
        return permisos(id, user).edit;
    }

    public synchronized ObjectNode estadoUsuario(String room, String id, String user) {
        permisos(id, user);
        return snapshot(sala(room, id));
    }

    private Acceso acceso(String diagramId, String authorization) {
        String token = authorization != null && authorization.startsWith("Bearer ") ? authorization.substring(7) : "";
        var claims = jwt
            .validarToken(token)
            .orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Inicia sesión para revisar propuestas.")
            );
        return permisos(diagramId, String.valueOf(claims.get("sub")));
    }

    private Acceso permisos(String diagramId, String user) {
        var d = diagramas
            .findForReview(diagramId)
            .orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Guarda primero el diagrama del proyecto.")
            );
        if (d.getProyecto() == null) {
            if (d.getCreador() != null && user.equals(d.getCreador().getId())) return new Acceso(user, true);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No tienes acceso a este diagrama.");
        }
        var p = d.getProyecto();
        if (p.getPropietario() != null && user.equals(p.getPropietario().getId())) return new Acceso(user, true);
        var member = miembros
            .findByProyectoIdAndUsuarioId(p.getId(), user)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "No eres miembro de este proyecto."));
        return new Acceso(user, Set.of("PROPIETARIO", "ADMINISTRADOR", "EDITOR").contains(member.getRolProyecto()));
    }

    public synchronized String autorizarInferencia(String room, String id, String auth) {
        Acceso a = acceso(id, auth);
        autorizarInferenciaUsuario(room, id, a.id);
        return a.id;
    }

    public synchronized void autorizarInferenciaUsuario(String room, String id, String user) {
        if (user == null || !permisos(id, user).edit) throw new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "No tienes permiso para solicitar propuestas."
        );
        sala(room, id);
    }

    private Estado sala(String room, String diagramId) {
        Estado e = estados.get(room);
        if (e != null) {
            if (!e.diagramId.equals(diagramId)) throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Esta sala tiene otro diagrama activo. Entra en la sala del proyecto."
            );
            return e;
        }
        e = new Estado();
        e.diagramId = diagramId;
        try {
            e.persistedStructure = estructura(
                mapper.readTree(diagramas.findById(diagramId).orElseThrow().getJsonDiagrama())
            );
            Object live = salas.obtenerDiagramaDeSala(room);
            e.official =
                live == null
                    ? objeto(mapper.readTree(diagramas.findById(diagramId).orElseThrow().getJsonDiagrama()))
                    : objeto(mapper.valueToTree(live));
            e.official = e.official.deepCopy();
            e.revision = e.official.path("_reviewRevision").asLong(0);
        } catch (Exception ex) {
            throw error("No se pudo recuperar el diagrama oficial.");
        }
        var saved = documentos.obtener("revision_propuestas", room);
        if (saved.isPresent() && diagramId.equals(saved.get().path("diagramId").asText())) {
            var n = saved.get();
            // SQL is the authority for committed approvals; never resurrect an older official model.
            long sqlRevision = e.revision;
            if (n.path("officialRevision").asLong() >= sqlRevision) {
                e.official = objeto(n.path("official")).deepCopy();
                e.revision = n.path("officialRevision").asLong();
            }
            e.sequence = n.path("sequence").asLong();
            e.active = n.path("activeId").asText("");
            for (JsonNode p : n.path("proposals")) e.proposals.put(texto(p, "id"), objeto(p).deepCopy());
            for (var it = n.path("operations").fieldNames(); it.hasNext(); ) e.results.put(
                it.next(),
                mapper.createObjectNode()
            );
            for (JsonNode h : n.path("undo")) e.undo.add(objeto(h).deepCopy());
            for (JsonNode h : n.path("redo")) e.redo.add(objeto(h).deepCopy());
        }
        e.official.put("id", diagramId);
        e.official.put("_reviewRevision", e.revision);
        estados.put(room, e);
        var d = diagramas.findForReview(diagramId).orElseThrow();
        salas.vincularDiagrama(room, diagramId, d.getProyecto() == null ? null : d.getProyecto().getId(), e.official);
        return e;
    }

    private ObjectNode snapshot(Estado e) {
        ObjectNode n = mapper.createObjectNode();
        n.put("sequence", e.sequence);
        n.put("diagramId", e.diagramId);
        n.put("activeId", e.active);
        n.put("officialRevision", e.revision);
        ArrayNode items = n.putArray("proposals");
        e.proposals.values().forEach(p -> items.add(p.deepCopy()));
        n.set("official", e.official.deepCopy());
        n.set("undo", mapper.valueToTree(e.undo));
        n.set("redo", mapper.valueToTree(e.redo));
        n.put("canUndo", !e.undo.isEmpty()).put("canRedo", !e.redo.isEmpty());
        return n;
    }

    private ObjectNode documento(String room, Estado e) {
        ObjectNode n = snapshot(e);
        n.put("roomId", room);
        n.set("operations", mapper.valueToTree(e.results));
        while (n.toString().length() > 9_000_000 && (!e.undo.isEmpty() || !e.redo.isEmpty())) {
            if (!e.undo.isEmpty()) e.undo.removeFirst();
            else e.redo.removeFirst();
            n.set("undo", mapper.valueToTree(e.undo));
            n.set("redo", mapper.valueToTree(e.redo));
        }
        return n;
    }

    public synchronized ObjectNode estado(String room, String id, String auth) {
        Acceso a = acceso(id, auth);
        ObjectNode n = snapshot(sala(room, id));
        n.put("canModerate", a.edit);
        return n;
    }

    private void emitir(String room, String type, Object payload) {
        broker.convertAndSend(
            "/topic/collab/" + room,
            MensajeColaboracionDto.builder()
                .tipo(type)
                .salaId(room)
                .emisorId("sistema-revision")
                .emisorNombre("ArchAI")
                .timestamp(System.currentTimeMillis())
                .payload(payload)
                .build()
        );
    }

    private Set<String> seleccion(JsonNode body, String key) {
        Set<String> result = new HashSet<>();
        body.path(key).forEach(x -> result.add(x.asText()));
        return result;
    }

    public synchronized ObjectNode comando(String room, String id, String auth, ObjectNode body) {
        return ejecutar(room, id, acceso(id, auth), body, false);
    }

    public synchronized ObjectNode registrarIA(
        String room,
        String id,
        String user,
        ObjectNode proposal,
        ObjectNode base
    ) {
        permisos(id, user);
        var body = mapper
            .createObjectNode()
            .put("action", "register")
            .put("proposalId", texto(proposal, "id"))
            .put("operationId", "ia-" + texto(proposal, "id"));
        body.set("proposal", proposal);
        body.set("baseDiagram", base);
        return ejecutar(room, id, new Acceso(user, false), body, true);
    }

    private ObjectNode ejecutar(String room, String id, Acceso a, ObjectNode body, boolean serverRegistration) {
        Estado e = sala(room, id);
        String action = texto(body, "action"),
            op = texto(body, "operationId"),
            proposalId = texto(body, "proposalId");
        if (proposalId.isBlank() || proposalId.length() > 100 || op.isBlank() || op.length() > 100) throw error(
            "Falta el identificador de operación."
        );
        String cacheKey = a.id + ":" + op;
        if (e.results.containsKey(cacheKey)) return snapshot(e).put("canModerate", a.edit);
        if (!a.edit && !serverRegistration) throw new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "Solo los miembros con edición pueden modificar propuestas."
        );
        Estado backup = copiar(e);
        String approvalExpected = null;
        try {
            ObjectNode p = e.proposals.get(proposalId);
            if (action.equals("register")) {
                if (p == null) {
                    p = objeto(body.path("proposal")).deepCopy();
                    if (!proposalId.equals(texto(p, "id")) || !"ready".equals(texto(p, "status"))) throw error(
                        "La propuesta aún no está lista."
                    );
                    ObjectNode draft = objeto(p.path("diagram"));
                    try {
                        validar(draft, e.official);
                    } catch (ResponseStatusException ex) {
                        if (ex.getReason() != null && ex.getReason().startsWith("Ya existe la clase")) p.put(
                            "conflict",
                            ex.getReason()
                        );
                        else throw ex;
                    }
                    ubicar(draft, e.official);
                    p.put("reviewRevision", 0);
                    p.put("moderationStatus", "pending");
                    p.put("baseStructure", estructura(body.path("baseDiagram")));
                    p.set("approvedClasses", mapper.createArrayNode());
                    p.set("approvedRelations", mapper.createArrayNode());
                    p.set("canonicalIds", mapper.createObjectNode());
                    e.proposals.put(proposalId, p);
                }
            } else {
                if (p == null) throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "La propuesta ya no está disponible. Solicita una nueva."
                );
                if (
                    !Set.of("pending", "partial").contains(texto(p, "moderationStatus"))
                ) throw new ResponseStatusException(HttpStatus.CONFLICT, "La propuesta ya fue resuelta.");
                if (
                    body.path("expectedRevision").asLong(-1) != p.path("reviewRevision").asLong()
                ) throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Otro participante modificó la propuesta. Revisa la versión actual."
                );
                ObjectNode draft = objeto(p.path("diagram"));
                switch (action) {
                    case "preview" -> {
                        e.active = proposalId;
                    }
                    case "edit" -> {
                        ObjectNode edited = objeto(body.path("diagram")).deepCopy();
                        validar(edited, e.official);
                        p.set("diagram", edited);
                        p.remove("conflict");
                    }
                    case "rebase" -> {
                        try {
                            ObjectNode stored = objeto(
                                mapper.readTree(diagramas.findById(id).orElseThrow().getJsonDiagrama())
                            );
                            if (!estructura(stored).equals(e.persistedStructure)) {
                                e.persistedStructure = estructura(stored);
                                e.revision = Math.max(e.revision, stored.path("_reviewRevision").asLong(0)) + 1;
                                stored.put("_reviewRevision", e.revision);
                                e.official = stored;
                                salas.actualizarDiagramaDeSala(room, stored);
                                emitir(room, "diagrama", stored);
                                throw new ResponseStatusException(
                                    HttpStatus.CONFLICT,
                                    "Se recuperó un guardado de otra sesión. Revisa el modelo y vuelve a validar la propuesta."
                                );
                            }
                        } catch (java.io.IOException ex) {
                            throw error("No se pudo recuperar el modelo guardado.");
                        }
                        validar(draft, e.official);
                        p.put("baseStructure", estructura(e.official));
                        p.remove("conflict");
                    }
                    case "approve" -> {
                        if (!e.active.equals(proposalId)) throw error("Abre primero la propuesta en la pizarra.");
                        if (
                            !texto(p, "baseStructure").equals(estructura(e.official))
                        ) throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "El diagrama cambió. Revisa los cambios y pulsa Validar contra el modelo actual."
                        );
                        Map<String, String> mappings = new HashMap<>();
                        p.path("canonicalIds")
                            .fields()
                            .forEachRemaining(x -> mappings.put(x.getKey(), x.getValue().asText()));
                        var fusion = fusionar(
                            e.official,
                            draft,
                            seleccion(body, "classIds"),
                            seleccion(body, "relationIds"),
                            mappings,
                            seleccion(body, "deletionIds")
                        );
                        ObjectNode official = fusion.official();
                        official.put("_reviewRevision", e.revision + 1);
                        official.put("updatedAt", java.time.Instant.now().toString());
                        approvalExpected = e.persistedStructure;
                        recordHistory(e);
                        e.revision++;
                        e.official = official;
                        e.persistedStructure = estructura(official);
                        p.set("diagram", fusion.pending());
                        p.set("canonicalIds", mapper.valueToTree(fusion.ids()));
                        for (JsonNode x : body.path("classIds"))
                            ((ArrayNode) p.path("approvedClasses")).add(x.asText());
                        for (JsonNode x : body.path("relationIds"))
                            ((ArrayNode) p.path("approvedRelations")).add(x.asText());
                        p.put(
                            "moderationStatus",
                            fusion.pending().path("classes").isEmpty() &&
                                fusion.pending().path("relations").isEmpty() &&
                                fusion.pending().path("deletions").isEmpty()
                                ? "approved"
                                : "partial"
                        );
                        p.put("baseStructure", estructura(official));
                        salas.actualizarDiagramaDeSala(room, official);
                    }
                    case "reject" -> {
                        p.put("moderationStatus", texto(body, "feedback").isBlank() ? "rejected" : "superseded");
                        p.put("feedback", texto(body, "feedback"));
                    }
                    default -> throw error("Acción de propuesta desconocida.");
                }
                p.put("reviewRevision", p.path("reviewRevision").asLong() + 1);
                p.put("decidedBy", a.id);
                p.put("decidedAt", java.time.Instant.now().toString());
                if (
                    !Set.of("pending", "partial").contains(texto(p, "moderationStatus")) && e.active.equals(proposalId)
                ) e.active = "";
            }
            e.sequence++;
            e.results.put(cacheKey, mapper.createObjectNode());
            if (e.results.size() > 2000) e.results.remove(e.results.keySet().iterator().next());
            ObjectNode saved = documento(room, e);
            if (approvalExpected != null) persistencia.guardarConSesion(
                id,
                e.official,
                a.id,
                op,
                approvalExpected,
                room,
                saved,
                "approve",
                proposalId
            );
            else documentos.guardar("revision_propuestas", room, saved);
            e.dirty = false;
            e.checkpointDirty = true;
            if (approvalExpected != null) emitir(room, "diagrama", e.official);
            ObjectNode result = snapshot(e);
            emitir(room, "ia_draft_state", result);
            if (Set.of("approve", "reject").contains(action)) eventos.publishEvent(
                new EventoSala(
                    room,
                    id,
                    action,
                    mapper
                        .createObjectNode()
                        .put("proposalId", proposalId)
                        .put("authorId", a.id)
                        .put("eventId", "review-" + op)
                )
            );
            result.put("canModerate", a.edit);
            return result;
        } catch (RuntimeException ex) {
            estados.put(room, backup);
            salas.actualizarDiagramaDeSala(room, backup.official);
            throw ex;
        }
    }

    /** All existing official room write paths pass through this fence once moderation starts. */
    public synchronized Object actualizarOficialConToken(String room, Object raw, String auth) {
        Estado e = estados.get(room);
        if (e != null && !acceso(e.diagramId, auth).edit) throw new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "No tienes permiso para editar este diagrama."
        );
        return actualizarOficial(room, raw, e == null ? null : acceso(e.diagramId, auth).id);
    }

    public synchronized Object actualizarOficial(String room, Object raw, String user) {
        Estado e = estados.get(room);
        if (e == null) {
            salas.actualizarDiagramaDeSala(room, raw);
            return raw;
        }
        if (user == null || !permisos(e.diagramId, user).edit) throw new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "No tienes permiso para editar este diagrama."
        );
        ObjectNode n = objeto(mapper.valueToTree(raw));
        if (!n.has("_reviewRevision")) {
            emitir(room, "diagrama", e.official);
            return e.official.deepCopy();
        }
        if (n.path("_reviewRevision").asLong(-1) != e.revision) {
            emitir(
                room,
                "ia_review_conflict",
                Map.of(
                    "message",
                    "El diagrama cambió antes de recibir tu edición. Se recuperó la versión actual para evitar sobrescribir el trabajo del equipo."
                )
            );
            emitir(room, "diagrama", e.official);
            return e.official.deepCopy();
        }
        boolean structural = !estructura(n).equals(estructura(e.official));
        if (structural) {
            recordHistory(e);
            e.revision++;
        }
        n.put("_reviewRevision", e.revision);
        e.official = n.deepCopy();
        salas.actualizarDiagramaDeSala(room, n);
        e.dirty = true;
        e.checkpointDirty = true;
        e.changedAt = System.currentTimeMillis();
        e.sequence++;
        emitir(
            room,
            "ia_revision",
            mapper
                .createObjectNode()
                .put("diagramId", e.diagramId)
                .put("sequence", e.sequence)
                .put("officialRevision", e.revision)
                .put("canUndo", !e.undo.isEmpty())
                .put("canRedo", !e.redo.isEmpty())
        );
        if (structural) eventos.publishEvent(
            new EventoSala(
                room,
                e.diagramId,
                "diagram_changed",
                mapper.createObjectNode().put("authorId", user == null ? "" : user)
            )
        );
        return n;
    }

    private void recordHistory(Estado e) {
        e.undo.addLast(e.official.deepCopy());
        while (e.undo.size() > 50) e.undo.removeFirst();
        e.redo.clear();
    }

    /**
     * Firma del layout: estructura UML + posición exacta de cada nodo. Guardar solo
     * posiciones no altera la estructura, pero sí debe refrescar el diagrama oficial
     * de la sala para que al recargar no se reaplique un layout antiguo.
     */
    private String disposicion(JsonNode n) {
        if (n == null) return "";
        StringBuilder firma = new StringBuilder(estructura(n));
        for (JsonNode c : n.path("classes")) {
            firma
                .append('|')
                .append(texto(c, "id"))
                .append(':')
                .append(c.path("position").path("x").asDouble())
                .append(',')
                .append(c.path("position").path("y").asDouble());
        }
        return firma.toString();
    }

    @org.springframework.transaction.event.TransactionalEventListener(
        phase = org.springframework.transaction.event.TransactionPhase.AFTER_COMMIT
    )
    public synchronized void guardadoExterno(com.archai.modulo.diagrama.servicio.DiagramaPersistido event) {
        for (var item : estados.entrySet()) {
            Estado e = item.getValue();
            if (!e.diagramId.equals(event.id())) continue;
            // AFTER_COMMIT callbacks may arrive out of order. Read the latest committed scalar,
            // rather than restoring an older event payload over a later team approval.
            try {
                var current = diagramas.findCurrentJson(event.id());
                if (current.isEmpty()) continue;
                ObjectNode saved = objeto(mapper.readTree(current.get()));
                String savedStructure = estructura(saved);
                boolean structural = !savedStructure.equals(estructura(e.official));
                boolean layout = !disposicion(saved).equals(disposicion(e.official));
                e.persistedStructure = savedStructure;
                if (structural || layout) {
                    if (structural) {
                        recordHistory(e);
                        e.revision = Math.max(e.revision + 1, saved.path("_reviewRevision").asLong());
                    }
                    e.official = saved.deepCopy().put("_reviewRevision", e.revision);
                    e.sequence++;
                    salas.actualizarDiagramaDeSala(item.getKey(), e.official);
                    emitir(item.getKey(), "diagrama", e.official);
                    if (structural) emitir(item.getKey(), "ia_draft_state", snapshot(e));
                }
                e.dirty = true;
                e.checkpointDirty = true;
                e.changedAt = System.currentTimeMillis();
            } catch (java.io.IOException ex) {
                throw new IllegalStateException("No se pudo sincronizar el diagrama guardado.");
            }
        }
    }

    private Estado copiar(Estado e) {
        Estado c = new Estado();
        c.diagramId = e.diagramId;
        c.active = e.active;
        c.persistedStructure = e.persistedStructure;
        c.revision = e.revision;
        c.sequence = e.sequence;
        c.official = e.official.deepCopy();
        c.dirty = e.dirty;
        c.checkpointDirty = e.checkpointDirty;
        c.lastCheckpoint = e.lastCheckpoint;
        c.changedAt = e.changedAt;
        e.proposals.forEach((k, v) -> c.proposals.put(k, v.deepCopy()));
        c.results.putAll(e.results);
        e.undo.forEach(x -> c.undo.add(x.deepCopy()));
        e.redo.forEach(x -> c.redo.add(x.deepCopy()));
        return c;
    }

    @org.springframework.scheduling.annotation.Scheduled(fixedDelay = 2000)
    public synchronized void guardarCambios() {
        long now = System.currentTimeMillis();
        for (var item : estados.entrySet()) {
            Estado e = item.getValue();
            if (e.dirty && now - e.changedAt >= 1500) {
                documentos.guardar("revision_propuestas", item.getKey(), documento(item.getKey(), e));
                e.dirty = false;
            }
            if (e.checkpointDirty && now - e.lastCheckpoint >= 30000) checkpoint(item.getKey(), e);
        }
    }

    private ObjectNode checkpoint(String room, Estado e) {
        ObjectNode n = documento(room, e);
        String id = UUID.randomUUID().toString();
        n.put("checkpointId", id).put("savedAt", java.time.Instant.now().toString());
        ObjectNode compact = n.deepCopy();
        compact.remove(List.of("undo", "redo", "operations"));
        documentos.guardar("puntos_control", id, compact);
        e.lastCheckpoint = System.currentTimeMillis();
        e.checkpointDirty = false;
        return n;
    }

    public synchronized ObjectNode guardarSesion(String room, String id, String auth) {
        Acceso a = acceso(id, auth);
        if (!a.edit) throw new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "Solo los editores pueden guardar puntos de control."
        );
        Estado e = sala(room, id);
        ObjectNode n = checkpoint(room, e);
        documentos.guardar("revision_propuestas", room, n);
        e.dirty = false;
        return n;
    }

    public synchronized List<ObjectNode> puntosControl(String room, String id, String auth) {
        acceso(id, auth);
        sala(room, id);
        return documentos
            .listar("puntos_control", room)
            .stream()
            .sorted(Comparator.comparing((ObjectNode n) -> n.path("savedAt").asText()).reversed())
            .map(n ->
                mapper
                    .createObjectNode()
                    .put("id", n.path("checkpointId").asText())
                    .put("savedAt", n.path("savedAt").asText())
                    .put("classes", n.path("official").path("classes").size())
            )
            .toList();
    }

    public synchronized ObjectNode restaurar(String room, String id, String auth, ObjectNode command) {
        Acceso a = acceso(id, auth);
        if (!a.edit) throw new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "Solo los editores pueden restaurar el diagrama."
        );
        Estado e = sala(room, id);
        String op = texto(command, "operationId"),
            cacheKey = a.id + ":" + op;
        if (op.isBlank()) throw error("Falta el identificador de operación.");
        if (e.results.containsKey(cacheKey)) return snapshot(e);
        if (command.path("expectedRevision").asLong(-1) != e.revision) throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "El diagrama cambió. Revisa su versión actual."
        );
        Estado backup = copiar(e);
        ObjectNode model;
        String action = texto(command, "action");
        try {
            if (action.equals("undo")) {
                if (e.undo.isEmpty()) throw error("No hay cambios para deshacer.");
                e.redo.addLast(e.official.deepCopy());
                model = e.undo.removeLast();
            } else if (action.equals("redo")) {
                if (e.redo.isEmpty()) throw error("No hay cambios para rehacer.");
                e.undo.addLast(e.official.deepCopy());
                model = e.redo.removeLast();
            } else if (action.equals("restore")) {
                var point = documentos
                    .obtener("puntos_control", texto(command, "checkpointId"))
                    .orElseThrow(() -> error("El punto de control no existe."));
                if (
                    !room.equals(point.path("roomId").asText()) || !id.equals(point.path("diagramId").asText())
                ) throw error("El punto de control pertenece a otra sala.");
                recordHistory(e);
                model = objeto(point.path("official")).deepCopy();
                e.proposals.clear();
                for (JsonNode p : point.path("proposals")) e.proposals.put(texto(p, "id"), objeto(p).deepCopy());
                e.active = point.path("activeId").asText("");
            } else throw error("Acción de sesión inválida.");
            e.official = model
                .deepCopy()
                .put("_reviewRevision", ++e.revision)
                .put("updatedAt", java.time.Instant.now().toString());
            e.sequence++;
            e.results.put(cacheKey, mapper.createObjectNode());
            persistencia.guardarConSesion(
                id,
                e.official,
                a.id,
                op,
                e.persistedStructure,
                room,
                documento(room, e),
                "session_restored",
                ""
            );
            e.persistedStructure = estructura(e.official);
            salas.actualizarDiagramaDeSala(room, e.official);
            emitir(room, "diagrama", e.official);
            emitir(room, "ia_draft_state", snapshot(e));
            eventos.publishEvent(
                new EventoSala(
                    room,
                    id,
                    "session_restored",
                    mapper
                        .createObjectNode()
                        .put("authorId", a.id)
                        .put("action", action)
                        .put("eventId", "review-" + op)
                )
            );
            return snapshot(e);
        } catch (RuntimeException ex) {
            estados.put(room, backup);
            throw ex;
        }
    }
}
