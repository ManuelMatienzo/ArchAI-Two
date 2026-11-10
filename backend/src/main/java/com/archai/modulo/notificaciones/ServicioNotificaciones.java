package com.archai.modulo.notificaciones;

import com.archai.modulo.autenticacion.repositorio.UsuarioRepository;
import com.archai.modulo.colaboracion.servicio.*;
import com.archai.modulo.diagrama.repositorio.DiagramaRepository;
import com.archai.modulo.persistencia.servicio.AlmacenDocumental;
import com.archai.modulo.proyecto.repositorio.MiembroProyectoRepository;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Durable activity + native Expo Push. Provider acceptance is distinct from opening on a device. */
@Service
public class ServicioNotificaciones {

    private final AlmacenDocumental docs;
    private final ServicioRevisionPropuesta reviews;
    private final DiagramaRepository diagrams;
    private final MiembroProyectoRepository members;
    private final UsuarioRepository users;
    private final ObjectMapper mapper;
    private final Environment env;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
    private final Map<String, EventoSala> changes = new ConcurrentHashMap<>();
    private final Map<String, Long> changedAt = new ConcurrentHashMap<>();

    public ServicioNotificaciones(
        AlmacenDocumental docs,
        ServicioRevisionPropuesta reviews,
        DiagramaRepository diagrams,
        MiembroProyectoRepository members,
        UsuarioRepository users,
        ObjectMapper mapper,
        Environment env
    ) {
        this.docs = docs;
        this.reviews = reviews;
        this.diagrams = diagrams;
        this.members = members;
        this.users = users;
        this.mapper = mapper;
        this.env = env;
    }

