package com.archai.modulo.colaboracion.controlador;

import com.archai.modulo.colaboracion.servicio.ServicioRevisionPropuesta;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/colaboracion/salas/{salaId}/propuestas")
public class ControladorRevisionPropuesta {
    private final ServicioRevisionPropuesta servicio;
    @GetMapping
    public ObjectNode estado(@PathVariable String salaId,@RequestParam String diagramId,@RequestHeader(value="Authorization",required=false) String auth) {
        return servicio.estado(salaId,diagramId,auth);
    }
    @PostMapping
    public ObjectNode comando(@PathVariable String salaId,@RequestParam String diagramId,@RequestHeader(value="Authorization",required=false) String auth,@RequestBody ObjectNode command) {
        return servicio.comando(salaId,diagramId,auth,command);
    }
    @ExceptionHandler(org.springframework.dao.DataAccessException.class)
    public org.springframework.http.ResponseEntity<java.util.Map<String,String>> falloGuardado() {
        return org.springframework.http.ResponseEntity.status(503).body(java.util.Map.of("mensaje","No se pudo guardar la aprobación. Tu borrador se conserva; intenta nuevamente."));
    }

}
