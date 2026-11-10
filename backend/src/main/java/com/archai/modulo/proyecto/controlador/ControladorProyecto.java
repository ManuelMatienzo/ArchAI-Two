package com.archai.modulo.proyecto.controlador;

import com.archai.modulo.proyecto.dto.*;
import com.archai.modulo.proyecto.servicio.ServicioProyecto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/v1/proyectos", "/api/v1/projects"})
@RequiredArgsConstructor
public class ControladorProyecto {

    private final ServicioProyecto servicioProyecto;

    @GetMapping
    public ResponseEntity<List<ProyectoDto>> listarProyectos(@RequestParam(required = false) String usuarioId) {
        return ResponseEntity.ok(servicioProyecto.listarProyectos(usuarioId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProyectoDto> obtenerPorId(@PathVariable String id) {
        return ResponseEntity.ok(servicioProyecto.obtenerProyectoPorId(id));
    }

    @PostMapping
    public ResponseEntity<ProyectoDto> crearProyecto(@RequestBody CrearProyectoSolicitudDto solicitud) {
        return ResponseEntity.ok(servicioProyecto.crearProyecto(solicitud));
    }

    /** CU-02 · Un colaborador se une al proyecto compartido mediante su código de acceso. */
    @PostMapping({"/unirse", "/join"})
    public ResponseEntity<ProyectoDto> unirseProyecto(@RequestBody UnirseProyectoSolicitudDto solicitud) {
        return ResponseEntity.ok(servicioProyecto.unirseProyectoPorCodigo(solicitud));
    }

    @PostMapping("/{id}/miembros")
    public ResponseEntity<MiembroProyectoDto> invitarMiembro(@PathVariable String id, @RequestBody InvitarMiembroDto solicitud) {
        return ResponseEntity.ok(servicioProyecto.invitarMiembro(id, solicitud));
    }

    @DeleteMapping("/{id}/miembros/{usuarioId}")
    public ResponseEntity<Void> removerMiembro(@PathVariable String id, @PathVariable String usuarioId) {
        servicioProyecto.removerMiembro(id, usuarioId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarProyecto(@PathVariable String id) {
        servicioProyecto.eliminarProyecto(id);
        return ResponseEntity.noContent().build();
    }
}
