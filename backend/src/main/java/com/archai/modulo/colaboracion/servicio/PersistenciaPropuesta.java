package com.archai.modulo.colaboracion.servicio;

import com.archai.modulo.diagrama.repositorio.DiagramaRepository;
import com.archai.modulo.diagrama.servicio.ServicioDiagrama;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class PersistenciaPropuesta {
    private final DiagramaRepository diagramas;
    private final ServicioDiagrama versiones;

    @Transactional
    public void guardar(String id, ObjectNode modelo, String autor, String operacion, String expectedStructure) {
        var entidad=diagramas.findForUpdate(id).orElseThrow(()->MotorBorrador.error("Guarda primero el diagrama del proyecto."));
        try {
            String stored=MotorBorrador.estructura(new com.fasterxml.jackson.databind.ObjectMapper().readTree(entidad.getJsonDiagrama()));
            if(!stored.equals(expectedStructure)) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"Otra sesión guardó este diagrama. Recupera y revisa el modelo actual antes de aprobar.");
        } catch(java.io.IOException ex) { throw new IllegalStateException("No se pudo recuperar el diagrama guardado.",ex); }
        entidad.setJsonDiagrama(modelo.toString());
        entidad.setTitulo(modelo.path("title").asText(entidad.getTitulo()));
        entidad.setFechaActualizacion(LocalDateTime.now());
        diagramas.saveAndFlush(entidad);
        versiones.crearVersion(id,"Propuesta IA", "Aprobación IA · operación "+operacion,autor);
    }
}
