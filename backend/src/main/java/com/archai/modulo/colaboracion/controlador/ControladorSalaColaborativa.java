package com.archai.modulo.colaboracion.controlador;

import com.archai.modulo.autenticacion.dto.PerfilUsuarioDto;
import com.archai.modulo.colaboracion.dto.CrearSalaSolicitudDto;
import com.archai.modulo.colaboracion.dto.InfoSesionDto;
import com.archai.modulo.colaboracion.dto.MensajeColaboracionDto;
import com.archai.modulo.colaboracion.dto.UnirseSalaSolicitudDto;
import com.archai.modulo.colaboracion.servicio.ServicioSalaColaborativa;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * CU-03 — Crear y Unirse a Sala Colaborativa (STOMP).
 * Endpoints REST complementarios a la retransmisión en tiempo real por WebSocket STOMP.
 */
@RestController
@RequestMapping({"/api/v1/colaboracion", "/api/v1/collab"})
@RequiredArgsConstructor
public class ControladorSalaColaborativa {

    private final ServicioSalaColaborativa servicioSalaColaborativa;
    private final SimpMessagingTemplate messagingTemplate;

    /** CU-03 · Paso 1: el anfitrión crea la sala y recibe el PIN. */
    @PostMapping({"/salas", "/rooms", "/crear-sala"})
    public ResponseEntity<InfoSesionDto> crearSala(@RequestBody CrearSalaSolicitudDto solicitud) {
        InfoSesionDto sesion = servicioSalaColaborativa.crearSala(solicitud.getNombreSala(), solicitud.getAnfitrion(), solicitud.getPin());
        return ResponseEntity.ok(sesion);
    }

    /** CU-03 · Paso 2: un colaborador se une con el PIN compartido. */
    @PostMapping({"/salas/unirse", "/rooms/join", "/unirse-sala"})
    public ResponseEntity<InfoSesionDto> unirseSala(@RequestBody UnirseSalaSolicitudDto solicitud) {
        InfoSesionDto sesion = servicioSalaColaborativa.unirseSala(solicitud.getPin(), solicitud.getUsuario());
        
        // Broadcast presencial en tiempo real para clientes Web y Móviles conectados
        try {
            String pin = sesion.getRoomId();
            MensajeColaboracionDto avisoJoin = MensajeColaboracionDto.builder()
                    .salaId(pin)
                    .tipo("join")
                    .emisorId(solicitud.getUsuario() != null ? solicitud.getUsuario().getId() : "invitado")
                    .emisorNombre(solicitud.getUsuario() != null ? solicitud.getUsuario().getName() : "Colaborador")
                    .payload(Map.of("usuario", solicitud.getUsuario(), "participantes", sesion.getParticipants()))
                    .timestamp(System.currentTimeMillis())
                    .build();
            messagingTemplate.convertAndSend("/topic/collab/" + pin, avisoJoin);
            messagingTemplate.convertAndSend("/topic/room/" + pin + "/presence", sesion.getParticipants());
        } catch (Exception ignored) {}

        return ResponseEntity.ok(sesion);
    }

    /** CU-03 · Paso 3: un colaborador abandona la sala (retorno a selector o proyectos). */
    @PostMapping({"/salas/{pin}/salir", "/rooms/{pin}/leave"})
    public ResponseEntity<InfoSesionDto> salirDeSala(
            @PathVariable String pin,
            @RequestParam(required = false) String usuarioId,
            @RequestBody(required = false) Map<String, String> body) {

        String uid = (usuarioId != null && !usuarioId.trim().isEmpty())
                ? usuarioId
                : (body != null ? body.get("usuarioId") : null);

        InfoSesionDto sesion = servicioSalaColaborativa.salirDeSala(pin, uid);

        // Broadcast de desconexión limpia para reflejar cambio inmediato en Header y Píldora de Presencia
        try {
            MensajeColaboracionDto avisoLeave = MensajeColaboracionDto.builder()
                    .salaId(sesion.getRoomId())
                    .tipo("leave")
                    .emisorId(uid != null ? uid : "desconocido")
                    .emisorNombre("Colaborador")
                    .payload(Map.of("usuarioId", uid != null ? uid : "", "participantes", sesion.getParticipants()))
                    .timestamp(System.currentTimeMillis())
                    .build();
            messagingTemplate.convertAndSend("/topic/collab/" + sesion.getRoomId(), avisoLeave);
            messagingTemplate.convertAndSend("/topic/room/" + sesion.getRoomId() + "/presence", sesion.getParticipants());
        } catch (Exception ignored) {}

        return ResponseEntity.ok(sesion);
    }

    /** CU-03 · Consultar estado de una sala por PIN. */
    @GetMapping({"/salas/{pin}", "/rooms/{pin}"})
    public ResponseEntity<InfoSesionDto> consultarSala(@PathVariable String pin) {
        return ResponseEntity.ok(servicioSalaColaborativa.consultarSala(pin));
    }

    /** CU-03 · Listado de participantes activos en la sala. */
    @GetMapping({"/salas/{pin}/participantes", "/rooms/{pin}/participants"})
    public ResponseEntity<List<PerfilUsuarioDto>> listarParticipantes(@PathVariable String pin) {
        return ResponseEntity.ok(servicioSalaColaborativa.listarParticipantes(pin));
    }

    /** CU-03 · Listado de salas activas visibles para la cuenta (propias + invitadas por PIN). */
    @GetMapping("/salas")
    public ResponseEntity<List<String>> listarSalasActivas(@RequestParam(required = false) String usuarioId) {
        return ResponseEntity.ok(servicioSalaColaborativa.listarPinesActivos(usuarioId));
    }

    /** CU-03 · Obtener el diagrama activo de la sala para sincronización inicial al ingresar con PIN. */
    @GetMapping({"/salas/{pin}/diagrama", "/rooms/{pin}/diagram"})
    public ResponseEntity<Object> obtenerDiagramaSala(@PathVariable String pin) {
        Object diagrama = servicioSalaColaborativa.obtenerDiagramaDeSala(pin);
        return ResponseEntity.ok(diagrama != null ? diagrama : java.util.Map.of());
    }

    /** CU-03 · Actualizar o fijar el diagrama activo de la sala. */
    @PutMapping({"/salas/{pin}/diagrama", "/rooms/{pin}/diagram"})
    public ResponseEntity<Void> actualizarDiagramaSala(@PathVariable String pin, @RequestBody Object diagrama) {
        servicioSalaColaborativa.actualizarDiagramaDeSala(pin, diagrama);
        return ResponseEntity.ok().build();
    }
}