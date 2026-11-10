package com.archai.modulo.colaboracion.controlador;

import com.archai.modulo.autenticacion.dto.PerfilUsuarioDto;
import com.archai.modulo.autenticacion.entidad.UsuarioEntity;
import com.archai.modulo.autenticacion.repositorio.UsuarioRepository;
import com.archai.modulo.colaboracion.dto.*;
import com.archai.modulo.colaboracion.servicio.*;
import com.archai.modulo.diagrama.repositorio.DiagramaRepository;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/colaboracion/salas")
public class ControladorEntradaSala {

    private final ServicioRevisionPropuesta reviews;
    private final ServicioSalaColaborativa rooms;
    private final DiagramaRepository diagrams;
    private final UsuarioRepository users;
    private final SimpMessagingTemplate broker;

    private PerfilUsuarioDto profile(UsuarioEntity u, String owner) {
        return PerfilUsuarioDto.builder()
            .id(u.getId())
            .name(u.getNombre())
            .username(u.getNombreUsuario())
            .email(u.getCorreo())
            .avatarColor(u.getColorAvatar())
            .role(u.getRol())
            .isHost(u.getId().equals(owner))
            .build();
    }

    @PostMapping("/abrir")
    public InfoSesionDto abrir(
        @RequestHeader(value = "Authorization", required = false) String auth,
        @RequestBody ObjectNode body
    ) throws java.security.NoSuchAlgorithmException {
        String user = reviews.usuario(auth),
            id = body.path("diagramId").asText();
        var d = diagrams
            .findForReview(id)
            .orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Guarda primero el diagrama del proyecto.")
            );
        reviews.puedeEditar(id, user); // Validates membership, including read-only members.
        var owner = d.getProyecto() != null ? d.getProyecto().getPropietario() : d.getCreador();
        if (owner == null) throw new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "El diagrama necesita un propietario."
        );
        String pin = body.path("roomId").asText();
        if (pin.isBlank()) {
            String hash = java.util.HexFormat.of().formatHex(
                java.security.MessageDigest.getInstance("SHA-256").digest(id.getBytes(StandardCharsets.UTF_8))
            );
            pin = "ARC-" + hash.substring(0, 8).toUpperCase(java.util.Locale.ROOT);
        }
        pin = pin.trim().toUpperCase(java.util.Locale.ROOT);
        InfoSesionDto session = rooms.abrirDiagrama(
            pin,
            d.getTitulo(),
            profile(owner, owner.getId()),
            profile(users.findById(user).orElseThrow(), owner.getId()),
            id,
            d.getProyecto() == null ? null : d.getProyecto().getId()
        );
        reviews.estado(pin, id, auth);
        broker.convertAndSend(
            "/topic/collab/" + pin,
            MensajeColaboracionDto.builder()
                .tipo("join")
                .salaId(pin)
                .emisorId(user)
                .emisorNombre(session.getCurrentUser().getName())
                .payload(
                    java.util.Map.of("usuario", session.getCurrentUser(), "participantes", session.getParticipants())
                )
                .timestamp(System.currentTimeMillis())
                .build()
        );
        broker.convertAndSend("/topic/room/" + pin + "/presence", session.getParticipants());
        return session;
    }
}
