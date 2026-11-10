package com.archai.modulo.proyecto.controlador;

import com.archai.modulo.proyecto.dto.*;
import com.archai.modulo.proyecto.servicio.ServicioProyecto;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({ "/api/v1/proyectos", "/api/v1/projects" })
@RequiredArgsConstructor
public class ControladorProyecto {

    private final ServicioProyecto servicioProyecto;
    private final com.archai.comun.seguridad.AccesoProyecto acceso;

    @GetMapping
    public ResponseEntity<List<ProyectoDto>> listarProyectos(
        @RequestParam(required = false) String usuarioId,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        return ResponseEntity.ok(servicioProyecto.listarProyectos(acceso.usuario(auth)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProyectoDto> obtenerPorId(
        @PathVariable String id,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        acceso.proyecto(id, acceso.usuario(auth), false, false);
        return ResponseEntity.ok(servicioProyecto.obtenerProyectoPorId(id));
    }

    @PostMapping
    public ResponseEntity<ProyectoDto> crearProyecto(
        @RequestBody CrearProyectoSolicitudDto solicitud,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        solicitud.setPropietarioId(acceso.usuario(auth));
        return ResponseEntity.ok(servicioProyecto.crearProyecto(solicitud));
    }

    /** CU-02 · Un colaborador se une al proyecto compartido mediante su código de acceso. */
    @PostMapping({ "/unirse", "/join" })
    public ResponseEntity<ProyectoDto> unirseProyecto(
        @RequestBody UnirseProyectoSolicitudDto solicitud,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        solicitud.setUsuarioId(acceso.usuario(auth));
        return ResponseEntity.ok(servicioProyecto.unirseProyectoPorCodigo(solicitud));
    }

    @PostMapping("/{id}/miembros")
    public ResponseEntity<MiembroProyectoDto> invitarMiembro(
        @PathVariable String id,
        @RequestBody InvitarMiembroDto solicitud,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        acceso.proyecto(id, acceso.usuario(auth), true, true);
        return ResponseEntity.ok(servicioProyecto.invitarMiembro(id, solicitud));
    }

    @DeleteMapping("/{id}/miembros/{usuarioId}")
    public ResponseEntity<Void> removerMiembro(
        @PathVariable String id,
        @PathVariable String usuarioId,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        acceso.proyecto(id, acceso.usuario(auth), true, true);
        servicioProyecto.removerMiembro(id, usuarioId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarProyecto(
        @PathVariable String id,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        acceso.proyecto(id, acceso.usuario(auth), true, true);
        servicioProyecto.eliminarProyecto(id);
        return ResponseEntity.noContent().build();
    }
}
