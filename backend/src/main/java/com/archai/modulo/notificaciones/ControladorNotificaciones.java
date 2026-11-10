package com.archai.modulo.notificaciones;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/notificaciones")
public class ControladorNotificaciones {

    private final ServicioNotificaciones service;

    @PutMapping("/dispositivos")
    public ObjectNode registrar(
        @RequestHeader(value = "Authorization", required = false) String auth,
        @RequestBody ObjectNode body
    ) {
        return service.registrar(auth, body);
    }

    @DeleteMapping("/dispositivos/{id}")
    public void eliminar(
        @PathVariable String id,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        service.desactivar(auth, id);
    }

    @GetMapping
    public List<ObjectNode> listar(
        @RequestHeader(value = "Authorization", required = false) String auth,
        @RequestParam(required = false) String roomId
    ) {
        return service.listar(auth, roomId);
    }

    @PutMapping("/{id}/leida")
    public void leer(@PathVariable String id, @RequestHeader(value = "Authorization", required = false) String auth) {
        service.leida(auth, id);
    }
}
