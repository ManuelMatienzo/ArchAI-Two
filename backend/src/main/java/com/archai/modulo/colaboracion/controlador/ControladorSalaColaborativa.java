package com.archai.modulo.colaboracion.controlador;

import com.archai.modulo.colaboracion.dto.CrearSalaSolicitudDto;
import com.archai.modulo.colaboracion.dto.InfoSesionDto;
import com.archai.modulo.colaboracion.dto.UnirseSalaSolicitudDto;
import com.archai.modulo.colaboracion.servicio.ServicioSalaColaborativa;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * CU-03 — Crear y Unirse a Sala Colaborativa (STOMP).
 * Endpoints REST complementarios a la retransmisión en tiempo real por WebSocket STOMP.
 */
@RestController
@RequestMapping({"/api/v1/colaboracion", "/api/v1/collab"})
@RequiredArgsConstructor
public class ControladorSalaColaborativa {

    private final ServicioSalaColaborativa servicioSalaColaborativa;
    private final com.archai.modulo.colaboracion.servicio.ServicioRevisionPropuesta revisiones;

    /** CU-03 · Paso 1: el anfitrión crea la sala y recibe el PIN. */
    @PostMapping({"/salas", "/rooms", "/crear-sala"})
    public ResponseEntity<InfoSesionDto> crearSala(@RequestBody CrearSalaSolicitudDto solicitud) {
        return ResponseEntity.ok(servicioSalaColaborativa.crearSala(solicitud.getNombreSala(), solicitud.getAnfitrion(), solicitud.getPin()));
    }

    /** CU-03 · Paso 2: un colaborador se une con el PIN compartido. */
    @PostMapping({"/salas/unirse", "/rooms/join", "/unirse-sala"})
    public ResponseEntity<InfoSesionDto> unirseSala(@RequestBody UnirseSalaSolicitudDto solicitud) {
        return ResponseEntity.ok(servicioSalaColaborativa.unirseSala(solicitud.getPin(), solicitud.getUsuario()));
    }

    /** CU-03 · Consultar estado de una sala por PIN. */
    @GetMapping({"/salas/{pin}", "/rooms/{pin}"})
    public ResponseEntity<InfoSesionDto> consultarSala(@PathVariable String pin) {
        return ResponseEntity.ok(servicioSalaColaborativa.consultarSala(pin));
    }

    /** CU-03 · Listado de salas activas (diagnóstico). */
    @GetMapping("/salas")
    public ResponseEntity<List<String>> listarSalasActivas() {
        return ResponseEntity.ok(servicioSalaColaborativa.listarPinesActivos());
    }

    /** CU-03 · Obtener el diagrama activo de la sala para sincronización inicial al ingresar con PIN. */
    @GetMapping({"/salas/{pin}/diagrama", "/rooms/{pin}/diagram"})
    public ResponseEntity<Object> obtenerDiagramaSala(@PathVariable String pin) {
        Object diagrama = servicioSalaColaborativa.obtenerDiagramaDeSala(pin);
        return ResponseEntity.ok(diagrama != null ? diagrama : java.util.Map.of());
    }

    /** CU-03 · Actualizar o fijar el diagrama activo de la sala. */
    @PutMapping({"/salas/{pin}/diagrama", "/rooms/{pin}/diagram"})
    public ResponseEntity<Void> actualizarDiagramaSala(@PathVariable String pin, @RequestBody Object diagrama, @RequestHeader(value="Authorization",required=false) String auth) {
        revisiones.actualizarOficialConToken(pin, diagrama, auth);
        return ResponseEntity.ok().build();
    }
}