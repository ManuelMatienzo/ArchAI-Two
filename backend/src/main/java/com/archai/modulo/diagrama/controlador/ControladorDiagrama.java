package com.archai.modulo.diagrama.controlador;

import com.archai.modulo.diagrama.dto.DiagramDto;
import com.archai.modulo.diagrama.dto.VersionDiagramaDto;
import com.archai.modulo.diagrama.servicio.ServicioDiagrama;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({ "/api/v1/diagrams", "/api/v1/diagramas" })
@RequiredArgsConstructor
public class ControladorDiagrama {

    private final ServicioDiagrama servicioDiagrama;
    private final com.archai.comun.seguridad.AccesoProyecto acceso;
    private final com.archai.modulo.diagrama.repositorio.DiagramaRepository diagramas;

    @GetMapping
    public ResponseEntity<List<DiagramDto>> listarDiagramas(
        @RequestParam(required = false) String proyectoId,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        String user = acceso.usuario(auth);
        if (proyectoId != null) acceso.proyecto(proyectoId, user, false, false);
        return ResponseEntity.ok(
            servicioDiagrama
                .listarDiagramas(proyectoId)
                .stream()
                .filter(d -> acceso.puedeLeer(d.getId(), user))
                .toList()
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<DiagramDto> obtenerDiagramaPorId(
        @PathVariable String id,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        acceso.diagrama(id, acceso.usuario(auth), false);
        return servicioDiagrama.obtenerPorId(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping({ "", "/save", "/guardar" })
    public ResponseEntity<DiagramDto> guardarDiagrama(
        @RequestBody DiagramDto diagram,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        String user = acceso.usuario(auth);
        diagram.setCreadorId(user);
        if (diagram.getId() != null && diagramas.existsById(diagram.getId())) {
            acceso.diagrama(diagram.getId(), user, true);
            var actual = diagramas.findForReview(diagram.getId()).orElseThrow();
            if (actual.getCreador() != null) diagram.setCreadorId(actual.getCreador().getId());
            if (
                actual.getProyecto() != null &&
                diagram.getProyectoId() != null &&
                !actual.getProyecto().getId().equals(diagram.getProyectoId())
            ) throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.CONFLICT,
                "No se puede cambiar el proyecto del diagrama durante el guardado."
            );
            if (actual.getProyecto() != null) diagram.setProyectoId(actual.getProyecto().getId());
        } else if (diagram.getProyectoId() != null) acceso.proyecto(diagram.getProyectoId(), user, true, false);
        return ResponseEntity.ok(servicioDiagrama.guardarDiagrama(diagram));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarDiagrama(
        @PathVariable String id,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        acceso.diagrama(id, acceso.usuario(auth), true);
        servicioDiagrama.eliminarDiagrama(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/versiones")
    public ResponseEntity<List<VersionDiagramaDto>> listarVersiones(
        @PathVariable String id,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        acceso.diagrama(id, acceso.usuario(auth), false);
        return ResponseEntity.ok(servicioDiagrama.listarVersiones(id));
    }

    @PostMapping("/{id}/versiones")
    public ResponseEntity<VersionDiagramaDto> crearVersion(
        @PathVariable String id,
        @RequestBody Map<String, String> body,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        String etiqueta = body != null ? body.get("etiqueta") : null;
        String descripcion = body != null ? body.get("descripcionCambio") : null;
        String autorId = acceso.usuario(auth);
        acceso.diagrama(id, autorId, true);
        return ResponseEntity.ok(servicioDiagrama.crearVersion(id, etiqueta, descripcion, autorId));
    }

    @PostMapping("/{id}/versiones/{versionId}/restaurar")
    public ResponseEntity<DiagramDto> restaurarVersion(
        @PathVariable String id,
        @PathVariable String versionId,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        acceso.diagrama(id, acceso.usuario(auth), true);
        return ResponseEntity.ok(servicioDiagrama.restaurarVersion(id, versionId));
    }

    /** CU-05 · Contexto conversacional del diagrama (chat, IA y propuestas resueltas). */
    @PutMapping("/{id}/contexto")
    public ResponseEntity<com.fasterxml.jackson.databind.node.ObjectNode> guardarContexto(
        @PathVariable String id,
        @RequestBody com.fasterxml.jackson.databind.node.ObjectNode contexto,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        acceso.diagrama(id, acceso.usuario(auth), true);
        return ResponseEntity.ok(servicioDiagrama.guardarContexto(id, contexto));
    }

    @GetMapping("/{id}/contexto")
    public ResponseEntity<?> obtenerContexto(
        @PathVariable String id,
        @RequestHeader(value = "Authorization", required = false) String auth
    ) {
        acceso.diagrama(id, acceso.usuario(auth), false);
        return servicioDiagrama
            .obtenerContexto(id)
            .<ResponseEntity<?>>map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
