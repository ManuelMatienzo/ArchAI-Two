package com.archai.modulo.ia.controlador;

import com.archai.modulo.ia.servicio.GatewayPropuestasNube;
import com.archai.modulo.colaboracion.servicio.ServicioRevisionPropuesta;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/colaboracion/salas/{salaId}/inferencia")
public class ControladorInferenciaNube {
    private final GatewayPropuestasNube gateway;
    private final ServicioRevisionPropuesta reviews;
    @GetMapping public Map<String,Object> config(@PathVariable String salaId,@RequestParam String diagramId,@RequestHeader(value="Authorization",required=false) String auth){reviews.autorizarInferencia(salaId,diagramId,auth);return gateway.config();}
    @PostMapping("/{id}") public ObjectNode infer(@PathVariable String salaId,@PathVariable String id,@RequestHeader(value="Authorization",required=false) String auth,@RequestBody ObjectNode options){return gateway.infer(salaId,id,auth,options);}
    @DeleteMapping("/{id}") public void cancel(@PathVariable String salaId,@PathVariable String id,@RequestHeader(value="Authorization",required=false) String auth){gateway.cancel(salaId,id,auth);}
}
