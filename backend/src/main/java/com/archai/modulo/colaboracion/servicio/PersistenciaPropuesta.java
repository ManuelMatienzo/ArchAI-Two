package com.archai.modulo.colaboracion.servicio;

import com.archai.modulo.diagrama.repositorio.DiagramaRepository;
import com.archai.modulo.diagrama.servicio.ServicioDiagrama;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PersistenciaPropuesta {

    private final DiagramaRepository diagramas;
    private final ServicioDiagrama versiones;
    private final com.archai.modulo.persistencia.servicio.AlmacenDocumental documentos;

    @Transactional
    public void guardarConSesion(
        String id,
        ObjectNode modelo,
        String autor,
        String operacion,
        String expectedStructure,
        String room,
        ObjectNode sesion,
        String eventType,
        String proposalId
    ) {
        guardar(id, modelo, autor, operacion, expectedStructure);
        documentos.guardar("revision_propuestas", room, sesion);
        String eventId = "review-" + operacion;
        var event = com.fasterxml.jackson.databind.node.JsonNodeFactory.instance
            .objectNode()
            .put("id", eventId)
            .put("roomId", room)
            .put("diagramId", id)
            .put("type", eventType)
            .put("status", "pending")
            .put("createdAt", java.time.Instant.now().toString());
        event.putObject("detail").put("authorId", autor).put("proposalId", proposalId);
        documentos.guardar("eventos_notificacion", eventId, event);
    }

    @Transactional
    public void guardar(String id, ObjectNode modelo, String autor, String operacion, String expectedStructure) {
        var entidad = diagramas
            .findForUpdate(id)
            .orElseThrow(() -> MotorBorrador.error("Guarda primero el diagrama del proyecto."));
        try {
            String stored = MotorBorrador.estructura(
                new com.fasterxml.jackson.databind.ObjectMapper().readTree(entidad.getJsonDiagrama())
            );
            if (!stored.equals(expectedStructure)) throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.CONFLICT,
                "Otra sesión guardó este diagrama. Recupera y revisa el modelo actual antes de aprobar."
            );
        } catch (java.io.IOException ex) {
            throw new IllegalStateException("No se pudo recuperar el diagrama guardado.", ex);
        }
        entidad.setJsonDiagrama(modelo.toString());
        entidad.setTitulo(modelo.path("title").asText(entidad.getTitulo()));
        entidad.setFechaActualizacion(LocalDateTime.now());
        diagramas.saveAndFlush(entidad);
        versiones.crearVersion(id, "Revisión colaborativa", "Cambio compartido · operación " + operacion, autor);
    }
}
