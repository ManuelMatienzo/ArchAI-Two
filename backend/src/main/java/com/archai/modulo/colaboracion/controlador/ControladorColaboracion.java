package com.archai.modulo.colaboracion.controlador;

import com.archai.modulo.colaboracion.dto.MensajeColaboracionDto;
import com.archai.modulo.colaboracion.servicio.ServicioSalaColaborativa;
import com.archai.modulo.push.dto.AlertaPushDto;
import com.archai.modulo.push.servicio.ServicioNotificacionesPush;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.HashMap;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class ControladorColaboracion {

    private final SimpMessagingTemplate messagingTemplate;
    private final com.archai.modulo.ia.servicio.GatewayPropuestasNube nube;
    private final com.archai.modulo.colaboracion.servicio.ServicioRevisionPropuesta revisiones;
    private final ServicioSalaColaborativa servicioSalaColaborativa;
    private final com.archai.modulo.colaboracion.servicio.ServicioConversacion chat;
    private final com.archai.modulo.autenticacion.repositorio.UsuarioRepository users;
    private final com.archai.modulo.colaboracion.servicio.CoordinadorPropuestas propuestas;
    private final ServicioNotificacionesPush servicioNotificacionesPush;

    @MessageMapping("/collab/{salaId}")
    public void retransmitirAccionColaborativa(
        @DestinationVariable String salaId,
        @Payload MensajeColaboracionDto mensaje,
        java.security.Principal principal
    ) {
        if (principal == null) throw new org.springframework.web.server.ResponseStatusException(
            org.springframework.http.HttpStatus.UNAUTHORIZED,
            "Inicia sesión para continuar."
        );
        String userId = principal.getName();
        var profile = users.findById(userId).orElseThrow();
        String instance = mensaje.getEmisorId() == null ? "" : mensaje.getEmisorId();
        mensaje.setEmisorId(instance.startsWith(userId + "#") ? instance : userId);
        mensaje.setEmisorNombre(profile.getNombre());
        String diagram = servicioSalaColaborativa.diagramaId(salaId);
        boolean efimero = java.util.Set.of(
            "cursor",
            "nodo_mover",
            "join",
            "leave",
            "salir",
            "solicitar_diagrama",
            "chat",
            "ia_request"
        ).contains(String.valueOf(mensaje.getTipo()));
        if (diagram != null && !efimero) {
            boolean puedeEditar;
            try {
                puedeEditar = revisiones.puedeEditar(diagram, userId);
            } catch (org.springframework.web.server.ResponseStatusException ex) {
                puedeEditar = false;
            }
            if (!puedeEditar) {
                // Un commit de diagrama de un lector se descarta sin romper la conexión STOMP:
                // lanzar el error aquí cerraba el canal y dejaba la sala sin tiempo real.
                if ("diagrama".equalsIgnoreCase(mensaje.getTipo())) return;
                throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN,
                    "No tienes permiso para editar este diagrama."
                );
            }
        }
        if ("chat".equals(mensaje.getTipo())) {
            if (diagram == null) throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST,
                "Abre primero un diagrama del proyecto."
            );
            var node = new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(mensaje.getPayload());
            var request = new com.fasterxml.jackson.databind.ObjectMapper()
                .createObjectNode()
                .put("id", node.path("id").asText(java.util.UUID.randomUUID().toString()))
                .put("text", node.path("content").asText(node.path("text").asText()));
            chat.enviarUsuario(salaId, diagram, userId, request);
            return;
        }
        if (
            mensaje.getTipo() != null &&
            (mensaje.getTipo().startsWith("chat_") ||
                (mensaje.getTipo().startsWith("ia_") && !mensaje.getTipo().equals("ia_request")))
        ) return;
        mensaje.setTimestamp(System.currentTimeMillis());
        mensaje.setSalaId(salaId);
        if ("ia_draft_state".equals(mensaje.getTipo()) || "ia_review_conflict".equals(mensaje.getTipo())) return; // server-only events
        if (mensaje.getTipo() != null && mensaje.getTipo().startsWith("ia_")) {
            if (!(mensaje.getPayload() instanceof java.util.Map<?, ?>)) return;
            String user = String.valueOf(mensaje.getEmisorId()).split("#")[0];
            boolean host = servicioSalaColaborativa.esAnfitrion(salaId, user);
            @SuppressWarnings("unchecked")
            var datos = (java.util.Map<String, Object>) mensaje.getPayload();
            var result = propuestas.procesar(salaId, mensaje.getTipo(), mensaje.getEmisorId(), datos, host);
            if (result == null) {
                if ("ia_auto".equals(mensaje.getTipo())) {
                    mensaje.setTipo("ia_denied");
                    messagingTemplate.convertAndSend("/topic/collab/" + salaId, mensaje);
                }
                return;
            }
            if (
                ("ia_request".equals(mensaje.getTipo()) || "ia_auto".equals(mensaje.getTipo())) &&
                datos.containsKey("diagramId") &&
                !"local".equals(datos.get("inferenceMode"))
            ) {
                try {
                    nube.register(
                        salaId,
                        principal == null ? null : principal.getName(),
                        new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(datos),
                        "ia_auto".equals(mensaje.getTipo())
                    );
                } catch (org.springframework.web.server.ResponseStatusException ex) {
                    mensaje.setTipo("ia_denied");
                    messagingTemplate.convertAndSend("/topic/collab/" + salaId, mensaje);
                    return;
                }
            }
            mensaje.setPayload(result);
            if ("ia_sync".equals(mensaje.getTipo())) mensaje.setTipo("ia_settings");
        }

        // CU-23 · Un evento crítico en la sala también despierta al ingeniero en tránsito.
        notificarEventoCritico(salaId, mensaje);

        // CU-03 · Persistir el diagrama activo en memoria de la sala
        if ("diagrama".equalsIgnoreCase(mensaje.getTipo()) && mensaje.getPayload() != null) {
            mensaje.setPayload(
                revisiones.actualizarOficial(
                    salaId,
                    mensaje.getPayload(),
                    principal == null ? null : principal.getName()
                )
            );
        }

        // Si un participante nuevo solicita el diagrama y el backend ya lo tiene, responderle de inmediato
        if ("solicitar_diagrama".equalsIgnoreCase(mensaje.getTipo())) {
            try {
                Object diagramaActual = servicioSalaColaborativa.obtenerDiagramaDeSala(salaId);
                if (diagramaActual != null) {
                    MensajeColaboracionDto respuesta = MensajeColaboracionDto.builder()
                        .salaId(salaId)
                        .tipo("diagrama")
                        .emisorId("sistema-backend")
                        .emisorNombre("Servidor ArchAI")
                        .payload(diagramaActual)
                        .timestamp(System.currentTimeMillis())
                        .build();
                    messagingTemplate.convertAndSend("/topic/collab/" + salaId, respuesta);
                }
            } catch (Exception ignored) {}
        }

        if ("join".equalsIgnoreCase(mensaje.getTipo())) {
            var real = com.archai.modulo.autenticacion.dto.PerfilUsuarioDto.builder()
                .id(userId)
                .name(profile.getNombre())
                .email(profile.getCorreo())
                .role(profile.getRol())
                .avatarColor(profile.getColorAvatar())
                .build();
            var session = servicioSalaColaborativa.unirseSala(salaId, real);
            mensaje.setPayload(java.util.Map.of("usuario", real, "participantes", session.getParticipants()));
            messagingTemplate.convertAndSend("/topic/room/" + salaId + "/presence", session.getParticipants());
        }

        // CU-03 · Manejo de salida / abandono de sala
        if ("leave".equalsIgnoreCase(mensaje.getTipo()) || "salir".equalsIgnoreCase(mensaje.getTipo())) {
            if (servicioSalaColaborativa.estaConectado(salaId, userId)) return; // The transport listener owns tab-aware departures.
            try {
                servicioSalaColaborativa.salirDeSala(salaId, userId);
                java.util.List<com.archai.modulo.autenticacion.dto.PerfilUsuarioDto> participantes =
                    servicioSalaColaborativa.listarParticipantes(salaId);
                messagingTemplate.convertAndSend("/topic/room/" + salaId + "/presence", participantes);
            } catch (Exception ignored) {}
        }

        // Retransmitir la acción a todos los suscriptores del canal STOMP
        messagingTemplate.convertAndSend("/topic/collab/" + salaId, mensaje);
    }

    /**
     * CU-23 — Traduce eventos colaborativos críticos en alertas push.
     * Se ejecuta en un pool aparte: un fallo de Firebase jamás frena el STOMP.
     */
    private void notificarEventoCritico(String salaId, MensajeColaboracionDto mensaje) {
        try {
            String tipo = mensaje.getTipo() != null ? mensaje.getTipo().toLowerCase() : "";
            Map<?, ?> payload = mensaje.getPayload() instanceof Map<?, ?> mapa ? mapa : Map.of();

            boolean esPropuestaIA = tipo.equals("ghost_draft") || tipo.equals("propuesta_ia");
            boolean esCritico = esPropuestaIA
                    || tipo.equals("alerta_critica")
                    || tipo.equals("cambio_critico")
                    || tipo.equals("evento_critico");

            // Un commit de diagrama solo alerta si el emisor lo marca explícitamente como crítico.
            if (!esCritico && tipo.equals("diagrama")) {
                esCritico = Boolean.TRUE.equals(payload.get("critico"))
                        || Boolean.TRUE.equals(payload.get("esCritico"));
            }

            if (!esCritico) return;

            String titulo = texto(payload.get("titulo"));
            String cuerpo = texto(payload.get("mensaje"));
            if (titulo == null) {
                titulo = esPropuestaIA ? "Nueva propuesta de IA" : "Cambio crítico en tu sala";
            }
            if (cuerpo == null) {
                cuerpo = esPropuestaIA
                        ? "La IA generó una propuesta que requiere tu moderación."
                        : "Se detectó un cambio crítico en la sala " + salaId + ".";
            }

            Map<String, String> datos = new HashMap<>();
            datos.put("roomId", salaId);
            datos.put("tipo", tipo);

            Object proyectoId = payload.get("proyectoId") != null ? payload.get("proyectoId") : payload.get("projectId");
            Object nombreSala = payload.get("roomName") != null ? payload.get("roomName") : payload.get("nombreSala");
            if (proyectoId != null) datos.put("projectId", String.valueOf(proyectoId));
            if (nombreSala != null) datos.put("roomName", String.valueOf(nombreSala));

            AlertaPushDto alerta = AlertaPushDto.builder()
                    .tipo(tipo)
                    .salaId(salaId)
                    .proyectoId(proyectoId != null ? String.valueOf(proyectoId) : null)
                    .titulo(titulo)
                    .cuerpo(cuerpo)
                    .datos(datos)
                    .build();

            servicioNotificacionesPush.enviarAlertaCriticaAsync(alerta);
        } catch (Exception ignored) {
            // La mensajería push es un canal complementario: nunca interrumpe la colaboración.
        }
    }

    private String texto(Object valor) {
        if (valor == null) return null;
        String texto = String.valueOf(valor).trim();
        return texto.isEmpty() ? null : texto;
    }
}