    public ObjectNode registrar(String auth, ObjectNode body) {
        String user = reviews.usuario(auth),
            token = body.path("token").asText();
        if (
            !token.matches("(?:ExponentPushToken|ExpoPushToken)\\[[A-Za-z0-9_-]{8,180}\\]")
        ) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El dispositivo no devolvió un token push válido.");
        try {
            String id = java.util.HexFormat.of().formatHex(
                java.security.MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))
            );
            ObjectNode device = mapper
                .createObjectNode()
                .put("id", id)
                .put("userId", user)
                .put("token", token)
                .put("enabled", true)
                .put("platform", "android")
                .put("updatedAt", Instant.now().toString());
            docs.guardar("dispositivos_push", id, device);
            return mapper.createObjectNode().put("id", id).put("enabled", true);
        } catch (java.security.NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    public void desactivar(String auth, String id) {
        String user = reviews.usuario(auth);
        ObjectNode device = docs
            .obtener("dispositivos_push", id)
            .orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "El dispositivo ya no está registrado.")
            );
        if (!user.equals(device.path("userId").asText())) throw new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "El dispositivo pertenece a otra cuenta."
        );
        device.put("enabled", false);
        docs.guardar("dispositivos_push", id, device);
    }

    public List<ObjectNode> listar(String auth, String room) {
        String user = reviews.usuario(auth);
        return docs
            .listar("notificaciones_usuario", room)
            .stream()
            .filter(n -> user.equals(n.path("userId").asText()))
            .sorted(Comparator.comparing((ObjectNode n) -> n.path("createdAt").asText()).reversed())
            .limit(100)
            .toList();
    }

    public void leida(String auth, String id) {
        String user = reviews.usuario(auth);
        ObjectNode n = docs
            .obtener("notificaciones_usuario", id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "La notificación no existe."));
        if (!user.equals(n.path("userId").asText())) throw new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "No tienes acceso a esta notificación."
        );
        n.put("readAt", Instant.now().toString());
        docs.guardar("notificaciones_usuario", id, n);
    }

    @EventListener
    public void evento(EventoSala e) {
        if (e.type().equals("diagram_changed")) {
            changes.put(e.room(), e);
            changedAt.putIfAbsent(e.room(), System.currentTimeMillis());
            return;
        }
        if (
            Set.of("approve", "reject", "session_restored", "ai_response", "chat_sent", "artifact_generated").contains(
                e.type()
            )
        ) enqueue(e, e.detail().path("eventId").asText(UUID.randomUUID().toString()));
    }

    private void enqueue(EventoSala e, String id) {
        if (docs.obtener("eventos_notificacion", id).isPresent()) return;
        ObjectNode n = mapper
            .createObjectNode()
            .put("id", id)
            .put("roomId", e.room())
            .put("diagramId", e.diagramId())
            .put("type", e.type())
            .put("status", "pending")
            .put("createdAt", Instant.now().toString());
        n.set("detail", e.detail());
        docs.guardar("eventos_notificacion", id, n);
    }

    private Set<String> recipients(ObjectNode e) {
        var d = diagrams.findForReview(e.path("diagramId").asText()).orElse(null);
        if (d == null) return Set.of();
        Set<String> ids = new LinkedHashSet<>();
        if (d.getProyecto() != null) {
            ids.add(d.getProyecto().getPropietario().getId());
            members.findByProyectoId(d.getProyecto().getId()).forEach(m -> ids.add(m.getUsuario().getId()));
        } else if (d.getCreador() != null) ids.add(d.getCreador().getId());
        String type = e.path("type").asText();
        JsonNode detail = e.path("detail");
        if (type.equals("chat_sent")) {
            String text = detail.path("text").asText();
            Set<String> mentioned = new HashSet<>();
            for (var user : users.findAllById(ids)) {
                String username = user.getNombreUsuario();
                if (
                    username != null &&
                    java.util.regex.Pattern.compile(
                        "(?iu)(?<![\\p{L}\\p{N}_])@" + java.util.regex.Pattern.quote(username) + "(?![\\p{L}\\p{N}_])"
                    )
                        .matcher(text)
                        .find()
                ) mentioned.add(user.getId());
            }
            return mentioned;
        }
        if (type.equals("ai_response") && !detail.hasNonNull("proposalId")) {
            String requester = detail.path("requesterId").asText();
            return ids.contains(requester) ? Set.of(requester) : Set.of();
        }
        return ids;
    }

    private String title(String type) {
        return switch (type) {
            case "approve" -> "Propuesta aprobada";
            case "reject" -> "Propuesta revisada por el equipo";
            case "session_restored" -> "Sesión restaurada";
            case "ai_response" -> "ArchAI intervino en tu proyecto";
            case "chat_sent" -> "Te mencionaron en el chat";
            case "artifact_generated" -> "Generación completada";
            default -> "Cambios en el diagrama";
        };
    }

    @Scheduled(fixedDelay = 3000)
    public synchronized void despachar() {
        long now = System.currentTimeMillis();
        for (var item : changedAt.entrySet())
            if (now - item.getValue() >= 30000) {
                EventoSala e = changes.remove(item.getKey());
                changedAt.remove(item.getKey());
                if (e != null) enqueue(e, UUID.randomUUID().toString());
            }
        for (ObjectNode event : docs.listar("eventos_notificacion", null)) {
            if (!event.path("status").asText().equals("pending")) continue;
            String eventId = event.path("id").asText(),
                type = event.path("type").asText(),
                room = event.path("roomId").asText();
            for (String user : recipients(event)) {
                String id = eventId + ":" + user;
                if (docs.obtener("notificaciones_usuario", id).isPresent()) continue;
                JsonNode detail = event.path("detail");
                String body = type.equals("chat_sent")
                    ? detail.path("authorName").asText("Un compañero") + " te mencionó."
                    : type.equals("ai_response")
                      ? detail.hasNonNull("proposalId")
                          ? "Hay una propuesta lista para revisar en la pizarra."
                          : "Tu consulta tiene una respuesta en el chat."
                      : "Abre la sala para consultar la actualización del equipo.";
                ObjectNode n = mapper
                    .createObjectNode()
                    .put("id", id)
                    .put("roomId", room)
                    .put("diagramId", event.path("diagramId").asText())
                    .put("userId", user)
                    .put("type", type)
                    .put("title", title(type))
                    .put("body", body)
                    .put("createdAt", event.path("createdAt").asText())
                    .put("readAt", "");
                String target =
                    type.equals("chat_sent") || (type.equals("ai_response") && !detail.hasNonNull("proposalId"))
                        ? "chat"
                        : "diagram";
                n.put("target", target)
                    .put("proposalId", detail.path("proposalId").asText())
                    .put("focusClassId", detail.path("focusClassId").asText());
                docs.guardar("notificaciones_usuario", id, n);
            }
            event.put("status", "processed");
            docs.guardar("eventos_notificacion", eventId, event);
        }
        List<ObjectNode> devices = docs.listar("dispositivos_push", null);
        for (ObjectNode notification : docs.listar("notificaciones_usuario", null))
            for (ObjectNode device : devices) {
                if (
                    !device.path("enabled").asBoolean() ||
                    !device.path("userId").asText().equals(notification.path("userId").asText())
                ) continue;
                String deliveryId = notification.path("id").asText() + ":" + device.path("id").asText();
                ObjectNode delivery = docs
                    .obtener("entregas_push", deliveryId)
                    .orElseGet(() ->
                        mapper
                            .createObjectNode()
                            .put("id", deliveryId)
                            .put("notificationId", notification.path("id").asText())
                            .put("roomId", notification.path("roomId").asText())
                    );
                if (
                    Set.of("accepted", "invalid", "failed", "expired").contains(delivery.path("status").asText()) ||
                    delivery.path("nextAttempt").asLong() > now
                ) continue;
                if (notification.path("createdAt").asText().compareTo(device.path("updatedAt").asText()) < 0) {
                    delivery.put("status", "expired");
                    docs.guardar("entregas_push", deliveryId, delivery);
                    continue;
                }
                send(notification, device, delivery, now);
            }
    }

    private void send(ObjectNode notification, ObjectNode device, ObjectNode delivery, long now) {
        int attempts = delivery.path("attempts").asInt() + 1;
        delivery.put("attempts", attempts);
        try {
            ObjectNode body = mapper
                .createObjectNode()
                .put("to", device.path("token").asText())
                .put("title", notification.path("title").asText())
                .put("body", notification.path("body").asText())
                .put("sound", "default")
                .put("channelId", "archai-important");
            ObjectNode data = notification.deepCopy();
            data.remove("userId");
            body.set("data", data);
            var req = HttpRequest.newBuilder(
                URI.create(env.getProperty("ARCHAI_EXPO_PUSH_URL", "https://exp.host/--/api/v2/push/send"))
            )
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json");
            String token = env.getProperty("EXPO_ACCESS_TOKEN", "");
            if (!token.isBlank()) req.header("Authorization", "Bearer " + token);
            var res = http.send(
                req.POST(HttpRequest.BodyPublishers.ofString(body.toString())).build(),
                HttpResponse.BodyHandlers.ofString()
            );
            if (res.statusCode() != 200) throw new java.io.IOException();
            JsonNode ticket = mapper.readTree(res.body()).path("data");
            if (ticket.isArray()) ticket = ticket.path(0);
            if (ticket.path("status").asText().equals("ok")) {
                delivery
                    .put("status", "accepted")
                    .put("receiptId", ticket.path("id").asText())
                    .put("acceptedAt", Instant.now().toString());
            } else if (ticket.path("details").path("error").asText().equals("DeviceNotRegistered")) {
                device.put("enabled", false);
                docs.guardar("dispositivos_push", device.path("id").asText(), device);
                delivery.put("status", "invalid");
            } else throw new java.io.IOException();
        } catch (Exception ex) {
            if (ex instanceof InterruptedException) Thread.currentThread().interrupt();
            delivery
                .put("status", attempts >= 5 ? "failed" : "retry")
                .put("nextAttempt", now + Math.min(900000, 30000L * (1L << Math.min(attempts, 5))));
        }
        docs.guardar("entregas_push", delivery.path("id").asText(), delivery);
    }
}
