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
    private final ServicioSalaColaborativa servicioSalaColaborativa;

    @MessageMapping("/collab/{salaId}")
    public void retransmitirAccionColaborativa(@DestinationVariable String salaId, @Payload MensajeColaboracionDto mensaje) {
        mensaje.setTimestamp(System.currentTimeMillis());

        // CU-03 · Persistir el diagrama activo en memoria de la sala
        if ("diagrama".equalsIgnoreCase(mensaje.getTipo()) && mensaje.getPayload() != null) {
            servicioSalaColaborativa.actualizarDiagramaDeSala(salaId, mensaje.getPayload());
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

        // CU-03 · Manejo de salida / abandono de sala
        if ("leave".equalsIgnoreCase(mensaje.getTipo()) || "salir".equalsIgnoreCase(mensaje.getTipo())) {
            try {
                servicioSalaColaborativa.salirDeSala(salaId, mensaje.getEmisorId());
                java.util.List<com.archai.modulo.autenticacion.dto.PerfilUsuarioDto> participantes = servicioSalaColaborativa.listarParticipantes(salaId);
                messagingTemplate.convertAndSend("/topic/room/" + salaId + "/presence", participantes);
            } catch (Exception ignored) {}
        }

        // Retransmitir la acción a todos los suscriptores del canal STOMP
        messagingTemplate.convertAndSend("/topic/collab/" + salaId, mensaje);
    }
}
