package com.archai.modulo.colaboracion.controlador;

import com.archai.modulo.colaboracion.dto.MensajeColaboracionDto;
import com.archai.modulo.colaboracion.servicio.ServicioSalaColaborativa;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class ControladorColaboracion {

    private final SimpMessagingTemplate messagingTemplate;
    private final com.archai.modulo.ia.servicio.GatewayPropuestasNube nube;
    private final com.archai.modulo.colaboracion.servicio.ServicioRevisionPropuesta revisiones;
    private final ServicioSalaColaborativa servicioSalaColaborativa;
    private final com.archai.modulo.colaboracion.servicio.CoordinadorPropuestas propuestas;

    @MessageMapping("/collab/{salaId}")
    public void retransmitirAccionColaborativa(@DestinationVariable String salaId, @Payload MensajeColaboracionDto mensaje, java.security.Principal principal) {
        mensaje.setTimestamp(System.currentTimeMillis());
        mensaje.setSalaId(salaId);
        if ("ia_draft_state".equals(mensaje.getTipo()) || "ia_review_conflict".equals(mensaje.getTipo())) return; // server-only events
        if (mensaje.getTipo() != null && mensaje.getTipo().startsWith("ia_")) {
            if (!(mensaje.getPayload() instanceof java.util.Map<?,?>)) return;
            String user = String.valueOf(mensaje.getEmisorId()).split("#")[0];
            boolean host = servicioSalaColaborativa.esAnfitrion(salaId, user);
            @SuppressWarnings("unchecked")
            var datos = (java.util.Map<String,Object>) mensaje.getPayload();
            var result = propuestas.procesar(salaId, mensaje.getTipo(), mensaje.getEmisorId(), datos, host);
            if (result == null) {
                if ("ia_auto".equals(mensaje.getTipo())) {
                    mensaje.setTipo("ia_denied");
                    messagingTemplate.convertAndSend("/topic/collab/" + salaId, mensaje);
                }
                return;
            }
            if (("ia_request".equals(mensaje.getTipo()) || "ia_auto".equals(mensaje.getTipo())) && datos.containsKey("diagramId") && !"local".equals(datos.get("inferenceMode"))) {
                try { nube.register(salaId,principal==null?null:principal.getName(),new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(datos),"ia_auto".equals(mensaje.getTipo())); }
                catch(org.springframework.web.server.ResponseStatusException ex) {
                    mensaje.setTipo("ia_denied");
                    messagingTemplate.convertAndSend("/topic/collab/"+salaId,mensaje); return;
                }
            }
            mensaje.setPayload(result);
            if ("ia_sync".equals(mensaje.getTipo())) mensaje.setTipo("ia_settings");
        }

        // CU-03 · Persistir el diagrama activo en memoria de la sala
        if ("diagrama".equalsIgnoreCase(mensaje.getTipo()) && mensaje.getPayload() != null) {
            mensaje.setPayload(revisiones.actualizarOficial(salaId, mensaje.getPayload(), principal == null ? null : principal.getName()));
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
            } catch (Exception ignored) {
            }
        }

        // Retransmitir la acción a todos los suscriptores del canal STOMP
        messagingTemplate.convertAndSend("/topic/collab/" + salaId, mensaje);
    }
}
