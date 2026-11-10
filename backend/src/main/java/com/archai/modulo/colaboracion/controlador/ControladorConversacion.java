package com.archai.modulo.colaboracion.controlador;

import com.archai.modulo.colaboracion.servicio.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/colaboracion/salas/{room}")
public class ControladorConversacion {

    private final ServicioConversacion chat;
    private final ServicioRevisionPropuesta reviews;

    @GetMapping("/sesion")
    public ObjectNode estado(
        @PathVariable String room,
        @RequestParam String diagramId,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        return chat.estado(room, diagramId, auth);
    }

    @GetMapping("/mensajes")
    public List<ObjectNode> mensajes(
        @PathVariable String room,
        @RequestParam String diagramId,
        @RequestParam(defaultValue = "0") long before,
        @RequestParam(defaultValue = "100") int limit,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        return chat.historial(room, diagramId, auth, before, limit);
    }

    @PostMapping("/mensajes")
    public ObjectNode enviar(
        @PathVariable String room,
        @RequestParam String diagramId,
        @RequestHeader(value = "Authorization", required = false) String auth,
        @RequestBody ObjectNode body
    ) {
        return chat.enviar(room, diagramId, auth, body);
    }

    @DeleteMapping("/mensajes/{messageId}")
    public void cancelar(
        @PathVariable String room,
        @PathVariable String messageId,
        @RequestParam String diagramId,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        chat.cancelar(room, diagramId, auth, messageId);
    }

    @GetMapping("/configuracion")
    public ObjectNode config(
        @PathVariable String room,
        @RequestParam String diagramId,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        return chat.configuracion(room, diagramId, auth);
    }

    @PutMapping("/configuracion")
    public ObjectNode configurar(
        @PathVariable String room,
        @RequestParam String diagramId,
        @RequestHeader(value = "Authorization", required = false) String auth,
        @RequestBody ObjectNode body
    ) {
        return chat.configurar(room, diagramId, auth, body);
    }

    @GetMapping("/modelos-locales")
    public List<String> modelos(
        @PathVariable String room,
        @RequestParam String diagramId,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        return chat.modelos(room, diagramId, auth);
    }

    @PostMapping("/sesion/guardar")
    public ObjectNode guardar(
        @PathVariable String room,
        @RequestParam String diagramId,
        @RequestHeader(value = "Authorization", required = false) String auth,
        @RequestBody(required = false) ObjectNode body
    ) {
        if (body != null && body.path("official").isObject()) reviews.actualizarOficialConToken(
            room,
            body.path("official"),
            auth
        );
        return reviews.guardarSesion(room, diagramId, auth);
    }

    @GetMapping("/sesion/puntos-control")
    public List<ObjectNode> checkpoints(
        @PathVariable String room,
        @RequestParam String diagramId,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        return reviews.puntosControl(room, diagramId, auth);
    }

    @PostMapping("/sesion/restaurar")
    public ObjectNode restore(
        @PathVariable String room,
        @RequestParam String diagramId,
        @RequestHeader(value = "Authorization", required = false) String auth,
        @RequestBody ObjectNode command
    ) {
        return reviews.restaurar(room, diagramId, auth, command);
    }

    @PostMapping("/actividad/generacion")
    public void artefacto(
        @PathVariable String room,
        @RequestParam String diagramId,
        @RequestHeader(value = "Authorization", required = false) String auth,
        @RequestBody ObjectNode body
    ) {
        chat.artefacto(room, diagramId, auth, body);
    }
}
